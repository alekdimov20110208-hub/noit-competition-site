import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth/auth.ts";
import { readDevelopmentAccounts } from "../src/auth/development-accounts.ts";
import { EnvironmentError, readServerEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import type { TransactionPool } from "../src/db/transaction.ts";
import {
  bootstrapDevelopmentEvent,
  readBootstrapConfig,
} from "../src/development/bootstrap.ts";
import type { TaskDto } from "../src/tasks/model.ts";
import { createTaskService } from "../src/tasks/service.ts";

// Explicit development-only verification. Real cookie jars stay in memory;
// task changes/history intentionally persist in the separate development Event.
let pool: ReturnType<typeof createDatabasePool> | undefined;
const apps: ReturnType<typeof createApp>[] = [];
const pendingLogout = new Set<string>();
let origin = "",
  base = "",
  stage = "configuration";
let fixtureClient: PoolClient | undefined;
let fixtureOpen = false;
const logs: string[] = [];
async function http(
  url: string,
  method = "GET",
  cookie?: string,
  body?: object,
  endpoint = base,
) {
  return fetch(`${endpoint}${url}`, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function endpoint(app: ReturnType<typeof createApp>) {
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}
try {
  const config = readServerEnv();
  origin = config.betterAuthUrl;
  if (config.nodeEnv !== "development")
    throw new EnvironmentError(
      "Responsibility verification is DEVELOPMENT ONLY.",
    );
  const accounts = readDevelopmentAccounts();
  pool = createDatabasePool(config, () => {});
  const database = pool;
  const auth = createAuth(database, config);
  const makeApp = (tasks: ReturnType<typeof createTaskService>) =>
    createApp({
      tasks,
      authentication: { auth, baseURL: origin },
      checkDatabase: async () => {
        await database.query("SELECT 1");
      },
      logger: {
        stream: {
          write: (line) => {
            logs.push(line);
          },
        },
      },
    });
  const app = makeApp(createTaskService(database));
  apps.push(app);
  base = await endpoint(app);
  stage = "bootstrap";
  const setup = await bootstrapDevelopmentEvent(
    database,
    readBootstrapConfig(),
  );
  const rerun = await bootstrapDevelopmentEvent(
    database,
    readBootstrapConfig(),
  );
  assert.ok(rerun.results.every((item) => item.result === "already-exists"));
  assert.equal(rerun.eventId, setup.eventId);
  console.info(
    "Development Event and active Organizer/Member memberships: PASS; bootstrap rerun already-exists.",
  );
  const path = `/api/events/${setup.eventId}/tasks/${setup.taskId}`;
  assert.equal((await http(path)).status, 401);
  const cookies: string[] = [];
  const identities: { id: string; sessions: number }[] = [];
  for (const account of accounts) {
    stage = `${account.label} sign-in`;
    const user = (
      await database.query(
        'SELECT id FROM public."user" WHERE email=$1 AND active=TRUE',
        [account.email],
      )
    ).rows[0];
    assert.ok(user);
    const sessions = (
      await database.query(
        'SELECT COUNT(*)::INT AS count FROM public.session WHERE "userId"=$1',
        [user.id],
      )
    ).rows[0].count as number;
    identities.push({ id: user.id as string, sessions });
    const signin = await http("/api/auth/sign-in/email", "POST", undefined, {
      email: account.email,
      password: account.password,
    });
    assert.equal(signin.status, 200);
    const setCookies = signin.headers.getSetCookie();
    assert.ok(
      setCookies.some(
        (value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value),
      ),
    );
    const cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
    cookies.push(cookie);
    pendingLogout.add(cookie);
    const me = await http("/api/me", "GET", cookie);
    assert.equal(me.status, 200);
    const data = (await me.json()) as { user: { id: string } };
    assert.equal(data.user.id, user.id);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    assert.equal(session?.user.id, user.id);
    assert.equal(
      (
        await database.query(
          'SELECT COUNT(*)::INT AS count FROM public.session WHERE "userId"=$1',
          [user.id],
        )
      ).rows[0].count,
      sessions + 1,
    );
    console.info(
      `Real ${account.label} HTTP sign-in, safe identity and database session: PASS.`,
    );
  }
  const organizerCookie = cookies[0]!,
    memberCookie = cookies[1]!;
  assert.notEqual(organizerCookie, memberCookie);
  const read = async (cookie: string) => {
    const response = await http(path, "GET", cookie);
    assert.equal(response.status, 200);
    return ((await response.json()) as { task: TaskDto }).task;
  };
  let task = await read(organizerCookie);
  assert.equal((await read(memberCookie)).id, task.id);
  assert.equal(task.deadline, "2026-10-04");
  const mutate = async (
    cookie: string,
    kind: "assignment" | "acceptance" | "status",
    body: object,
    expected = 200,
  ) => {
    const response = await http(
      `${path}/${kind}`,
      kind === "assignment" ? "POST" : kind === "acceptance" ? "PUT" : "PATCH",
      cookie,
      { ...body, expectedVersion: task.version },
    );
    assert.equal(response.status, expected);
    if (expected === 200)
      task = ((await response.json()) as { task: TaskDto }).task;
  };
  const state = async () =>
    (
      await database.query(
        "SELECT assigned_member_id, accepted_by_member_id, accepted_at, version, status FROM public.task WHERE event_id=$1 AND id=$2",
        [setup.eventId, setup.taskId],
      )
    ).rows[0];
  const history = async () =>
    (
      await database.query(
        "SELECT action_type, actor_user_id, actor_member_id, payload FROM public.activity_entry WHERE event_id=$1 AND target_id=$2 ORDER BY (payload->>'taskVersion')::INTEGER",
        [setup.eventId, setup.taskId],
      )
    ).rows;
  // Reruns resolve the previous verification state via public commands, not resets.
  stage = "assignment";
  await mutate(organizerCookie, "assignment", { assignedMemberId: null });
  await mutate(organizerCookie, "status", { status: "not-started" });
  await mutate(
    memberCookie,
    "assignment",
    { assignedMemberId: setup.memberId },
    403,
  );
  await mutate(organizerCookie, "assignment", {
    assignedMemberId: setup.memberId,
  });
  assert.equal((await read(memberCookie)).assignedMemberId, setup.memberId);
  assert.equal((await state()).assigned_member_id, setup.memberId);
  console.info(
    "Real Organizer assignment and Member refetch: PASS; Member assignment denied 403.",
  );
  stage = "acceptance and actor/time forgery";
  await mutate(organizerCookie, "acceptance", { accepted: true }, 403);
  for (const field of [
    "actorUserId",
    "actorMemberId",
    "acceptedByMemberId",
    "acceptedAt",
    "accessRole",
    "history",
  ])
    await mutate(
      memberCookie,
      "acceptance",
      { accepted: true, [field]: "FORGED_INPUT" },
      400,
    );
  await mutate(memberCookie, "acceptance", { accepted: true });
  assert.equal(task.acceptedByMemberId, setup.memberId);
  assert.ok(task.acceptedAt);
  const acceptance = task.acceptedAt;
  assert.equal((await state()).accepted_at.toISOString(), acceptance);
  assert.equal((await read(organizerCookie)).acceptedAt, acceptance);
  const entry = (await history()).at(-1);
  assert.equal(entry?.action_type, "task.accepted");
  assert.equal(entry?.actor_user_id, identities[1]?.id);
  assert.equal(entry?.actor_member_id, setup.memberId);
  // Current-version idempotency must not overwrite the original instant.
  const acceptedVersion = task.version;
  await mutate(memberCookie, "acceptance", { accepted: true });
  assert.equal(task.version, acceptedVersion);
  assert.equal(task.acceptedAt, acceptance);
  await mutate(memberCookie, "status", { status: "in-progress" });
  assert.equal(task.acceptedAt, acceptance);
  console.info(
    "Real Member acceptance, server actor/time, Organizer refetch and Member progress: PASS; impersonation 403; forged metadata 400.",
  );
  stage = "stale write and withdrawal";
  const stale = await http(`${path}/acceptance`, "PUT", memberCookie, {
    accepted: true,
    expectedVersion: acceptedVersion,
  });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), {
    status: "error",
    code: "TASK_VERSION_CONFLICT",
  });
  await mutate(organizerCookie, "acceptance", { accepted: false }, 403);
  await mutate(memberCookie, "acceptance", { accepted: false });
  assert.equal((await state()).accepted_at, null);
  await mutate(memberCookie, "acceptance", { accepted: true });
  stage = "reassignment and unassignment";
  await mutate(organizerCookie, "assignment", {
    assignedMemberId: setup.organizerMemberId,
  });
  const reassigned = await state();
  assert.equal(reassigned.assigned_member_id, setup.organizerMemberId);
  assert.equal(reassigned.accepted_by_member_id, null);
  assert.equal(reassigned.accepted_at, null);
  const reassignment = (await history()).at(-1);
  assert.equal(reassignment?.action_type, "task.reassigned");
  assert.equal(reassignment?.payload.acceptanceCleared, true);
  assert.equal(
    reassignment?.payload.previousAcceptedByMemberId,
    setup.memberId,
  );
  await mutate(memberCookie, "status", { status: "completed" }, 403);
  await mutate(memberCookie, "acceptance", { accepted: true }, 403);
  await mutate(organizerCookie, "acceptance", { accepted: true });
  await mutate(organizerCookie, "assignment", { assignedMemberId: null });
  assert.equal((await state()).assigned_member_id, null);
  assert.equal((await state()).accepted_at, null);
  await mutate(organizerCookie, "assignment", {
    assignedMemberId: setup.memberId,
  });
  assert.equal((await read(memberCookie)).accepted, false);
  assert.ok(
    (await history()).some(
      (row) =>
        row.action_type === "task.accepted" &&
        row.payload.acceptedAt === acceptance,
    ),
  );
  console.info(
    "Withdrawal/reacceptance, reassignment/unassignment atomic clearing, old-assignee denial and preserved acceptance history: PASS; assign-back remains unaccepted.",
  );
  stage = "two simultaneous versioned writes";
  const countBeforeRace = (await history()).length,
    versionBeforeRace = task.version;
  const race = await Promise.all([
    http(`${path}/status`, "PATCH", organizerCookie, {
      status: "blocked",
      expectedVersion: versionBeforeRace,
    }),
    http(`${path}/status`, "PATCH", memberCookie, {
      status: "completed",
      expectedVersion: versionBeforeRace,
    }),
  ]);
  assert.deepEqual(race.map((response) => response.status).sort(), [200, 409]);
  task = await read(memberCookie);
  assert.equal(task.version, versionBeforeRace + 1);
  assert.equal((await history()).length, countBeforeRace + 1);
  console.info(
    "Real stale retry 409 and concurrent two-session writes: exactly one 200 / one 409, one version/history increment PASS.",
  );

  stage = "foreign Event/task/member HTTP probes";
  fixtureClient = await database.connect();
  const fixture = fixtureClient;
  fixture.on("error", () => {});
  await fixture.query("BEGIN");
  fixtureOpen = true;
  const foreignUser = `p1c-http-${randomUUID()}`,
    eventA = randomUUID(),
    eventB = randomUUID(),
    memberA = randomUUID(),
    organizerA = randomUUID(),
    memberB = randomUUID(),
    taskA = randomUUID(),
    taskB = randomUUID();
  await fixture.query(
    `INSERT INTO public."user" (id,name,email,"emailVerified",active,"createdAt","updatedAt") VALUES ($1,'Disposable foreign identity',$2,FALSE,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [foreignUser, `${foreignUser}@example.invalid`],
  );
  for (const [event, owner] of [
    [eventA, identities[0]!.id],
    [eventB, foreignUser],
  ])
    await fixture.query(
      `INSERT INTO public.event (id,name,start_date,end_date,timezone,owner_user_id) VALUES ($1,'Disposable HTTP Event','2026-10-03','2026-10-04','Europe/Sofia',$2)`,
      [event, owner],
    );
  for (const [id, event, user, role] of [
    [organizerA, eventA, identities[0]!.id, "ORGANIZER"],
    [memberA, eventA, identities[1]!.id, "MEMBER"],
    [memberB, eventB, foreignUser, "ORGANIZER"],
  ])
    await fixture.query(
      "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES ($1,$2,$3,$4,'Organizer')",
      [id, event, user, role],
    );
  for (const [id, event, actor] of [
    [taskA, eventA, organizerA],
    [taskB, eventB, memberB],
  ])
    await fixture.query(
      "INSERT INTO public.task(id,event_id,title,deadline,created_by,updated_by) VALUES ($1,$2,'Disposable HTTP task','2026-10-04',$3,$3)",
      [id, event, actor],
    );
  // Commands remain real SQL transactions via savepoints in this rollback-only
  // fixture. Concurrent verification above used independent real pg clients.
  const fixturePool: TransactionPool = {
    async connect() {
      return {
        on: (event, listener) => fixture.on(event, listener),
        removeListener: (event, listener) =>
          fixture.removeListener(event, listener),
        release: () => {},
        async query(sql, values) {
          if (sql === "BEGIN")
            return fixture.query("SAVEPOINT p1c_http_command");
          if (sql === "COMMIT")
            return fixture.query("RELEASE SAVEPOINT p1c_http_command");
          if (sql === "ROLLBACK") {
            await fixture.query("ROLLBACK TO SAVEPOINT p1c_http_command");
            return fixture.query("RELEASE SAVEPOINT p1c_http_command");
          }
          return fixture.query(sql, values);
        },
      };
    },
  };
  const foreignApp = makeApp(createTaskService(fixturePool));
  apps.push(foreignApp);
  const foreignBase = await endpoint(foreignApp);
  for (const cookie of cookies) {
    assert.equal(
      (
        await http(
          `/api/events/${eventA}/tasks/${taskB}`,
          "GET",
          cookie,
          undefined,
          foreignBase,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await http(
          `/api/events/${eventB}/tasks/${taskB}`,
          "GET",
          cookie,
          undefined,
          foreignBase,
        )
      ).status,
      404,
    );
  }
  assert.equal(
    (
      await http(
        `/api/events/${eventA}/tasks/${taskB}/status`,
        "PATCH",
        organizerCookie,
        { status: "blocked", expectedVersion: 1 },
        foreignBase,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await http(
        `/api/events/${eventA}/tasks/${taskA}/assignment`,
        "POST",
        organizerCookie,
        { assignedMemberId: memberB, expectedVersion: 1 },
        foreignBase,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await http(
        `/api/events/${eventA}/tasks/${taskA}/assignment`,
        "POST",
        memberCookie,
        { assignedMemberId: memberA, expectedVersion: 1 },
        foreignBase,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fixture.query(
        "SELECT version FROM public.task WHERE event_id=$1 AND id=$2",
        [eventA, taskA],
      )
    ).rows[0].version,
    1,
  );
  await foreignApp.close();
  await fixture.query("ROLLBACK");
  fixtureOpen = false;
  assert.equal(
    (
      await fixture.query(
        'SELECT COUNT(*)::INT AS count FROM public."user" WHERE id=$1',
        [foreignUser],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await fixture.query(
        "SELECT COUNT(*)::INT AS count FROM public.event WHERE id=ANY($1::UUID[])",
        [[eventA, eventB]],
      )
    ).rows[0].count,
    0,
  );
  fixture.release();
  fixtureClient = undefined;
  console.info(
    "Real two-session foreign Event/task/member denial 404, operationalRole non-authority 403, unchanged DB state and disposable fixture rollback: PASS.",
  );
  stage = "logout and session isolation";
  for (let index = 0; index < cookies.length; index++) {
    const cookie = cookies[index]!;
    assert.equal(
      (await http("/api/auth/sign-out", "POST", cookie, {})).status,
      200,
    );
    pendingLogout.delete(cookie);
    assert.equal((await http(path, "GET", cookie)).status, 401);
    if (index === 0)
      assert.equal((await http(path, "GET", memberCookie)).status, 200);
    const user = identities[index]!;
    assert.equal(
      (
        await database.query(
          'SELECT COUNT(*)::INT AS count FROM public.session WHERE "userId"=$1',
          [user.id],
        )
      ).rows[0].count,
      user.sessions,
    );
  }
  for (const secret of [
    config.databaseUrl,
    config.betterAuthSecret,
    ...accounts.flatMap((account) => [account.password, account.email]),
    ...cookies,
  ])
    assert.equal(logs.join("").includes(secret), false);
  for (const cookie of cookies)
    for (const item of cookie.split("; ")) {
      const value = item.slice(item.indexOf("=") + 1);
      assert.equal(logs.join("").includes(value), false);
      assert.equal(logs.join("").includes(decodeURIComponent(value)), false);
    }
  console.info(
    "Real isolated logout/session cleanup and credential-safe logs: PASS. Responsibility workflow verification: PASS.",
  );
} catch (error) {
  console.error(
    error instanceof EnvironmentError
      ? error.message
      : `Responsibility verification failed at ${stage}; credential/session/database details omitted.`,
  );
  if (
    error instanceof assert.AssertionError &&
    typeof error.actual === "number" &&
    typeof error.expected === "number"
  )
    console.error(
      `Numeric result: expected ${error.expected}, received ${error.actual}.`,
    );
  process.exitCode = 1;
} finally {
  if (fixtureClient) {
    let destroy = false;
    try {
      if (fixtureOpen) await fixtureClient.query("ROLLBACK");
    } catch {
      destroy = true;
      process.exitCode = 1;
    }
    fixtureClient.release(destroy);
  }
  for (const cookie of pendingLogout) {
    try {
      assert.equal(
        (await http("/api/auth/sign-out", "POST", cookie, {})).status,
        200,
      );
    } catch {
      console.error("Verification session cleanup failed; details omitted.");
      process.exitCode = 1;
    }
  }
  for (const app of apps)
    try {
      await app.close();
    } catch {
      console.error("HTTP cleanup failed; details omitted.");
      process.exitCode = 1;
    }
  try {
    await pool?.end();
  } catch {
    console.error("Database cleanup failed; details omitted.");
    process.exitCode = 1;
  }
}

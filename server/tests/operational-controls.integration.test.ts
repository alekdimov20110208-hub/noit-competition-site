import assert from "node:assert/strict";
import test from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import type pg from "pg";
import { createApp } from "../src/app.ts";
import { createApplicationServices } from "../src/runtime.ts";
import { createEmailOutbox } from "../src/email/outbox.ts";
import {
  createSharedControls,
  OperationalError,
} from "../src/operations/limits.ts";
import { createInvitationService } from "../src/invitations/service.ts";
import {
  inTransaction,
  TransactionOutcomeUnknownError,
} from "../src/db/transaction.ts";
import {
  decryptEmail,
  encryptEmail,
  privateIdentifier,
} from "../src/operations/crypto.ts";
import { runtimeDisposableDatabase } from "./helpers/runtime-disposable.ts";
import { syntheticOperationalSecrets } from "./helpers/operational-secrets.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";

const origin = "https://www.budograph.com";
const scopes = new AsyncLocalStorage<{ active: number; peak: number }>();
function observed(pool: pg.Pool) {
  const connect = pool.connect.bind(pool);
  let active = 0,
    peak = 0;
  pool.on("acquire", () => {
    active++;
    peak = Math.max(peak, active);
  });
  pool.on("release", () => {
    active--;
  });
  const wrap = (client: pg.PoolClient) => {
    const scope = scopes.getStore();
    if (scope) {
      scope.active++;
      scope.peak = Math.max(scope.peak, scope.active);
    }
    let released = false;
    return new Proxy(client, {
      get(target, key) {
        if (key === "release")
          return (destroy?: boolean) => {
            if (!released) {
              released = true;
              if (scope) scope.active--;
            }
            target.release(destroy);
          };
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  type Callback = (
    error: Error | undefined,
    client?: pg.PoolClient,
    release?: (destroy?: boolean) => void,
  ) => void;
  pool.connect = ((callback?: Callback) => {
    const result = connect().then(wrap);
    if (!callback) return result;
    void result.then(
      (client) => callback(undefined, client, client.release.bind(client)),
      (error) => callback(error),
    );
  }) as pg.Pool["connect"];
  return {
    get active() {
      return active;
    },
    get peak() {
      return peak;
    },
  };
}
async function waitFor(predicate: () => boolean | Promise<boolean>) {
  const end = Date.now() + 5000;
  while (!(await predicate())) {
    if (Date.now() > end) throw Error("Bounded deterministic barrier failed.");
    await new Promise((r) => setTimeout(r, 5));
  }
}
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function jwt(email: string, secret: string, seconds = 3600) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + seconds,
    }),
  ).toString("base64url");
  return `${head}.${payload}.${createHmac("sha256", secret).update(`${head}.${payload}`).digest("base64url")}`;
}

test(
  "V1-C4 actual PostgreSQL outbox, shared limits and account safety",
  { skip: !process.env.V1C_OWNER_FILE, timeout: 240000 },
  async (t) => {
    const db = await runtimeDisposableDatabase(),
      poolA = db.runtime(2),
      poolB = db.runtime(2),
      control = db.runtime(1);
    const a = observed(poolA),
      b = observed(poolB),
      secrets = syntheticOperationalSecrets();
    const config = {
      ...db.config,
      nodeEnv: "production" as const,
      host: "127.0.0.1",
      port: 1,
      betterAuthSecret: randomBytes(32).toString("hex"),
      betterAuthUrl: origin,
      publicAppUrl: origin,
      emailMode: "resend" as const,
      emailFrom: "no-reply@example.invalid",
      resendApiKey: "re_" + randomBytes(20).toString("hex"),
      operations: secrets,
    };
    const labels: string[] = [],
      attempts: { key: string; body: string }[] = [],
      accepted = new Map<string, string>();
    const messages: { to: string[]; text: string }[] = [];
    let outcome = "success",
      entered = gate(),
      resume = gate();
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(
          String(url),
          "https://api.resend.com/emails",
          "Any other outbound HTTP is forbidden",
        );
        assert.equal(
          scopes.getStore()?.active ?? 0,
          0,
          "Network email must hold no SQL lease",
        );
        const key = new Headers(init?.headers).get("idempotency-key")!,
          body = String(init?.body);
        assert.match(key, /^budograph-email\/v1\/[a-f0-9]{64}$/);
        attempts.push({ key, body });
        if (accepted.has(key))
          assert.ok(
            accepted.get(key) === body,
            "Idempotency payload must never change",
          );
        if (outcome === "hold") {
          entered.resolve();
          await resume.promise;
        }
        if (outcome === "timeout")
          throw new Error(
            "Synthetic timeout; private provider details omitted",
          );
        if (outcome === "429")
          return new Response("{}", {
            status: 429,
            headers: { "retry-after": "60" },
          });
        if (outcome === "500") return new Response("{}", { status: 500 });
        if (outcome === "403") return new Response("{}", { status: 403 });
        if (outcome === "409") return new Response("{}", { status: 409 });
        if (outcome === "malformed")
          return new Response('{"accepted":"unknown"}');
        if (outcome === "oversized") return new Response("x".repeat(9000));
        if (!accepted.has(key)) {
          accepted.set(key, body);
          messages.push(JSON.parse(body));
        }
        if (outcome === "lost-ack")
          throw new Error("Synthetic provider accepted, acknowledgement lost");
        return new Response(JSON.stringify({ id: randomUUID() }));
      },
    );
    const servicesA = createApplicationServices(
      poolA,
      config,
      { submit: (work) => work() },
      (kind) => labels.push(kind),
    );
    const servicesB = createApplicationServices(
      poolB,
      config,
      { submit: (work) => work() },
      (kind) => labels.push(kind),
    );
    const appA = createApp({ production: true, ...servicesA }),
      appB = createApp({ production: true, ...servicesB });
    const outA = servicesA.email!,
      outB = servicesB.email!;
    const limitsA = servicesA.authentication!.controls!,
      limitsB = servicesB.authentication!.controls!;
    await Promise.all([appA.ready(), appB.ready()]);
    const fixtureClient = await db.migrator.connect();
    const f = await createPostgresFixture(fixtureClient).finally(() =>
      fixtureClient.release(),
    );
    const org = {
      id: f.organizerUser,
      name: "Synthetic C4 fixture",
      email: `${f.organizerUser}@example.invalid`,
    };
    const address = () => `c4-${randomUUID()}@example.invalid`;
    const invite = (email = address()) =>
      servicesA.invitations!.create(org, f.eventId, { email }, "en");
    const row = async (id: string) =>
      (
        await db.migrator.query(
          "SELECT * FROM budograph_private.email_outbox WHERE id=$1",
          [id],
        )
      ).rows[0];
    const count = async (table: string) =>
      (
        await db.migrator.query(
          `SELECT count(*)::int AS n FROM budograph_private.${table}`,
        )
      ).rows[0].n as number;
    const clearLimits = () =>
      db.migrator.query("DELETE FROM budograph_private.rate_counter");
    const due = (id: string) =>
      db.migrator.query(
        "UPDATE budograph_private.email_outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [id],
      );
    const run = async <T>(work: () => Promise<T>) => {
      const scope = { active: 0, peak: 0 };
      const result = await scopes.run(scope, work);
      assert.equal(scope.active, 0);
      assert.ok(scope.peak <= 1);
      return result;
    };
    let peer = 10;
    const post = (
      app: typeof appA,
      path: string,
      payload: unknown,
      cookie = "",
      ip = `127.4.0.${peer++}`,
      headers: Record<string, string> = {},
    ) =>
      app.inject({
        method: "POST",
        url: path.startsWith("/api/") ? path : `/api/auth/${path}`,
        remoteAddress: ip,
        headers: { origin, cookie, ...headers },
        payload: payload as Record<string, unknown>,
      });
    const cookieOf = (r: { headers: Record<string, unknown> }) =>
      [r.headers["set-cookie"]]
        .flat()
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.split(";")[0])
        .join("; ");
    const link = (email: string, kind = "verify-email") =>
      new URL(
        messages
          .filter(
            (m) => m.to.includes(email) && m.text.includes(`/api/auth/${kind}`),
          )
          .at(-1)!
          .text.match(/https:\/\/www\.budograph\.com\/[^\s<>"']+/)![0],
      );
    t.afterEach(async () => {
      outcome = "success";
      resume.resolve();
      await waitFor(() => a.active === 0 && b.active === 0);
      await clearLimits();
    });
    try {
      await t.test(
        "private tables deny direct runtime/browser reads/writes; only bounded reviewed functions execute",
        async () => {
          for (const name of ["email_outbox", "rate_counter"]) {
            for (const sql of [
              `SELECT * FROM budograph_private.${name}`,
              `INSERT INTO budograph_private.${name} DEFAULT VALUES`,
              `UPDATE budograph_private.${name} SET ${name === "email_outbox" ? "state=state" : "count=count"}`,
              `DELETE FROM budograph_private.${name}`,
              `TRUNCATE budograph_private.${name}`,
            ])
              await assert.rejects(poolA.query(sql), { code: "42501" });
          }
          for (const role of ["anon", "authenticated", "public_probe"]) {
            const c = await db.migrator.connect();
            try {
              await c.query("BEGIN");
              if (role !== "public_probe")
                await c.query(`SET LOCAL ROLE ${role}`);
              if (role !== "public_probe")
                await assert.rejects(
                  c.query("SELECT budograph_private.consume_limits('[]')"),
                  { code: "42501" },
                );
              else {
                const rights = (
                  await c.query(
                    "SELECT has_function_privilege('public_probe','budograph_private.consume_limits(jsonb)','EXECUTE') AS allowed",
                  )
                ).rows[0];
                assert.equal(rights.allowed, false);
              }
            } finally {
              await c.query("ROLLBACK");
              c.release();
            }
          }
          for (const sql of [
            "SELECT budograph_private.consume_limits('[]')",
            "SELECT * FROM budograph_private.claim_email(21,gen_random_uuid(),NULL)",
            "SELECT budograph_private.cleanup_operations(201)",
          ])
            await assert.rejects(poolA.query(sql), { code: "22023" });
          const inventory = (
            await db.migrator.query(
              "SELECT p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='budograph_private' ORDER BY p.proname",
            )
          ).rows;
          assert.equal(inventory.length, 8);
          assert.ok(
            inventory.every(
              (r) =>
                r.prosecdef &&
                r.proconfig.includes("search_path=pg_catalog, pg_temp"),
            ),
          );
        },
      );
      await t.test(
        "atomic N/N+1 across instances, cold visibility, independent scopes, HMAC privacy",
        async () => {
          const sensitive = "private-recipient@example.invalid",
            ip = "127.9.9.9";
          const rules = [
            limitsA.rule("test:identity", sensitive, 3, 60000),
            limitsA.rule("test:ip", ip, 5, 60000),
          ];
          const results = await Promise.all(
            Array.from({ length: 12 }, (_, i) =>
              (i % 2 ? limitsA : limitsB).consume(rules),
            ),
          );
          assert.equal(results.filter((r) => r.allowed).length, 3);
          const cold = createSharedControls(poolB, secrets.hmacKey);
          assert.equal((await cold.consume(rules)).allowed, false);
          const script = `import {runtimeDisposableDatabase} from './server/tests/helpers/runtime-disposable.ts'; import {createSharedControls} from './server/src/operations/limits.ts'; const db=await runtimeDisposableDatabase(); const c=createSharedControls(db.runtime(2),process.env.C4_SYNTHETIC_HMAC); const r=await c.consume([c.rule('test:identity','private-recipient@example.invalid',3,60000),c.rule('test:ip','127.9.9.9',5,60000)]); await db.close(); process.exit(r.allowed?77:0);`;
          const clean = Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) =>
                key.startsWith("V1C_") ||
                key.startsWith("EXPECTED_") ||
                [
                  "SystemRoot",
                  "WINDIR",
                  "PATH",
                  "TEMP",
                  "TMP",
                  "LOCALAPPDATA",
                ].includes(key),
            ),
          );
          const child = spawn(
            process.execPath,
            ["--input-type=module", "--eval", script],
            {
              env: { ...clean, C4_SYNTHETIC_HMAC: secrets.hmacKey },
              stdio: "ignore",
              windowsHide: true,
            },
          );
          assert.equal(
            await new Promise<number | null>((resolve) =>
              child.on("exit", resolve),
            ),
            0,
            "A new Node process must observe the exhausted SQL bucket",
          );
          assert.equal(
            (
              await limitsB.consume([
                limitsB.rule("test:other-action", sensitive, 3, 60000),
              ])
            ).allowed,
            true,
          );
          const persisted = JSON.stringify(
            (
              await db.migrator.query(
                "SELECT * FROM budograph_private.rate_counter",
              )
            ).rows,
          );
          assert.ok(
            !persisted.includes(sensitive) &&
              !persisted.includes(ip) &&
              !persisted.includes(secrets.hmacKey),
          );
          const actor2 = limitsA.rule(
            "test:identity",
            "another@example.invalid",
            3,
            60000,
          );
          assert.equal(
            (await limitsB.consume([actor2, rules[1]!])).allowed,
            true,
          );
          assert.equal(
            (await limitsA.consume([actor2, rules[1]!])).allowed,
            true,
          );
          assert.equal(
            (await limitsB.consume([actor2, rules[1]!])).allowed,
            false,
            "IP cap spans identities",
          );
        },
      );
      await t.test(
        "fixed versus rolling inactivity expiry, global/action budgets and bounded indexed cleanup",
        async () => {
          const fixed = limitsA.rule("fixed-test", "x", 2, 60000),
            rolling = limitsA.rule("rolling-test", "x", 2, 60000, "rolling");
          assert.equal((await limitsA.consume([fixed, rolling])).allowed, true);
          const first = (
            await db.migrator.query(
              "SELECT key_hash,expires_at FROM budograph_private.rate_counter WHERE key_hash=ANY($1::text[])",
              [[fixed.key, rolling.key]],
            )
          ).rows;
          assert.equal((await limitsB.consume([fixed, rolling])).allowed, true);
          const second = (
            await db.migrator.query(
              "SELECT key_hash,expires_at FROM budograph_private.rate_counter WHERE key_hash=ANY($1::text[])",
              [[fixed.key, rolling.key]],
            )
          ).rows;
          assert.equal(
            first.find((r) => r.key_hash === fixed.key).expires_at.getTime(),
            second.find((r) => r.key_hash === fixed.key).expires_at.getTime(),
          );
          assert.ok(
            second
              .find((r) => r.key_hash === rolling.key)
              .expires_at.getTime() >
              first
                .find((r) => r.key_hash === rolling.key)
                .expires_at.getTime(),
          );
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
            [fixed.key],
          );
          assert.equal((await limitsA.consume([fixed])).allowed, true);
          assert.equal((await limitsB.consume([rolling])).allowed, false);
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
            [rolling.key],
          );
          assert.equal((await limitsA.consume([rolling])).allowed, true);
          await clearLimits();
          await db.migrator.query(
            "INSERT INTO budograph_private.rate_counter(key_hash,count,expires_at) SELECT lpad(to_hex(n),64,'0'),1,clock_timestamp()-interval '1 hour' FROM generate_series(1,200) n",
          );
          const cleaned = (await limitsA.cleanup(10)) as {
            result: { counters: number };
          };
          assert.equal(cleaned.result.counters, 10);
          assert.equal(await count("rate_counter"), 190);
          const c = await db.migrator.connect();
          try {
            await c.query("BEGIN");
            await c.query("SET LOCAL enable_seqscan=off");
            const plan = JSON.stringify(
              (
                await c.query(
                  "EXPLAIN SELECT key_hash FROM budograph_private.rate_counter WHERE expires_at<clock_timestamp() ORDER BY expires_at,key_hash LIMIT 10",
                )
              ).rows,
            );
            assert.match(plan, /rate_counter_expiry/);
          } finally {
            await c.query("ROLLBACK");
            c.release();
          }
          await clearLimits();
          assert.equal((await limitsA.delivery()).allowed, true);
          assert.equal((await limitsB.delivery()).allowed, false);
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET count=80 WHERE key_hash=$1",
            [limitsA.rule("delivery:day", "all", 80, 86400000, "day").key],
          );
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
            [limitsA.rule("delivery:second", "all", 1, 1000).key],
          );
          assert.equal(
            (await limitsB.delivery()).allowed,
            false,
            "daily budget remains shared",
          );
          await clearLimits();
          assert.equal((await limitsA.delivery()).allowed, true);
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET count=2400 WHERE key_hash=$1",
            [
              limitsA.rule("delivery:month", "all", 2400, 2678400000, "month")
                .key,
            ],
          );
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
            [limitsA.rule("delivery:second", "all", 1, 1000).key],
          );
          assert.equal(
            (await limitsB.delivery()).allowed,
            false,
            "monthly budget remains shared",
          );
        },
      );
      await t.test(
        "counter/outbox hard caps fail closed and roll back new business effects",
        async () => {
          await db.migrator.query(
            "INSERT INTO budograph_private.rate_counter(key_hash,count,expires_at) SELECT lpad(to_hex(n),64,'0'),1,clock_timestamp()+interval '1 day' FROM generate_series(1,10000) n",
          );
          await assert.rejects(
            limitsA.consume([
              limitsA.rule("capacity-test", randomUUID(), 1, 60000),
            ]),
            OperationalError,
          );
          assert.equal(await count("rate_counter"), 10000);
          await clearLimits();
          const before = await count("email_outbox"),
            email = address();
          await db.migrator.query(
            `INSERT INTO budograph_private.email_outbox(id,kind,subject_key,reference_hash,key_id,expires_at,state)
        SELECT md5('cap'||n::text)||md5('cap-extra'||n::text),'verification',repeat('0',64),repeat('1',64),'cap-test',clock_timestamp()+interval '1 hour','permanent'
        FROM generate_series(1,$1::int) n`,
            [1000 - before],
          );
          try {
            await assert.rejects(invite(email));
            assert.equal(await count("email_outbox"), 1000);
            assert.equal(
              (
                await db.migrator.query(
                  "SELECT id FROM public.event_invitation WHERE invited_email=$1",
                  [email],
                )
              ).rows.length,
              0,
            );
          } finally {
            await db.migrator.query(
              "DELETE FROM budograph_private.email_outbox WHERE subject_key=repeat('0',64)",
            );
          }
        },
      );
      await t.test(
        "business rollback has no job; committed encrypted invitation survives a new dispatcher instance",
        async () => {
          const email = address(),
            before = await count("email_outbox");
          const failing = createInvitationService(
            poolA,
            undefined,
            true,
            async () => {},
            async (tx, value) => {
              await outA.enqueue!(tx, {
                kind: "invitation",
                to: value.invitation.email,
                url: `${origin}/invite/${value.token}`,
                locale: "en",
              });
              throw Error("Synthetic post-enqueue failure");
            },
          );
          await assert.rejects(failing.create(org, f.eventId, { email }));
          assert.equal(await count("email_outbox"), before);
          assert.equal(
            (
              await db.migrator.query(
                "SELECT id FROM public.event_invitation WHERE invited_email=$1",
                [email],
              )
            ).rows.length,
            0,
          );
          const created = await run(() => invite());
          assert.ok(created.emailJob);
          const job = await row(created.emailJob);
          assert.equal(job.state, "pending");
          const serialized = JSON.stringify(job);
          for (const secret of [
            created.token,
            created.invitation.email,
            `${origin}/invite/`,
            secrets.hmacKey,
            secrets.encryptionKeys[secrets.encryptionKeyId]!,
          ])
            assert.ok(!serialized.includes(secret));
          assert.equal(attempts.length, 0);
          const recovered = createEmailOutbox(
            poolB,
            {
              ...config,
              emailFrom: config.emailFrom,
              resendApiKey: config.resendApiKey,
            },
            limitsB,
            (state) => labels.push(state),
          );
          assert.equal(
            (await run(() => recovered.dispatch(created.emailJob, 1))).accepted,
            1,
          );
          assert.equal((await row(created.emailJob)).ciphertext, null);
          assert.equal(
            (await recovered.dispatch(created.emailJob, 1)).accepted,
            0,
          );
          assert.equal(attempts.length, 1);
        },
      );
      await t.test(
        "revoked/superseded/expired invitations never dispatch after the validity check",
        async () => {
          const first = await invite(),
            second = await servicesB.invitations!.resend(
              org,
              f.eventId,
              first.invitation.id,
              "en",
            );
          assert.notEqual(first.emailJob, second.emailJob);
          assert.equal((await row(first.emailJob!)).state, "obsolete");
          const before = attempts.length;
          await outA.dispatch!(first.emailJob, 1);
          assert.equal(attempts.length, before);
          await servicesA.invitations!.revoke(
            org,
            f.eventId,
            second.invitation.id,
            {},
          );
          await outB.dispatch!(second.emailJob, 1);
          assert.equal((await row(second.emailJob!)).state, "obsolete");
          assert.equal(attempts.length, before);
          const expired = await invite();
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
            [expired.emailJob],
          );
          await outA.dispatch!(expired.emailJob, 1);
          assert.equal((await row(expired.emailJob!)).state, "expired");
          assert.equal(attempts.length, before);
        },
      );
      await t.test(
        "AEAD wrong-key and authenticated metadata tampering fail closed without provider I/O",
        async () => {
          const created = await invite(),
            job = await row(created.emailJob!),
            wrong = syntheticOperationalSecrets();
          assert.throws(
            () => decryptEmail(wrong, job, job.ciphertext),
            /Encrypted email unavailable/,
          );
          assert.throws(() =>
            decryptEmail(
              secrets,
              { ...job, reference_hash: "f".repeat(64) },
              job.ciphertext,
            ),
          );
          const encrypted = encryptEmail(secrets, job, { synthetic: true });
          assert.deepEqual(decryptEmail(secrets, job, encrypted), {
            synthetic: true,
          });
          const bad = createEmailOutbox(
            poolB,
            {
              ...config,
              operations: wrong,
              emailFrom: config.emailFrom,
              resendApiKey: config.resendApiKey,
            },
            limitsB,
            () => {},
          );
          const before = attempts.length;
          await bad.dispatch(created.emailJob, 1);
          assert.equal((await row(created.emailJob!)).state, "blocked");
          assert.ok((await row(created.emailJob!)).ciphertext);
          assert.equal(attempts.length, before);
          const restored = createEmailOutbox(
            poolA,
            {
              ...config,
              emailFrom: config.emailFrom,
              resendApiKey: config.resendApiKey,
            },
            limitsA,
            () => {},
          );
          assert.equal(await restored.retryBlocked(created.emailJob!), true);
          assert.equal(
            (await run(() => restored.dispatch(created.emailJob, 1))).accepted,
            1,
          );
          const superseded = await invite();
          await bad.dispatch(superseded.emailJob, 1);
          assert.equal((await row(superseded.emailJob!)).state, "blocked");
          await servicesB.invitations!.resend(
            org,
            f.eventId,
            superseded.invitation.id,
            "en",
          );
          assert.equal((await row(superseded.emailJob!)).state, "obsolete");
          assert.equal(
            await restored.retryBlocked(superseded.emailJob!),
            false,
          );
          const expiring = await invite();
          await bad.dispatch(expiring.emailJob, 1);
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
            [expiring.emailJob],
          );
          await limitsA.cleanup(1);
          assert.equal((await row(expiring.emailJob!)).state, "expired");
          assert.equal((await row(expiring.emailJob!)).ciphertext, null);
        },
      );
      await t.test(
        "one verification token preserves distinct locale/return contexts and deduplicates identical intent",
        async () => {
          const token = jwt(org.email, config.betterAuthSecret);
          const message = (locale: "bg" | "en", target: string) => {
            const callback = new URL("/verify-email", origin);
            callback.searchParams.set("returnTo", `/invite/${target}`);
            callback.searchParams.set("lang", locale);
            const url = new URL("/api/auth/verify-email", origin);
            url.searchParams.set("token", token);
            url.searchParams.set("callbackURL", callback.href);
            return {
              kind: "verification" as const,
              to: org.email,
              url: url.href,
              locale,
            };
          };
          const firstTarget = randomBytes(32).toString("base64url"),
            secondTarget = randomBytes(32).toString("base64url");
          const first = message("bg", firstTarget),
            second = message("en", firstTarget),
            third = message("en", secondTarget);
          const firstId = await inTransaction(poolA, (tx) =>
            outA.enqueue!(tx, first),
          );
          assert.equal(
            await inTransaction(poolB, (tx) => outB.enqueue!(tx, first)),
            firstId,
          );
          const secondId = await inTransaction(poolB, (tx) =>
            outB.enqueue!(tx, second),
          );
          const thirdId = await inTransaction(poolA, (tx) =>
            outA.enqueue!(tx, third),
          );
          assert.equal(new Set([firstId, secondId, thirdId]).size, 3);
          assert.equal((await row(firstId)).state, "obsolete");
          assert.equal((await row(secondId)).state, "obsolete");
          assert.equal(
            (await run(() => outB.dispatch!(thirdId, 1))).accepted,
            1,
          );
          const delivered = messages.at(-1)!;
          assert.ok(delivered.text.includes(secondTarget));
          assert.ok(delivered.text.includes("Confirm ownership"));
        },
      );
      for (const failure of [
        "timeout",
        "429",
        "500",
        "403",
        "409",
        "lost-ack",
        "malformed",
        "oversized",
      ])
        await t.test(
          `provider ${failure}: classified durable outcome, stable retry body/key and bounded recovery`,
          async () => {
            const created = await invite();
            outcome = failure;
            await run(() => outA.dispatch!(created.emailJob, 1));
            const first = await row(created.emailJob!);
            assert.equal(first.attempts, 1);
            assert.equal(
              first.state,
              failure === "403"
                ? "permanent"
                : ["429", "500"].includes(failure)
                  ? "retry"
                  : "unknown",
            );
            if (failure === "429")
              assert.ok(first.next_attempt_at.getTime() - Date.now() > 55000);
            const prior = attempts.at(-1)!;
            outcome = "success";
            await clearLimits();
            await due(created.emailJob!);
            const before = attempts.length;
            await outB.dispatch!(created.emailJob, 1);
            if (failure === "403") assert.equal(attempts.length, before);
            else {
              assert.equal((await row(created.emailJob!)).state, "accepted");
              const last = attempts.at(-1)!;
              assert.ok(
                last.key === prior.key && last.body === prior.body,
                "Retry must use the exact immutable provider request",
              );
            }
          },
        );
      await t.test(
        "unknown history survives a later rejection; a resumed process past its lease sends nothing",
        async () => {
          const created = await invite();
          outcome = "lost-ack";
          await outA.dispatch!(created.emailJob, 1);
          await clearLimits();
          await due(created.emailJob!);
          outcome = "403";
          await outB.dispatch!(created.emailJob, 1);
          assert.equal((await row(created.emailJob!)).state, "uncertain");
          assert.equal((await row(created.emailJob!)).has_unknown, true);
          await clearLimits();
          outcome = "success";
          const frozen = await invite(),
            before = attempts.length,
            now = Date.now();
          const clock = t.mock.method(Date, "now", () => now + 61000);
          try {
            assert.equal(
              (await outA.dispatch!(frozen.emailJob, 1)).deferred,
              1,
            );
            assert.equal(attempts.length, before);
          } finally {
            clock.mock.restore();
          }
          await clearLimits();
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
            [frozen.emailJob],
          );
          assert.equal((await outB.dispatch!(frozen.emailJob, 1)).accepted, 1);
        },
      );
      await t.test(
        "unknown outcome outside the 23-hour retry window is terminal; attempts are capped",
        async () => {
          const created = await invite();
          outcome = "lost-ack";
          await outA.dispatch!(created.emailJob, 1);
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET first_attempt_at=clock_timestamp()-interval '24 hours',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
            [created.emailJob],
          );
          const before = attempts.length;
          await outB.dispatch!(created.emailJob, 1);
          assert.equal((await row(created.emailJob!)).state, "uncertain");
          assert.equal(attempts.length, before);
          const exhausted = await invite();
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET attempts=8 WHERE id=$1",
            [exhausted.emailJob],
          );
          await outA.dispatch!(exhausted.emailJob, 1);
          assert.equal((await row(exhausted.emailJob!)).state, "permanent");
        },
      );
      await t.test(
        "concurrent dispatchers claim once; network wait holds no transaction; duplicate invocation is fenced",
        async () => {
          const created = await invite();
          outcome = "hold";
          entered = gate();
          resume = gate();
          const first = run(() => outA.dispatch!(created.emailJob, 1));
          await entered.promise;
          const job = await row(created.emailJob!);
          assert.equal(job.state, "leased");
          const idle = (
            await control.query(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND state='idle in transaction'",
            )
          ).rows[0].n;
          assert.equal(idle, 0);
          assert.equal((await outB.dispatch!(created.emailJob, 1)).accepted, 0);
          resume.resolve();
          assert.equal((await first).accepted, 1);
          assert.equal(
            (
              await poolB.query(
                "SELECT budograph_private.finish_email($1,$2,'accepted','accepted',0) AS done",
                [created.emailJob, job.lease_nonce],
              )
            ).rows[0].done,
            null,
          );
        },
      );
      for (const started of [false, true])
        await t.test(
          `real child process dies after ${started ? "attempt start" : "claim"}; stale lease recovers on a separate runtime`,
          async () => {
            const created = await invite();
            const script = `import {runtimeDisposableDatabase} from './server/tests/helpers/runtime-disposable.ts'; import {randomUUID} from 'node:crypto'; const db=await runtimeDisposableDatabase(); const p=db.runtime(2),nonce=randomUUID(),id=${JSON.stringify(created.emailJob)}; await p.query('SELECT * FROM budograph_private.claim_email(1,$1,$2)',[nonce,id]); ${started ? "await p.query('SELECT budograph_private.start_email($1,$2)',[id,nonce]);" : ""} process.exit(73);`;
            const clean = Object.fromEntries(
              Object.entries(process.env).filter(
                ([key]) =>
                  key.startsWith("V1C_") ||
                  key.startsWith("EXPECTED_") ||
                  [
                    "SystemRoot",
                    "WINDIR",
                    "PATH",
                    "TEMP",
                    "TMP",
                    "LOCALAPPDATA",
                  ].includes(key),
              ),
            );
            const child = spawn(
              process.execPath,
              ["--input-type=module", "--eval", script],
              { env: clean, stdio: "ignore", windowsHide: true },
            );
            const exit = await new Promise<number | null>((resolve) =>
              child.on("exit", resolve),
            );
            assert.equal(exit, 73);
            const claimed = await row(created.emailJob!);
            assert.equal(claimed.state, "leased");
            assert.equal(claimed.attempts, started ? 1 : 0);
            assert.equal(
              (await outA.dispatch!(created.emailJob, 1)).accepted,
              0,
            );
            await db.migrator.query(
              "UPDATE budograph_private.email_outbox SET lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
              [created.emailJob],
            );
            assert.equal(
              (await run(() => outB.dispatch!(created.emailJob, 1))).accepted,
              1,
            );
            assert.equal((await row(created.emailJob!)).has_unknown, started);
            assert.equal(
              (
                await poolA.query(
                  "SELECT budograph_private.finish_email($1,$2,'retry','unknown',0) AS done",
                  [created.emailJob, claimed.lease_nonce],
                )
              ).rows[0].done,
              null,
            );
          },
        );
      await t.test(
        "actual COMMIT then lost SQL acknowledgement preserves one business row/job, with no automatic send",
        async () => {
          const email = address(),
            before = attempts.length;
          const uncertain = {
            query: poolA.query.bind(poolA),
            async connect() {
              const client = await poolA.connect();
              return new Proxy(client, {
                get(target, key) {
                  if (key === "query")
                    return async (sql: string, values?: unknown[]) => {
                      const result = await target.query(sql, values);
                      if (sql === "COMMIT")
                        throw Error("Synthetic lost COMMIT acknowledgement");
                      return result;
                    };
                  const value: unknown = Reflect.get(target, key, target);
                  return typeof value === "function"
                    ? value.bind(target)
                    : value;
                },
              });
            },
          };
          const service = createInvitationService(
            uncertain,
            undefined,
            true,
            async () => {},
            (tx, value) =>
              outA.enqueue!(tx, {
                kind: "invitation",
                to: value.invitation.email,
                url: `${origin}/invite/${value.token}`,
                locale: "en",
              }),
          );
          await assert.rejects(
            service.create(org, f.eventId, { email }),
            TransactionOutcomeUnknownError,
          );
          assert.equal(attempts.length, before);
          const jobs = (
            await db.migrator.query(
              "SELECT id FROM budograph_private.email_outbox WHERE subject_key=$1",
              [
                privateIdentifier(
                  secrets.hmacKey,
                  "invitation-subject",
                  (
                    await db.migrator.query(
                      "SELECT id FROM public.event_invitation WHERE invited_email=$1",
                      [email],
                    )
                  ).rows[0].id,
                ),
              ],
            )
          ).rows;
          assert.equal(jobs.length, 1);
          assert.equal((await outB.dispatch!(jobs[0].id, 1)).accepted, 1);
        },
      );
      await t.test(
        "expired verification/reset and consumed reset links are suppressed; retention deletes bounded old receipts",
        async () => {
          const email = org.email,
            token = jwt(email, config.betterAuthSecret, 1);
          const id = await inTransaction(poolA, (tx) =>
            outA.enqueue!(tx, {
              kind: "verification",
              to: email,
              url: `${origin}/api/auth/verify-email?token=${token}`,
              locale: "en",
            }),
          );
          await db.migrator.query("SELECT pg_sleep(1.1)");
          const before = attempts.length;
          await outA.dispatch!(id, 1);
          assert.equal((await row(id)).state, "expired");
          assert.equal(attempts.length, before);
          for (const consumed of [false, true]) {
            const reset = randomBytes(24).toString("base64url"),
              v = randomUUID();
            await db.migrator.query(
              'INSERT INTO public.verification(id,identifier,value,"expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,clock_timestamp()+interval \'1 hour\',clock_timestamp(),clock_timestamp())',
              [v, `reset-password:${reset}`, org.id],
            );
            const job = await inTransaction(poolA, (tx) =>
              outA.enqueue!(tx, {
                kind: "reset",
                to: email,
                url: `${origin}/api/auth/reset-password/${reset}`,
                locale: "en",
              }),
            );
            if (consumed)
              await db.migrator.query(
                "DELETE FROM public.verification WHERE id=$1",
                [v],
              );
            else
              await db.migrator.query(
                "UPDATE public.verification SET \"expiresAt\"=clock_timestamp()-interval '1 second' WHERE id=$1",
                [v],
              );
            await outB.dispatch!(job, 1);
            assert.equal((await row(job)).state, "obsolete");
          }
          await db.migrator.query(
            "UPDATE budograph_private.email_outbox SET expires_at=clock_timestamp()-interval '9 days' WHERE state IN ('accepted','permanent','obsolete','expired','uncertain')",
          );
          const beforeCount = await count("email_outbox");
          const result = (await limitsA.cleanup(2)) as {
            result: { jobs: number };
          };
          assert.equal(result.result.jobs, 2);
          assert.equal(await count("email_outbox"), beforeCount - 2);
        },
      );

      const password = randomBytes(24).toString("hex");
      let registeredEmail: string, cookie: string, verification: URL;
      await t.test(
        "full production registration durably records verification, retries without duplicate account and requires explicit accept",
        async () => {
          const invitation = await invite();
          registeredEmail = invitation.invitation.email;
          const result = await run(() =>
            post(appA, `/api/invitations/${invitation.token}/register`, {
              name: "C4 registered user",
              password,
            }),
          );
          assert.equal(result.statusCode, 200);
          assert.equal(result.json().status, "verification_required");
          assert.ok(!result.body.includes(invitation.token));
          assert.equal(
            (
              await db.migrator.query(
                'SELECT m.id FROM public.event_member m JOIN public."user" u ON u.id=m.user_id WHERE u.email=$1',
                [registeredEmail],
              )
            ).rows.length,
            0,
          );
          verification = link(registeredEmail);
          await clearLimits();
          const verified = await appB.inject({
            url: verification.pathname + verification.search,
            remoteAddress: "127.4.1.1",
          });
          assert.ok([200, 302].includes(verified.statusCode));
          const login = await post(appA, "sign-in/email", {
            email: registeredEmail,
            password,
          });
          assert.equal(login.statusCode, 200);
          cookie = cookieOf(login);
          assert.match(
            String(login.headers["set-cookie"]),
            /HttpOnly.*|Secure/,
          );
          const wrong = await servicesB
            .invitations!.accept(org, invitation.token, {})
            .then(
              () => null,
              (e) => e,
            );
          assert.equal(wrong.code, "WRONG_ACCOUNT");
          const accepted = await post(
            appB,
            `/api/invitations/${invitation.token}/accept`,
            {},
            cookie,
          );
          assert.equal(accepted.statusCode, 200);
          assert.equal(
            (
              await db.migrator.query(
                'SELECT count(*)::int AS n FROM public.account a JOIN public."user" u ON u.id=a."userId" WHERE u.email=$1',
                [registeredEmail],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "shared login/mail limits cannot be bypassed with forwarded headers, new IPs or a cold instance",
        async () => {
          const ip = "127.4.9.9";
          for (let i = 0; i < 4; i++) {
            const response = await post(
              i % 2 ? appA : appB,
              "sign-in/email",
              { email: address(), password: "incorrect-password" },
              "",
              ip,
              {
                "x-forwarded-for": `192.0.2.${i + 1}`,
                "x-budograph-client-ip": `192.0.2.${i + 1}`,
              },
            );
            assert.equal(response.statusCode, i < 3 ? 401 : 429);
          }
          await clearLimits();
          for (let i = 0; i < 4; i++) {
            const response = await post(i % 2 ? appA : appB, "sign-in/email", {
              email: registeredEmail,
              password: "incorrect-password",
            });
            assert.equal(response.statusCode, i < 3 ? 401 : 429);
          }
          await clearLimits();
          const hidden = address();
          for (let i = 0; i < 4; i++)
            assert.equal(
              (
                await post(i % 2 ? appA : appB, "request-password-reset", {
                  email: hidden,
                })
              ).statusCode,
              i < 3 ? 200 : 429,
            );
          await clearLimits();
          for (const [i, path] of [
            "send-verification-email",
            "%73end-verification-email",
            "send-verification-email/",
            "/send-verification-email",
          ].entries())
            assert.equal(
              (await post(i % 2 ? appA : appB, path, { email: hidden }))
                .statusCode,
              i < 3 ? 200 : 429,
              "Canonical mail paths share the same throttle",
            );
          const invalid = await post(
            appA,
            "%75pdate-user",
            { name: "\u0000invalid" },
            cookie,
          );
          assert.equal(invalid.statusCode, 400);
          const unsafe = createSharedControls(poolA, secrets.hmacKey, false);
          await assert.rejects(
            unsafe.invitation("127.0.0.1", true, "synthetic-token"),
            OperationalError,
          );
          await assert.rejects(
            limitsA.email("authmail", "untrusted-ip", hidden),
            OperationalError,
          );
          await assert.rejects(
            limitsA.email("authmail", "127.0.0.1", "bad identity"),
            OperationalError,
          );
        },
      );
      await t.test(
        "shared storage loss fails sensitive mutations closed; disabled signup and foreign Origin stay distinct",
        async () => {
          const disabled = await post(appA, "sign-up/email", {
            email: address(),
            name: "No public signup",
            password,
          });
          assert.equal(disabled.statusCode, 404);
          await db.migrator.query(
            "REVOKE EXECUTE ON FUNCTION budograph_private.consume_limits(jsonb) FROM budograph_runtime",
          );
          try {
            const response = await post(appB, "sign-in/email", {
              email: registeredEmail,
              password,
            });
            assert.equal(response.statusCode, 503);
            assert.equal(response.json().status, "error");
            assert.equal(response.json().code, "UNAVAILABLE");
            assert.equal(Object.keys(response.json()).length, 2);
            const foreign = await post(
              appA,
              "sign-in/email",
              { email: registeredEmail, password },
              "",
              undefined,
              { origin: "https://foreign.invalid" },
            );
            assert.equal(foreign.statusCode, 403);
            assert.equal(
              (await post(appB, "request-password-reset", { email: address() }))
                .statusCode,
              503,
            );
          } finally {
            await db.migrator.query(
              "GRANT EXECUTE ON FUNCTION budograph_private.consume_limits(jsonb) TO budograph_runtime",
            );
          }
          const invitation = await invite();
          await db.migrator.query(
            "REVOKE EXECUTE ON FUNCTION budograph_private.enqueue_email(text,text,text,text,timestamptz,text,text) FROM budograph_runtime",
          );
          try {
            for (const email of [registeredEmail, address()])
              for (const command of [
                "request-password-reset",
                "send-verification-email",
              ])
                assert.equal(
                  (await post(appB, command, { email })).statusCode,
                  503,
                  "outbox failure must not enumerate recipients",
                );
            const response = await post(
              appA,
              `/api/invitations/${invitation.token}/register`,
              { name: "Must roll back", password },
            );
            assert.equal(response.statusCode, 503);
            assert.equal(
              (
                await db.migrator.query(
                  'SELECT id FROM public."user" WHERE email=$1',
                  [invitation.invitation.email],
                )
              ).rows.length,
              0,
            );
          } finally {
            await db.migrator.query(
              "GRANT EXECUTE ON FUNCTION budograph_private.enqueue_email(text,text,text,text,timestamptz,text,text) TO budograph_runtime",
            );
          }
        },
      );
      await t.test(
        "distributed ACCOUNT_BUSY uses the existing account gate; profile mutations and inactive sessions stay protected",
        async () => {
          const blocker = await control.connect();
          try {
            await blocker.query("BEGIN");
            await blocker.query(
              "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
              [JSON.stringify(["budograph-account-v1c3", registeredEmail])],
            );
            const results = await Promise.all([
              post(appA, "update-user", { name: "C4 name A" }, cookie),
              post(
                appB,
                "change-password",
                {
                  currentPassword: password,
                  newPassword: randomBytes(24).toString("hex"),
                  revokeOtherSessions: true,
                },
                cookie,
              ),
            ]);
            assert.ok(
              results.every(
                (r) => r.statusCode === 409 && r.json().code === "ACCOUNT_BUSY",
              ),
            );
          } finally {
            await blocker.query("ROLLBACK");
            blocker.release();
          }
          const updated = await post(
            appB,
            "update-user",
            { name: "C4 updated name" },
            cookie,
          );
          assert.equal(updated.statusCode, 200);
          await db.migrator.query(
            'UPDATE public."user" SET active=FALSE WHERE email=$1',
            [registeredEmail],
          );
          try {
            assert.equal(
              (await appA.inject({ url: "/api/me", headers: { cookie } }))
                .statusCode,
              401,
            );
          } finally {
            await db.migrator.query(
              'UPDATE public."user" SET active=TRUE WHERE email=$1',
              [registeredEmail],
            );
          }
        },
      );
      await t.test(
        "reset before queued login revokes sessions across instances; replay cannot create a session",
        async () => {
          const resetRequest = await post(appA, "request-password-reset", {
            email: registeredEmail,
          });
          assert.equal(resetRequest.statusCode, 200);
          const resetLink = link(registeredEmail, "reset-password"),
            token = resetLink.pathname.split("/").at(-1)!;
          const blocker = await control.connect(),
            nextPassword = randomBytes(24).toString("hex");
          let reset: ReturnType<typeof post> | undefined,
            login: ReturnType<typeof post> | undefined;
          try {
            await blocker.query("BEGIN");
            await blocker.query(
              "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
              [JSON.stringify(["budograph-account-v1c3", registeredEmail])],
            );
            const waiting = async () =>
              (
                await blocker.query(
                  "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock'",
                )
              ).rows[0].n as number;
            reset = post(appA, "reset-password", {
              token,
              newPassword: nextPassword,
            });
            await waitFor(async () => (await waiting()) >= 1);
            login = post(appB, "sign-in/email", {
              email: registeredEmail,
              password,
            });
            await waitFor(async () => (await waiting()) >= 2);
            await blocker.query("COMMIT");
            const [r, l] = await Promise.all([reset, login]);
            assert.equal(r.statusCode, 200);
            assert.equal(l.statusCode, 401);
          } finally {
            await blocker.query("ROLLBACK");
            blocker.release();
          }
          assert.equal(
            (await appB.inject({ url: "/api/me", headers: { cookie } }))
              .statusCode,
            401,
          );
          assert.equal(
            (
              await post(appA, "reset-password", {
                token,
                newPassword: password,
              })
            ).statusCode,
            400,
          );
          const logged = await post(appB, "sign-in/email", {
            email: registeredEmail,
            password: nextPassword,
          });
          assert.equal(logged.statusCode, 200);
        },
      );
      await t.test(
        "verification and invitation registration retry share the account gate without automatic membership",
        async () => {
          const invitation = await invite(),
            email = invitation.invitation.email;
          assert.equal(
            (
              await post(
                appA,
                `/api/invitations/${invitation.token}/register`,
                { name: "Concurrent verify", password },
              )
            ).statusCode,
            200,
          );
          const verify = link(email);
          await clearLimits();
          const results = await Promise.all([
            post(appB, `/api/invitations/${invitation.token}/register`, {
              name: "Retry must not overwrite",
              password: "another-synthetic-password",
            }),
            appA.inject({
              url: verify.pathname + verify.search,
              remoteAddress: "127.4.2.2",
            }),
          ]);
          assert.equal(results[0].statusCode, 200);
          assert.ok([200, 302].includes(results[1].statusCode));
          const identity = (
            await db.migrator.query(
              'SELECT id,name,"emailVerified" FROM public."user" WHERE email=$1',
              [email],
            )
          ).rows[0];
          assert.equal(identity.name, "Concurrent verify");
          assert.equal(identity.emailVerified, true);
          assert.equal(
            (
              await db.migrator.query(
                'SELECT id FROM public.account WHERE "userId"=$1',
                [identity.id],
              )
            ).rows.length,
            1,
          );
          assert.equal(
            (
              await db.migrator.query(
                "SELECT id FROM public.event_member WHERE user_id=$1",
                [identity.id],
              )
            ).rows.length,
            0,
          );
        },
      );
      await t.test(
        "max=2 production burst across independent runtimes records all jobs and separates two authenticated identities",
        async () => {
          const invitations = [];
          for (let i = 0; i < 6; i++) invitations.push(await invite());
          const results = await Promise.all(
            invitations.map((invitation, i) =>
              run(() =>
                post(
                  i % 2 ? appA : appB,
                  `/api/invitations/${invitation.token}/register`,
                  { name: `Burst identity ${i}`, password },
                ),
              ),
            ),
          );
          assert.ok(
            results.every(
              (r) =>
                r.statusCode === 200 &&
                r.json().status === "verification_required",
            ),
          );
          const cookies: string[] = [],
            ids: string[] = [];
          for (const invitation of invitations) {
            const identity = (
              await db.migrator.query(
                'SELECT id FROM public."user" WHERE email=$1',
                [invitation.invitation.email],
              )
            ).rows[0];
            assert.ok(identity);
            const jobs = (
              await db.migrator.query(
                "SELECT id,state FROM budograph_private.email_outbox WHERE kind='verification' AND subject_key=$1",
                [
                  privateIdentifier(
                    secrets.hmacKey,
                    "verification-subject",
                    invitation.invitation.email,
                  ),
                ],
              )
            ).rows;
            assert.equal(jobs.length, 1);
            assert.ok(["accepted", "retry"].includes(jobs[0].state));
            if (cookies.length < 2) {
              await clearLimits();
              await due(jobs[0].id);
              await outB.dispatch!(jobs[0].id, 1);
              const verify = link(invitation.invitation.email);
              assert.ok(
                [200, 302].includes(
                  (
                    await appA.inject({
                      url: verify.pathname + verify.search,
                      remoteAddress: `127.5.1.${peer++}`,
                    })
                  ).statusCode,
                ),
              );
              const logged = await post(appB, "sign-in/email", {
                email: invitation.invitation.email,
                password,
              });
              assert.equal(logged.statusCode, 200);
              cookies.push(cookieOf(logged));
              ids.push(identity.id);
            }
          }
          const me = await Promise.all(
            cookies.map((cookie) =>
              appA.inject({ url: "/api/me", headers: { cookie } }),
            ),
          );
          assert.deepEqual(
            me.map((r) => r.json().user.id),
            ids,
          );
          assert.notEqual(ids[0], ids[1]);
          const foreign = await appB.inject({
            url: `/api/events/${f.foreignEventId}/tasks`,
            headers: { cookie: cookies[0] },
          });
          assert.equal(foreign.statusCode, 404);
        },
      );
      await t.test(
        "unaccepted Vercel ingress fails sensitive requests closed while health and disabled signup remain distinct",
        async () => {
          const services = createApplicationServices(
              poolA,
              config,
              { submit: (work) => work() },
              () => {},
              false,
            ),
            app = createApp({ production: true, ...services });
          try {
            await app.ready();
            const before = attempts.length;
            const rejected = await post(app, "sign-in/email", {
              email: registeredEmail,
              password,
            });
            assert.equal(rejected.statusCode, 503);
            assert.equal(
              (
                await post(app, "sign-up/email", {
                  email: address(),
                  name: "Disabled",
                  password,
                })
              ).statusCode,
              404,
            );
            assert.equal(
              (await app.inject({ url: "/api/health/live" })).statusCode,
              200,
            );
            assert.equal(attempts.length, before);
          } finally {
            await app.close();
          }
        },
      );
      await waitFor(() => a.active === 0 && b.active === 0);
      assert.equal(poolA.waitingCount, 0);
      assert.equal(poolB.waitingCount, 0);
      assert.ok(a.peak <= 2 && b.peak <= 2);
      assert.ok(
        labels.every((label) =>
          [
            "outbox",
            "accepted",
            "permanent",
            "retry",
            "unknown",
            "obsolete",
            "uncertain",
          ].includes(label),
        ),
      );
      writeFileSync(
        "tmp/v1c5/operational-metrics.json",
        JSON.stringify(
          {
            poolPeaks: [a.peak, b.peak],
            active: [a.active, b.active],
            waiting: [poolA.waitingCount, poolB.waitingCount],
            providerAttempts: attempts.length,
            distinctProviderAcceptances: accepted.size,
            realProviderCalls: 0,
            observabilityLabels: [...new Set(labels)],
            exactlyOnceInboxClaim: false,
          },
          null,
          2,
        ),
      );
    } finally {
      resume.resolve();
      await Promise.all([appA.close(), appB.close()]);
      await db.close();
    }
  },
);

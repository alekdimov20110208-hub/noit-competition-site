// Real production factories and authenticated browser scripts, in an owned runtime.
// Catalog filtering confines writers to newly owned synthetic fixtures; it never
// grants membership/role authority or replaces command/read implementations.
import assert from "node:assert/strict";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { readServerEnv } from "../server/src/config/env.ts";
import { createDatabasePool } from "../server/src/db/pool.ts";
import { createAuth } from "../server/src/auth/auth.ts";
import { createApp } from "../server/src/app.ts";
import { createEventService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { createChangeService } from "../server/src/changes/service.ts";
import { createInvitationService } from "../server/src/invitations/service.ts";
import { createNotificationService } from "../server/src/notifications/service.ts";
const out =
  process.env.BUDOGRAPH_EVIDENCE_DIR ??
  "tmp/event-management-stage7/regressions";
mkdirSync(out, { recursive: true });
const config = readServerEnv();
assert.equal(config.nodeEnv, "development");
const pool = createDatabasePool(config, () => {}),
  events = createEventService(pool),
  tasks = createTaskService(pool),
  origin = "http://127.0.0.1:5174";
let allowed = new Set(),
  filtered = false,
  vite;
const report = {
  isolated: true,
  configurationOnlyHostOverride: true,
  controlledCatalogForWriters: true,
  results: [],
  intentionalEvents: [],
  pid: process.pid,
  vitePort: 5174,
};
const remember = (e) => {
  allowed.add(e.id);
  report.intentionalEvents.push(e.id);
  return e;
};
const scopedEvents = {
  ...events,
  list: async (user) => {
    const all = await events.list(user);
    return filtered ? all.filter((e) => allowed.has(e.id)) : all;
  },
  create: async (...args) => remember(await events.create(...args)),
  duplicate: async (...args) => remember(await events.duplicate(...args)),
};
const app = createApp({
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
  events: scopedEvents,
  tasks,
  changes: createChangeService(pool),
  invitations: createInvitationService(pool),
  notifications: createNotificationService(pool),
  authentication: {
    auth: createAuth(pool, { ...config, publicAppUrl: origin }),
    baseURL: config.betterAuthUrl,
    taskMutationOrigins: [origin, new URL(config.betterAuthUrl).origin],
    developmentInviteLinks: true,
  },
});
const actor = async (role) => {
  const { rows } = await pool.query(
    'SELECT id,name,email FROM public."user" WHERE email=$1 AND active=TRUE',
    [process.env[`BUDOGRAPH_${role}_EMAIL`]],
  );
  assert.equal(rows.length, 1);
  return rows[0];
};
try {
  const backend = await app.listen({ host: "127.0.0.1", port: 0 });
  report.backendPort = Number(new URL(backend).port);
  vite = await createServer({
    configFile: false,
    plugins: [react()],
    logLevel: "silent",
    cacheDir: "tmp/event-management-stage7/regression-vite-cache",
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: { "/api": { target: backend, changeOrigin: true } },
    },
  });
  await vite.listen();
  for (const suite of process.env.BUDOGRAPH_STAGE7_SUITES?.split(",") ?? [
    "event-management",
    "auth",
    "event-authoring",
    "event-history",
    "event-duplication",
    "event-archive",
    "task-reads",
    "workspace",
    "task-authoring",
    "task-actions",
    "changes",
  ]) {
    allowed = new Set();
    filtered = !["event-management", "auth"].includes(suite);
    if (filtered) {
      const organizer = await actor("ORGANIZER"),
        member = await actor("MEMBER");
      const event = remember(
        await events.create(organizer, {
          name: `Stage 7 regression ${suite} ${randomUUID()}`,
          startDate: "2026-10-03",
          endDate: "2026-10-04",
          timezone: "Europe/Sofia",
        }),
      );
      const memberMembershipId = randomUUID();
      await pool.query(
        "INSERT INTO public.event_member(id,event_id,user_id,access_role,operational_role) VALUES($1,$2,$3,'MEMBER','Synthetic responsibility')",
        [memberMembershipId, event.id, member.id],
      );
      const fixtureTask = await tasks.create(organizer, event.id, {
        title: "Verify the two-user responsibility loop",
        deadline: "2026-10-04",
        priority: "normal",
        assignedMemberId:
          suite === "task-reads" ? memberMembershipId : event.membership.id,
      });
      remember(
        await events.create(member, {
          name: `Stage 7 independent Member Event ${randomUUID()}`,
          startDate: "2026-10-05",
          endDate: "2026-10-06",
          timezone: "Europe/Sofia",
        }),
      );
      remember(
        await events.create(organizer, {
          name: `Stage 7 private Organizer Event ${randomUUID()}`,
          startDate: "2026-10-07",
          endDate: "2026-10-08",
          timezone: "Europe/Sofia",
        }),
      );
      if (suite === "event-history") {
        // Explicitly labelled synthetic pagination rows. No historical states,
        // snapshots or actor names are invented; these target this owned fixture.
        await pool.query(
          `INSERT INTO public.activity_entry(id,event_id,actor_user_id,actor_member_id,action_type,target_type,target_id,payload)
          SELECT gen_random_uuid(),$1,$2,$3,'test.fixture','task',$4,jsonb_build_object('syntheticPaginationFixture',TRUE) FROM generate_series(1,60)`,
          [event.id, organizer.id, event.membership.id, fixtureTask.id],
        );
        await createChangeService(pool).create(organizer, event.id, {
          title: "Stage 7 controlled history Change",
          affectedTaskIds: [fixtureTask.id],
        });
      }
    }
    const env = {
      ...process.env,
      BUDOGRAPH_ISOLATED_ORIGIN: origin,
      BUDOGRAPH_ISOLATED_BACKEND: backend,
      BUDOGRAPH_HISTORY_DIRECT: "1",
      BUDOGRAPH_DUPLICATE_DIRECT: "1",
      BUDOGRAPH_ARCHIVE_DIRECT: "1",
      BUDOGRAPH_EVIDENCE_DIR: `${out}/${suite}`,
    };
    try {
      const result = await promisify(execFile)(
        process.execPath,
        [
          "--import",
          "./scripts/stage7-test-host.mjs",
          `scripts/verify-${suite}-ui.mjs`,
        ],
        { env, timeout: 600000, maxBuffer: 2000000 },
      );
      writeFileSync(`${out}/${suite}.log`, result.stdout + result.stderr);
      report.results.push({ suite, pass: true, filtered });
      console.log(`${suite}: PASS`);
      // Preserve the real Better Auth limiter; leave its sign-in window between suites.
      await new Promise((resolve) => setTimeout(resolve, 12000));
    } catch (error) {
      writeFileSync(
        `${out}/${suite}-failed.log`,
        (error.stdout ?? "") + (error.stderr ?? ""),
      );
      report.results.push({ suite, pass: false, filtered });
      throw Error(`Controlled regression incomplete: ${suite}`);
    } finally {
      writeFileSync(`${out}/summary.json`, JSON.stringify(report, null, 2));
    }
  }
} finally {
  const closed = await Promise.allSettled([vite?.close(), app.close()]);
  report.resourcesClosed = closed.every((x) => x.status === "fulfilled");
  await pool.end();
  writeFileSync(`${out}/summary.json`, JSON.stringify(report, null, 2));
}

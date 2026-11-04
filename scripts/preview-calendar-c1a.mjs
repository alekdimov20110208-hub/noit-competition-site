// Local review only. Real GET handlers over a synthetic session and query rows.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/src/app.ts";
import { createEventReadService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { calendarFixtureHost } from "./calendar-fixture-host.mjs";
import {
  event,
  other,
  members,
  stamp,
  task,
  tasks,
} from "./calendar-fixtures.mjs";

export function createCalendarFixtureApi(accessRole) {
  const user = {
    id: "synthetic-calendar-user",
    name: "SYNTHETIC Calendar",
    email: "calendar@example.invalid",
    active: true,
  };
  const accessible =
    accessRole === "ORGANIZER" ? [event, other] : accessRole ? [event] : [];
  const findEvent = (id) => accessible.find((value) => value.id === id);
  const member = { member_id: members[0].id, access_role: accessRole };
  const transaction = /^(?:BEGIN|COMMIT|ROLLBACK|SET LOCAL .+)$/;
  const database = {
    on() {},
    removeListener() {},
    release() {},
    async query(sql, values = []) {
      const [eventId, userId] = values;
      const selected = findEvent(eventId);
      if (transaction.test(sql)) return { rows: [] };
      if (sql.startsWith("SELECT event.id"))
        return {
          rows:
            eventId === user.id
              ? accessible.map((item) => ({
                  id: item.id,
                  name: item.name,
                  start_date: item.startDate,
                  end_date: item.endDate,
                  timezone: item.timezone,
                  archived_at: null,
                  version: item.version,
                  created_at: item.createdAt,
                  updated_at: item.updatedAt,
                  ...member,
                }))
              : [],
        };
      if (sql.startsWith("SELECT archived_at"))
        return { rows: selected ? [{ archived_at: null }] : [] };
      if (sql.startsWith("SELECT member.id, member.access_role"))
        return {
          rows:
            selected && userId === user.id
              ? [{ id: member.member_id, access_role: member.access_role }]
              : [],
        };
      if (sql.startsWith("SELECT id, title") && selected) {
        const rows =
          selected === event
            ? tasks
            : [task(200, "SYNTHETIC Event B only", "2026-12-15")];
        return {
          rows: rows.map((item) => ({
            ...item,
            assigned_member_id: item.assignedMemberId,
            accepted_by_member_id: item.acceptedByMemberId,
            accepted_at: null,
            updated_at: new Date(item.updatedAt),
          })),
        };
      }
      if (sql.startsWith("SELECT member.id, identity.name") && selected)
        return { rows: Array.isArray(userId) ? [] : members };
      throw new Error("Unexpected Calendar fixture query.");
    },
  };
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: "http://127.0.0.1",
      auth: {
        handler: async () => new Response(null, { status: 405 }),
        api: { getSession: async () => (accessRole ? { user } : null) },
      },
    },
    events: createEventReadService(database),
    tasks: createTaskService({ connect: async () => database }),
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "GET") {
      return reply
        .code(405)
        .header("allow", "GET")
        .send({ error: "FIXTURE_READ_ONLY" });
    }
  });
  // Adjacent workspace projections. Event and Task reads above use app services.
  for (const [resource, data] of Object.entries({
    changes: { changes: [] },
    notifications: { notifications: [], unreadCount: 0 },
  })) {
    app.get("/api/events/:id/" + resource, async (request, reply) =>
      findEvent(request.params.id)
        ? data
        : reply.code(404).send({ error: "NOT_FOUND" }),
    );
  }
  return app;
}

async function startReview() {
  const accessRole = process.argv.includes("--member") ? "MEMBER" : "ORGANIZER";
  const app = createCalendarFixtureApi(accessRole);
  const { server, origin } = await calendarFixtureHost({
    port: Number(process.env.BUDOGRAPH_CALENDAR_PREVIEW_PORT ?? 5184),
    async apiHandler(req, res) {
      try {
        const result = await app.inject({ method: req.method, url: req.url });
        res.writeHead(result.statusCode, {
          ...result.headers,
          "cache-control": "no-store",
          "x-budograph-preview": "synthetic",
        });
        res.end(result.payload);
      } catch {
        res.writeHead(500).end("Calendar fixture failed.");
      }
    },
    plugins: [
      {
        name: "calendar-local-review-label",
        transformIndexHtml() {
          return [
            {
              tag: "script",
              injectTo: "head-prepend",
              children: [
                "const RealDate = window.Date;",
                "const fixed = RealDate.parse(" + JSON.stringify(stamp) + ");",
                "window.Date = class extends RealDate {",
                "constructor(...args) { super(...(args.length ? args : [fixed])); }",
                "static now() { return fixed; }",
                "};",
              ].join("\n"),
            },
            {
              tag: "p",
              injectTo: "body-prepend",
              attrs: {
                style:
                  "margin:0;padding:0.5rem 1rem;text-align:center;background:#232d3a;color:#fff;font:14px system-ui",
              },
              children:
                "SYNTHETIC · " +
                accessRole +
                " · Demo clock: 15 Dec 2026 · No live login or database",
            },
          ];
        },
      },
    ],
  });
  console.log(origin + "/events/" + event.id + "/calendar");
  process.once("SIGINT", async () => {
    await server.close();
    await app.close();
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await startReview();

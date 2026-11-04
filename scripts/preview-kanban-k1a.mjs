// Loopback preview with a synthetic identity and in-memory query rows.
// Task authorization, version checks and commands run through the real service.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/src/app.ts";
import { createEventReadService } from "../server/src/events/service.ts";
import { createTaskService } from "../server/src/tasks/service.ts";
import { calendarFixtureHost } from "./calendar-fixture-host.mjs";
import { event, id, other, stamp, task } from "./calendar-fixtures.mjs";

export const activeEvent = { ...event, name: "SYNTHETIC Kanban Workshop" };
export const archivedEvent = {
  ...other,
  name: "SYNTHETIC Kanban Archive",
  archived: true,
};
export const workshopPath = `/events/${activeEvent.id}/tasks`;
const organizer = { id: id(10), name: "Synthetic Organizer", role: "Lead" };
const member = { id: id(11), name: "Synthetic Member", role: "Venue" };
const members = [organizer, member];
const instant = new Date(stamp);

function taskRow(dto) {
  return {
    ...dto,
    assigned_member_id: dto.assignedMemberId,
    accepted_by_member_id: dto.acceptedByMemberId,
    accepted_at: dto.acceptedAt ? instant : null,
    updated_at: instant,
  };
}

function createFixtureApi(origin, accessRole) {
  const user = {
    id: "synthetic-kanban-user",
    name: "SYNTHETIC Kanban",
    email: "kanban@example.invalid",
    active: true,
  };
  const actor = accessRole === "ORGANIZER" ? organizer : member;
  const events =
    accessRole === "ORGANIZER" ? [activeEvent, archivedEvent] : [activeEvent];
  const rowsByEvent = new Map([
    [
      activeEvent.id,
      [
        {
          ...task(100, "Prepare venue", "2026-12-14", "09:30"),
          category: "Logistics",
          priority: "important",
          assignedMemberId: member.id,
        },
        {
          ...task(101, "Book transport", "2026-12-22"),
          category: "Logistics",
          status: "in-progress",
          assignedMemberId: organizer.id,
          acceptedByMemberId: organizer.id,
          acceptedAt: stamp,
        },
        {
          ...task(102, "Print signs", "2026-12-20"),
          category: "Materials",
          status: "blocked",
          priority: "critical",
        },
        {
          ...task(103, "Confirm workshop", "2026-12-13"),
          category: "Logistics",
          status: "completed",
        },
      ].map(taskRow),
    ],
    [archivedEvent.id, [taskRow(task(200, "Archive only", "2026-12-31"))]],
  ]);
  const database = {
    on() {},
    removeListener() {},
    release() {},
    async query(sql, values = []) {
      const [eventId, target] = values;
      const selected = events.find(({ id }) => id === eventId);
      const tasks = rowsByEvent.get(eventId) ?? [];
      if (/^(?:BEGIN|COMMIT|ROLLBACK|SET LOCAL .+)$/.test(sql))
        return { rows: [] };
      if (sql.startsWith("SELECT event.id")) {
        return {
          rows: (eventId === user.id ? events : []).map((item) => ({
            id: item.id,
            name: item.name,
            start_date: item.startDate,
            end_date: item.endDate,
            timezone: item.timezone,
            archived_at: item.archived ? instant : null,
            version: item.version,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
            member_id: actor.id,
            access_role: accessRole,
          })),
        };
      }
      if (!selected) return { rows: [] };
      if (sql.startsWith("SELECT archived_at"))
        return { rows: [{ archived_at: selected.archived ? instant : null }] };
      if (sql.startsWith("SELECT member.id, member.access_role"))
        return {
          rows:
            target === user.id
              ? [{ id: actor.id, access_role: accessRole }]
              : [],
        };
      if (sql.startsWith("SELECT member.id, identity.name"))
        return {
          rows: Array.isArray(target)
            ? members.filter(({ id }) => target.includes(id))
            : members,
        };
      if (sql.startsWith("SELECT member.id"))
        return { rows: members.filter(({ id }) => id === target) };
      if (sql.startsWith("SELECT id, title"))
        return {
          rows: target ? tasks.filter(({ id }) => id === target) : tasks,
        };
      if (sql.startsWith("UPDATE public.task")) {
        const row = tasks.find(
          ({ id, version }) => id === target && version === values[8],
        );
        if (!row) return { rows: [] };
        Object.assign(row, {
          assigned_member_id: values[2],
          accepted_by_member_id: values[3],
          accepted_at: values[4] ? instant : values[5],
          status: values[6],
          version: row.version + 1,
        });
        return { rows: [row] };
      }
      if (
        sql.startsWith("INSERT INTO public.activity_entry") ||
        sql.startsWith("INSERT INTO public.notification")
      )
        return { rows: [] };
      throw new Error("Unexpected Kanban fixture query.");
    },
  };
  const app = createApp({
    checkDatabase: async () => {},
    authentication: {
      baseURL: origin,
      auth: {
        handler: async () => new Response(null, { status: 405 }),
        api: { getSession: async () => ({ user }) },
      },
    },
    events: createEventReadService(database),
    tasks: createTaskService({ connect: async () => database }),
  });
  app.addHook("onRequest", async (request, reply) => {
    const allowedCommand =
      /\/tasks\/[^/]+\/(status|assignment|acceptance)$/.test(request.url);
    if (request.method !== "GET" && !allowedCommand)
      return reply.code(405).send({ error: "OUTSIDE_KANBAN_FIXTURE" });
  });
  for (const [resource, data] of Object.entries({
    changes: { changes: [] },
    notifications: { notifications: [], unreadCount: 0 },
  })) {
    app.get("/api/events/:id/" + resource, async (request, reply) =>
      events.some(({ id }) => id === request.params.id)
        ? data
        : reply.code(404).send({ error: "NOT_FOUND" }),
    );
  }
  return app;
}

export async function kanbanFixtureHost({
  accessRole = "ORGANIZER",
  port = 5187,
} = {}) {
  const app = createFixtureApi(`http://127.0.0.1:${port}`, accessRole);
  try {
    const { server, origin } = await calendarFixtureHost({
      port,
      async apiHandler(req, res) {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const result = await app.inject({
            method: req.method,
            url: req.url,
            headers: req.headers,
            payload: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          res.writeHead(result.statusCode, {
            ...result.headers,
            "cache-control": "no-store",
            "x-budograph-preview": "synthetic",
          });
          res.end(result.rawPayload);
        } catch {
          res.writeHead(500).end("Kanban fixture failed.");
        }
      },
      plugins: [
        {
          name: "kanban-preview-label",
          transformIndexHtml() {
            return [
              {
                tag: "script",
                injectTo: "head-prepend",
                children: `{
                const RealDate = Date;
                const fixed = RealDate.parse(${JSON.stringify(stamp)});
                window.Date = class extends RealDate {
                  constructor(...args) { super(...(args.length ? args : [fixed])); }
                  static now() { return fixed; }
                };
              }`,
              },
              {
                tag: "p",
                injectTo: "body-prepend",
                attrs: {
                  style:
                    "margin:0;padding:0.5rem;text-align:center;background:#232d3a;color:#fff;font:14px system-ui",
                },
                children: `SYNTHETIC · ${accessRole} · 15 Dec 2026 · Local Kanban preview`,
              },
            ];
          },
        },
      ],
    });
    return {
      origin,
      async close() {
        await server.close();
        await app.close();
      },
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const fixture = await kanbanFixtureHost({
    accessRole: process.argv.includes("--member") ? "MEMBER" : "ORGANIZER",
    port: process.argv.includes("--member") ? 5189 : 5187,
  });
  console.log(fixture.origin + workshopPath);
  process.once("SIGINT", () => void fixture.close());
}

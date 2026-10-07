import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  RemoteWorkspaceService,
  WorkspaceReadFailure,
  emptyTasksWorkspace,
  type TaskEvent,
} from "./RemoteWorkspaceService.ts";
import { toWorkspaceView } from "./workspaceViews.ts";
import type { RemoteChange } from "./changes.ts";
import { TaskReadController, eventCalendarNow } from "./taskReadState.ts";
import {
  getAttentionTasks,
  getTaskCounts,
  getTeamWorkload,
} from "../domain/workspace.ts";
import { getTeamRoster } from "../pages/team/helpers.ts";
import {
  buildPreparationTimeline,
  eventDateMilestones,
  partitionTeamPressure,
} from "../pages/dashboard/helpers.ts";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const event: TaskEvent = {
  id: uid(1),
  name: "Server Event",
  startDate: "2026-10-04",
  endDate: "2026-10-05",
  timezone: "Pacific/Kiritimati",
  archived: false,
  version: 1,
  createdAt: "2026-10-03T12:00:00Z",
  updatedAt: "2026-10-03T12:00:00Z",
  membership: { id: uid(2), accessRole: "MEMBER" },
};
const active = { id: uid(2), name: "Active Member", role: "Organizer" };
const historical = { id: uid(3), name: "Former Member", role: "Venue" };
const dto = (n: number, assignedMemberId = active.id) => ({
  id: uid(n),
  title: `Server task ${n}`,
  category: "Venue",
  context: "",
  deadline: "2026-10-04",
  deadlineTime: null,
  status: "not-started",
  priority: "critical",
  assignedMemberId,
  accepted: false,
  acceptedByMemberId: null,
  acceptedAt: null,
  version: 1,
  updatedAt: "2026-10-03T12:00:00Z",
  blockedBy: "",
  blocks: "",
});
function service(tasks = [dto(4), dto(5, historical.id)]) {
  return new RemoteWorkspaceService(async (url) =>
    Response.json(
      String(url) === "/api/events"
        ? { events: [event] }
        : String(url).endsWith("/members")
          ? {
              members: [
                {
                  ...active,
                  userId: "AUTH_INTERNAL",
                  email: "private@example.invalid",
                },
              ],
            }
          : String(url).endsWith("/changes")
            ? { changes: [] }
            : { tasks, members: [active, historical] },
    ),
  );
}
const signal = () => new AbortController().signal;
const now = eventCalendarNow(new Date("2026-10-03T12:00:00Z"), event.timezone);

test("real overview preserves DATE/timezone and omits unsupported Event fields, authority and fictional Changes", async () => {
  const remote = await service().readTasks(signal()),
    view = toWorkspaceView(remote);
  assert.deepEqual(view.events, [
    {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone,
    },
  ]);
  assert.equal(view.currentEventId, remote.currentEventId);
  assert.equal("changes" in view, false);
  assert.equal("changesPersisted" in view, false);
  assert.doesNotMatch(
    JSON.stringify(view),
    /AUTH_INTERNAL|private@example|accessRole|membership|guestInstructor|location|isOrganizer/,
  );
});
test("active Team includes unassigned members; historical assignees are name context only for both roles", async () => {
  const remote = await service().readTasks(signal()),
    view = toWorkspaceView(remote);
  assert.deepEqual(view.teamMembers, [active]);
  assert.deepEqual(view.taskMembers, [active, historical]);
  assert.deepEqual(remote.assignableMembers, []);
  assert.equal(view.tasks[1]!.ownerId, historical.id);
  const empty = toWorkspaceView(await service([]).readTasks(signal()));
  assert.equal(getTeamRoster(empty, now)[0]!.assigned, 0);
});
test("Dashboard and Team reuse deterministic real task lifecycle, acceptance, priority and Event-calendar selectors", async () => {
  const view = toWorkspaceView(await service().readTasks(signal()));
  assert.equal(now.getDate(), 4);
  assert.deepEqual(getTaskCounts(view.tasks, now), {
    total: 2,
    active: 2,
    blocked: 0,
    overdue: 0,
    completed: 0,
  });
  assert.equal(getAttentionTasks(view.tasks, now, 10).length, 2);
  const roster = getTeamRoster(view, now);
  assert.equal(roster.length, 1);
  assert.equal(roster[0]!.assigned, 1);
  assert.equal(roster[0]!.notAccepted, 1);
  assert.equal(roster[0]!.criticalDeadline, 1);
  assert.deepEqual(
    roster[0]!.attention.map((t) => t.id),
    [uid(4)],
  );
  assert.equal(
    partitionTeamPressure(getTeamWorkload(view.teamMembers, view.tasks, now))
      .quiet.length,
    1,
  );
});
test("real Timeline uses unchanged date strings and Event boundaries; elapsed boundaries are completed", async () => {
  const view = toWorkspaceView(await service().readTasks(signal()));
  const milestones = eventDateMilestones(
    view.events[0]!,
    now,
    "Starts",
    "Ends",
  );
  assert.deepEqual(
    milestones.map((m) => [m.date, m.status]),
    [
      ["2026-10-04", "current"],
      ["2026-10-05", "upcoming"],
    ],
  );
  assert.equal(buildPreparationTimeline(view.tasks, milestones, now).length, 4);
  assert.ok(
    buildPreparationTimeline(view.tasks, milestones, now).every(
      (e) => e.kind !== "task" || view.tasks.some((t) => t.id === e.task.id),
    ),
  );
  const after = new Date(2026, 9, 6, 12);
  assert.equal(
    buildPreparationTimeline(
      [],
      eventDateMilestones(view.events[0]!, after, "Starts", "Ends"),
      after,
    ).length,
    0,
  );
});
test("member endpoint failure never degrades into partial/demo Team or Dashboard (401, 403, 500)", async () => {
  for (const [status, error] of [
    [401, "unauthenticated"],
    [403, "forbidden"],
    [500, "unavailable"],
  ] as const) {
    const remote = new RemoteWorkspaceService(async (url) =>
      String(url).endsWith("/members")
        ? new Response("RAW", { status })
        : Response.json(
            String(url) === "/api/events"
              ? { events: [event] }
              : { tasks: [dto(4)], members: [active] },
          ),
    );
    let expired = 0;
    const controller = new TaskReadController(remote, () => expired++);
    await controller.load();
    assert.equal(controller.getSnapshot().error, error);
    assert.deepEqual(
      toWorkspaceView(controller.getSnapshot().workspace).teamMembers,
      [],
    );
    assert.equal(expired, status === 401 ? 1 : 0);
  }
});
test("shared current Event stays pinned during refresh and fails closed when that Event disappears", async () => {
  const first = await service().readTasks(signal());
  const ids: string[] = [];
  const controller = new TaskReadController(
    {
      readTasks: async () => first,
      refreshTasks: async (id) => {
        ids.push(id);
        return first;
      },
    },
    () => {},
  );
  await controller.load();
  await controller.load();
  assert.deepEqual(ids, [event.id]);
  controller.clear();
  await controller.load();
  assert.equal(controller.getSnapshot().workspace.currentEventId, event.id);
});
test("authenticated application no longer initializes local workspace or a per-page remote lifecycle", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    app,
    /useWorkspace|localizeWorkspace|DemoReference|localizedState|LocalDemo/,
  );
  assert.match(app, /remoteEnabled = Boolean\(identity.user\)/);
  assert.match(app, /dataMode="remote-workspace"/);
});

test("malformed active-member reads fail closed instead of substituting historical or demo members", async () => {
  for (const members of [
    [active, active],
    [{ ...active, id: "member-demo" }],
    [{ ...active, role: null }],
  ]) {
    const remote = new RemoteWorkspaceService(async (url) =>
      Response.json(
        String(url) === "/api/events"
          ? { events: [event] }
          : String(url).endsWith("/members")
            ? { members }
            : { tasks: [dto(4)], members: [active] },
      ),
    );
    await assert.rejects(
      remote.readTasks(signal()),
      (error) =>
        error instanceof WorkspaceReadFailure && error.code === "invalid",
    );
  }
});
test("Team selectors exclude foreign-Event tasks even when they reuse a displayed member reference", async () => {
  const view = toWorkspaceView(await service().readTasks(signal()));
  const real = view.tasks[0]!;
  view.tasks.push({ ...real, id: uid(9), eventId: uid(99), title: "FOREIGN" });
  assert.deepEqual(
    getTeamRoster(view, now)[0]!.attention.map((t) => t.id),
    [uid(4)],
  );
});
test("shared refresh does not independently rediscover an earlier Event or retain data after scope loss", async () => {
  let accessible = [event];
  const remote = new RemoteWorkspaceService(async (url) =>
    Response.json(
      String(url) === "/api/events"
        ? { events: accessible }
        : String(url).endsWith("/members")
          ? { members: [active] }
          : { tasks: [dto(4)], members: [active] },
    ),
  );
  const controller = new TaskReadController(remote, () => {});
  await controller.load();
  accessible = [{ ...event, id: uid(20), startDate: "2026-10-01" }, event];
  await controller.load();
  assert.equal(controller.getSnapshot().workspace.currentEventId, event.id);
  accessible = [accessible[0]!];
  await controller.load();
  assert.equal(controller.getSnapshot().error, "forbidden");
  assert.deepEqual(controller.getSnapshot().workspace.tasks, []);
  assert.deepEqual(
    toWorkspaceView(controller.getSnapshot().workspace).teamMembers,
    [],
  );
});

function canonicalChange(eventId = event.id, n = 30): RemoteChange {
  return {
    id: uid(n),
    eventId,
    title: "Canonical P3",
    context: "",
    reporter: active,
    responseOwner: null,
    decision: null,
    response: null,
    planB: null,
    version: 1,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    affectedTasks: [],
    impact: { taskCount: 0, people: [], deadlines: [] },
  };
}
function composed(
  changeReply: (path: string, signal?: AbortSignal | null) => Promise<Response>,
) {
  return new RemoteWorkspaceService(async (url, options) => {
    const path = String(url);
    if (path.endsWith("/changes")) return changeReply(path, options?.signal);
    return Response.json(
      path === "/api/events"
        ? { events: [event] }
        : path.endsWith("/members")
          ? { members: [active] }
          : { tasks: [dto(4)], members: [active] },
    );
  });
}
test("shared workspace composes validated canonical Change DTOs with real Tasks; only successful zero reads mean empty Changes", async () => {
  const value = canonicalChange();
  let optionsSignal: AbortSignal | null | undefined;
  const workspace = await composed(async (_path, signal) => {
    optionsSignal = signal;
    return Response.json({ changes: [value] });
  }).readTasks(signal());
  assert.deepEqual(workspace.changes, [value]);
  assert.equal(workspace.changeReadError, null);
  assert.ok(optionsSignal instanceof AbortSignal);
  assert.equal(workspace.tasks[0]?.title, dto(4).title);
  assert.deepEqual(
    (
      await composed(async () => Response.json({ changes: [] })).readTasks(
        signal(),
      )
    ).changes,
    [],
  );
  assert.equal("changes" in toWorkspaceView(workspace), false);
});
test("Change-only server/network/malformed/foreign DTO failures clear canonical Changes without pretending zero or replacing Task/Team data", async () => {
  for (const reply of [
    async () => new Response("PRIVATE_DATABASE_DETAIL", { status: 500 }),
    async () => {
      throw new Error("PRIVATE_NETWORK_DETAIL");
    },
    async () => Response.json({ changes: [canonicalChange(uid(99))] }),
    async () =>
      Response.json({ changes: [canonicalChange(), canonicalChange()] }),
  ]) {
    const workspace = await composed(reply).readTasks(signal());
    assert.equal(workspace.changes, null);
    assert.ok(
      workspace.changeReadError === "unavailable" ||
        workspace.changeReadError === "invalid",
    );
    assert.equal(workspace.tasks[0]?.title, dto(4).title);
    assert.deepEqual(workspace.activeMembers, [active]);
    assert.doesNotMatch(JSON.stringify(workspace), /PRIVATE_|demo/);
  }
});
test("Change read session/scope loss clears the entire shared workspace and only 401 expires identity", async () => {
  for (const [status, error] of [
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
  ] as const) {
    let expired = 0;
    const controller = new TaskReadController(
      composed(async () => new Response("PRIVATE", { status })),
      () => expired++,
    );
    await controller.load();
    assert.equal(controller.getSnapshot().error, error);
    assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
    assert.equal(expired, status === 401 ? 1 : 0);
  }
});
test("late old-Event Change response cannot publish into the new Event after switching, including transport that ignores cancellation", async () => {
  const next = {
    ...event,
    id: uid(99),
    membership: { ...event.membership, id: uid(98) },
  };
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve)),
    waiting = new Promise<void>((resolve) => (entered = resolve));
  const remote = new RemoteWorkspaceService(async (url) => {
    const path = String(url);
    if (path === "/api/events") return Response.json({ events: [event, next] });
    if (path.endsWith("/changes")) {
      const scope = path.includes(event.id) ? event.id : next.id;
      if (scope === event.id) {
        entered();
        await held;
      }
      return Response.json({
        changes: [canonicalChange(scope, scope === event.id ? 30 : 31)],
      });
    }
    return Response.json(
      path.endsWith("/members")
        ? { members: [active] }
        : { tasks: [dto(4)], members: [active] },
    );
  });
  const controller = new TaskReadController(remote, () => {});
  controller.selectEvent(event.id);
  const old = controller.load();
  await waiting;
  controller.selectEvent(next.id);
  assert.deepEqual(controller.getSnapshot().workspace, emptyTasksWorkspace());
  await controller.load();
  release();
  await old;
  assert.equal(controller.getSnapshot().workspace.currentEventId, next.id);
  assert.deepEqual(
    controller.getSnapshot().workspace.changes?.map((c) => c.eventId),
    [next.id],
  );
});

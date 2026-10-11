import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { safeReturnTo, loginHref } from "./auth/routing.ts";
import {
  readDashboardContext,
  withDashboardContext,
} from "./dashboardNavigation.ts";
import {
  createTaskDetailHistoryState,
  createTaskHref,
  isTaskDetailHistoryState,
  normalizePath,
  parseAppLocation,
  resolveTaskLocation,
  TASK_DETAIL_HISTORY_STATE,
  eventHref,
  eventEditHref,
  isGlobalAppPath,
  APP_ROUTES,
} from "./routes.ts";

test("Event management is global, ignores detail context and leaves the five workspace routes intact", () => {
  for (const pathname of ["/events", "/events/", "/events///"]) {
    assert.deepEqual(parseAppLocation(pathname, "?task=old&change=old"), {
      path: "/events",
      taskId: null,
      eventId: null,
      eventMode: "workspace",
    });
    assert.equal(normalizePath(pathname), "/events");
  }
  assert.equal(isGlobalAppPath("/events"), true);
  assert.equal(isGlobalAppPath("/account"), true);
  assert.equal(isGlobalAppPath("/"), false);
  assert.equal(eventHref(randomUUID(), "/events"), "/events");
  assert.deepEqual(
    APP_ROUTES.map((route) => route.path),
    ["/", "/tasks", "/team", "/changes", "/templates"],
  );
});

test("strict global management login return accepts only the canonical route", () => {
  assert.equal(safeReturnTo("/events"), "/events");
  assert.equal(safeReturnTo("/events/"), "/events");
  assert.equal(
    new URL(loginHref("/events"), "https://budograph.invalid").searchParams.get(
      "returnTo",
    ),
    "/events",
  );
  for (const href of [
    "/events?task=old",
    "/events?next=//evil.invalid",
    "/events#fragment",
    "//evil.invalid/events",
    "/%65vents",
    "/events/duplicate",
    "/events/manage",
  ])
    assert.equal(safeReturnTo(href), "/");
});

test("all five Event-scoped pages preserve route and login scope", () => {
  const id = randomUUID();
  for (const route of APP_ROUTES) {
    const href = eventHref(id, route.path);
    assert.equal(parseAppLocation(href, "").path, route.path);
    assert.equal(parseAppLocation(href, "").eventId, id);
    assert.equal(safeReturnTo(href), href);
  }
});

test("Event URLs preserve explicit Dashboard, Tasks, Team and edit scope through refresh", () => {
  const eventId = randomUUID();
  for (const path of ["/", "/tasks", "/team"] as const) {
    const href = eventHref(eventId, path);
    const url = new URL(href, "https://budograph.invalid");
    assert.deepEqual(parseAppLocation(url.pathname, url.search), {
      path,
      taskId: null,
      eventId,
      eventMode: "workspace",
    });
    assert.equal(safeReturnTo(href), href);
    assert.equal(
      new URL("https://budograph.invalid" + loginHref(href)).searchParams.get(
        "returnTo",
      ),
      href,
    );
  }
  assert.deepEqual(parseAppLocation(eventEditHref(eventId), ""), {
    path: "/",
    taskId: null,
    eventId,
    eventMode: "edit",
  });
  assert.equal(safeReturnTo(eventEditHref(eventId)), eventEditHref(eventId));
  assert.deepEqual(parseAppLocation("/events/new", "?task=foreign"), {
    path: "/",
    taskId: null,
    eventId: null,
    eventMode: "create",
  });
  assert.equal(safeReturnTo("/events/new?private=discard"), "/events/new");
});

test("Event switch destinations keep page type and drop former Event task-detail state", () => {
  const a = randomUUID(),
    b = randomUUID(),
    taskId = randomUUID();
  const taskUrl = new URL(
    createTaskHref(taskId, a),
    "https://budograph.invalid",
  );
  const location = parseAppLocation(taskUrl.pathname, taskUrl.search);
  assert.equal(location.eventId, a);
  assert.equal(location.taskId, taskId);
  assert.equal(eventHref(b, location.path), `/events/${b}/tasks`);
  const next = parseAppLocation(eventHref(b, location.path), "");
  assert.equal(next.taskId, null);
  assert.equal(
    resolveTaskLocation(location, [{ id: taskId, eventId: a }], b).status,
    "invalid",
  );
  assert.equal(
    safeReturnTo(`${eventHref(a, "/tasks")}?task=${taskId}&token=discard`),
    createTaskHref(taskId, a),
  );
});

test("Event login return allowlist rejects unknown pages, unsafe/encoded IDs, external routes and loops", () => {
  const eventId = randomUUID();
  for (const href of [
    `/events/${eventId}/unknown`,
    `/events/${eventId}/login`,
    "/events/unsafe%2fid/tasks",
    "/events/%2f%2fattacker.invalid/team",
    "/events/new#fragment",
    "//attacker.invalid/events/new",
    `/events/${eventId}\\tasks`,
  ])
    assert.equal(safeReturnTo(href), "/");
  assert.throws(() => eventHref("unsafe/id"));
});

test("normalizes only the existing top-level application paths", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/tasks///"), "/tasks");
  assert.equal(normalizePath("/team/"), "/team");
  assert.equal(normalizePath("/changes"), "/changes");
  assert.equal(normalizePath("/templates"), "/templates");
  assert.equal(normalizePath("/tasks/task-one"), "/");
  assert.equal(normalizePath("/unknown"), "/");
});

test("creates and parses a canonical encoded task deep link", () => {
  const taskId = "задача / 50%?owner=one&ready=yes";
  const href = createTaskHref(taskId);

  assert.equal(href, `/tasks?task=${encodeURIComponent(taskId)}`);

  const refreshedUrl = new URL(href, "https://budograph.example");
  assert.deepEqual(
    parseAppLocation(refreshedUrl.pathname, refreshedUrl.search),
    {
      path: "/tasks",
      taskId,
      eventId: null,
      eventMode: "workspace",
    },
  );
});

test("ignores absent, blank, duplicate, and malformed task parameters", () => {
  for (const search of [
    "",
    "?view=list",
    "?task=",
    "?task=%20%20",
    "?task=one&task=two",
    "?task=one&task=one",
    "?task=%E0%A4%A",
  ]) {
    assert.deepEqual(parseAppLocation("/tasks", search), {
      path: "/tasks",
      taskId: null,
      eventId: null,
      eventMode: "workspace",
    });
  }

  assert.equal(createTaskHref("   "), "/tasks");
  assert.deepEqual(parseAppLocation("/tasks", "?task=task-one&view=list"), {
    path: "/tasks",
    taskId: "task-one",
    eventId: null,
    eventMode: "workspace",
  });
});

test("task query state is limited to the tasks route", () => {
  assert.deepEqual(parseAppLocation("/team", "?task=task-one"), {
    path: "/team",
    taskId: null,
    eventId: null,
    eventMode: "workspace",
  });
  assert.deepEqual(parseAppLocation("/missing", "?task=task-one"), {
    path: "/",
    taskId: null,
    eventId: null,
    eventMode: "workspace",
  });
});

test("resolves a valid task for the current event", () => {
  const currentTask = { id: "task-one", eventId: "event-current" };
  const tasks = [{ id: "task-two", eventId: "event-current" }, currentTask];
  const location = parseAppLocation("/tasks", "?task=task-one");

  assert.deepEqual(resolveTaskLocation(location, tasks, "event-current"), {
    status: "valid",
    taskId: "task-one",
    task: currentTask,
  });
});

test("marks unknown and wrong-event task IDs invalid without throwing", () => {
  const tasks = [{ id: "task-other", eventId: "event-other" }];

  assert.deepEqual(
    resolveTaskLocation(
      parseAppLocation("/tasks", "?task=missing"),
      tasks,
      "event-current",
    ),
    {
      status: "invalid",
      reason: "unknown-task",
      taskId: "missing",
      task: null,
    },
  );
  assert.deepEqual(
    resolveTaskLocation(
      parseAppLocation("/tasks", "?task=task-other"),
      tasks,
      "event-current",
    ),
    {
      status: "invalid",
      reason: "wrong-event",
      taskId: "task-other",
      task: null,
    },
  );
  assert.deepEqual(
    resolveTaskLocation(parseAppLocation("/tasks", ""), tasks, "event-current"),
    {
      status: "none",
      taskId: null,
      task: null,
    },
  );
});

test("recognizes only task-detail entries created by the application", () => {
  assert.equal(isTaskDetailHistoryState(TASK_DETAIL_HISTORY_STATE), true);
  assert.equal(isTaskDetailHistoryState({ budographTaskDetail: true }), true);
  assert.deepEqual(createTaskDetailHistoryState("deadline:task-one"), {
    budographTaskDetail: true,
    taskFocusKey: "deadline:task-one",
  });
  assert.equal(isTaskDetailHistoryState({ budographTaskDetail: false }), false);
  assert.equal(
    isTaskDetailHistoryState({
      budographTaskDetail: true,
      taskFocusKey: 12,
    }),
    false,
  );
  assert.equal(isTaskDetailHistoryState({}), false);
  assert.equal(isTaskDetailHistoryState(null), false);
});

test("a direct Dashboard entry starts collapsed without an unrelated origin", () => {
  for (const state of [
    null,
    undefined,
    {},
    createTaskDetailHistoryState("focus:task-six"),
  ]) {
    assert.deepEqual(readDashboardContext(state), { focusExpanded: false });
  }
});

test("Dashboard disclosure and task return origin survive history serialization", () => {
  const context = {
    focusExpanded: true,
    origin: { taskId: "task-six", focusKey: "focus:task-six", scrollY: 1240 },
  };
  const dashboardEntry = withDashboardContext(
    { unrelated: "retained" },
    context,
  );
  const taskEntry = createTaskDetailHistoryState("focus:task-six");
  assert.ok("unrelated" in dashboardEntry);
  assert.equal(dashboardEntry.unrelated, "retained");
  // Back reads the original entry; Forward reads only the task entry. Neither mutates the other.
  assert.deepEqual(
    readDashboardContext(JSON.parse(JSON.stringify(dashboardEntry))),
    context,
  );
  assert.deepEqual(readDashboardContext(taskEntry), { focusExpanded: false });
  assert.deepEqual(readDashboardContext(dashboardEntry), context);
});

test("collapsing or changing a disclosure clears obsolete task return context", () => {
  const old = withDashboardContext(
    {},
    {
      focusExpanded: true,
      origin: { taskId: "six", focusKey: "focus:six", scrollY: 900 },
    },
  );
  assert.deepEqual(
    readDashboardContext(withDashboardContext(old, { focusExpanded: false })),
    { focusExpanded: false },
  );
  assert.equal(readDashboardContext(old).focusExpanded, true);
});

test("malformed Dashboard history cannot introduce invalid scroll or focus context", () => {
  for (const context of [null, true, { focusExpanded: "true" }]) {
    assert.deepEqual(readDashboardContext({ budographDashboard: context }), {
      focusExpanded: false,
    });
  }
  for (const scrollY of [-1, NaN, Infinity, "400"]) {
    assert.deepEqual(
      readDashboardContext({
        budographDashboard: {
          focusExpanded: true,
          origin: { taskId: "six", focusKey: "focus:six", scrollY },
        },
      }),
      { focusExpanded: true },
    );
  }
  assert.deepEqual(
    readDashboardContext({
      budographDashboard: {
        focusExpanded: true,
        origin: { taskId: "six", focusKey: 12, scrollY: 0 },
      },
    }),
    { focusExpanded: true },
  );
});

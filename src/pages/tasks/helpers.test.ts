import assert from "node:assert/strict";
import test from "node:test";
import type { Task, TeamMember } from "../../domain/types.ts";
import {
  filterTasks,
  getTaskCategories,
  groupTasksByStatus,
  hasActiveTaskFilters,
  type TaskFilters,
} from "./helpers.ts";

const NOW = new Date("2026-08-15T09:00:00.000Z");

const members: TeamMember[] = [
  {
    id: "member-mira",
    name: "Mira Velin",
    role: "Lead organizer",
    isOrganizer: true,
  },
  {
    id: "member-lina",
    name: "Лина Морева",
    role: "Venue coordinator",
    isOrganizer: false,
  },
];

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    eventId: "event-one",
    title: `Task ${id}`,
    category: "Venue",
    ownerId: "member-mira",
    deadline: "2026-08-20",
    deadlineTime: null,
    status: "not-started",
    priority: "normal",
    context: "Operational preparation context",
    acknowledged: false,
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const allFilters: TaskFilters = {
  search: "",
  status: "all",
  ownerId: "all",
  category: "all",
};

test("Board always has four columns, including when the Event has no tasks", () => {
  assert.deepEqual(groupTasksByStatus([]), [
    { status: "not-started", tasks: [] },
    { status: "in-progress", tasks: [] },
    { status: "blocked", tasks: [] },
    { status: "completed", tasks: [] },
  ]);
});

test("Board preserves the filtered List's tasks and operational ordering within each status", () => {
  const fixtures = [
    makeTask("later", { deadline: "2026-08-27", ownerId: "" }),
    makeTask("overdue-b", { deadline: "2026-08-10" }),
    makeTask("overdue-a", { deadline: "2026-08-10", acknowledged: true }),
    makeTask("blocked", { status: "blocked" }),
    makeTask("progress", { status: "in-progress", ownerId: "member-lina" }),
    makeTask("done", {
      status: "completed",
      deadline: "2026-08-10",
      category: "Travel",
    }),
  ];
  const list = filterTasks(fixtures, members, allFilters, NOW);
  const board = groupTasksByStatus(list);
  assert.deepEqual(
    board.map(({ tasks }) => tasks.length),
    [3, 1, 1, 1],
  );
  assert.deepEqual(
    board[0].tasks.map(({ id }) => id),
    ["overdue-a", "overdue-b", "later"],
  );
  assert.equal(board[0].tasks[0].acknowledged, true);
  assert.equal(board[0].tasks[2].ownerId, "");
  assert.equal(board[3].tasks[0].id, "done");

  for (const filters of [
    { search: "ЛИНА" },
    { status: "blocked" as const },
    { ownerId: "member-mira", category: "Venue", search: "overdue" },
    { category: "missing" },
  ]) {
    const visible = filterTasks(
      fixtures,
      members,
      { ...allFilters, ...filters },
      NOW,
    );
    const columns = groupTasksByStatus(visible);
    for (const { status, tasks } of columns)
      assert.deepEqual(
        tasks,
        visible.filter((task) => task.status === status),
      );
  }
});

test("task search matches localized title, context, category, and owner", () => {
  const tasks = [
    makeTask("travel", {
      title: "Confirm airport transfer",
      category: "Travel",
      context: "Backup driver and meeting point",
    }),
    makeTask("venue", {
      title: "Проверка на достъпния вход",
      ownerId: "member-lina",
      category: "Зала",
      context: "Маршрут без стъпала",
    }),
  ];

  for (const search of ["AIRPORT", "backup driver", "travel"]) {
    assert.deepEqual(
      filterTasks(tasks, members, { ...allFilters, search }, NOW).map(
        (task) => task.id,
      ),
      ["travel"],
    );
  }

  for (const search of ["ПРОВЕРКА", "стъпала", "зала", "ЛИНА"]) {
    assert.deepEqual(
      filterTasks(tasks, members, { ...allFilters, search }, NOW).map(
        (task) => task.id,
      ),
      ["venue"],
    );
  }
});

test("status, owner, and category filters combine without using Accepted as status", () => {
  const tasks = [
    makeTask("matching", {
      ownerId: "member-lina",
      category: "Safety",
      status: "in-progress",
      acknowledged: false,
    }),
    makeTask("wrong-owner", {
      category: "Safety",
      status: "in-progress",
      acknowledged: true,
    }),
    makeTask("wrong-category", {
      ownerId: "member-lina",
      category: "Travel",
      status: "in-progress",
      acknowledged: true,
    }),
    makeTask("wrong-status", {
      ownerId: "member-lina",
      category: "Safety",
      status: "completed",
      acknowledged: true,
    }),
  ];

  const result = filterTasks(
    tasks,
    members,
    {
      search: "",
      status: "in-progress",
      ownerId: "member-lina",
      category: "Safety",
    },
    NOW,
  );

  assert.deepEqual(
    result.map((task) => task.id),
    ["matching"],
  );
  assert.equal(result[0]?.acknowledged, false);
});

test("operational ordering puts overdue work first, then blockers, then deadlines", () => {
  const tasks = [
    makeTask("later", { deadline: "2026-08-22" }),
    makeTask("blocked", {
      deadline: "2026-08-30",
      deadlineTime: null,
      status: "blocked",
    }),
    makeTask("overdue-b", { deadline: "2026-08-10" }),
    makeTask("overdue-a", { deadline: "2026-08-10" }),
    makeTask("sooner", { deadline: "2026-08-18" }),
  ];

  assert.deepEqual(
    filterTasks(tasks, members, allFilters, NOW).map((task) => task.id),
    ["overdue-a", "overdue-b", "blocked", "sooner", "later"],
  );
});

test("category options are unique and active-filter detection ignores whitespace", () => {
  const tasks = [
    makeTask("one", { category: "Travel" }),
    makeTask("two", { category: "Venue" }),
    makeTask("three", { category: "Travel" }),
  ];

  assert.deepEqual(getTaskCategories(tasks), ["Travel", "Venue"]);
  assert.equal(hasActiveTaskFilters({ ...allFilters, search: "   " }), false);
  assert.equal(
    hasActiveTaskFilters({ ...allFilters, category: "Travel" }),
    true,
  );
});

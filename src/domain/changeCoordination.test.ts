import assert from "node:assert/strict";
import test from "node:test";
import type { RemoteChange } from "../services/changes.ts";
import {
  getChangeCoordinationState,
  getEventChanges,
  getPersonalChangeAttention,
} from "./changeCoordination.ts";
import { changeHref } from "../routes.ts";
import { getAttentionTasks } from "./workspace.ts";
import type { Task } from "./types.ts";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const member = { id: uid(2), name: "Current member", role: "Organizer" };
const organizer = {
  id: uid(1),
  membership: { id: member.id, accessRole: "ORGANIZER" as const },
};
const reader = {
  id: uid(1),
  membership: { id: member.id, accessRole: "MEMBER" as const },
};
const decision = {
  text: "Agreed approach",
  authoredBy: member,
  createdAt: "2026-10-05T10:00:00Z",
  updatedAt: "2026-10-05T10:00:00Z",
};
function change(n: number, fields: Partial<RemoteChange> = {}): RemoteChange {
  return {
    id: uid(n),
    eventId: uid(1),
    title: `Change ${n}`,
    context: "",
    reporter: member,
    responseOwner: null,
    decision: null,
    response: null,
    planB: null,
    version: 1,
    createdAt: "2026-10-05T10:00:00Z",
    updatedAt: "2026-10-05T10:00:00Z",
    affectedTasks: [],
    impact: { taskCount: 0, people: [], deadlines: [] },
    ...fields,
  };
}

test("Operational Changes use current Event, updated time rather than creation, stable ID and durable routes without mutating input", () => {
  const values = [
    change(6, { createdAt: "2026-10-06T12:00:00Z" }),
    change(5),
    change(4, { updatedAt: "2026-10-06T13:00:00Z" }),
    change(7, { eventId: uid(99) }),
  ];
  const before = structuredClone(values);
  assert.deepEqual(
    getEventChanges(values, uid(1)).map((c) => c.id),
    [uid(4), uid(5), uid(6)],
  );
  assert.deepEqual(values, before);
  assert.equal(
    changeHref(uid(1), uid(4)),
    `/events/${uid(1)}/changes/${uid(4)}`,
  );
});
test("unowned Change produces one Organizer item with highest precedence; descriptive Organizer role grants Member nothing", () => {
  const values = [change(4, { planB: "Optional fallback" })];
  assert.deepEqual(
    getPersonalChangeAttention(values, organizer).map((i) => i.reason),
    ["needs-owner"],
  );
  assert.deepEqual(getPersonalChangeAttention(values, reader), []);
});
test("own no-Decision coordination is personal for both access roles, independent of partial Response/Plan B and Task links", () => {
  const own = change(4, {
    responseOwner: member,
    response: "Partial response",
    planB: "Optional fallback",
  });
  const other = change(5, { responseOwner: { ...member, id: uid(3) } });
  for (const event of [organizer, reader]) {
    assert.deepEqual(
      getPersonalChangeAttention([own, other], event).map((i) => [
        i.change.id,
        i.reason,
      ]),
      [[own.id, "needs-decision"]],
    );
    assert.equal(
      event.membership.accessRole,
      event === reader ? "MEMBER" : "ORGANIZER",
    );
  }
});
test("own Decision without Response creates exactly the next coordination item, including Member response owner", () => {
  const value = change(4, { responseOwner: member, decision });
  for (const event of [organizer, reader])
    assert.deepEqual(
      getPersonalChangeAttention([value], event).map((i) => i.reason),
      ["needs-response"],
    );
});
test("recorded Decision/Response needs no attention with or without optional Plan B, and other owners/foreign Events remain excluded", () => {
  const values = [
    change(4, {
      responseOwner: member,
      decision,
      response: "Coordination underway",
    }),
    change(5, {
      responseOwner: member,
      decision,
      response: "Underway",
      planB: "Fallback",
    }),
    change(6, { responseOwner: { ...member, id: uid(3) }, decision }),
    change(7, { eventId: uid(99) }),
  ];
  assert.deepEqual(getPersonalChangeAttention(values, organizer), []);
  assert.deepEqual(getPersonalChangeAttention(values, reader), []);
  assert.deepEqual(values.slice(0, 2).map(getChangeCoordinationState), [
    "decision-recorded",
    "plan-b-prepared",
  ]);
  assert.equal(
    getChangeCoordinationState(change(8, { planB: "Fallback only" })),
    "decision-pending",
  );
});
test("personal coordination deduplicates applicable rules and leaves Task attention/lifecycle/assignment independent", () => {
  const task: Task = {
    id: uid(30),
    eventId: uid(1),
    title: "Affected task",
    category: "",
    context: "",
    ownerId: member.id,
    deadline: "2026-10-05",
    status: "blocked",
    priority: "normal",
    acknowledged: false,
    updatedAt: "2026-10-05T10:00:00Z",
  };
  const now = new Date(2026, 9, 6, 12),
    before = structuredClone(task);
  const base = getAttentionTasks([task], now, 100);
  const value = change(4, {
    affectedTasks: [
      {
        id: task.id,
        title: task.title,
        status: task.status,
        deadline: task.deadline,
        assignedMember: member,
      },
    ],
    impact: { taskCount: 1, people: [member], deadlines: [task.deadline] },
  });
  assert.equal(getPersonalChangeAttention([value], organizer).length, 1);
  assert.deepEqual(getAttentionTasks([task], now, 100), base);
  assert.deepEqual(task, before);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGH_ACTIVE_LOAD_THRESHOLD,
  type TeamWorkload,
} from "../../domain/workspace.ts";
import { getWorkloadSignal } from "./helpers.ts";

function workload(values: Partial<Omit<TeamWorkload, "member">>): TeamWorkload {
  return {
    member: {
      id: "member-test",
      name: "Test Member",
      role: "Test role",
      isOrganizer: false,
    },
    assigned: 0,
    completed: 0,
    active: 0,
    blocked: 0,
    overdue: 0,
    atRisk: 0,
    ...values,
  };
}

test("workload signals distinguish blockers, timing risk, load, and no work", () => {
  assert.equal(getWorkloadSignal(workload({ blocked: 1 })), "blocked");
  assert.equal(getWorkloadSignal(workload({ overdue: 1 })), "overdue");
  assert.equal(
    getWorkloadSignal(
      workload({
        assigned: HIGH_ACTIVE_LOAD_THRESHOLD,
        active: HIGH_ACTIVE_LOAD_THRESHOLD,
      }),
    ),
    "high",
  );
  assert.equal(getWorkloadSignal(workload({})), "unassigned");
  assert.equal(getWorkloadSignal(workload({ assigned: 1 })), "clear");
});

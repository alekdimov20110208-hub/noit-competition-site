import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/auth/session.ts";
import {
  AuthorizationError,
  createEventAuthorization,
  type AuthorizationDatabase,
} from "../src/authorization/events.ts";

const eventId = "f3051b23-c2fb-49dc-b0e7-c5feef09cda1";
const foreignEventId = "ef1b3642-2953-4eb9-b14e-8bed3a23de52";
const memberId = "fa2f2920-64b2-4664-9f06-45fd8cbccaf6";
const otherMemberId = "372fc0b8-5846-4584-b189-52ec3d482266";
const taskId = "e0d93ba0-58c6-4c31-ad9a-b0b80c3b77b5";
const user: AuthenticatedUser = {
  id: "AUTHENTICATED_TEST_USER",
  name: "Synthetic member",
  email: "member@example.invalid",
};

interface TestRequest {
  // Explicit test double for the trusted session boundary, not an HTTP field.
  sessionIdentity?: AuthenticatedUser;
  body?: Record<string, unknown>;
}

function harness(rows: unknown[][] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const order: string[] = [];
  const database: AuthorizationDatabase = {
    query: async (text, values) => {
      calls.push({ text, values });
      order.push("database");
      return { rows: rows.shift() ?? [] };
    },
  };
  const authorization = createEventAuthorization<TestRequest>({
    database,
    requireAuthenticatedUser: async (request) => {
      order.push("authentication");
      if (!request.sessionIdentity) {
        throw Object.assign(new Error("Authentication required."), {
          statusCode: 401,
        });
      }
      return request.sessionIdentity;
    },
  });
  return { authorization, calls, order };
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: memberId,
    event_id: eventId,
    user_id: user.id,
    access_role: "MEMBER",
    operational_role: "Organizer and administrator",
    active: true,
    deactivated_at: null,
    version: 1,
    ...overrides,
  };
}

function denied(statusCode: 403 | 404) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.statusCode, statusCode);
    assert.doesNotMatch(
      error.message,
      /AUTHENTICATED_TEST_USER|SELECT|f3051b23/,
    );
    return true;
  };
}

test("all authorization helpers require a trusted session before any query", async () => {
  const { authorization, calls, order } = harness([[member()]]);
  const forged = {
    body: {
      actorId: user.id,
      userId: user.id,
      eventId,
      membershipId: memberId,
      accessRole: "ORGANIZER",
      isOrganizer: true,
    },
  };
  for (const check of [
    () => authorization.getEventMembership(forged, eventId),
    () => authorization.requireActiveEventMembership(forged, eventId),
    () => authorization.requireOrganizerMembership(forged, eventId),
    () => authorization.requireOwnAssignedTask(forged, eventId, taskId),
  ]) {
    await assert.rejects(check(), (error: unknown) => {
      assert.equal((error as { statusCode: number }).statusCode, 401);
      return true;
    });
  }
  assert.deepEqual(order, Array(4).fill("authentication"));
  assert.deepEqual(calls, []);
});

test("membership lookup parameterizes Event and session identity and rechecks active User", async () => {
  const { authorization, calls, order } = harness([[member()]]);
  const result = await authorization.getEventMembership(
    {
      sessionIdentity: user,
      body: { actorId: "FORGED_USER", userId: "FORGED_USER" },
    },
    eventId,
  );
  assert.equal(result?.userId, user.id);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(order, ["authentication", "database"]);
  assert.deepEqual(calls[0]?.values, [eventId, user.id]);
  assert.match(calls[0]?.text ?? "", /member\.event_id = \$1/);
  assert.match(calls[0]?.text ?? "", /member\.user_id = \$2/);
  assert.match(calls[0]?.text ?? "", /identity\.active = TRUE/);
  assert.doesNotMatch(
    calls[0]?.text ?? "",
    /FORGED_USER|AUTHENTICATED_TEST_USER/,
  );
});

test("missing, inactive, inconsistent, and foreign memberships deny without disclosure", async () => {
  for (const rows of [
    [],
    [member({ active: false, deactivated_at: new Date() })],
    [member({ active: true, deactivated_at: new Date() })],
    [member({ event_id: foreignEventId })],
    [member({ user_id: "FOREIGN_USER" })],
    [member({ access_role: "ADMIN" })],
  ]) {
    const { authorization } = harness([rows]);
    await assert.rejects(
      authorization.requireActiveEventMembership(
        { sessionIdentity: user },
        eventId,
      ),
      denied(404),
    );
  }
});

test("operational text and forged organizer fields cannot elevate MEMBER", async () => {
  const { authorization } = harness([[member()]]);
  await assert.rejects(
    authorization.requireOrganizerMembership(
      {
        sessionIdentity: user,
        body: { accessRole: "ORGANIZER", role: "ORGANIZER", isOrganizer: true },
      },
      eventId,
    ),
    denied(403),
  );
});

test("active ORGANIZER passes using the persisted access role", async () => {
  const { authorization } = harness([
    [member({ access_role: "ORGANIZER", operational_role: "Guest logistics" })],
  ]);
  const result = await authorization.requireOrganizerMembership(
    { sessionIdentity: user },
    eventId,
  );
  assert.equal(result.accessRole, "ORGANIZER");
  assert.equal(result.operationalRole, "Guest logistics");
});

test("invalid Event IDs authenticate first and never become SQL input", async () => {
  const { authorization, calls, order } = harness();
  await assert.rejects(
    authorization.requireActiveEventMembership(
      { sessionIdentity: user },
      "' OR TRUE --",
    ),
    denied(404),
  );
  assert.deepEqual(order, ["authentication"]);
  assert.deepEqual(calls, []);
});

test("own-assigned-task lookup scopes both IDs and excludes soft-deleted tasks", async () => {
  const { authorization, calls } = harness([
    [member()],
    [
      {
        id: taskId,
        event_id: eventId,
        assigned_member_id: memberId,
        version: 2,
      },
    ],
  ]);
  const result = await authorization.requireOwnAssignedTask(
    { sessionIdentity: user },
    eventId,
    taskId,
  );
  assert.deepEqual(result.task, {
    id: taskId,
    eventId,
    assignedMemberId: memberId,
    version: 2,
  });
  assert.deepEqual(calls[1]?.values, [eventId, taskId]);
  assert.match(
    calls[1]?.text ?? "",
    /event_id = \$1 AND id = \$2 AND deleted_at IS NULL/,
  );
});

test("own-assigned-task requires actual assignment even for an organizer", async () => {
  for (const assignedMember of [null, otherMemberId]) {
    const { authorization } = harness([
      [member({ access_role: "ORGANIZER" })],
      [
        {
          id: taskId,
          event_id: eventId,
          assigned_member_id: assignedMember,
          version: 1,
        },
      ],
    ]);
    await assert.rejects(
      authorization.requireOwnAssignedTask(
        {
          sessionIdentity: user,
          body: { assignedMemberId: memberId, acceptedBy: memberId },
        },
        eventId,
        taskId,
      ),
      denied(403),
    );
  }
});

test("foreign or missing tasks are non-disclosing and invalid IDs do not query tasks", async () => {
  for (const taskRows of [
    [],
    [
      {
        id: taskId,
        event_id: foreignEventId,
        assigned_member_id: memberId,
        version: 1,
      },
    ],
  ]) {
    const { authorization } = harness([[member()], taskRows]);
    await assert.rejects(
      authorization.requireOwnAssignedTask(
        { sessionIdentity: user },
        eventId,
        taskId,
      ),
      denied(404),
    );
  }
  const { authorization, calls } = harness([[member()]]);
  await assert.rejects(
    authorization.requireOwnAssignedTask(
      { sessionIdentity: user },
      eventId,
      "invalid",
    ),
    denied(404),
  );
  assert.equal(calls.length, 1);
});

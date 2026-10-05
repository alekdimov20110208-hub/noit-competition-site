import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  ChangeService,
  ChangeFailure,
  authoredChange,
  readRemoteChange,
  validateChangeFields,
  type RemoteChange,
} from "./changes.ts";
import { changeHref, eventHref, parseAppLocation } from "../routes.ts";
import { safeReturnTo, loginHref } from "../auth/routing.ts";
import {
  CHANGE_BG_MESSAGES,
  CHANGE_EN_MESSAGES,
} from "../i18n/changeMessages.ts";
import { createI18n } from "../i18n/createI18n.ts";

const eventId = randomUUID(),
  changeId = randomUUID(),
  taskId = randomUUID();
const person = {
  id: randomUUID(),
  name: "Current assignee",
  role: "Organizer",
};
const value: RemoteChange = {
  id: changeId,
  eventId,
  title: "Arrival delayed",
  context: "Flight changed",
  reporter: { ...person, id: randomUUID() },
  responseOwner: null,
  decision: null,
  response: null,
  planB: null,
  version: 2,
  createdAt: "2026-10-05T10:00:00Z",
  updatedAt: "2026-10-05T11:00:00Z",
  affectedTasks: [
    {
      id: taskId,
      title: "Airport pickup",
      status: "blocked",
      deadline: "2026-11-03",
      assignedMember: person,
    },
  ],
  impact: { taskCount: 1, people: [person], deadlines: ["2026-11-03"] },
};
const signal = () => new AbortController().signal;
const failure = (code: string) => (error: unknown) =>
  error instanceof ChangeFailure && error.code === code;
test("Changes navigation and durable detail preserve scoped login return; Event switch drops former Change ID", () => {
  const href = changeHref(eventId, changeId);
  const location = parseAppLocation(href, "?token=discard");
  assert.deepEqual(location, {
    path: "/changes",
    taskId: null,
    eventId,
    eventMode: "workspace",
    changeId,
  });
  assert.equal(safeReturnTo(href + "?token=discard"), href);
  assert.equal(
    new URL("https://budograph.invalid" + loginHref(href)).searchParams.get(
      "returnTo",
    ),
    href,
  );
  const next = eventHref(randomUUID(), location.path);
  assert.ok(next.endsWith("/changes"));
  assert.equal(parseAppLocation(next, "").changeId, undefined);
  assert.equal(
    parseAppLocation(`/events/${eventId}/changes/invalid`, "").changeId,
    "invalid",
  );
  assert.equal(safeReturnTo(`/events/${eventId}/changes/%2F`), "/");
});
test("canonical Change projection rejects foreign IDs, malformed impact, duplicate Tasks and invented date semantics", () => {
  assert.deepEqual(readRemoteChange(value, eventId, changeId), value);
  for (const raw of [
    { ...value, eventId: randomUUID() },
    { ...value, id: randomUUID() },
    { ...value, version: 0 },
    {
      ...value,
      affectedTasks: [value.affectedTasks[0], value.affectedTasks[0]],
    },
    { ...value, impact: { ...value.impact, taskCount: 9 } },
    { ...value, impact: { ...value.impact, people: [] } },
    {
      ...value,
      impact: { ...value.impact, deadlines: ["2026-11-03T00:00:00Z"] },
    },
    {
      ...value,
      affectedTasks: [{ ...value.affectedTasks[0], status: "resolved" }],
    },
  ])
    assert.throws(
      () => readRemoteChange(raw, eventId, changeId),
      failure("invalid"),
    );
  assert.deepEqual(authoredChange(value), {
    title: value.title,
    context: value.context,
    responseOwnerMemberId: null,
    affectedTaskIds: [taskId],
    decision: null,
    response: null,
    planB: null,
  });
  assert.deepEqual(validateChangeFields(authoredChange(value)), {});
  assert.equal(
    validateChangeFields({ ...authoredChange(value), title: " " }).title,
    "INVALID_TEXT",
  );
});
test("server refetch reflects current people/date/status; writes whitelist fields and use expectedVersion with cookie auth", async () => {
  let current = structuredClone(value);
  const calls: { path: string; options?: RequestInit }[] = [];
  const request: typeof fetch = async (input, options) => {
    calls.push({ path: String(input), options });
    return Response.json(
      options?.method === "GET" && !String(input).endsWith(changeId)
        ? { changes: [current] }
        : { change: current },
    );
  };
  const service = new ChangeService(request);
  assert.equal((await service.list(eventId, signal())).length, 1);
  const replacement = { ...person, id: randomUUID(), name: "New assignee" };
  current = {
    ...current,
    affectedTasks: [
      {
        ...current.affectedTasks[0]!,
        assignedMember: replacement,
        deadline: "2026-12-01",
        status: "completed",
      },
    ],
    impact: { taskCount: 1, people: [replacement], deadlines: ["2026-12-01"] },
  };
  const read = await service.get(eventId, changeId, signal());
  assert.equal(read.impact.people[0].name, "New assignee");
  assert.equal(read.affectedTasks[0].status, "completed");
  assert.deepEqual(read.impact.deadlines, ["2026-12-01"]);
  await service.save(
    eventId,
    {
      ...authoredChange(read),
      actorId: "forged",
      createdAt: "forged",
      accessRole: "ORGANIZER",
    } as ReturnType<typeof authoredChange>,
    signal(),
    { id: changeId, expectedVersion: 2 },
  );
  const last = calls.at(-1)!;
  assert.equal(last.options!.method, "PATCH");
  assert.equal(last.options!.credentials, "same-origin");
  assert.equal(last.options!.cache, "no-store");
  assert.deepEqual(JSON.parse(last.options!.body as string), {
    ...authoredChange(read),
    expectedVersion: 2,
  });
  current = { ...value, version: 1 };
  assert.equal(
    (await service.save(eventId, authoredChange(value), signal())).version,
    1,
  );
  assert.equal(calls.at(-1)!.options!.method, "POST");
});
test("server empty list stays empty; 409, auth, validation, network and malformed responses fail safely without demo fallback", async () => {
  assert.deepEqual(
    await new ChangeService(async () => Response.json({ changes: [] })).list(
      eventId,
      signal(),
    ),
    [],
  );
  for (const [status, code] of [
    [400, "invalid"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [500, "unavailable"],
  ] as const) {
    const service = new ChangeService(async () =>
      Response.json(
        {
          private: "RAW_ERROR",
          fields: { title: "INVALID_TEXT", context: "PRIVATE_DB_DETAIL" },
        },
        { status },
      ),
    );
    await assert.rejects(
      service.save(eventId, authoredChange(value), signal(), {
        id: changeId,
        expectedVersion: 1,
      }),
      failure(code),
    );
    try {
      await service.list(eventId, signal());
    } catch (error) {
      assert.ok(error instanceof ChangeFailure);
      assert.ok(!error.message.includes("PRIVATE"));
      if (status === 400)
        assert.deepEqual(error.fields, { title: "INVALID_TEXT" });
    }
  }
  await assert.rejects(
    new ChangeService(async () => {
      throw new Error("PRIVATE_NETWORK");
    }).list(eventId, signal()),
    failure("unavailable"),
  );
  await assert.rejects(
    new ChangeService(async () =>
      Response.json({ changes: [value, value] }),
    ).list(eventId, signal()),
    failure("invalid"),
  );
  await assert.rejects(
    new ChangeService(async () => new Response("not json")).list(
      eventId,
      signal(),
    ),
    failure("invalid"),
  );
});
test("late aborted results cannot be presented after Event navigation", async () => {
  const controller = new AbortController();
  const service = new ChangeService(async () => {
    controller.abort();
    return Response.json({ change: value });
  });
  await assert.rejects(service.get(eventId, changeId, controller.signal));
});
test("complete BG/EN Change copy and shared event-local DATE formatting", () => {
  assert.deepEqual(
    Object.keys(CHANGE_BG_MESSAGES).sort(),
    Object.keys(CHANGE_EN_MESSAGES).sort(),
  );
  for (const key of Object.keys(
    CHANGE_EN_MESSAGES,
  ) as (keyof typeof CHANGE_EN_MESSAGES)[]) {
    assert.ok(CHANGE_BG_MESSAGES[key]);
    assert.deepEqual(
      CHANGE_BG_MESSAGES[key].match(/\{\w+\}/g),
      CHANGE_EN_MESSAGES[key].match(/\{\w+\}/g),
    );
  }
  assert.equal(createI18n("bg").t("nav.changes"), "Промени");
  assert.equal(createI18n("en").t("nav.changes"), "Changes");
  for (const language of ["bg", "en"] as const)
    assert.equal(
      createI18n(language, { timeZone: "Pacific/Honolulu" }).formatDate(
        "2026-11-03",
      ),
      createI18n(language, { timeZone: "Asia/Tokyo" }).formatDate("2026-11-03"),
    );
});
test("P3B current Decision provenance, partial state and drafts map independently from live impact", () => {
  const decision = {
    text: "Move pickup to 20:30",
    authoredBy: person,
    createdAt: "2026-10-05T11:00:00Z",
    updatedAt: "2026-10-05T11:00:00Z",
  };
  for (const state of [
    { decision: null, response: null, planB: null },
    { decision, response: null, planB: null },
    { decision, response: "Driver and hotel informed", planB: null },
    {
      decision,
      response: "Driver informed",
      planB: "Airport hotel if flight cancelled",
    },
    { decision: null, response: "Driver contacted", planB: null },
  ]) {
    const current = { ...value, ...state };
    assert.deepEqual(readRemoteChange(current, eventId, changeId), current);
    assert.deepEqual(authoredChange(current), {
      ...authoredChange(value),
      decision: state.decision?.text ?? null,
      response: state.response,
      planB: state.planB,
    });
    assert.deepEqual(validateChangeFields(authoredChange(current)), {});
  }
  for (const malformed of [
    { decision: { ...decision, text: " " } },
    { decision: { ...decision, text: null } },
    { decision: { ...decision, authoredBy: { ...person, id: "forged" } } },
    { decision: { ...decision, updatedAt: "2026-10-04T11:00:00Z" } },
    { decision: "unstructured" },
    { decision: undefined },
    { response: " " },
    { planB: "x".repeat(5001) },
    { planB: "bad\u0000" },
  ])
    assert.throws(
      () => readRemoteChange({ ...value, ...malformed }, eventId),
      failure("invalid"),
    );
  for (const key of ["decision", "response", "planB"] as const) {
    assert.equal(
      validateChangeFields({ ...authoredChange(value), [key]: " " })[key],
      "INVALID_TEXT",
    );
    assert.equal(
      validateChangeFields({ ...authoredChange(value), [key]: "\ud800" })[key],
      "INVALID_TEXT",
    );
  }
});
test("P3B saves whitelist text/null, preserves draft on safe 409 and accepts explicit canonical refetch", async () => {
  const draft = {
    ...authoredChange(value),
    decision: "Local decision",
    response: "Local response",
    planB: "Local fallback",
  };
  const original = structuredClone(draft);
  let sent: Record<string, unknown> = {};
  let conflict = true;
  const canonical = {
    ...value,
    version: 3,
    decision: {
      text: "Newer decision",
      authoredBy: person,
      createdAt: value.updatedAt,
      updatedAt: value.updatedAt,
    },
    response: null,
    planB: null,
  };
  const service = new ChangeService(async (_input, options) => {
    if (options?.method === "PATCH") {
      sent = JSON.parse(options.body as string);
      return conflict
        ? Response.json({ private: "PRIVATE" }, { status: 409 })
        : Response.json({ change: canonical });
    }
    return Response.json({ change: canonical });
  });
  await assert.rejects(
    service.save(eventId, draft, signal(), {
      id: changeId,
      expectedVersion: 2,
    }),
    failure("conflict"),
  );
  assert.deepEqual(draft, original);
  assert.deepEqual(sent, { ...draft, expectedVersion: 2 });
  const reloaded = await service.get(eventId, changeId, signal());
  assert.equal(reloaded.decision!.text, "Newer decision");
  assert.equal(reloaded.version, 3);
  assert.deepEqual(draft, original);
  conflict = false;
  await service.save(
    eventId,
    {
      ...authoredChange(reloaded),
      decision: null,
      response: null,
      planB: null,
    },
    signal(),
    { id: changeId, expectedVersion: 3 },
  );
  assert.equal(sent.decision, null);
  assert.equal(sent.response, null);
  assert.equal(sent.planB, null);
});

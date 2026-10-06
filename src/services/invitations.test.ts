import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  InvitationController,
  InvitationService,
  InvitationFailure,
  invitationPath,
  readInvitationToken,
  readInvitationSummary,
  readPendingInvitation,
  type PendingInvitation,
} from "./invitations.ts";
import { safeReturnTo, loginHref } from "../auth/routing.ts";
const eventId = "00000000-0000-4000-8000-000000000001";
const invite: PendingInvitation = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "member@example.invalid",
  createdAt: "2026-10-04T00:00:00Z",
  expiresAt: "2026-10-11T00:00:00Z",
  state: "pending",
};
test("invitation destinations are strictly internal, token-shaped and query-free", () => {
  const token = randomBytes(32).toString("base64url"),
    path = invitationPath(token)!;
  assert.equal(readInvitationToken(path), token);
  assert.equal(safeReturnTo(path), path);
  assert.equal(
    new URL(loginHref(path), "https://example.invalid").searchParams.get(
      "returnTo",
    ),
    path,
  );
  for (const path of [
    "//evil.invalid/invite/",
    "https://evil.invalid/invite/",
    "/invite/guess",
    `/invite/${token}?next=https://evil.invalid`,
    `/invite/${token}#fragment`,
    `/invite/${token}/`,
    `/invite/${token}%2fother`,
    `/invite/${token}\\evil`,
  ])
    assert.equal(safeReturnTo(path), "/");
});
test("recipient summary and pending DTO projection omit auth metadata and hashes", () => {
  assert.deepEqual(
    readInvitationSummary({
      state: "pending",
      eventName: "Real Event",
      email: invite.email,
      expiresAt: invite.expiresAt,
      token_hash: "do-not-return",
      roster: [],
    }),
    {
      state: "pending",
      eventName: "Real Event",
      email: invite.email,
      expiresAt: invite.expiresAt,
    },
  );
  assert.deepEqual(
    readPendingInvitation({ ...invite, token_hash: "do-not-return" }),
    invite,
  );
  for (const state of [
    "expired",
    "revoked",
    "accepted",
    "unavailable",
  ] as const)
    assert.deepEqual(
      readInvitationSummary({
        state,
        eventName: "hidden",
        email: invite.email,
      }),
      { state },
    );
  assert.throws(
    () => readInvitationSummary({ state: "unknown" }),
    InvitationFailure,
  );
});
test("transport sends narrow commands; development link is one response only", async () => {
  const token = randomBytes(32).toString("base64url"),
    calls: { path: string; input: RequestInit | undefined }[] = [];
  const service = new InvitationService(async (path, input) => {
    calls.push({ path: String(path), input });
    return new Response(
      JSON.stringify({
        invitation: invite,
        developmentInvitePath: invitationPath(token),
        delivery: "development_link",
      }),
      { status: 201 },
    );
  });
  const result = await service.create(
    eventId,
    " member@example.invalid ",
    new AbortController().signal,
  );
  assert.equal(result.path, invitationPath(token));
  assert.deepEqual(JSON.parse(String(calls[0]!.input?.body)), {
    email: invite.email,
  });
  assert.equal(calls[0]!.input?.credentials, "same-origin");
  assert.equal(calls[0]!.input?.referrerPolicy, "no-referrer");
});
test("production delivery success/failure and resend keep canonical invitation with no bearer link", async () => {
  for (const delivery of ["sent", "failed"] as const) {
    const service = new InvitationService(
      async () =>
        new Response(JSON.stringify({ invitation: invite, delivery })),
      () => "en",
    );
    const controller = new InvitationController(service, eventId, () =>
      assert.fail(),
    );
    // Load is not used here: the send DTO is the canonical pending invitation.
    await controller.create(invite.email);
    assert.equal(controller.getSnapshot().link, null);
    assert.equal(controller.getSnapshot().delivery, delivery);
    assert.equal(controller.getSnapshot().invitations[0]?.id, invite.id);
    await controller.resend(invite.id);
    assert.equal(controller.getSnapshot().invitations.length, 1);
    assert.equal(controller.getSnapshot().link, null);
    assert.equal(controller.getSnapshot().delivery, delivery);
  }
});
test("management controller creates, displays, revokes and clears bearer link", async () => {
  const token = randomBytes(32).toString("base64url");
  const controller = new InvitationController(
    {
      list: async () => [],
      create: async () => ({
        invitation: invite,
        path: invitationPath(token)!,
        delivery: "development_link" as const,
      }),
      revoke: async () => {},
    },
    eventId,
    () => assert.fail(),
  );
  await controller.load();
  assert.equal(controller.getSnapshot().loaded, true);
  await controller.create(invite.email);
  assert.equal(controller.getSnapshot().invitations.length, 1);
  assert.equal(controller.getSnapshot().link?.path, invitationPath(token));
  await controller.revoke(invite.id);
  assert.equal(controller.getSnapshot().invitations.length, 0);
  assert.equal(controller.getSnapshot().link, null);
  controller.dispose();
  assert.equal(controller.getSnapshot().link, null);
});
test("cancelled Event/identity work cannot publish and duplicate submissions coalesce", async () => {
  let resolve!: (value: PendingInvitation[]) => void,
    calls = 0;
  const pending = new Promise<PendingInvitation[]>((r) => (resolve = r));
  const controller = new InvitationController(
    {
      list: async () => {
        calls++;
        return pending;
      },
      create: async () => {
        throw new Error();
      },
      revoke: async () => {},
    },
    eventId,
    () => {},
  );
  const first = controller.load();
  void controller.load();
  assert.equal(calls, 1);
  controller.dispose();
  resolve([invite]);
  await first;
  assert.equal(controller.getSnapshot().invitations.length, 0);
  assert.equal(controller.getSnapshot().link, null);
});
test("session expiry clears administration and failure messages remain safe", async () => {
  let expired = false;
  const controller = new InvitationController(
    {
      list: async () => {
        throw new InvitationFailure("unauthenticated");
      },
      create: async () => {
        throw new Error();
      },
      revoke: async () => {},
    },
    eventId,
    () => {
      expired = true;
    },
  );
  await controller.load();
  assert.equal(expired, true);
  assert.equal(controller.getSnapshot().invitations.length, 0);
});

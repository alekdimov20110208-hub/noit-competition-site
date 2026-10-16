import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import { createTemplateApplicationService } from "../src/templates/service.ts";
import { SEMINAR_BLUEPRINT } from "../src/templates/catalog.ts";
import {
  templateFixture,
  eventId,
  user,
  operationId,
} from "./helpers/template-fixture.ts";

test("Template HTTP authenticates before scope, enforces origin/Fetch Metadata, bounded strict fields and safe results", async () => {
  const f = templateFixture();
  let signedIn = true;
  const app = createApp({
    checkDatabase: async () => {},
    templates: createTemplateApplicationService(f.pool),
    authentication: {
      baseURL: "http://localhost:3001",
      taskMutationOrigins: ["http://localhost:5173"],
      auth: {
        handler: async () => new Response(),
        api: {
          getSession: async () =>
            signedIn ? { user: { ...user, active: true } } : null,
        },
      },
    },
  });
  const selection = {
    templateId: SEMINAR_BLUEPRINT.id,
    templateVersion: 1,
    language: "en",
    itemIds: [SEMINAR_BLUEPRINT.items[0].id],
  };
  const url = `/api/events/${eventId}/templates/preview`,
    headers = { origin: "http://localhost:5173" };
  try {
    signedIn = false;
    assert.equal(
      (await app.inject({ method: "POST", url, headers, payload: selection }))
        .statusCode,
      401,
    );
    assert.equal(f.calls.length, 0);
    signedIn = true;
    for (const bad of [
      {},
      { origin: "https://foreign.invalid" },
      { ...headers, "sec-fetch-site": "cross-site" },
    ])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url,
            headers: bad,
            payload: selection,
          })
        ).statusCode,
        403,
      );
    assert.equal(f.calls.length, 0);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `${url}?actor=forged`,
          headers,
          payload: selection,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url,
          headers,
          payload: { ...selection, tasks: [] },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url,
          headers,
          payload: { ...selection, padding: "x".repeat(5000) },
        })
      ).statusCode,
      413,
    );
    const preview = await app.inject({
      method: "POST",
      url,
      headers,
      payload: selection,
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.headers["cache-control"], "no-store");
    const review = preview.json();
    const apply = {
      ...selection,
      expectedEventVersion: review.event.version,
      reviewRevision: review.reviewRevision,
      confirmed: true,
    };
    const applyUrl = `/api/events/${eventId}/templates/apply`;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: applyUrl,
          headers,
          payload: apply,
        })
      ).statusCode,
      400,
    );
    const result = await app.inject({
      method: "POST",
      url: applyUrl,
      headers: { ...headers, "idempotency-key": operationId },
      payload: apply,
    });
    assert.equal(result.statusCode, 201);
    assert.equal(result.json().createdCount, 1);
    assert.deepEqual(
      (
        await app.inject({
          method: "POST",
          url: applyUrl,
          headers: { ...headers, "idempotency-key": operationId },
          payload: apply,
        })
      ).json(),
      result.json(),
    );
    f.options.failReceipt = true;
    const fresh = (
      await app.inject({ method: "POST", url, headers, payload: selection })
    ).json();
    const failed = await app.inject({
      method: "POST",
      url: applyUrl,
      headers: {
        ...headers,
        "idempotency-key": "44444444-4444-4444-8444-444444444444",
      },
      payload: { ...apply, reviewRevision: fresh.reviewRevision },
    });
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(failed.json(), { status: "error" });
  } finally {
    await app.close();
  }
});

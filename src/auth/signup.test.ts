import assert from "node:assert/strict";
import test from "node:test";
import { validateSignup, signupAvailability, signupCommand } from "./signup.ts";
const fields = {
  name: "Synthetic",
  email: "person@example.invalid",
  password: "syntheticPassword123",
  confirmPassword: "syntheticPassword123",
  returnTo: "/",
};
test("signup client validation covers name/email/password/mismatch", () => {
  assert.equal(validateSignup(fields), null);
  assert.equal(validateSignup({ ...fields, name: "<>" }), "invalidName");
  assert.equal(validateSignup({ ...fields, email: "bad" }), "invalidEmail");
  assert.equal(
    validateSignup({ ...fields, password: "short" }),
    "invalidPassword",
  );
  assert.equal(
    validateSignup({ ...fields, confirmPassword: "different" }),
    "mismatch",
  );
});
test("email length limits match registration boundaries before a request", () => {
  const longest = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(longest.length, 254);
  for (const email of [
    ` ${"A".repeat(64)}@EXAMPLE.invalid `,
    `a@${"b".repeat(63)}.invalid`,
    `a@example.${"b".repeat(63)}`,
    longest,
  ])
    assert.equal(validateSignup({ ...fields, email }), null);
  for (const email of [
    `${"a".repeat(65)}@example.invalid`,
    `a@${"b".repeat(64)}.invalid`,
    `a@example.${"b".repeat(64)}`,
    longest + "d",
  ])
    assert.equal(validateSignup({ ...fields, email }), "invalidEmail");
});
test("signup capability fails closed and client response ignores all identity data", async (t) => {
  let response = Response.json({ enabled: false });
  t.mock.method(
    globalThis,
    "fetch",
    async (path: string, init: RequestInit) => {
      assert.equal(path, "/api/registration");
      assert.equal(init.cache, "no-store");
      if (init.method) {
        assert.equal(init.method, "POST");
        assert.deepEqual(JSON.parse(String(init.body)), fields);
        assert.equal(new Headers(init.headers).get("x-budograph-locale"), "bg");
      }
      return response.clone();
    },
  );
  assert.equal(await signupAvailability(new AbortController().signal), false);
  response = Response.json({ enabled: "true" });
  assert.equal(await signupAvailability(new AbortController().signal), false);
  response = Response.json({ enabled: true });
  assert.equal(await signupAvailability(new AbortController().signal), true);
  for (const [status, expected] of [
    [404, "closed"],
    [429, "limited"],
    [503, "unavailable"],
    [400, "failed"],
  ] as const) {
    response = Response.json({}, { status });
    assert.equal(await signupCommand(fields, "bg"), expected);
  }
  response = Response.json({
    status: true,
    user: { role: "ORGANIZER" },
    token: "synthetic",
  });
  assert.equal(await signupCommand(fields, "bg"), null);
  response = Response.json({ status: false });
  assert.equal(await signupCommand(fields, "bg"), "failed");
});

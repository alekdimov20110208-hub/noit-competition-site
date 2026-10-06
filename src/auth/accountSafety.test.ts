import assert from "node:assert/strict";
import test from "node:test";
import {
  readResetToken,
  setPendingVerification,
  takePendingVerification,
  accountSafetyCommand,
} from "./accountSafety.ts";
test("reset credentials reject missing/malformed input and verification continuation rejects external destinations", () => {
  for (const search of [
    "",
    "?token=x",
    "?token=../bad",
    "?token=" + "x".repeat(129),
  ])
    assert.equal(readResetToken(search), null);
  assert.equal(
    readResetToken("?token=syntheticResetToken123456"),
    "syntheticResetToken123456",
  );
  setPendingVerification(
    "synthetic@example.invalid",
    "https://attacker.invalid",
  );
  assert.equal(takePendingVerification()?.returnTo, "/");
});
test("account safety transport never surfaces raw errors, uses same-origin/no-referrer and localized commands", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const [status, result] of [
    [200, null],
    [429, "limited"],
    [400, "invalid"],
    [503, "unavailable"],
  ] as const) {
    globalThis.fetch = async (path, options) => {
      assert.equal(path, "/api/auth/request-password-reset");
      assert.equal(options?.credentials, "same-origin");
      assert.equal(options?.referrerPolicy, "no-referrer");
      assert.equal(
        new Headers(options?.headers).get("x-budograph-locale"),
        "bg",
      );
      return new Response("SYNTHETIC_PRIVATE_PROVIDER_BODY", { status });
    };
    assert.equal(
      await accountSafetyCommand(
        "request-password-reset",
        { email: "synthetic@example.invalid" },
        "bg",
      ),
      result,
    );
  }
  globalThis.fetch = async () => {
    throw new Error("SYNTHETIC_PRIVATE_ERROR");
  };
  assert.equal(
    await accountSafetyCommand("request-password-reset", {}, "en"),
    "unavailable",
  );
});

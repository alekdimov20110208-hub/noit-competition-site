import assert from "node:assert/strict";
import test from "node:test";
import { readDevelopmentAccounts } from "../src/auth/development-accounts.ts";

const inputs = {
  BUDOGRAPH_ORGANIZER_EMAIL: " ORGANIZER@example.invalid ",
  BUDOGRAPH_ORGANIZER_PASSWORD: "SYNTHETIC_ONLY_ORGANIZER_SECRET",
  BUDOGRAPH_ORGANIZER_NAME: " Organizer ",
  BUDOGRAPH_MEMBER_EMAIL: "member@example.invalid",
  BUDOGRAPH_MEMBER_PASSWORD: "SYNTHETIC_ONLY_MEMBER_SECRET",
  BUDOGRAPH_MEMBER_NAME: "Member",
};

test("controlled-account configuration is separate, normalized and immutable", () => {
  const accounts = readDevelopmentAccounts(inputs);
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0]?.email, "organizer@example.invalid");
  assert.equal(accounts[0]?.name, "Organizer");
  assert.equal(Object.isFrozen(accounts[0]), true);
});

test("provisioning rejects missing, duplicate or placeholder inputs without disclosing values", () => {
  for (const invalid of [
    {},
    { ...inputs, BUDOGRAPH_MEMBER_EMAIL: inputs.BUDOGRAPH_ORGANIZER_EMAIL },
    { ...inputs, BUDOGRAPH_MEMBER_PASSWORD: "short" },
    { ...inputs, BUDOGRAPH_MEMBER_PASSWORD: "REPLACE_HIGH_ENTROPY_PASSWORD" },
    { ...inputs, BUDOGRAPH_MEMBER_NAME: "" },
  ]) {
    assert.throws(
      () => readDevelopmentAccounts(invalid),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(
          error.message,
          /SYNTHETIC_ONLY|example\.invalid|REPLACE_HIGH|short/,
        );
        return true;
      },
    );
  }
});

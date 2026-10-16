import assert from "node:assert/strict";
import test from "node:test";
import { validateTemplateTestDatabase } from "./helpers/template-isolated-db.ts";
test("template SQL tests reject shared/nonlocal/ambiguous/unconfirmed database URLs before connecting", () => {
  const name = "budograph_t2_isolated_example",
    confirmation = `${name}:DISPOSABLE`;
  assert.equal(
    validateTemplateTestDatabase(
      `postgresql://test@127.0.0.1:5433/${name}`,
      confirmation,
    ),
    name,
  );
  for (const url of [
    "postgresql://test@shared.supabase.co/postgres",
    `postgresql://test@127.0.0.1/postgres`,
    `postgresql://test@127.0.0.1/${name}?host=foreign.invalid`,
    "",
  ])
    assert.throws(() => validateTemplateTestDatabase(url, confirmation));
  assert.throws(() =>
    validateTemplateTestDatabase(`postgresql://test@localhost/${name}`, ""),
  );
});

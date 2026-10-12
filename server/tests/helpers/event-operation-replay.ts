import { readDatabaseEnv } from "../../src/config/env.ts";
import { createDatabasePool } from "../../src/db/pool.ts";
import { runEventOperation } from "../../src/events/operations.ts";

const [actor, source, key, raw] = process.argv.slice(2);
const pool = createDatabasePool(readDatabaseEnv(), () => {});
try {
  const result = await runEventOperation(
    pool,
    { id: actor!, name: "Synthetic replay", email: "replay@example.invalid" },
    source!,
    key!,
    JSON.parse(raw!),
    async () => {
      throw new Error("Replay executed effects");
    },
  );
  process.stdout.write(JSON.stringify({ id: result.id }));
} catch {
  process.stderr.write("Independent replay failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

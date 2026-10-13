import { readDatabaseEnv } from "../../src/config/env.ts";
import { createDatabasePool } from "../../src/db/pool.ts";
import { createEventService } from "../../src/events/service.ts";
const [actor, event, key] = process.argv.slice(2);
const config = readDatabaseEnv();
if (config.nodeEnv === "production") throw Error("Development only");
const pool = createDatabasePool(config, () => {});
try {
  const result = await createEventService(pool).archive(
    { id: actor!, name: "Synthetic replay", email: "replay@example.invalid" },
    event!,
    key!,
    { expectedVersion: 1, confirmationName: "Disposable P1C fixture" },
  );
  console.log(
    JSON.stringify({
      id: result.id,
      version: result.version,
      archived: result.archived,
    }),
  );
} catch {
  throw Error("Synthetic archive replay failed");
} finally {
  await pool.end();
}

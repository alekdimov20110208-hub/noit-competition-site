import { readDatabaseEnv } from "../../src/config/env.ts";
import { createDatabasePool } from "../../src/db/pool.ts";
import { createEventService } from "../../src/events/service.ts";
const [actor, event, key, input] = process.argv.slice(2),
  pool = createDatabasePool(readDatabaseEnv(), () => {});
try {
  console.log(
    JSON.stringify(
      await createEventService(pool).clearTasks(
        { id: actor!, name: "Synthetic", email: "test@example.invalid" },
        event!,
        key,
        JSON.parse(input!),
      ),
    ),
  );
} finally {
  await pool.end();
}

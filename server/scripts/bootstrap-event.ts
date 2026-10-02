import { EnvironmentError, readDatabaseEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";
import {
  bootstrapDevelopmentEvent,
  readBootstrapConfig,
} from "../src/development/bootstrap.ts";

let pool: ReturnType<typeof createDatabasePool> | undefined;
try {
  const config = readBootstrapConfig();
  pool = createDatabasePool(readDatabaseEnv(), () => {});
  const result = await bootstrapDevelopmentEvent(pool, config);
  for (const item of result.results)
    console.info(`Development ${item.resource}: ${item.result}.`);
  console.info(
    JSON.stringify({
      eventId: result.eventId,
      organizerMemberId: result.organizerMemberId,
      memberId: result.memberId,
      taskId: result.taskId,
    }),
  );
} catch (error) {
  console.error(
    error instanceof EnvironmentError
      ? error.message
      : "Development Event bootstrap failed; database/account details omitted.",
  );
  process.exitCode = 1;
} finally {
  try {
    await pool?.end();
  } catch {
    console.error("Bootstrap database cleanup failed; details omitted.");
    process.exitCode = 1;
  }
}

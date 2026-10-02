import { createAuth } from "../src/auth/auth.ts";
import {
  provisionDevelopmentAccounts,
  readDevelopmentAccounts,
} from "../src/auth/development-accounts.ts";
import { EnvironmentError, readServerEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";

let pool: ReturnType<typeof createDatabasePool> | undefined;
try {
  const config = readServerEnv();
  if (config.nodeEnv !== "development")
    throw new EnvironmentError("Account provisioning is DEVELOPMENT ONLY.");
  const accounts = readDevelopmentAccounts();
  pool = createDatabasePool(config, () => {});
  const auth = createAuth(pool, config, { developmentProvisioning: true });
  const results = await provisionDevelopmentAccounts(pool, auth, accounts);
  for (const { label, result } of results)
    console.info(`Development ${label} account: ${result}.`);
} catch (error) {
  console.error(
    error instanceof EnvironmentError
      ? error.message
      : "Development account provisioning failed; credentials and database details omitted.",
  );
  process.exitCode = 1;
} finally {
  try {
    await pool?.end();
  } catch {
    console.error(
      "Could not close provisioning database pool; details omitted.",
    );
    process.exitCode = 1;
  }
}

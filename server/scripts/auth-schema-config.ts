// Loaded only by the pinned schema generator, never by the web runtime.
import { createAuth } from "../src/auth/auth.ts";
import { readServerEnv } from "../src/config/env.ts";
import { createDatabasePool } from "../src/db/pool.ts";

const config = readServerEnv();
const pool = createDatabasePool(config, () => {});
export const auth = createAuth(pool, config);

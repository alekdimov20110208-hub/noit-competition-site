import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import pg from "pg";
import { createDatabasePool } from "../../src/db/pool.ts";
import {
  guardProductionDatabasePool,
  readProductionDatabaseIdentity,
} from "../../src/db/identity.ts";

export async function runtimeDisposableDatabase() {
  const file = process.env.V1C_OWNER_FILE!;
  const owner = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(owner.purpose, "V1-C2 disposable local cluster");
  assert.equal(owner.nonce, process.env.V1C_NONCE);
  assert.equal(resolve(dirname(file)), resolve(owner.root));
  assert.ok(owner.root.endsWith(`BudoGraph-V1C-PostgreSQL17-${owner.nonce}`));
  assert.equal(owner.database, "postgres");
  const checked = (key: string, role: string) => {
    const text = process.env[key]!,
      url = new URL(text);
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(Number(url.port), owner.port);
    assert.equal(url.pathname, `/${owner.database}`);
    assert.equal(url.username, role);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    return text;
  };
  const expected = readProductionDatabaseIdentity();
  assert.equal(expected.databaseId, owner.databaseId);
  assert.equal(expected.projectRef, owner.projectRef);
  const caFile = process.env.V1C_CA_FILE!;
  const migrator = new pg.Pool({
    connectionString: checked("V1C_MIGRATOR_URL", "postgres"),
    ssl: { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true },
    max: 2,
    options: "-c role=budograph_migrator",
    connectionTimeoutMillis: 4000,
  });
  const witness = (
    await migrator.query(
      "SELECT current_database() AS name,host(inet_server_addr()) AS host,inet_server_port() AS port,current_user AS role",
    )
  ).rows[0];
  assert.deepEqual(witness, {
    name: owner.database,
    host: "127.0.0.1",
    port: owner.port,
    role: "budograph_migrator",
  });
  const config = {
    nodeEnv: "production" as const,
    databaseUrl: checked("V1C_RUNTIME_URL", "budograph_runtime"),
    databaseTls: { mode: "verify-full" as const, caFile },
  };
  const pools: pg.Pool[] = [migrator];
  return {
    owner,
    migrator,
    config,
    runtime(max: number, maxWaiting = 64) {
      const p = createDatabasePool(config, () => {}, { max, maxWaiting });
      guardProductionDatabasePool(p, expected);
      pools.push(p);
      return p;
    },
    async close() {
      await Promise.all(pools.map((p) => p.end()));
    },
  };
}

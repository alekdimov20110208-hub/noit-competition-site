import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import pg from "pg";

// No ambient DATABASE_URL/.env fallback and no existing owner-file convention.
export async function d5B0Database() {
  const file = process.env.D5_B0_OWNER_FILE!;
  const owner = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(owner.purpose, "D5-B0 synthetic local cluster");
  assert.equal(owner.nonce, process.env.D5_B0_NONCE);
  assert.equal(resolve(dirname(file)), resolve(owner.root));
  assert.equal(
    basename(owner.root),
    `BudoGraph-D5B0-PostgreSQL17-${owner.nonce}`,
  );
  function checked(key: string, role: string) {
    const url = new URL(process.env[key]!);
    assert.equal(url.protocol, "postgresql:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(Number(url.port), owner.port);
    assert.equal(url.pathname, "/postgres");
    assert.equal(url.username, role);
    assert.equal(url.search + url.hash, "");
    return url.href;
  }
  const migrator = new pg.Pool({
    connectionString: checked("D5_B0_MIGRATOR_URL", "postgres"),
    ssl: false,
    max: 2,
    options: "-c role=budograph_migrator",
  });
  const pools = [migrator];
  assert.equal(
    (await migrator.query("SELECT inet_server_port() AS port")).rows[0].port,
    owner.port,
  );
  return {
    migrator,
    runtime() {
      const pool = new pg.Pool({
        connectionString: checked("D5_B0_RUNTIME_URL", "budograph_runtime"),
        ssl: false,
        max: 3,
      });
      pools.push(pool);
      return pool;
    },
    async close() {
      await Promise.all(pools.map((pool) => pool.end()));
    },
  };
}

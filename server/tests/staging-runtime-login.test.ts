// D3 offline contract: intercepted pool, synthetic TLS metadata, no sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
const blocked = () => {
  throw Error("Offline D3 tests forbid network.");
};
net.Socket.prototype.connect = blocked as typeof net.Socket.prototype.connect;
tls.connect = blocked as typeof tls.connect;
dns.lookup = blocked as unknown as typeof dns.lookup;
globalThis.fetch = blocked as typeof globalThis.fetch;
const root = mkdtempSync(resolve("tmp/d3-runtime-tests-"));
const fixtureUrl = pathToFileURL(
  resolve("server/tests/helpers/offline-staging-client.ts"),
).href;
const poolUrl = pathToFileURL(resolve("server/src/db/pool.ts")).href;
const secret = "SYNTHETIC_PRIVATE_D3_PASSWORD";
for (const kind of ["pass", "auth", "tls", "identity", "rollback", "close"]) {
  test(`D3 runtime login: ${kind}, one connection maximum, safe report and read-only SQL`, () => {
    const dir = join(root, kind);
    mkdirSync(join(dir, "tmp/d3"), { recursive: true });
    const preload = join(dir, "offline.mjs"),
      trace = join(dir, "trace.json");
    const fakePool = `export function createDatabasePool(config,logger,limits){if(limits.max!==1||config.databaseTls.mode!=='verify-full')throw Error('Bad pool');return {connect:async()=>{globalThis.__d3.connects++;if(globalThis.__d3.kind==='auth')throw Object.assign(new Error('PRIVATE_RAW_ERROR'),{code:'28P01'});return globalThis.__d3.db},end:async()=>{if(globalThis.__d3.kind==='close')throw Error('PRIVATE_CLOSE_ERROR')}}}`;
    writeFileSync(
      preload,
      `
import {registerHooks} from 'node:module';import fs from 'node:fs';import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';
const stop=()=>{throw Error('Forbidden network')};net.Socket.prototype.connect=stop;tls.connect=stop;dns.lookup=stop;globalThis.fetch=stop;
import {offlineStagingClient} from ${JSON.stringify(fixtureUrl)};
const f=offlineStagingClient(),kind=${JSON.stringify(kind)},calls=[];f.db.user='budograph_runtime.jlladwdqdillryyfvndo';
if(kind==='tls')f.stream.authorized=false;
f.db.query=async q=>{const sql=typeof q==='string'?q:q.text;calls.push(sql);if(sql==='BEGIN READ ONLY')return {command:'BEGIN',rows:[]};if(sql==='ROLLBACK'){if(kind==='rollback')throw Object.assign(new Error('PRIVATE_ROLLBACK_ERROR'),{code:'08006'});return {command:'ROLLBACK',rows:[]}};return {rows:[{database_id:'bce50118-4829-42e0-86cd-1cb41de8b1ba',project_ref:kind==='identity'?'bdcjascqqvzmmlvabhgv':'jlladwdqdillryyfvndo',environment:'staging',runtime_role:'budograph_runtime',safe_role:true}]}};
f.db.release=()=>{f.stream.destroy();queueMicrotask(()=>f.db.emit('end'))};globalThis.__d3={db:f.db,connects:0,kind};
registerHooks({load(url,context,next){if(url===${JSON.stringify(poolUrl)})return {format:'module',shortCircuit:true,source:${JSON.stringify(fakePool)}};return next(url,context)}});
process.on('exit',()=>fs.writeFileSync(${JSON.stringify(trace)},JSON.stringify({connects:globalThis.__d3.connects,readOnly:calls.every(q=>q==='BEGIN READ ONLY'||q==='ROLLBACK'||/^SELECT/.test(q)),count:calls.length,first:calls[0],last:calls.at(-1)})));
`,
    );
    const report = join(dir, "tmp/d3/D3_RUNTIME_LOGIN_1.json");
    const clean = Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
          k,
        ),
      ),
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "--import",
          pathToFileURL(preload).href,
          resolve("server/scripts/staging-runtime-login.ts"),
        ],
        {
          cwd: dir,
          windowsHide: true,
          encoding: "utf8",
          timeout: 15000,
          env: {
            ...clean,
            D3_RUNTIME_LOGIN_APPROVAL: "runtime-login:jlladwdqdillryyfvndo",
            DATABASE_URL: `postgresql://budograph_runtime.jlladwdqdillryyfvndo:${secret}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
            DATABASE_TLS_MODE: "verify-full",
            DATABASE_TLS_CA_FILE: "D:\\prod-ca-2021.crt",
            D3_RUNTIME_REPORT_FILE: report,
          },
        },
      );
    const result = run(),
      saved = JSON.parse(readFileSync(report, "utf8")),
      observed = JSON.parse(readFileSync(trace, "utf8"));
    assert.doesNotMatch(
      result.stdout + result.stderr + JSON.stringify(saved),
      /SYNTHETIC_PRIVATE|PRIVATE_.*ERROR|postgresql:\/\//,
    );
    assert.equal(observed.connects, 1);
    assert.equal(observed.readOnly, true);
    assert.equal(saved.automaticRetry, false);
    if (kind === "pass") {
      assert.equal(result.status, 0);
      assert.equal(saved.status, "PASS");
      assert.equal(saved.identityVerified, true);
      assert.equal(saved.tlsVerified, true);
      assert.equal(saved.rollbackStatus, "confirmed");
      assert.equal(saved.closeStatus, "confirmed");
      assert.equal(observed.count, 3);
      const before = readFileSync(report, "utf8");
      assert.equal(run().status, 1);
      assert.equal(readFileSync(report, "utf8"), before);
      assert.equal(JSON.parse(readFileSync(trace, "utf8")).connects, 0);
    } else {
      assert.equal(result.status, 1);
      assert.equal(saved.status, "STOP");
      if (kind === "auth") {
        assert.equal(saved.failurePhase, "connect");
        assert.equal(saved.errorCode, "AUTHENTICATION_FAILED");
        assert.equal(saved.sqlstate, "28P01");
        assert.equal(observed.count, 0);
      }
      if (kind === "identity") {
        assert.equal(saved.failurePhase, "runtime_identity");
        assert.equal(saved.rollbackStatus, "confirmed");
      }
      if (kind === "tls") {
        assert.equal(saved.failurePhase, "tls");
        assert.equal(observed.count, 0);
      }
      if (kind === "rollback") assert.equal(saved.rollbackStatus, "failed");
      if (kind === "close") assert.equal(saved.closeStatus, "failed");
    }
  });
}

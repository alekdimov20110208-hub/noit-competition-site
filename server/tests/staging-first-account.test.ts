import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { verifyPassword } from "better-auth/crypto";
import type { Pool, PoolClient } from "pg";
import { createAuth } from "../src/auth/auth.ts";
import {
  FIRST_ACCOUNT,
  accountBootstrapState,
  bootstrapFirstStagingAccount,
  createFirstAccountAuth,
  validateFirstAccountFields,
  verifyFirstAccountTls,
} from "../src/staging/first-account.ts";

const fields = () => ({
  email: "synthetic-owner@example.invalid",
  name: "Synthetic owner",
  password: randomBytes(24).toString("hex"),
});

test("native Better Auth hashes the password, requires verification and creates no session", async () => {
  const storage: Record<string, Record<string, unknown>[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
  };
  const auth = createFirstAccountAuth(memoryAdapter(storage));
  const input = fields();
  const result = await auth.api.signUpEmail({ body: input });
  assert.equal(result.token, null);
  assert.equal(result.user.emailVerified, false);
  assert.equal(storage.user!.length, 1);
  assert.equal(storage.user![0]!.active, true);
  const hash = storage.account![0]!.password as string;
  assert.notEqual(hash, input.password);
  assert.equal(await verifyPassword({ hash, password: input.password }), true);
  assert.equal(
    await verifyPassword({ hash, password: randomBytes(24).toString("hex") }),
    false,
  );
  assert.equal(storage.session!.length, 0);
  assert.equal(storage.verification!.length, 0);
  await assert.rejects(
    auth.api.signInEmail({
      body: { email: input.email, password: input.password },
    }),
  );
  assert.equal(storage.session!.length, 0);
});

test("private bootstrap factory still refuses HTTP signup", async () => {
  const auth = createFirstAccountAuth(
    memoryAdapter({ user: [], account: [], session: [], verification: [] }),
  );
  const response = await auth.handler(
    new Request(`${FIRST_ACCOUNT.backend}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields()),
    }),
  );
  assert.equal(response.status, 404);
});

test("existing application verification signs its own token and then accepts the CLI-created password", async () => {
  const storage: Record<string, Record<string, unknown>[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
  };
  const input = fields();
  const adapter = memoryAdapter(storage);
  await createFirstAccountAuth(adapter).api.signUpEmail({ body: input });
  const links: string[] = [];
  const liveAuth = createAuth(
    adapter as unknown as Pool,
    {
      nodeEnv: "test",
      betterAuthSecret: randomBytes(32).toString("hex"),
      betterAuthUrl: FIRST_ACCOUNT.backend,
      publicAppUrl: FIRST_ACCOUNT.backend,
    },
    {
      email: {
        enabled: true,
        async send(message) {
          links.push(message.url);
        },
      },
      emailTasks: { submit: (work) => work() },
    },
  );
  await assert.rejects(liveAuth.api.signInEmail({ body: input }));
  await liveAuth.api.sendVerificationEmail({
    body: {
      email: input.email,
      callbackURL: `${FIRST_ACCOUNT.backend}/verify-email?status=verified`,
    },
  });
  assert.equal(links.length, 1);
  const link = new URL(links[0]!);
  assert.equal(link.origin, FIRST_ACCOUNT.backend);
  await liveAuth.api.verifyEmail({
    query: { token: link.searchParams.get("token")! },
  });
  assert.equal(storage.user![0]!.emailVerified, true);
  assert.equal(storage.session!.length, 0);
  const login = await liveAuth.api.signInEmail({ body: input });
  assert.equal(typeof login.token, "string");
  assert.equal(storage.session!.length, 1);
});

// Entirely synthetic pg protocol facade: no real Pool, sockets, credentials or
// database. The real Kysely/Better Auth registration executes against this fake.
function fixture(
  options: {
    existing?: boolean;
    production?: boolean;
    failAccount?: boolean;
    failRollback?: boolean;
    failCommit?: boolean;
    busy?: boolean;
    identityChanges?: boolean;
    badPostcondition?: boolean;
  } = {},
) {
  type Row = Record<string, unknown>;
  let users: Row[] = options.existing ? [{ id: "existing" }] : [];
  let accounts: Row[] = [];
  let committed = users.length;
  const sqls: string[] = [];
  let identityReads = 0,
    releases = 0,
    connects = 0;
  const client = {
    on() {
      return this;
    },
    removeListener() {
      return this;
    },
    release() {
      releases++;
    },
    async query(input: string | { text: string }, values?: unknown[]) {
      const sql = typeof input === "string" ? input : input.text;
      sqls.push(sql);
      if (sql.includes("FROM budograph_private.environment_identity")) {
        identityReads++;
        return {
          rows: [
            {
              database_id: FIRST_ACCOUNT.databaseId,
              project_ref:
                options.production ||
                (options.identityChanges && users.length > 0)
                  ? FIRST_ACCOUNT.productionRef
                  : FIRST_ACCOUNT.projectRef,
              environment: "staging",
              runtime_role: "budograph_runtime",
              safe_role: true,
            },
          ],
        };
      }
      if (sql === "BEGIN" || sql.startsWith("SET LOCAL")) return { rows: [] };
      if (sql === "COMMIT") {
        if (options.failCommit)
          throw Object.assign(new Error("SYNTHETIC transport failure"), {
            code: "08006",
          });
        committed = users.length;
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        if (options.failRollback)
          throw Object.assign(new Error("SYNTHETIC secondary failure"), {
            code: "08006",
          });
        users = users.slice(0, committed);
        accounts = [];
        return { rows: [] };
      }
      if (sql.includes("pg_try_advisory_xact_lock"))
        return { rows: [{ locked: !options.busy }] };
      if (sql.includes("AS users"))
        return {
          rows: [
            {
              users: users.length,
              accounts: accounts.length,
              sessions: 0,
              events: options.badPostcondition && users.length ? 1 : 0,
              members: 0,
              invitations: 0,
            },
          ],
        };
      if (sql.includes("password_present"))
        return {
          rows: users.map((user) => ({
            active: user.active,
            emailVerified: user.emailVerified,
            providerId: "credential",
            password_present: true,
          })),
        };
      const insert = /^insert into "(user|account)" \(([^)]+)\)/i.exec(sql);
      if (insert) {
        if (insert[1] === "account" && options.failAccount)
          throw Object.assign(
            new Error("SYNTHETIC unsafe raw email/password/connection error"),
            { code: "42501" },
          );
        const columns = [...insert[2]!.matchAll(/"([^"]+)"/g)].map(
          (match) => match[1]!,
        );
        const row = Object.fromEntries(
          columns.map((column, index) => [column, values?.[index]]),
        );
        (insert[1] === "user" ? users : accounts).push(row);
        return { rows: [row] };
      }
      if (/^select .* from "user"/i.test(sql)) return { rows: users };
      if (/^select .* from "account"/i.test(sql)) return { rows: accounts };
      throw new Error("Unexpected synthetic query");
    },
  } as unknown as PoolClient;
  const pool = {
    async connect() {
      connects++;
      return client;
    },
  } as Pick<Pool, "connect">;
  // Only the transport assertion is replaced; real hosted-identity validation,
  // transactions, adapter, SQL generation and native password hashing are used.
  return {
    pool,
    client,
    sqls,
    inspect: () => ({
      users,
      accounts,
      committed,
      identityReads,
      releases,
      connects,
    }),
  };
}

// Override only transport for a fake with no TLS socket, retaining the actual
// native registration default. It is not an option accepted by the owner CLI.
async function run(
  fake: ReturnType<typeof fixture>,
  state = accountBootstrapState(),
) {
  return bootstrapFirstStagingAccount(fake.pool, fields(), state, {
    verifyTls() {},
  });
}

test("real native pg registration commits exactly one unverified account after identity checks", async () => {
  const fake = fixture(),
    state = accountBootstrapState();
  await run(fake, state);
  assert.equal(state.accountCommitted, true);
  assert.equal(state.commitOutcome, "confirmed");
  assert.equal(fake.inspect().committed, 1);
  assert.equal(fake.inspect().accounts.length, 1);
  assert.equal(fake.inspect().connects, 1);
  assert.equal(fake.inspect().releases, 1);
  assert.equal(fake.sqls.filter((sql) => sql === "BEGIN").length, 1);
  for (const [index, sql] of fake.sqls.entries()) {
    if (/^insert /i.test(sql) || sql === "COMMIT")
      assert.match(fake.sqls[index - 1]!, /environment_identity/);
    const insert = /^insert into "(user|account)" \(([^)]+)\)/i.exec(sql);
    if (insert) {
      const migration = readFileSync(
        "server/migrations/0014_production_runtime_access.sql",
        "utf8",
      );
      const table = insert[1] === "user" ? '"user"' : "account";
      const grant = new RegExp(
        `GRANT INSERT\\(([^)]+)\\) ON public\\.${table} TO budograph_runtime;`,
      ).exec(migration);
      assert.ok(grant, "accepted migration grants native registration columns");
      const permitted = grant[1]!.replaceAll('"', "").split(",");
      for (const column of [...insert[2]!.matchAll(/"([^"]+)"/g)])
        assert.ok(
          permitted.includes(column[1]!),
          "native insert uses a permitted column",
        );
    }
  }
  assert.equal(
    fake.sqls.some((sql) =>
      /^insert into "(event|session|event_member|verification)"/i.test(sql),
    ),
    false,
  );
});

test("nonempty staging refuses a second account before native writes", async () => {
  const fake = fixture({ existing: true });
  await assert.rejects(run(fake));
  assert.equal(
    fake.sqls.some((sql) => /^insert /i.test(sql)),
    false,
  );
});
test("Production identity is refused before business writes", async () => {
  const fake = fixture({ production: true });
  await assert.rejects(run(fake));
  assert.equal(
    fake.sqls.some((sql) => /^insert /i.test(sql)),
    false,
  );
  assert.equal(fake.sqls.includes("COMMIT"), false);
});
test("identity is rechecked after user creation and refuses a changed target before account write", async () => {
  const fake = fixture({ identityChanges: true });
  await assert.rejects(run(fake));
  assert.equal(
    fake.sqls.some((sql) => /^insert into "account"/i.test(sql)),
    false,
  );
  assert.equal(fake.inspect().committed, 0);
});
test("42501 account failure rolls back user and keeps primary SQLSTATE despite cleanup failure", async () => {
  const fake = fixture({ failAccount: true, failRollback: true }),
    state = accountBootstrapState();
  await assert.rejects(run(fake, state));
  assert.equal(state.failurePhase, "native_registration");
  assert.equal(state.sqlstate, "42501");
  assert.equal(state.rollbackStatus, "failed");
  assert.equal(state.accountCommitted, false);
  assert.equal(fake.inspect().committed, 0);
  assert.doesNotMatch(
    JSON.stringify(state),
    /synthetic-owner|unsafe raw|SYNTHETIC|password\/connection/,
  );
});
test("native account failure rolls back the partial user with no retry", async () => {
  const fake = fixture({ failAccount: true }),
    state = accountBootstrapState();
  await assert.rejects(run(fake, state));
  assert.equal(state.rollbackStatus, "confirmed");
  assert.equal(fake.inspect().users.length, 0);
  assert.equal(fake.inspect().connects, 1);
});
test("lost COMMIT acknowledgement stays UNKNOWN and is never retried", async () => {
  const fake = fixture({ failCommit: true }),
    state = accountBootstrapState();
  await assert.rejects(run(fake, state));
  assert.equal(state.commitOutcome, "unknown");
  assert.equal(state.failurePhase, "commit");
  assert.equal(fake.inspect().connects, 1);
  assert.equal(fake.sqls.filter((sql) => sql === "COMMIT").length, 1);
});
test("busy first-account lock refuses instead of waiting/retrying", async () => {
  const fake = fixture({ busy: true });
  await assert.rejects(run(fake));
  assert.equal(
    fake.sqls.some((sql) => /^insert /i.test(sql)),
    false,
  );
});
test("unexpected Event postcondition aborts the whole creation", async () => {
  const fake = fixture({ badPostcondition: true });
  await assert.rejects(run(fake));
  assert.equal(fake.sqls.includes("COMMIT"), false);
  assert.equal(fake.inspect().committed, 0);
});
test("bad input is rejected without acquiring a connection", async () => {
  const fake = fixture();
  for (const input of [
    { ...fields(), password: "short" },
    { ...fields(), name: "\n" },
    { ...fields(), email: "invalid" },
  ])
    await assert.rejects(
      bootstrapFirstStagingAccount(fake.pool, input, accountBootstrapState()),
    );
  assert.equal(fake.inspect().connects, 0);
  assert.equal(
    validateFirstAccountFields({
      ...fields(),
      email: " UPPER@example.invalid ",
    }).email,
    "upper@example.invalid",
  );
});
test("transport assertion refuses a non-TLS synthetic client", () => {
  assert.throws(() =>
    verifyFirstAccountTls({
      host: FIRST_ACCOUNT.host,
      connection: { stream: {} },
    } as PoolClient),
  );
});
test("launcher defaults to preflight; secrets use masked prompts and stdin, not args/env/files", () => {
  const ps = readFileSync(
    "scripts/windows/Invoke-StagingFirstAccount-D4.ps1",
    "utf8",
  );
  assert.match(ps, /Read-Host \$Prompt -AsSecureString/);
  assert.ok(
    ps.indexOf("if(-not $CreateAccountApproved)") <
      ps.indexOf("PSSerializer]::Deserialize"),
  );
  assert.match(
    ps,
    /\$info.Arguments='server\/scripts\/staging-first-account.ts'/,
  );
  assert.match(ps, /Send-PrivateInput \$child \$payload/);
  assert.doesNotMatch(
    ps,
    /Set-Clipboard|Get-Clipboard|DATABASE_URL'\]|--env-file|Write-Host.*\$(email|password|plain|payload)/,
  );
  const cli = readFileSync("server/scripts/staging-first-account.ts", "utf8");
  assert.match(
    cli,
    /open\(join\(directory, "D4_FIRST_ACCOUNT_1.claim"\), "wx"\)/,
  );
  assert.doesNotMatch(
    cli,
    /console\.(log|error)|\.listen\(|\.api\.signUpEmail|env-file|activation\.ts/,
  );
});

test(
  "actual Windows PowerShell 5.1 private pipe preserves Unicode using only synthetic data",
  {
    skip: process.platform !== "win32",
  },
  () => {
    const ps = readFileSync(
      "scripts/windows/Invoke-StagingFirstAccount-D4.ps1",
      "utf8",
    );
    const send = /function Send-PrivateInput[^]*?\n\}/.exec(ps)?.[0];
    assert.ok(send);
    assert.doesNotMatch(send, /DPAPI|PSSerializer|credential|connect/i);
    const script = `${send}
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
$info.Arguments='-e "let b=String();process.stdin.setEncoding(\u0027utf8\u0027);process.stdin.on(\u0027data\u0027,c=>b+=c);process.stdin.on(\u0027end\u0027,()=>process.stdout.write(JSON.parse(b).marker.charCodeAt(0)===1048?\u0027SYNTHETIC_PIPE_PASS\u0027:\u0027FAIL\u0027));"'
$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true
$child=[Diagnostics.Process]::new();$child.StartInfo=$info
try{$null=$child.Start();Send-PrivateInput $child @{marker='Име'};$result=$child.StandardOutput.ReadToEnd();$child.WaitForExit();if($child.ExitCode -ne 0){throw 'Synthetic pipe failed'};Write-Output $result}finally{$child.Dispose()}
`;
    // Escape JS single quotes inside the PowerShell single-quoted argument.
    const safeScript = script.replace(
      /\$info.Arguments='([^]*?)'\n/,
      (_all, value: string) =>
        `$info.Arguments='${value.replaceAll("'", "''")}'\n`,
    );
    const output = execFileSync(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(safeScript, "utf16le").toString("base64"),
      ],
      { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(output.trim(), "SYNTHETIC_PIPE_PASS");
  },
);

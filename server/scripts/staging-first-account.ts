// No dotenv, HTTP listener, owner credentials, migrations or deployment imports.
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../src/db/pool.ts";
import { validateRuntimeConnection } from "../src/db/identity.ts";
import {
  FIRST_ACCOUNT,
  firstAccountIdentity,
  accountBootstrapState,
  bootstrapFirstStagingAccount,
  recordAccountFailure,
  validateFirstAccountFields,
} from "../src/staging/first-account.ts";

// Private anonymous pipe from the owner's masked PowerShell prompts. These
// values are never accepted as command arguments or persisted to a file.
async function privateInput() {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) throw new Error("INPUT_REFUSED");
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  try {
    return JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } finally {
    bytes.fill(0);
    chunks.forEach((chunk) => chunk.fill(0));
  }
}

async function main() {
  const state = accountBootstrapState();
  let pool: ReturnType<typeof createDatabasePool> | undefined;
  let report: Awaited<ReturnType<typeof open>> | undefined;
  let payload: Record<string, unknown> | undefined;
  try {
    if (
      process.argv.length !== 2 ||
      process.platform !== "win32" ||
      process.env.NODE_ENV !== "production" ||
      !process.env.LOCALAPPDATA ||
      Object.keys(process.env).some((key) =>
        /^(PG|DATABASE_|NODE_OPTIONS$|NODE_TLS_REJECT_UNAUTHORIZED$)/.test(key),
      )
    )
      throw new Error("ENVIRONMENT_REFUSED");
    payload = await privateInput();
    if (
      payload.approval !== `create-first-account:${FIRST_ACCOUNT.projectRef}` ||
      typeof payload.databaseUrl !== "string"
    )
      throw new Error("APPROVAL_REFUSED");
    const fields = validateFirstAccountFields(payload);
    const url = payload.databaseUrl;
    validateRuntimeConnection(url, firstAccountIdentity);
    const target = new URL(url);
    if (
      target.hostname !== FIRST_ACCOUNT.host ||
      decodeURIComponent(target.username) !==
        `budograph_runtime.${FIRST_ACCOUNT.projectRef}`
    )
      throw new Error("TARGET_REFUSED");
    if (
      createHash("sha256")
        .update(await readFile(FIRST_ACCOUNT.caFile))
        .digest("hex") !== FIRST_ACCOUNT.caSha256
    )
      throw new Error("CA_PIN_REFUSED");
    const directory = join(
      process.env.LOCALAPPDATA,
      "BudoGraph",
      "D4-FirstAccount-1",
    );
    state.phase = "one_shot_reservation";
    // CreateNew is authoritative; neither old claim nor old report is reusable.
    const claim = await open(join(directory, "D4_FIRST_ACCOUNT_1.claim"), "wx");
    try {
      await claim.writeFile(
        `ONE STAGING FIRST ACCOUNT ${FIRST_ACCOUNT.projectRef}\n`,
      );
      await claim.sync();
    } finally {
      await claim.close();
    }
    report = await open(join(directory, "D4_FIRST_ACCOUNT_1.json"), "wx");
    pool = createDatabasePool(
      {
        nodeEnv: "production",
        databaseUrl: url,
        databaseTls: { mode: "verify-full", caFile: FIRST_ACCOUNT.caFile },
      },
      () => recordAccountFailure(state, "CONNECTION_FAILED"),
      { max: 1 },
    );
    // One real checkout; the native auth adapter is bound to that same lease.
    await bootstrapFirstStagingAccount(pool, fields, state);
  } catch (error) {
    recordAccountFailure(state, "LOCAL_OR_ACCOUNT_OPERATION_REFUSED", error);
  } finally {
    payload = undefined;
    try {
      if (pool) {
        await pool.end();
        state.closeStatus = "confirmed";
      }
    } catch (error) {
      state.closeStatus = "failed";
      recordAccountFailure(state, "CONNECTION_CLOSE_FAILED", error);
    }
    if (
      !state.failurePhase &&
      state.accountCommitted &&
      state.closeStatus === "confirmed"
    ) {
      state.status = "PASS";
      state.phase = "account_created_verification_required";
    }
    try {
      if (report) await report.writeFile(JSON.stringify(state, null, 2) + "\n");
    } catch (error) {
      state.status = "STOP";
      recordAccountFailure(state, "REPORT_WRITE_FAILED", error);
    } finally {
      await report?.close().catch(() => {});
    }
    // Closed vocabulary/facts only: never output caught exceptions or input.
    process.stdout.write(JSON.stringify(state) + "\n");
    process.exitCode = state.status === "PASS" ? 0 : 1;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();

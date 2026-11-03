// Private owner CLI only. Nothing in this module is mounted on the HTTP server.
import { randomBytes } from "node:crypto";
import { TLSSocket, checkServerIdentity } from "node:tls";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createKyselyAdapter } from "@better-auth/kysely-adapter";
import type { Pool, PoolClient } from "pg";
import { verifyProductionDatabaseIdentity } from "../db/identity.ts";
import {
  inTransaction,
  TransactionOutcomeUnknownError,
  type TransactionDatabase,
} from "../db/transaction.ts";
import { STAGING } from "./target.ts";

export const FIRST_ACCOUNT = Object.freeze({
  ...STAGING,
  host: "aws-1-eu-central-1.pooler.supabase.com",
  backend: "https://budograph-staging-d3.onrender.com",
  caFile: "D:\\prod-ca-2021.crt",
  caSha256: "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7",
});
const expected = Object.freeze({
  projectRef: FIRST_ACCOUNT.projectRef,
  databaseId: FIRST_ACCOUNT.databaseId,
  databaseHost: FIRST_ACCOUNT.host,
  environment: "staging" as const,
});
export { expected as firstAccountIdentity };

export function accountBootstrapState() {
  return {
    mode: "staging-first-account",
    projectRef: FIRST_ACCOUNT.projectRef,
    status: "STOP" as "PASS" | "STOP",
    phase: "preflight",
    failurePhase: null as string | null,
    errorCode: "NONE",
    sqlstate: null as string | null,
    connectionAttempts: 0,
    tlsVerified: false,
    identityVerified: false,
    accountCommitted: false,
    commitOutcome: "not_attempted",
    rollbackStatus: "not_attempted",
    closeStatus: "not_attempted",
    verificationRequired: true,
    verificationDelivery: "request_through_live_staging_app",
    automaticRetry: false,
  };
}
export type AccountBootstrapState = ReturnType<typeof accountBootstrapState>;
export function recordAccountFailure(
  state: AccountBootstrapState,
  code: string,
  error?: unknown,
) {
  if (state.failurePhase !== null) return;
  state.failurePhase = state.phase;
  state.errorCode = code;
  const sqlstate = (error as { code?: unknown } | undefined)?.code;
  state.sqlstate =
    typeof sqlstate === "string" && /^[0-9A-Z]{5}$/.test(sqlstate)
      ? sqlstate
      : null;
}

export interface FirstAccountFields {
  email: string;
  name: string;
  password: string;
}
export function validateFirstAccountFields(input: unknown): FirstAccountFields {
  const fields = input as Partial<FirstAccountFields> | null;
  if (
    !fields ||
    typeof fields.email !== "string" ||
    fields.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) ||
    typeof fields.name !== "string" ||
    !fields.name.trim() ||
    fields.name.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(fields.name) ||
    typeof fields.password !== "string" ||
    fields.password.length < 12 ||
    fields.password.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(fields.password)
  )
    throw new Error("ACCOUNT_INPUT_REFUSED");
  return {
    email: fields.email.trim().toLowerCase(),
    name: fields.name.trim(),
    password: fields.password,
  };
}

// Better Auth's normal password hashing and user/account creation. No sessions,
// tokens or email links are issued with this ephemeral CLI secret. Verification
// is REQUIRED; the existing live app later sends/signs its normal verification
// email using its real secret and durable outbox. Never set emailVerified=true.
export function createFirstAccountAuth(
  database: BetterAuthOptions["database"],
) {
  return betterAuth({
    appName: "BudoGraph",
    database,
    secret: randomBytes(32).toString("hex"),
    baseURL: FIRST_ACCOUNT.backend,
    basePath: "/api/auth",
    trustedOrigins: [FIRST_ACCOUNT.backend],
    disabledPaths: ["/sign-up/email"],
    emailAndPassword: {
      enabled: true,
      disableSignUp: false, // Private server API, never an HTTP signup route.
      autoSignIn: false,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
    },
    user: {
      additionalFields: {
        active: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    advanced: {
      // Same externally-owned transaction adapter pattern as auth/transactions.
      database: { validateSchema: false },
      useSecureCookies: true,
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
}

async function register(
  database: TransactionDatabase,
  fields: FirstAccountFields,
) {
  const facade = {
    connect: async () => ({
      query: (sql: string, values?: unknown[]) => database.query(sql, values),
      release() {},
    }),
    async end() {},
  };
  const { kysely } = await createKyselyAdapter({
    database: facade as unknown as Pool,
  });
  if (!kysely) throw new Error("AUTH_ADAPTER_UNAVAILABLE");
  try {
    const auth = createFirstAccountAuth({
      db: kysely,
      type: "postgres",
      transaction: false,
    });
    const result = await auth.api.signUpEmail({ body: fields });
    if (result.token !== null || result.user.emailVerified !== false)
      throw new Error("UNEXPECTED_AUTH_RESULT");
  } finally {
    // This facade cannot close/release the externally owned physical client.
    await kysely.destroy();
  }
}

export function verifyFirstAccountTls(db: PoolClient) {
  const ssl = db.ssl as unknown as {
    rejectUnauthorized?: unknown;
    checkServerIdentity?: unknown;
    ca?: unknown;
  };
  const stream = db.connection.stream;
  if (
    db.host !== FIRST_ACCOUNT.host ||
    db.port !== 5432 ||
    db.database !== "postgres" ||
    db.user !== `budograph_runtime.${FIRST_ACCOUNT.projectRef}` ||
    !ssl ||
    ssl.rejectUnauthorized !== true ||
    ssl.checkServerIdentity !== checkServerIdentity ||
    !Array.isArray(ssl.ca) ||
    !ssl.ca.length ||
    !(stream instanceof TLSSocket) ||
    stream.encrypted !== true ||
    stream.authorized !== true ||
    stream.authorizationError != null ||
    !["TLSv1.2", "TLSv1.3"].includes(stream.getProtocol() ?? "") ||
    checkServerIdentity(FIRST_ACCOUNT.host, stream.getPeerCertificate()) !==
      undefined
  )
    throw new Error("TLS_REFUSED");
}

const countsSql = `SELECT
  (SELECT count(*)::int FROM public."user") AS users,
  (SELECT count(*)::int FROM public.account) AS accounts,
  (SELECT count(*)::int FROM public.session) AS sessions,
  (SELECT count(*)::int FROM public.event) AS events,
  (SELECT count(*)::int FROM public.event_member) AS members,
  (SELECT count(*)::int FROM public.event_invitation) AS invitations`;

export async function bootstrapFirstStagingAccount(
  pool: Pick<Pool, "connect">,
  input: FirstAccountFields,
  state: AccountBootstrapState,
  // Explicit offline transport seam; the owner CLI cannot supply overrides.
  dependencies: { verifyTls?: typeof verifyFirstAccountTls } = {},
) {
  const fields = validateFirstAccountFields(input);
  const guarded = {
    async connect() {
      state.phase = "connect";
      state.connectionAttempts++;
      const client = await pool.connect();
      client.on("error", () => {}); // pg errors must never reach console output.
      try {
        state.phase = "tls";
        (dependencies.verifyTls ?? verifyFirstAccountTls)(client);
        state.tlsVerified = true;
        state.phase = "identity";
        return {
          on: client.on.bind(client),
          removeListener: client.removeListener.bind(client),
          release: client.release.bind(client),
          async query(sql: string, values?: unknown[]) {
            try {
              if (sql !== "ROLLBACK") {
                // Independent hosted identity/least-privilege read on THIS lease
                // immediately before every command, including each native write
                // and COMMIT. No identity is inferred from the URL or receipt.
                await verifyProductionDatabaseIdentity(client, expected);
                state.identityVerified = true;
              }
              if (sql === "COMMIT") {
                state.phase = "commit";
                state.commitOutcome = "unknown";
              }
              const result = await client.query(sql, values);
              if (sql === "ROLLBACK") state.rollbackStatus = "confirmed";
              return result;
            } catch (error) {
              if (sql === "ROLLBACK") state.rollbackStatus = "failed";
              recordAccountFailure(state, "DATABASE_OPERATION_FAILED", error);
              // Do not pass raw pg errors/parameters into library diagnostics.
              throw Object.assign(new Error("DATABASE_OPERATION_FAILED"), {
                code: (error as { code?: unknown } | undefined)?.code,
              });
            }
          },
        };
      } catch (error) {
        client.release(true);
        throw error;
      }
    },
  };
  try {
    await inTransaction(guarded, async (database) => {
      try {
        state.phase = "first_account_gate";
        const lock = await database.query(
          "SELECT pg_try_advisory_xact_lock(1779930196,4) AS locked",
        );
        if ((lock.rows[0] as { locked?: boolean })?.locked !== true)
          throw new Error("FIRST_ACCOUNT_BUSY");
        const before = (await database.query(countsSql)).rows[0];
        if (!before || Object.values(before).some((count) => count !== 0))
          throw new Error("DATABASE_NOT_EMPTY");
        state.phase = "native_registration";
        await register(database, fields);
        state.phase = "verify_account";
        const after = (await database.query(countsSql)).rows[0] as Record<
          string,
          number
        >;
        const check = await database.query(
          `SELECT u.active, u."emailVerified", a."providerId",
          (a.password IS NOT NULL AND length(a.password)>0) AS password_present
         FROM public."user" u JOIN public.account a ON a."userId"=u.id
         WHERE u.email=$1 AND a."accountId"=u.id`,
          [fields.email],
        );
        const row = check.rows[0] as Record<string, unknown> | undefined;
        if (
          !after ||
          after.users !== 1 ||
          after.accounts !== 1 ||
          after.sessions !== 0 ||
          after.events !== 0 ||
          after.members !== 0 ||
          after.invitations !== 0 ||
          check.rows.length !== 1 ||
          !row ||
          row.active !== true ||
          row.emailVerified !== false ||
          row.providerId !== "credential" ||
          row.password_present !== true
        )
          throw new Error("ACCOUNT_POSTCONDITION_FAILED");
      } catch (error) {
        // Record logical/API failures before inTransaction attempts ROLLBACK;
        // secondary cleanup must never replace the primary refusal.
        recordAccountFailure(state, "ACCOUNT_BOOTSTRAP_REFUSED", error);
        throw error;
      }
    });
    state.accountCommitted = true;
    state.commitOutcome = "confirmed";
    state.phase = "account_created_verification_required";
  } catch (error) {
    if (error instanceof TransactionOutcomeUnknownError)
      state.commitOutcome = "unknown";
    recordAccountFailure(state, "ACCOUNT_BOOTSTRAP_REFUSED", error);
    throw new Error("ACCOUNT_BOOTSTRAP_REFUSED");
  }
}

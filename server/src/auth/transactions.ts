import { createKyselyAdapter } from "@better-auth/kysely-adapter";
import type { BetterAuthOptions } from "better-auth";
import { createEmailVerificationToken } from "better-auth/api";
import type { Pool } from "pg";
import type { AuthInstance, AuthOptions } from "./auth.ts";
import { inTransaction, type TransactionDatabase } from "../db/transaction.ts";
import type {
  TransactionalEmailService,
  TransactionalEmail,
} from "../email/service.ts";
import { emailLocale } from "../email/service.ts";
import { OperationalError, type SharedControls } from "../operations/limits.ts";
import { verificationMetadata } from "../operations/crypto.ts";
import { canonicalAuthPath } from "./path.ts";
import {
  authMailResponse,
  canonicalResetToken,
  genericAuthMailResponse,
  invalidateResetTokens,
  isAuthMailRequest,
} from "./safety.ts";
import type { SignupFields } from "./signup.ts";

type Build = (
  database: BetterAuthOptions["database"],
  email: TransactionalEmailService,
) => AuthInstance;

function authPath(request: Request) {
  return canonicalAuthPath(new URL(request.url).pathname);
}

// The documented Kysely configuration disables the adapter's SQL transaction
// owner ONLY when all of its queries already use our externally owned client.
// No BEGIN/COMMIT is simulated. No pooled/global adapter is mutated. The facade
// is operation-local and never releases its caller's physical lease.
async function boundAuth(
  database: TransactionDatabase,
  build: Build,
  email: TransactionalEmailService,
) {
  const facade = {
    connect: async () => ({
      query: async (text: string, values?: unknown[]) => {
        try {
          return await database.query(text, values);
        } catch (error) {
          const code = (error as { code?: unknown })?.code;
          throw Object.assign(new Error("Auth database operation failed."), {
            code:
              typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)
                ? code
                : undefined,
          });
        }
      },
      release: () => {},
    }),
    end: async () => {},
  };
  const { kysely } = await createKyselyAdapter({
    database: facade as unknown as Pool,
  });
  if (!kysely) throw new Error("Auth transaction adapter unavailable.");
  const auth = build(
    { db: kysely, type: "postgres", transaction: false },
    email,
  );
  await auth.$context;
  return { auth, close: () => kysely.destroy() };
}

export async function lockAccount(
  database: TransactionDatabase,
  email: string,
  tryOnly = false,
) {
  const result = await database.query(
    tryOnly
      ? "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked"
      : "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [JSON.stringify(["budograph-account-v1c3", email])],
  );
  if (tryOnly && !(result.rows[0] as { locked: boolean }).locked)
    throw new OperationalError(409, "ACCOUNT_BUSY");
  // Preserve the active identity throughout session/profile writes. This also
  // serializes administrative deactivation, without taking any Event lock.
  await database.query(
    'SELECT id FROM public."user" WHERE lower(email)=$1 FOR SHARE',
    [email],
  );
}

class RejectedAuthResponse extends Error {
  readonly response: Response;
  constructor(response: Response) {
    super("Auth command rejected.");
    this.response = response;
  }
}

export function createAuthTransactions(
  pool: Pool,
  raw: AuthInstance,
  build: Build,
  email: TransactionalEmailService | undefined,
  tasks: AuthOptions["emailTasks"],
  verifySchema: boolean,
  sharedControls?: SharedControls,
  authSecret?: string,
  publicAppUrl?: string,
  onMailEnqueueFailure: () => void = () =>
    console.error("Authentication mail enqueue failed"),
) {
  const prepare = async () => {
    // Settle the shared, cached production schema check before taking a client.
    const context = await raw.$context;
    if (verifySchema) await context.checkSchema?.();
  };
  const mail = (database: TransactionDatabase) => {
    const pending: TransactionalEmail[] = [];
    const jobs = new Set<string>();
    let failure: OperationalError | undefined;
    return {
      service: {
        enabled: email?.enabled === true,
        send: async (message: TransactionalEmail) => {
          if (email?.enqueue) {
            try {
              jobs.add(await email.enqueue(database, message));
            } catch {
              failure = new OperationalError();
              throw failure;
            }
            return;
          }
          pending.push({ ...message });
        },
      },
      pending,
      jobs,
      get failure() {
        return failure;
      },
      async dispatch() {
        // Durable jobs are already committed. The registered email worker claims
        // them (also after restart); no provider promise belongs to this response.
        if (email?.enqueue) return;
        // This must be invoked only after actual COMMIT and physical release.
        for (const message of pending) {
          if (!email || !tasks)
            throw new Error("Email delivery configuration unavailable.");
          await tasks.submit(() => email.send(message));
        }
      },
    };
  };
  const enqueueVerification = async (
    delivery: ReturnType<typeof mail>,
    address: string,
    callbackURL: string | undefined,
    locale: "bg" | "en",
  ) => {
    if (!authSecret || !publicAppUrl) throw new OperationalError();
    const url = new URL("/api/auth/verify-email", publicAppUrl);
    url.searchParams.set(
      "token",
      await createEmailVerificationToken(
        authSecret,
        address,
        undefined,
        raw.options.emailVerification.expiresIn,
      ),
    );
    if (callbackURL) url.searchParams.set("callbackURL", callbackURL);
    await delivery.service.send({
      kind: "verification",
      to: address,
      url: url.href,
      locale,
    });
    if (delivery.failure) throw delivery.failure;
  };
  const normalizedEmail = (value: unknown) =>
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? value.trim().toLowerCase()
      : undefined;
  const commandEmail = async (
    request: Request,
    body: Record<string, unknown>,
  ) => {
    const path = authPath(request);
    if (path === "/api/auth/verify-email" && authSecret) {
      return verificationMetadata(
        new URL(request.url).searchParams.get("token") ?? "",
        authSecret,
      )?.email;
    }
    if (path.endsWith("/reset-password")) {
      const token = body.token;
      if (typeof token !== "string" || token.length > 256) return;
      const context = await raw.$context;
      const value = await context.internalAdapter.findVerificationValue(
        `reset-password:${token}`,
      );
      if (!value) return;
      const identity = await context.internalAdapter.findUserById(value.value);
      return normalizedEmail(identity?.email);
    }
    if (
      [
        "/api/auth/change-password",
        "/api/auth/update-user",
        "/api/auth/sign-out",
      ].includes(path)
    ) {
      const session = await raw.api.getSession({ headers: request.headers });
      return normalizedEmail(session?.user.email);
    }
    return normalizedEmail(body.email);
  };
  const handle = async (request: Request) => {
    const path = authPath(request);
    // Disabled signup stays disabled even when operational storage is down.
    if (path === "/api/auth/sign-up/email") return raw.handler(request);
    if (sharedControls) {
      const origin = request.headers.get("origin");
      if (origin) {
        let trusted = false;
        try {
          trusted = raw.options.trustedOrigins.includes(new URL(origin).origin);
        } catch {
          /* Invalid origin. */
        }
        if (!trusted)
          return new Response(
            '{"code":"INVALID_ORIGIN","message":"Invalid origin"}',
            {
              status: 403,
              headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
              },
            },
          );
      }
      try {
        await sharedControls.auth(request, path);
      } catch (error) {
        if (!(error instanceof OperationalError)) throw error;
        return new Response(
          JSON.stringify({ status: "error", code: error.code }),
          {
            status: error.statusCode,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              ...(error.retryAfter
                ? { "retry-after": String(error.retryAfter) }
                : {}),
            },
          },
        );
      }
    }
    const write =
      (request.method === "POST" &&
        [
          "sign-in/email",
          "update-user",
          "change-password",
          "reset-password",
          "request-password-reset",
          "send-verification-email",
          "sign-out",
        ].some((p) => path === `/api/auth/${p}`)) ||
      (request.method === "GET" && path === "/api/auth/verify-email");
    if (!write) return raw.handler(request);
    const origin = request.headers.get("origin");
    if (origin) {
      let trusted = false;
      try {
        trusted = raw.options.trustedOrigins.includes(new URL(origin).origin);
      } catch {
        /* Invalid/opaque Origin is never trusted. */
      }
      if (!trusted)
        return new Response(
          '{"code":"INVALID_ORIGIN","message":"Invalid origin"}',
          {
            status: 403,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
    }
    await prepare();
    let body: Record<string, unknown> = {};
    try {
      if (request.method === "POST") {
        const parsed: unknown = await request.clone().json();
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          body = parsed as Record<string, unknown>;
      }
    } catch {
      /* The library validates malformed input. */
    }
    const reset =
      request.method === "POST" && path === "/api/auth/reset-password";
    if (reset) {
      const url = new URL(request.url);
      const token = canonicalResetToken(body, url.searchParams);
      if (!token)
        return Response.json({ code: "INVALID_TOKEN" }, { status: 400 });
      body = { ...body, token };
      url.searchParams.delete("token");
      request = new Request(url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(body),
      });
    }
    // Sequential lookups only; no lease is held while resolving the gate key.
    // They never authorize the command: the bound endpoint validates again.
    const account = await commandEmail(request, body);
    if (reset && !account)
      return Response.json({ code: "INVALID_TOKEN" }, { status: 400 });
    if (path === "/api/auth/sign-out" && !account) return raw.handler(request);
    const profile =
      path === "/api/auth/change-password" || path === "/api/auth/update-user";
    const publicMail = isAuthMailRequest(request, path);
    if (account && profile && sharedControls)
      await sharedControls.account(
        request.headers.get("x-budograph-client-ip") ?? "",
        account,
      );
    let delivery: ReturnType<typeof mail> | undefined;
    let response: Response;
    try {
      response = await inTransaction(pool, async (database) => {
        if (account)
          await lockAccount(database, account, profile && !!sharedControls);
        if (publicMail) await email?.reserve?.(database);
        let identity:
          { id: string; active: boolean; emailVerified: boolean } | undefined;
        if (account && (publicMail || path === "/api/auth/reset-password")) {
          const result = await database.query(
            'SELECT id,active,"emailVerified" FROM public."user" WHERE lower(email)=$1',
            [account],
          );
          identity = result.rows[0] as typeof identity;
          // This branch neither mints credentials nor enqueues mail. Capacity is
          // checked for every identity first; the outer response floor is shared.
          if (
            publicMail &&
            (!identity?.active ||
              (path === "/api/auth/send-verification-email" &&
                identity.emailVerified))
          )
            return genericAuthMailResponse();
          if (!publicMail && !identity?.active)
            return Response.json({ code: "INVALID_TOKEN" }, { status: 400 });
          if (path === "/api/auth/request-password-reset" && identity)
            await invalidateResetTokens(database, identity.id);
        }
        delivery = mail(database);
        if (
          path === "/api/auth/send-verification-email" &&
          identity &&
          account &&
          email?.enabled &&
          authSecret &&
          publicAppUrl
        ) {
          // The native anonymous endpoint's 500ms floor runs INSIDE its handler.
          // Holding the shared outbox admission lock through that sleep exposes
          // identity-dependent contention. Use its exported native JWT generator
          // with our server-pinned URL; the common floor runs only after COMMIT.
          await enqueueVerification(
            delivery,
            account,
            typeof body.callbackURL === "string" ? body.callbackURL : undefined,
            emailLocale(request.headers.get("x-budograph-locale")),
          );
          return genericAuthMailResponse();
        }
        const bound = await boundAuth(database, build, delivery.service);
        try {
          const result = await bound.auth.handler(request);
          if (delivery.failure) throw delivery.failure;
          if (!result.ok && result.status >= 400)
            throw new RejectedAuthResponse(result);
          if (path === "/api/auth/reset-password" && identity)
            await invalidateResetTokens(database, identity.id);
          return result;
        } finally {
          await bound.close();
        }
      });
    } catch (error) {
      if (publicMail && delivery?.failure) {
        // The owned transaction has rolled back and released its client. A
        // recipient-dependent enqueue failure must not become an HTTP oracle.
        // This generic response makes no assertion that an email was queued/sent.
        try {
          onMailEnqueueFailure();
        } catch {
          console.error("Authentication mail enqueue failed");
        }
        return genericAuthMailResponse();
      }
      if (error instanceof RejectedAuthResponse) return error.response;
      throw error;
    }
    await delivery?.dispatch();
    return response;
  };
  const handler = (request: Request) =>
    isAuthMailRequest(request, authPath(request))
      ? authMailResponse(() => handle(request))
      : handle(request);
  return {
    handler,
    registration: {
      prepare,
      async publicSignup(
        fields: SignupFields,
        locale: "bg" | "en",
        callbackURL: string,
        verifyIdentity: (database: TransactionDatabase) => Promise<void>,
      ) {
        if (
          !sharedControls ||
          !email?.enabled ||
          !email.enqueue ||
          !email.reserve ||
          !authSecret ||
          !publicAppUrl ||
          raw.options.emailAndPassword.disableSignUp
        )
          throw new OperationalError();
        await prepare();
        let admitted = false;
        try {
          await inTransaction(pool, async (database) => {
            await verifyIdentity(database);
            await lockAccount(database, fields.email);
            // Check capacity for every recipient before native existence lookup.
            await email.reserve!(database);
            admitted = true;
            const delivery = mail(database);
            const bound = await boundAuth(database, build, delivery.service);
            try {
              await bound.auth.api.signUpEmail({
                body: {
                  name: fields.name,
                  email: fields.email,
                  password: fields.password,
                  callbackURL,
                },
                headers: new Headers({ "x-budograph-locale": locale }),
              });
              if (delivery.failure) throw delivery.failure;
            } finally {
              await bound.close();
            }
          });
        } catch {
          // Identity/capacity failures are common for all recipients. Once
          // admitted, native/write/enqueue/unknown-commit failures must not reveal
          // account existence. Rollback/release precedes the caller's 750ms floor.
          // Never retry an unknown commit; resend uses the established mail flow.
          if (!admitted) throw new OperationalError();
          try {
            onMailEnqueueFailure();
          } catch {
            console.error("Authentication mail enqueue failed");
          }
        }
      },
      async withinTransaction(
        database: TransactionDatabase,
        fields: { name: string; email: string; password: string },
        locale: "bg" | "en",
        callbackURL: string,
      ) {
        // Invitation service already owns Event -> invitation before this gate.
        await lockAccount(database, fields.email);
        await email?.reserve?.(database);
        const delivery = mail(database);
        const bound = await boundAuth(database, build, delivery.service);
        try {
          try {
            await bound.auth.api.signUpEmail({
              body: { ...fields, callbackURL },
              headers: new Headers({ "x-budograph-locale": locale }),
            });
          } catch (error) {
            throw delivery.failure ?? error;
          }
          if (delivery.failure) throw delivery.failure;
          if (email?.enqueue && delivery.jobs.size === 0) {
            const identity = await database.query(
              'SELECT active,"emailVerified" FROM public."user" WHERE email=$1',
              [fields.email],
            );
            if (
              (
                identity.rows[0] as
                  { active: boolean; emailVerified: boolean } | undefined
              )?.active &&
              !(identity.rows[0] as { emailVerified: boolean }).emailVerified
            )
              await enqueueVerification(
                delivery,
                fields.email,
                callbackURL,
                locale,
              );
          }
        } finally {
          await bound.close();
        }
        const result = await database.query(
          'SELECT active,"emailVerified" FROM public."user" WHERE email=$1',
          [fields.email],
        );
        const identity = result.rows[0] as
          { active: boolean; emailVerified: boolean } | undefined;
        const resend =
          delivery.pending.length === 0 &&
          identity?.active &&
          !identity.emailVerified &&
          !email?.enqueue &&
          email?.enabled;
        return async () => {
          await delivery.dispatch();
          // Existing-account/lost-response retry never replaces credentials.
          // The verified-email API runs only after the owned transaction ends.
          if (resend)
            await raw.api.sendVerificationEmail({
              body: { email: fields.email, callbackURL },
              headers: new Headers({ "x-budograph-locale": locale }),
            });
        };
      },
    },
  };
}

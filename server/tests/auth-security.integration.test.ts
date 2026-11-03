import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { d5B0Database } from "./helpers/d5-b0-database.ts";
import { syntheticOperationalSecrets } from "./helpers/operational-secrets.ts";
import { createApplicationServices } from "../src/runtime.ts";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth/auth.ts";
import {
  createEmailTasks,
  type TransactionalEmail,
} from "../src/email/service.ts";
import { decryptEmail, type EmailMetadata } from "../src/operations/crypto.ts";
import {
  createSharedControls,
  OperationalError,
} from "../src/operations/limits.ts";
import { inTransaction } from "../src/db/transaction.ts";
import { authMailResponseFloorMs } from "../src/auth/safety.ts";
import { createEventService, maxOwnedEvents } from "../src/events/service.ts";
import type { ServerConfig } from "../src/config/env.ts";

test(
  "D5-B0 real Better Auth + isolated PostgreSQL runtime permissions; all provider I/O is synthetic",
  {
    skip: !process.env.D5_B0_OWNER_FILE,
    timeout: 120000,
  },
  async (t) => {
    const db = await d5B0Database();
    const runtime = db.runtime(),
      otherRuntime = db.runtime();
    const secrets = syntheticOperationalSecrets();
    const origin = "https://d5-b0.example.invalid";
    const config: ServerConfig = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 1,
      databaseUrl: "postgresql://unused.invalid/synthetic",
      databaseTls: { mode: "disable" },
      betterAuthSecret: randomBytes(32).toString("hex"),
      betterAuthUrl: origin,
      publicAppUrl: origin,
      emailMode: "resend",
      emailFrom: "no-reply@example.invalid",
      resendApiKey: "re_" + randomBytes(24).toString("hex"),
      operations: secrets,
    };
    const tasks = createEmailTasks();
    const diagnostic: string[] = [],
      attempts: { key: string; body: string }[] = [];
    let outcome = "success";
    let enter!: () => void, release!: () => void;
    let entered: Promise<void>, released: Promise<void>;
    function hold() {
      entered = new Promise<void>((r) => {
        enter = r;
      });
      released = new Promise<void>((r) => {
        release = r;
      });
      outcome = "hold";
    }
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(
          String(url),
          "https://api.resend.com/emails",
          "Unexpected outbound HTTP forbidden",
        );
        attempts.push({
          key: new Headers(init?.headers).get("idempotency-key")!,
          body: String(init?.body),
        });
        if (outcome === "hold") {
          enter();
          await released;
        }
        if (outcome === "outage") return new Response("{}", { status: 503 });
        return Response.json({ id: "synthetic-provider-acceptance" });
      },
    );
    const services = createApplicationServices(runtime, config, tasks, (kind) =>
      diagnostic.push(kind),
    );
    const servicesB = createApplicationServices(
      otherRuntime,
      config,
      tasks,
      (kind) => diagnostic.push(kind),
    );
    const app = createApp(services);
    const appB = createApp(servicesB);
    t.after(async () => {
      release?.();
      await Promise.all([app.close(), appB.close()]);
      await tasks.drain();
      await db.close();
    });
    const clearLimits = () =>
      db.migrator.query("DELETE FROM budograph_private.rate_counter");
    const post = (path: string, body: object, target = app, cookie?: string) =>
      target.inject({
        method: "POST",
        url: path.startsWith("/") ? path : `/api/auth/${path}`,
        remoteAddress: "192.0.2.17",
        headers: { origin, ...(cookie ? { cookie } : {}) },
        payload: body,
      });
    const provision = createAuth(runtime, config, {
      invitationRegistration: true,
      email: services.email,
      emailTasks: tasks,
      sharedControls: services.authentication!.controls,
    });
    const password = randomBytes(24).toString("hex");
    const accounts = {
      active: "active@example.invalid",
      unverified: "unverified@example.invalid",
      inactive: "inactive@example.invalid",
      missing: "missing@example.invalid",
    };
    for (const email of [
      accounts.active,
      accounts.unverified,
      accounts.inactive,
    ]) {
      const finish = await inTransaction(runtime, (tx) =>
        provision.registration.withinTransaction(
          tx,
          { email, name: "Synthetic D5-B0", password },
          "en",
          origin + "/verify-email?status=verified",
        ),
      );
      await finish();
    }
    await db.migrator.query(
      'UPDATE public."user" SET "emailVerified"=TRUE WHERE email=$1',
      [accounts.active],
    );
    await db.migrator.query(
      'UPDATE public."user" SET active=FALSE WHERE email=$1',
      [accounts.inactive],
    );
    const userId = async (email: string) =>
      (
        await db.migrator.query('SELECT id FROM public."user" WHERE email=$1', [
          email,
        ])
      ).rows[0].id as string;
    type Job = EmailMetadata & { ciphertext: string; state: string };
    async function mail(email: string, kind: string) {
      const rows = (
        await db.migrator.query(
          "SELECT * FROM budograph_private.email_outbox WHERE ciphertext IS NOT NULL ORDER BY created_at DESC",
        )
      ).rows as Job[];
      for (const job of rows) {
        const payload = decryptEmail(secrets, job, job.ciphertext) as {
          message: TransactionalEmail;
        };
        if (payload.message.to === email && payload.message.kind === kind)
          return { job, url: new URL(payload.message.url) };
      }
      throw new Error("Synthetic expected mail job missing.");
    }
    const resetToken = async () =>
      (await mail(accounts.active, "reset")).url.pathname.split("/").at(-1)!;
    const requestReset = () =>
      post("request-password-reset", { email: accounts.active });

    await t.test(
      "unknown, inactive, active and verified/unverified resend responses share status/body/floor and never dispatch providers",
      async () => {
        for (const path of [
          "request-password-reset",
          "send-verification-email",
        ]) {
          const durations: number[] = [];
          for (const email of Object.values(accounts)) {
            await clearLimits();
            const start = performance.now();
            const response = await post(path, { email });
            durations.push(performance.now() - start);
            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.json(), { status: true });
          }
          assert.ok(
            durations.every((ms) => ms >= authMailResponseFloorMs - 20),
          );
          assert.ok(
            Math.max(...durations) - Math.min(...durations) < 400,
            "Normal local identity timing should fit the common floor",
          );
        }
        assert.equal(attempts.length, 0);
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.verification WHERE value=$1 AND identifier LIKE 'reset-password:%'",
              [await userId(accounts.inactive)],
            )
          ).rows[0].n,
          0,
        );
      },
    );

    await t.test(
      "parallel verification resends do not stack native response sleeps under account/outbox locks",
      async () => {
        const finish = await inTransaction(runtime, (tx) =>
          provision.registration.withinTransaction(
            tx,
            {
              email: accounts.unverified,
              name: "Retry must not replace identity",
              password: randomBytes(24).toString("hex"),
            },
            "en",
            origin + "/verify-email?status=verified",
          ),
        );
        await finish();
        assert.equal(
          (
            await db.migrator.query(
              'SELECT name FROM public."user" WHERE email=$1',
              [accounts.unverified],
            )
          ).rows[0].name,
          "Synthetic D5-B0",
        );
        await clearLimits();
        const start = performance.now();
        const replies = await Promise.all(
          Array.from({ length: 3 }, (_v, i) =>
            post(
              "send-verification-email",
              { email: accounts.unverified },
              i % 2 ? appB : app,
            ),
          ),
        );
        assert.ok(replies.every((reply) => reply.statusCode === 200));
        assert.ok(
          performance.now() - start < 1200,
          "Native sleeps must not serialize on a database lock",
        );
      },
    );

    await t.test(
      "slow provider is owned by the worker; concurrent HTTP response completes while delivery is held",
      async () => {
        await clearLimits();
        const { job, url } = await mail(accounts.unverified, "verification");
        hold();
        const sending = services.email!.dispatch!(job.id, 1);
        await entered!;
        try {
          const response = await Promise.race([
            post("send-verification-email", { email: accounts.missing }),
            new Promise<never>((_r, reject) =>
              setTimeout(
                () => reject(Error("Provider blocked HTTP response")),
                2500,
              ),
            ),
          ]);
          assert.equal(response.statusCode, 200);
        } finally {
          release();
        }
        assert.equal((await sending).accepted, 1);
        outcome = "success";
        const verified = await app.inject({ url: url.pathname + url.search });
        assert.ok([200, 302].includes(verified.statusCode));
        assert.equal(
          (
            await db.migrator.query(
              'SELECT "emailVerified" FROM public."user" WHERE email=$1',
              [accounts.unverified],
            )
          ).rows[0].emailVerified,
          true,
        );
        await clearLimits();
        assert.equal(
          (
            await post("sign-in/email", {
              email: accounts.unverified,
              password,
            })
          ).statusCode,
          200,
        );
      },
    );

    await t.test(
      "outage stays retryable in the durable queue; another runtime retries the same idempotency key and body",
      async () => {
        await clearLimits();
        assert.equal((await requestReset()).statusCode, 200);
        const { job } = await mail(accounts.active, "reset");
        outcome = "outage";
        assert.equal((await services.email!.dispatch!(job.id, 1)).accepted, 0);
        assert.equal(
          (
            await db.migrator.query(
              "SELECT state FROM budograph_private.email_outbox WHERE id=$1",
              [job.id],
            )
          ).rows[0].state,
          "retry",
        );
        await clearLimits();
        assert.equal(
          (await post("request-password-reset", { email: accounts.missing }))
            .statusCode,
          200,
        );
        await db.migrator.query(
          "UPDATE budograph_private.email_outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
        outcome = "success";
        await clearLimits();
        assert.equal((await servicesB.email!.dispatch!(job.id, 1)).accepted, 1);
        assert.deepEqual(attempts.at(-2), attempts.at(-1));
        assert.ok(diagnostic.includes("outbox"));
      },
    );

    await t.test(
      "worker budget denial defers the committed job without provider I/O and another runtime later delivers it",
      async () => {
        await clearLimits();
        await requestReset();
        const { job } = await mail(accounts.active, "reset");
        const controls = createSharedControls(runtime, secrets.hmacKey);
        assert.equal((await controls.delivery()).allowed, true);
        const before = attempts.length;
        const result = await services.email!.dispatch!(job.id, 1);
        assert.equal(result.accepted, 0);
        assert.equal(result.deferred, 1);
        assert.equal(attempts.length, before);
        assert.equal(
          (
            await db.migrator.query(
              "SELECT state FROM budograph_private.email_outbox WHERE id=$1",
              [job.id],
            )
          ).rows[0].state,
          "retry",
        );
        await clearLimits();
        await db.migrator.query(
          "UPDATE budograph_private.email_outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
        assert.equal((await servicesB.email!.dispatch!(job.id, 1)).accepted, 1);
      },
    );

    await t.test(
      "failed durable enqueue rolls back token replacement and preserves the previous valid reset link",
      async () => {
        await clearLimits();
        await requestReset();
        const token = await resetToken();
        const broken = createAuth(runtime, config, {
          onMailEnqueueFailure: () => diagnostic.push("enqueue-failed"),
          email: {
            ...services.email!,
            enqueue: async () => {
              throw new OperationalError();
            },
          },
          emailTasks: tasks,
          sharedControls: services.authentication!.controls,
        });
        const request = new Request(
          origin + "/api/auth/request-password-reset",
          {
            method: "POST",
            headers: {
              origin,
              "content-type": "application/json",
              "x-budograph-client-ip": "192.0.2.99",
            },
            body: JSON.stringify({ email: accounts.active }),
          },
        );
        await clearLimits();
        const response = await broken.handler(request);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: true });
        assert.ok(diagnostic.includes("enqueue-failed"));
        assert.equal(
          (
            await db.migrator.query(
              'SELECT count(*)::int AS n FROM public.verification WHERE identifier=$1 AND "expiresAt">clock_timestamp()',
              [`reset-password:${token}`],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "F2 enqueue failure has identical public status/body/headers/floor after rollback and a safe diagnostic",
      async () => {
        const unverified = "enqueue-fault@example.invalid";
        const finish = await inTransaction(runtime, (tx) =>
          provision.registration.withinTransaction(
            tx,
            { email: unverified, name: "Synthetic enqueue fault", password },
            "en",
            origin + "/verify-email?status=verified",
          ),
        );
        await finish();
        await clearLimits();
        await requestReset();
        const previousToken = await resetToken();
        const previousJobs = (
          await db.migrator.query(
            "SELECT count(*)::int AS n FROM budograph_private.email_outbox",
          )
        ).rows[0].n;
        const snapshotJobs = async () =>
          (
            await db.migrator.query(
              "SELECT id,state,reference_hash,(ciphertext IS NOT NULL) AS payload_present FROM budograph_private.email_outbox ORDER BY id",
            )
          ).rows;
        const previousStates = await snapshotJobs();
        const logs: string[] = [];
        const faultyAuth = createAuth(runtime, config, {
          email: {
            ...services.email!,
            enqueue: async (tx, message) => {
              await services.email!.enqueue!(tx, message);
              throw new OperationalError(); // Fail after writing: the job must roll back too.
            },
          },
          emailTasks: tasks,
          sharedControls: services.authentication!.controls,
          onMailEnqueueFailure: () =>
            faultyApp.log.error("Authentication mail enqueue failed"),
        });
        const faultyApp = createApp({
          checkDatabase: async () => {},
          logger: {
            stream: new Writable({
              write(chunk, _encoding, done) {
                logs.push(String(chunk));
                done();
              },
            }),
          },
          authentication: { ...services.authentication!, auth: faultyAuth },
        });
        try {
          for (const path of [
            "request-password-reset",
            "send-verification-email",
          ]) {
            const durations: number[] = [];
            let expectedHeaders: object | undefined;
            for (const email of [
              accounts.active,
              accounts.inactive,
              accounts.missing,
              unverified,
            ]) {
              await clearLimits();
              const start = performance.now();
              const response = await post(path, { email }, faultyApp);
              durations.push(performance.now() - start);
              assert.equal(response.statusCode, 200);
              assert.deepEqual(response.json(), { status: true });
              const headers = Object.fromEntries(
                Object.entries(response.headers).filter(
                  ([key]) => key !== "date",
                ),
              );
              if (expectedHeaders) assert.deepEqual(headers, expectedHeaders);
              else expectedHeaders = headers;
              assert.equal(response.headers["set-cookie"], undefined);
              assert.equal(response.headers["retry-after"], undefined);
            }
            assert.ok(
              durations.every((ms) => ms >= authMailResponseFloorMs - 20),
            );
            assert.ok(Math.max(...durations) - Math.min(...durations) < 400);
          }
          assert.ok(
            logs.join("").includes("Authentication mail enqueue failed"),
          );
          for (const sensitive of [
            ...Object.values(accounts),
            unverified,
            previousToken,
            password,
          ])
            assert.ok(!logs.join("").includes(sensitive));
          assert.equal(
            (
              await db.migrator.query(
                "SELECT count(*)::int AS n FROM budograph_private.email_outbox",
              )
            ).rows[0].n,
            previousJobs,
          );
          assert.deepEqual(await snapshotJobs(), previousStates);
          assert.equal(
            (
              await db.migrator.query(
                "SELECT count(*)::int AS n FROM public.verification WHERE identifier=$1",
                [`reset-password:${previousToken}`],
              )
            ).rows[0].n,
            1,
          );
        } finally {
          await faultyApp.close();
        }
      },
    );

    await t.test(
      "concurrent duplicate reset requests serialize and retain exactly one native reset credential",
      async () => {
        await clearLimits();
        const responses = await Promise.all([
          requestReset(),
          post("request-password-reset", { email: accounts.active }, appB),
        ]);
        for (const response of responses)
          assert.equal(response.statusCode, 200);
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.verification WHERE value=$1 AND identifier LIKE 'reset-password:%'",
              [await userId(accounts.active)],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "only newest reset link works; successful reset also clears legacy siblings, refuses reuse and revokes both sessions",
      async () => {
        await clearLimits();
        await requestReset();
        const old = await resetToken();
        await requestReset();
        const latest = await resetToken();
        assert.notEqual(old, latest);
        const nextPassword = randomBytes(24).toString("hex");
        assert.equal(
          (
            await post("reset-password", {
              token: old,
              newPassword: nextPassword,
            })
          ).statusCode,
          400,
        );
        const context = await provision.$context;
        const sibling = randomBytes(24).toString("hex");
        await context.internalAdapter.createVerificationValue({
          identifier: `reset-password:${sibling}`,
          value: await userId(accounts.active),
          expiresAt: new Date(Date.now() + 3600000),
        });
        await clearLimits();
        const sessions = [];
        for (let i = 0; i < 2; i++) {
          const login = await post("sign-in/email", {
            email: accounts.active,
            password,
          });
          assert.equal(login.statusCode, 200);
          sessions.push(String(login.headers["set-cookie"]).split(";")[0]!);
        }
        assert.equal(
          (
            await post("reset-password", {
              token: latest,
              newPassword: nextPassword,
            })
          ).statusCode,
          200,
        );
        assert.equal(
          (
            await post("reset-password", {
              token: latest,
              newPassword: password,
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (
            await post("reset-password", {
              token: sibling,
              newPassword: password,
            })
          ).statusCode,
          400,
        );
        for (const cookie of sessions)
          assert.equal(
            (await app.inject({ url: "/api/me", headers: { cookie } }))
              .statusCode,
            401,
          );
        assert.equal(
          (
            await db.migrator.query(
              'SELECT count(*)::int AS n FROM public.session WHERE "userId"=$1',
              [await userId(accounts.active)],
            )
          ).rows[0].n,
          0,
        );
        await clearLimits();
        assert.equal(
          (await post("sign-in/email", { email: accounts.active, password }))
            .statusCode,
          401,
        );
        assert.equal(
          (
            await post("sign-in/email", {
              email: accounts.active,
              password: nextPassword,
            })
          ).statusCode,
          200,
        );
      },
    );

    await t.test(
      "expired and inactive-account reset credentials cannot change password or create sessions",
      async () => {
        await clearLimits();
        await requestReset();
        const token = await resetToken();
        await db.migrator.query(
          "UPDATE public.verification SET \"expiresAt\"=clock_timestamp()-interval '1 second' WHERE identifier=$1",
          [`reset-password:${token}`],
        );
        assert.equal(
          (
            await post("reset-password", {
              token,
              newPassword: randomBytes(24).toString("hex"),
            })
          ).statusCode,
          400,
        );
        const context = await provision.$context;
        const inactiveToken = randomBytes(24).toString("hex");
        await context.internalAdapter.createVerificationValue({
          identifier: `reset-password:${inactiveToken}`,
          value: await userId(accounts.inactive),
          expiresAt: new Date(Date.now() + 3600000),
        });
        assert.equal(
          (
            await post("reset-password", {
              token: inactiveToken,
              newPassword: randomBytes(24).toString("hex"),
            })
          ).statusCode,
          400,
        );
      },
    );

    await t.test(
      "F1 canonical reset authority rejects ambiguity and inactive accounts; body/query resets remain single-use under concurrency",
      async () => {
        const email = "token-authority@example.invalid";
        const finish = await inTransaction(runtime, (tx) =>
          provision.registration.withinTransaction(
            tx,
            { email, name: "Synthetic token authority", password },
            "en",
            origin + "/verify-email?status=verified",
          ),
        );
        await finish();
        await db.migrator.query(
          'UPDATE public."user" SET "emailVerified"=TRUE WHERE email=$1',
          [email],
        );
        const id = await userId(email),
          inactiveId = await userId(accounts.inactive);
        const context = await provision.$context;
        const mint = async (owner = id) => {
          const token = randomBytes(24).toString("hex");
          await context.internalAdapter.createVerificationValue({
            identifier: `reset-password:${token}`,
            value: owner,
            expiresAt: new Date(Date.now() + 3600000),
          });
          return token;
        };
        const hash = async (owner: string) =>
          (
            await db.migrator.query(
              'SELECT password FROM public.account WHERE "userId"=$1 AND "providerId"=\'credential\'',
              [owner],
            )
          ).rows[0].password;
        const before = await hash(id),
          inactiveBefore = await hash(inactiveId);
        const valid = await mint(),
          inactive = await mint(inactiveId);
        const nextPassword = randomBytes(24).toString("hex");
        for (const [query, fields] of [
          [`?token=${valid}`, { token: "" }],
          ["", { token: "" }],
          [`?token=${valid}`, { token: "different" }],
          [`?token=${valid}`, { token: null }],
          [`?token=${valid}`, { token: [] }],
          [`?token=${valid}&token=${valid}`, {}],
          ["", { token: "unknown-synthetic-token" }],
          ["", {}],
          [`?token=${inactive}`, { token: "" }],
          [`?token=${inactive}`, {}],
          ["", { token: inactive }],
        ] as const) {
          await clearLimits();
          const response = await post(`/api/auth/reset-password${query}`, {
            ...fields,
            newPassword: nextPassword,
          });
          assert.equal(response.statusCode, 400);
          assert.ok(!response.body.includes(nextPassword));
          assert.equal(await hash(id), before);
          assert.equal(await hash(inactiveId), inactiveBefore);
        }
        // The failed ambiguous request must not consume its otherwise valid token.
        await clearLimits();
        assert.equal(
          (
            await post("reset-password", {
              token: valid,
              newPassword: nextPassword,
            })
          ).statusCode,
          200,
        );
        assert.equal(
          (
            await post("reset-password", {
              token: valid,
              newPassword: password,
            })
          ).statusCode,
          400,
        );
        const queryToken = await mint();
        await clearLimits();
        assert.equal(
          (
            await post(`/api/auth/reset-password?token=${queryToken}`, {
              newPassword: password,
            })
          ).statusCode,
          200,
        );
        const sharedToken = await mint(),
          sibling = await mint();
        await clearLimits();
        const login = await post("sign-in/email", { email, password });
        assert.equal(login.statusCode, 200);
        const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
        const replies = await Promise.all([
          post("reset-password", {
            token: sharedToken,
            newPassword: nextPassword,
          }),
          post(
            `/api/auth/reset-password?token=${sharedToken}`,
            { newPassword: nextPassword },
            appB,
          ),
        ]);
        assert.deepEqual(replies.map((r) => r.statusCode).sort(), [200, 400]);
        assert.equal(
          (
            await post("reset-password", {
              token: sibling,
              newPassword: password,
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (await app.inject({ url: "/api/me", headers: { cookie } }))
            .statusCode,
          401,
        );
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.verification WHERE value=$1 AND identifier LIKE 'reset-password:%'",
              [id],
            )
          ).rows[0].n,
          0,
        );
        await clearLimits();
        assert.equal(
          (await post("sign-in/email", { email, password: nextPassword }))
            .statusCode,
          200,
        );
      },
    );

    await t.test(
      "critical capacity failure remains identical 503 for all identities with safe internal diagnostics",
      async () => {
        const logs: string[] = [];
        const brokenEmail = {
          ...services.email!,
          reserve: async () => {
            throw new OperationalError();
          },
        };
        const brokenAuth = createAuth(runtime, config, {
          email: brokenEmail,
          emailTasks: tasks,
          sharedControls: services.authentication!.controls,
        });
        const broken = createApp({
          checkDatabase: async () => {},
          logger: {
            stream: new Writable({
              write(chunk, _encoding, done) {
                logs.push(String(chunk));
                done();
              },
            }),
          },
          authentication: { ...services.authentication!, auth: brokenAuth },
        });
        try {
          for (const email of Object.values(accounts)) {
            await clearLimits();
            const result = await post(
              "request-password-reset",
              { email },
              broken,
            );
            assert.equal(result.statusCode, 503);
            assert.equal(result.json().code, "UNAVAILABLE");
          }
          assert.ok(logs.join("").includes("Operational control unavailable"));
          for (const email of Object.values(accounts))
            assert.ok(!logs.join("").includes(email));
        } finally {
          await broken.close();
        }
      },
    );

    await t.test(
      "origin and disabled signup boundaries reject before identity mutation or provider work",
      async () => {
        const before = (
          await db.migrator.query(
            'SELECT count(*)::int AS n FROM public."user"',
          )
        ).rows[0].n;
        for (const headers of [
          {},
          { origin: "https://attacker.invalid" },
          { origin, "sec-fetch-site": "cross-site" },
        ]) {
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: "/api/auth/request-password-reset",
                headers,
                payload: { email: accounts.active },
              })
            ).statusCode,
            403,
          );
        }
        assert.equal(
          (
            await post("sign-up/email", {
              name: "Blocked",
              email: "blocked@example.invalid",
              password,
            })
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await db.migrator.query(
              'SELECT count(*)::int AS n FROM public."user"',
            )
          ).rows[0].n,
          before,
        );
      },
    );

    await t.test(
      "registration and event limits persist across instances and IPv6 rotation cannot reset admission",
      async () => {
        await clearLimits();
        const a = createSharedControls(runtime, secrets.hmacKey),
          b = createSharedControls(otherRuntime, secrets.hmacKey);
        for (let i = 0; i < 3; i++)
          await a.registration(`192.0.2.${i + 1}`, "same@example.invalid");
        await assert.rejects(
          b.registration("198.51.100.1", "SAME@example.invalid"),
          (e) => e instanceof OperationalError && e.statusCode === 429,
        );
        await clearLimits();
        for (let i = 0; i < 5; i++)
          await a.registration(
            `2001:db8:1:2::${i + 1}`,
            `person${i}@example.invalid`,
          );
        await assert.rejects(
          b.registration("2001:db8:1:2::ffff", "next@example.invalid"),
          (e) => e instanceof OperationalError && e.statusCode === 429,
        );
        await clearLimits();
        for (let i = 0; i < 5; i++)
          await a.eventCreation(`192.0.2.${i + 1}`, "same-actor");
        await assert.rejects(
          b.eventCreation("198.51.100.1", "same-actor"),
          (e) => e instanceof OperationalError && e.statusCode === 429,
        );
        await b.eventCreation("198.51.100.1", "other-actor");
        await clearLimits();
        const minuteKey = a.rule(
          "event-create:account",
          "day-actor",
          5,
          60000,
        ).key;
        for (let i = 0; i < 20; i++) {
          if (i % 5 === 0)
            await db.migrator.query(
              "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
              [minuteKey],
            );
          await (i % 2 ? a : b).eventCreation(
            `198.51.100.${i + 1}`,
            "day-actor",
          );
        }
        await db.migrator.query(
          "UPDATE budograph_private.rate_counter SET expires_at=clock_timestamp()-interval '1 second' WHERE key_hash=$1",
          [minuteKey],
        );
        await assert.rejects(
          a.eventCreation("203.0.113.1", "day-actor"),
          (e) => e instanceof OperationalError && e.statusCode === 429,
        );
      },
    );

    await t.test(
      "F3 lost-response exact replay survives exhausted quotas; changed/new commands and revoked authority cannot bypass admission",
      async () => {
        const id = await userId(accounts.unverified);
        const actor = {
          id,
          email: accounts.unverified,
          name: "Synthetic replay",
        };
        const fields = {
          name: "Synthetic replay source",
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          timezone: "UTC",
        };
        const source = await createEventService(runtime).create(actor, fields);
        await clearLimits();
        const login = await post("sign-in/email", {
          email: actor.email,
          password,
        });
        assert.equal(login.statusCode, 200);
        const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
        const key = randomUUID(),
          body = {
            ...fields,
            name: "Synthetic replay target",
            expectedVersion: 1,
          };
        const duplicate = (command = key, payload = body, target = app) =>
          target.inject({
            method: "POST",
            url: `/api/events/${source.id}/duplicate`,
            remoteAddress: "192.0.2.17",
            headers: { origin, cookie, "idempotency-key": command },
            payload,
          });
        const accepted = await duplicate();
        assert.equal(accepted.statusCode, 201);
        for (let i = 0; i < 5; i++) {
          const replay = await duplicate(key, body, i % 2 ? appB : app);
          assert.equal(replay.statusCode, 201);
          assert.deepEqual(replay.json(), accepted.json());
        }
        const concurrent = await Promise.all(
          Array.from({ length: 3 }, (_v, i) =>
            duplicate(key, body, i % 2 ? appB : app),
          ),
        );
        assert.ok(concurrent.every((r) => r.statusCode === 201));
        assert.equal(
          (await duplicate(key, { ...body, name: "Changed digest" }))
            .statusCode,
          409,
        );
        const denied = await duplicate(randomUUID());
        assert.equal(denied.statusCode, 429);
        assert.ok(Number(denied.headers["retry-after"]) > 0);
        const outcome = accepted.json().event;
        await db.migrator.query(
          "UPDATE public.event_member SET access_role='MEMBER' WHERE event_id=$1 AND user_id=$2",
          [source.id, id],
        );
        assert.equal((await duplicate()).statusCode, 403);
        await db.migrator.query(
          "UPDATE public.event_member SET access_role='ORGANIZER' WHERE event_id=$1 AND user_id=$2",
          [source.id, id],
        );
        await db.migrator.query(
          "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE event_id=$1 AND user_id=$2",
          [outcome.id, id],
        );
        assert.equal((await duplicate()).statusCode, 404);
        await db.migrator.query(
          "UPDATE public.event_member SET active=TRUE,deactivated_at=NULL WHERE event_id=$1 AND user_id=$2",
          [outcome.id, id],
        );
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.event WHERE owner_user_id=$1",
              [id],
            )
          ).rows[0].n,
          2,
        );
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.event_command_receipt WHERE actor_user_id=$1",
              [id],
            )
          ).rows[0].n,
          1,
        );
        await clearLimits();
        const freshKey = randomUUID();
        const fresh = await Promise.all(
          Array.from({ length: 5 }, (_v, i) =>
            duplicate(freshKey, body, i % 2 ? appB : app),
          ),
        );
        assert.ok(fresh.every((r) => r.statusCode === 201));
        assert.ok(
          fresh.every((r) => r.json().event.id === fresh[0]!.json().event.id),
        );
        assert.equal((await duplicate(freshKey)).statusCode, 201);
        assert.equal((await duplicate(randomUUID())).statusCode, 429);
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.event WHERE owner_user_id=$1",
              [id],
            )
          ).rows[0].n,
          3,
        );
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.activity_entry WHERE event_id=$1 AND action_type='EVENT_CREATED'",
              [fresh[0]!.json().event.id],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "Create and Duplicate share a serialized per-account storage cap including archived events",
      async () => {
        const id = await userId(accounts.active);
        const ids = Array.from({ length: maxOwnedEvents - 1 }, () =>
          randomUUID(),
        );
        await db.migrator.query(
          `INSERT INTO public.event(id,name,start_date,end_date,timezone,owner_user_id,archived_at)
      SELECT x::uuid,'Synthetic capacity','2026-11-01','2026-11-01','UTC',$2,clock_timestamp() FROM unnest($1::text[]) x`,
          [ids, id],
        );
        const a = createEventService(runtime),
          b = createEventService(otherRuntime);
        const actor = { id, email: accounts.active, name: "Synthetic" };
        const fields = {
          name: "Final capacity",
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          timezone: "UTC",
        };
        const outcomes = await Promise.allSettled([
          a.create(actor, fields),
          b.create(actor, fields),
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        const created = outcomes.find((r) => r.status === "fulfilled")!;
        assert.ok(created.status === "fulfilled");
        const rejected = outcomes.find((r) => r.status === "rejected")!;
        assert.ok(
          rejected.status === "rejected" &&
            rejected.reason.code === "EVENT_CAPACITY_REACHED",
        );
        await assert.rejects(
          b.duplicate(actor, created.value.id, randomUUID(), {
            ...fields,
            expectedVersion: 1,
          }),
          (e: unknown) =>
            (e as { code: string }).code === "EVENT_CAPACITY_REACHED",
        );
        assert.equal(
          (
            await db.migrator.query(
              "SELECT count(*)::int AS n FROM public.event WHERE owner_user_id=$1",
              [id],
            )
          ).rows[0].n,
          maxOwnedEvents,
        );
      },
    );
  },
);

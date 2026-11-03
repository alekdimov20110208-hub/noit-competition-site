import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { d5B0Database } from "./helpers/d5-b0-database.ts";
import { syntheticOperationalSecrets } from "./helpers/operational-secrets.ts";
import { createApplicationServices } from "../src/runtime.ts";
import { createApp } from "../src/app.ts";
import { createAuth } from "../src/auth/auth.ts";
import { localSignupIdentity } from "../src/auth/signup.ts";
import {
  createEmailTasks,
  type TransactionalEmail,
  type TransactionalEmailService,
} from "../src/email/service.ts";
import { decryptEmail, type EmailMetadata } from "../src/operations/crypto.ts";
import { OperationalError } from "../src/operations/limits.ts";
import { maxOwnedEvents } from "../src/events/service.ts";
import type { ServerConfig } from "../src/config/env.ts";

test(
  "D5-B1 native signup on a fresh witnessed PostgreSQL fixture; mocked provider only",
  {
    skip: !process.env.D5_B0_OWNER_FILE,
    timeout: 180000,
  },
  async (t) => {
    const db = await d5B0Database(),
      runtime = db.runtime(),
      otherRuntime = db.runtime();
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((r, reject) =>
      socket.close((e) => (e ? reject(e) : r())),
    );
    const origin = `http://127.0.0.1:${port}`,
      secrets = syntheticOperationalSecrets();
    const config: ServerConfig = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port,
      databaseUrl: process.env.D5_B0_RUNTIME_URL!,
      databaseTls: { mode: "disable" },
      betterAuthSecret: randomBytes(32).toString("hex"),
      betterAuthUrl: origin,
      publicAppUrl: origin,
      emailMode: "resend",
      emailFrom: "no-reply@example.invalid",
      resendApiKey: "re_" + randomBytes(24).toString("hex"),
      operations: secrets,
      publicSignupEnabled: true,
    };
    const tasks = createEmailTasks(),
      diagnostic: string[] = [];
    let providerCalls = 0;
    t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
      assert.equal(
        String(url),
        "https://api.resend.com/emails",
        "Unexpected outbound HTTP forbidden",
      );
      providerCalls++;
      return new Response("{}", { status: 503 });
    });
    const services = createApplicationServices(runtime, config, tasks, (kind) =>
      diagnostic.push(kind),
    );
    const servicesB = createApplicationServices(
      otherRuntime,
      config,
      tasks,
      (kind) => diagnostic.push(kind),
    );
    const app = createApp({ ...services, frontendRoot: resolve("dist") }),
      appB = createApp(servicesB);
    t.after(async () => {
      await Promise.all([app.close(), appB.close()]);
      await tasks.drain();
      await db.close();
    });
    const clearLimits = () =>
      db.migrator.query("DELETE FROM budograph_private.rate_counter");
    const password = randomBytes(24).toString("hex");
    const body = (email: string) => ({
      name: "Synthetic B1",
      email,
      password,
      confirmPassword: password,
    });
    const post = (
      path: string,
      payload: object,
      target = app,
      cookie?: string,
    ) =>
      target.inject({
        method: "POST",
        url: path,
        remoteAddress: "192.0.2.17",
        headers: {
          origin,
          "x-budograph-locale": "en",
          ...(cookie ? { cookie } : {}),
        },
        payload,
      });
    const signup = (email: string, target = app) =>
      post("/api/registration", body(email), target);
    const user = async (email: string) =>
      (
        await db.migrator.query('SELECT * FROM public."user" WHERE email=$1', [
          email,
        ])
      ).rows[0];
    const counts = async () =>
      (
        await db.migrator.query(`SELECT
    (SELECT count(*)::int FROM public."user") AS users,
    (SELECT count(*)::int FROM public.account) AS accounts,
    (SELECT count(*)::int FROM public.session) AS sessions,
    (SELECT count(*)::int FROM public.event) AS events,
    (SELECT count(*)::int FROM public.event_member) AS members,
    (SELECT count(*)::int FROM budograph_private.email_outbox) AS jobs`)
      ).rows[0];
    async function mail(email: string) {
      const jobs = (
        await db.migrator.query(
          "SELECT * FROM budograph_private.email_outbox WHERE ciphertext IS NOT NULL ORDER BY created_at DESC",
        )
      ).rows as (EmailMetadata & { ciphertext: string })[];
      for (const job of jobs) {
        const payload = decryptEmail(secrets, job, job.ciphertext) as {
          message: TransactionalEmail;
        };
        if (
          payload.message.to === email &&
          payload.message.kind === "verification"
        )
          return payload.message;
      }
      throw Error("Synthetic verification job missing");
    }
    const verify = async (email: string) => {
      const link = new URL((await mail(email)).url);
      return app.inject({ method: "GET", url: link.pathname + link.search });
    };
    const login = async (email: string, secret = password) => {
      await clearLimits();
      return post("/api/auth/sign-in/email", { email, password: secret });
    };
    const cookieOf = (result: { headers: Record<string, unknown> }) =>
      String(result.headers["set-cookie"]).split(";")[0]!;
    const email = "new-b1@example.invalid";
    await clearLimits();
    await t.test(
      "default gate and native general signup remain closed without account writes",
      async () => {
        const closedServices = createApplicationServices(
          runtime,
          { ...config, publicSignupEnabled: undefined },
          tasks,
          () => {},
        );
        const closed = createApp(closedServices);
        try {
          const before = await counts();
          assert.deepEqual((await closed.inject("/api/registration")).json(), {
            enabled: false,
          });
          assert.equal(
            (await signup("closed@example.invalid", closed)).statusCode,
            404,
          );
          for (const target of [app, closed])
            assert.equal(
              (await post("/api/auth/sign-up/email", body(email), target))
                .statusCode,
              404,
            );
          assert.deepEqual(await counts(), before);
        } finally {
          await closed.close();
        }
      },
    );
    await t.test(
      "valid native signup atomically creates only unverified active identity, credential and one durable job",
      async () => {
        const before = await counts(),
          start = performance.now();
        const result = await signup(" NEW-B1@example.invalid ");
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.json(), { status: true });
        assert.ok(performance.now() - start >= 740);
        assert.equal(result.headers["set-cookie"], undefined);
        assert.equal(result.headers["cache-control"], "no-store");
        const after = await counts();
        assert.deepEqual(after, {
          ...before,
          users: before.users + 1,
          accounts: before.accounts + 1,
          jobs: before.jobs + 1,
        });
        const identity = await user(email);
        assert.equal(identity.active, true);
        assert.equal(identity.emailVerified, false);
        const credential = (
          await db.migrator.query(
            'SELECT password FROM public.account WHERE "userId"=$1',
            [identity.id],
          )
        ).rows[0];
        assert.ok(credential.password && credential.password !== password);
        const message = await mail(email);
        assert.equal(message.locale, "en");
        assert.equal(new URL(message.url).origin, origin);
        assert.equal(providerCalls, 0);
      },
    );
    await t.test(
      "invalid names/emails/passwords/mismatch/authority/query and CSRF cannot mutate storage",
      async () => {
        const before = await counts();
        for (const patch of [
          { name: "<>" },
          { email: "invalid" },
          { password: "short", confirmPassword: "short" },
          { confirmPassword: "different" },
          { emailVerified: true },
          { active: true },
          { userId: "synthetic" },
          { role: "ORGANIZER" },
        ])
          assert.equal(
            (
              await post("/api/registration", {
                ...body("invalid@example.invalid"),
                ...patch,
              })
            ).statusCode,
            400,
          );
        assert.equal(
          (await post("/api/registration?active=true", body(email))).statusCode,
          400,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/registration",
              payload: body(email),
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/registration",
              headers: { origin: "https://attacker.invalid" },
              payload: body(email),
            })
          ).statusCode,
          403,
        );
        assert.deepEqual(await counts(), before);
      },
    );
    await t.test(
      "D4 unverified refusal, native verification, verified login and empty Event list",
      async () => {
        const denied = await login(email);
        assert.equal(denied.statusCode, 403);
        assert.equal(denied.json().code, "EMAIL_NOT_VERIFIED");
        assert.equal(denied.headers["set-cookie"], undefined);
        const verified = await verify(email);
        assert.equal(verified.statusCode, 302);
        assert.equal(verified.headers["set-cookie"], undefined);
        assert.equal((await user(email)).emailVerified, true);
        const logged = await login(email);
        assert.equal(logged.statusCode, 200);
        const cookie = cookieOf(logged);
        const list = await app.inject({
          url: "/api/events",
          headers: { cookie },
        });
        assert.equal(list.statusCode, 200);
        assert.deepEqual(list.json().events, []);
        const me = await app.inject({ url: "/api/me", headers: { cookie } });
        assert.equal(me.json().user.email, email);
      },
    );
    await t.test(
      "new/verified/unverified/inactive duplicates share status/body/headers/floor; credentials and mail remain unchanged on duplicates",
      async () => {
        await clearLimits();
        await signup("unverified-b1@example.invalid");
        await clearLimits();
        await signup("inactive-b1@example.invalid");
        await db.migrator.query(
          'UPDATE public."user" SET active=FALSE WHERE email=$1',
          ["inactive-b1@example.invalid"],
        );
        let headers: object | undefined;
        for (const address of [
          email,
          "unverified-b1@example.invalid",
          "inactive-b1@example.invalid",
          "fresh-timing-b1@example.invalid",
        ]) {
          await clearLimits();
          const before = await counts(),
            start = performance.now();
          const replacement = randomBytes(24).toString("hex");
          const result = await post(
            "/api/registration",
            {
              ...body(address),
              name: "Replacement must not overwrite",
              password: replacement,
              confirmPassword: replacement,
            },
            appB,
          );
          const elapsed = performance.now() - start;
          assert.equal(result.statusCode, 200);
          assert.deepEqual(result.json(), { status: true });
          assert.ok(elapsed >= 740);
          const common = Object.fromEntries(
            Object.entries(result.headers).filter(([key]) => key !== "date"),
          );
          if (headers) assert.deepEqual(common, headers);
          else headers = common;
          if (address !== "fresh-timing-b1@example.invalid")
            assert.deepEqual(await counts(), before);
          t.diagnostic(
            `signup recipient class ${address === email ? "verified" : address.startsWith("unverified") ? "unverified" : address.startsWith("inactive") ? "inactive" : "new"}: ${Math.round(elapsed)}ms`,
          );
        }
        assert.equal((await user(email)).name, "Synthetic B1");
        assert.equal((await login(email)).statusCode, 200);
      },
    );
    await t.test(
      "new unverified BG account can request verification again; unsafe returnTo stays on the application",
      async () => {
        await clearLimits();
        const address = "bg-resend-b1@example.invalid";
        const result = await app.inject({
          method: "POST",
          url: "/api/registration",
          remoteAddress: "192.0.2.18",
          headers: { origin, "x-budograph-locale": "bg" },
          payload: { ...body(address), returnTo: "//attacker.invalid" },
        });
        assert.equal(result.statusCode, 200);
        const initial = await mail(address);
        assert.equal(initial.locale, "bg");
        const callback = new URL(
          new URL(initial.url).searchParams.get("callbackURL")!,
        );
        assert.equal(callback.origin, origin);
        assert.equal(callback.pathname, "/verify-email");
        assert.equal(callback.searchParams.get("returnTo"), null);
        await clearLimits();
        const resent = await post("/api/auth/send-verification-email", {
          email: address,
          returnTo: "https://attacker.invalid",
        });
        assert.equal(resent.statusCode, 200);
        assert.deepEqual(resent.json(), { status: true });
        assert.equal((await user(address)).emailVerified, false);
        assert.equal((await verify(address)).statusCode, 302);
        assert.equal((await login(address)).statusCode, 200);
      },
    );
    await t.test(
      "concurrent duplicate signup across runtimes creates one identity, credential and job",
      async () => {
        await clearLimits();
        const before = await counts();
        const results = await Promise.all([
          signup("concurrent-b1@example.invalid"),
          signup("concurrent-b1@example.invalid", appB),
          signup("concurrent-b1@example.invalid"),
        ]);
        assert.ok(
          results.every(
            (result) =>
              result.statusCode === 200 && result.body === '{"status":true}',
          ),
        );
        const after = await counts();
        assert.deepEqual(after, {
          ...before,
          users: before.users + 1,
          accounts: before.accounts + 1,
          jobs: before.jobs + 1,
        });
      },
    );
    await t.test(
      "durable limits survive retry/other runtime; exhausted email/network/global budgets fail before creation",
      async () => {
        await clearLimits();
        for (let i = 0; i < 3; i++)
          assert.equal(
            (await signup(email, i % 2 ? appB : app)).statusCode,
            200,
          );
        const before = await counts(),
          denied = await signup(email, appB);
        assert.equal(denied.statusCode, 429);
        assert.ok(Number(denied.headers["retry-after"]) > 0);
        assert.deepEqual(await counts(), before);
        const controls = services.authentication!.controls!;
        for (const rule of [
          controls.rule("registration:network", "192.0.2.17", 5, 900000),
          controls.rule("registration:global-day", "all", 80, 86400000, "day"),
        ]) {
          await clearLimits();
          await controls.consume([{ ...rule, max: 1 }]);
          await db.migrator.query(
            "UPDATE budograph_private.rate_counter SET count=$2 WHERE key_hash=$1",
            [rule.key, rule.max],
          );
          assert.equal(
            (await signup("denied-b1@example.invalid")).statusCode,
            429,
          );
          assert.equal(await user("denied-b1@example.invalid"), undefined);
        }
      },
    );
    await t.test(
      "failed enqueue after real SQL rolls back account and credential; duplicate/fresh responses remain generic",
      async () => {
        const brokenEmail: TransactionalEmailService = { ...services.email! };
        // Use the exact existing enqueue contract and fail after its real insert.
        brokenEmail.enqueue = async (tx, message) => {
          await services.email!.enqueue!(tx, message);
          throw Error("SYNTHETIC_ENQUEUE_FAILURE");
        };
        const privateAuth = createAuth(runtime, config, {
          invitationRegistration: true,
          email: brokenEmail,
          emailTasks: tasks,
          sharedControls: services.authentication!.controls,
          onMailEnqueueFailure: () => diagnostic.push("signup-failure"),
        });
        const broken = createApp({
          checkDatabase: async () => {},
          authentication: {
            ...services.authentication!,
            publicSignup: (fields, locale, callback) =>
              privateAuth.registration.publicSignup(
                fields,
                locale,
                callback,
                localSignupIdentity(config)!,
              ),
          },
        });
        try {
          const before = await counts();
          for (const address of [email, "rollback-b1@example.invalid"]) {
            await clearLimits();
            const result = await signup(address, broken);
            assert.equal(result.statusCode, 200);
            assert.deepEqual(result.json(), { status: true });
          }
          assert.deepEqual(await counts(), before);
          assert.equal(await user("rollback-b1@example.invalid"), undefined);
          assert.ok(diagnostic.includes("signup-failure"));
        } finally {
          await broken.close();
        }
      },
    );
    await t.test(
      "capacity/config/identity/storage failures fail closed with common unavailable responses",
      async () => {
        const brokenEmail = {
          ...services.email!,
          reserve: async () => {
            throw new OperationalError();
          },
        };
        const privateAuth = createAuth(runtime, config, {
          invitationRegistration: true,
          email: brokenEmail,
          emailTasks: tasks,
          sharedControls: services.authentication!.controls,
        });
        const badIdentity = localSignupIdentity({
          ...config,
          databaseUrl: config.databaseUrl.replace(
            "/postgres",
            "/wrong-database",
          ),
        })!;
        for (const verifyIdentity of [
          localSignupIdentity(config)!,
          badIdentity,
        ]) {
          const broken = createApp({
            checkDatabase: async () => {},
            authentication: {
              ...services.authentication!,
              publicSignup: (fields, locale, callback) =>
                privateAuth.registration.publicSignup(
                  fields,
                  locale,
                  callback,
                  verifyIdentity,
                ),
            },
          });
          try {
            const before = await counts();
            for (const address of [email, "capacity-b1@example.invalid"]) {
              await clearLimits();
              assert.equal((await signup(address, broken)).statusCode, 503);
            }
            assert.deepEqual(await counts(), before);
          } finally {
            await broken.close();
          }
        }
        assert.throws(
          () =>
            createApplicationServices(
              runtime,
              { ...config, operations: undefined },
              tasks,
              () => {},
            ),
          /durable email/,
        );
      },
    );
    await t.test(
      "verified signup can create own Event with scoped ORGANIZER; foreign Events denied and budgets/cap apply",
      async () => {
        const logged = await login(email),
          cookie = cookieOf(logged);
        await clearLimits();
        const fields = {
          name: "Synthetic B1 Event",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
          timezone: "Europe/Sofia",
        };
        const created = await post("/api/events", fields, app, cookie);
        assert.equal(created.statusCode, 201);
        const id = created.json().event.id,
          identity = await user(email);
        const membership = (
          await db.migrator.query(
            "SELECT access_role FROM public.event_member WHERE event_id=$1 AND user_id=$2",
            [id, identity.id],
          )
        ).rows;
        assert.deepEqual(membership, [{ access_role: "ORGANIZER" }]);
        await db.migrator.query(
          'UPDATE public."user" SET "emailVerified"=TRUE WHERE email=$1',
          ["unverified-b1@example.invalid"],
        );
        const otherLogin = await login("unverified-b1@example.invalid"),
          otherCookie = cookieOf(otherLogin);
        const foreign = await app.inject({
          url: `/api/events/${id}`,
          headers: { cookie: otherCookie },
        });
        assert.equal(foreign.statusCode, 404);
        const foreignEdit = await app.inject({
          method: "PATCH",
          url: `/api/events/${id}`,
          headers: { origin, cookie: otherCookie },
          payload: { ...fields, expectedVersion: 1 },
        });
        assert.ok([403, 404].includes(foreignEdit.statusCode));
        await clearLimits();
        for (let i = 0; i < 5; i++)
          assert.equal(
            (await post("/api/events", fields, app, cookie)).statusCode,
            201,
          );
        assert.equal(
          (await post("/api/events", fields, app, cookie)).statusCode,
          429,
        );
        const owned = (
          await db.migrator.query(
            "SELECT count(*)::int AS n FROM public.event WHERE owner_user_id=$1",
            [identity.id],
          )
        ).rows[0].n;
        await db.migrator.query(
          `INSERT INTO public.event(id,name,start_date,end_date,timezone,owner_user_id)
      SELECT gen_random_uuid(),'Synthetic cap','2026-11-01','2026-11-02','UTC',$1 FROM generate_series(1,$2::int)`,
          [identity.id, maxOwnedEvents - owned],
        );
        await clearLimits();
        const capped = await post("/api/events", fields, app, cookie);
        assert.equal(capped.statusCode, 409);
        assert.equal(capped.json().code, "EVENT_CAPACITY_REACHED");
      },
    );
    await t.test(
      "invitation registration, deep-link verification and explicit MEMBER acceptance retain their contract",
      async () => {
        const actor = await user(email),
          eventId = (
            await db.migrator.query(
              "SELECT id FROM public.event WHERE owner_user_id=$1 LIMIT 1",
              [actor.id],
            )
          ).rows[0].id;
        const invitation = await services.invitations!.create(
          { id: actor.id, name: actor.name, email },
          eventId,
          { email: "invited-b1@example.invalid" },
        );
        await clearLimits();
        const result = await post(
          `/api/invitations/${invitation.token}/register`,
          { name: "Synthetic invited", password },
        );
        assert.equal(result.statusCode, 200);
        assert.equal(
          (await user("invited-b1@example.invalid")).emailVerified,
          false,
        );
        const msg = await mail("invited-b1@example.invalid"),
          callback = new URL(new URL(msg.url).searchParams.get("callbackURL")!);
        assert.equal(
          callback.searchParams.get("returnTo"),
          `/invite/${invitation.token}`,
        );
        assert.equal(
          (await verify("invited-b1@example.invalid")).statusCode,
          302,
        );
        const logged = await login("invited-b1@example.invalid"),
          cookie = cookieOf(logged);
        const accepted = await post(
          `/api/invitations/${invitation.token}/accept`,
          {},
          app,
          cookie,
        );
        assert.equal(accepted.statusCode, 200);
        const invited = await user("invited-b1@example.invalid");
        assert.deepEqual(
          (
            await db.migrator.query(
              "SELECT access_role FROM public.event_member WHERE event_id=$1 AND user_id=$2",
              [eventId, invited.id],
            )
          ).rows,
          [{ access_role: "MEMBER" }],
        );
      },
    );
    await t.test(
      "real browser signup → native email verification → login → empty Dashboard → Create Event",
      { skip: !process.env.BUDOGRAPH_PLAYWRIGHT_MODULE },
      async () => {
        const { chromium } = await import(
          pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE!).href
        );
        const browser = await chromium.launch({
          headless: true,
          ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
            ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
            : {}),
        });
        await app.listen({ host: "127.0.0.1", port });
        try {
          await clearLimits();
          const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
          });
          await context.addInitScript(() =>
            localStorage.setItem(
              "budograph.preferences.v1",
              JSON.stringify({ version: 1, language: "en", theme: "dark" }),
            ),
          );
          const page = await context.newPage(),
            errors: string[] = [];
          page.on("pageerror", (e: Error) => errors.push(e.message));
          await page.goto(origin + "/signup");
          await page.locator("#signup-name").fill("Synthetic browser");
          await page
            .locator("#signup-email")
            .fill("browser-b1@example.invalid");
          await page.locator("#signup-password").fill(password);
          await page.locator("#signup-confirm").fill(password);
          await page.locator("button[type=submit]").click();
          await page.locator("#safety-title").waitFor();
          assert.equal(
            await page.locator("#safety-email").inputValue(),
            "browser-b1@example.invalid",
          );
          await page.goto((await mail("browser-b1@example.invalid")).url);
          await page.getByRole("heading", { name: "Email verified" }).waitFor();
          await page.getByRole("link", { name: "Back to sign in" }).click();
          await page.locator("#login-email").fill("browser-b1@example.invalid");
          await page.locator("#login-password").fill(password);
          await page.locator("button[type=submit]").click();
          await page.locator(".app-shell").waitFor();
          await page
            .getByRole("heading", { name: "No events yet" })
            .first()
            .waitFor();
          await page
            .getByRole("link", { name: "Create event", exact: true })
            .click();
          await page.waitForURL("**/events/new");
          await page
            .locator("#event-name")
            .fill("Synthetic first browser Event");
          await page.locator("#event-startDate").fill("2026-11-01");
          await page.locator("#event-endDate").fill("2026-11-02");
          await page.locator("#event-timezone").fill("Europe/Sofia");
          await page.locator(".event-form button[type=submit]").click();
          await page.waitForURL(/\/events\/[a-f0-9-]+\/dashboard$/);
          const created = (
            await db.migrator.query(
              "SELECT e.id,m.access_role FROM public.event e JOIN public.event_member m ON m.event_id=e.id WHERE e.owner_user_id=$1 AND m.user_id=e.owner_user_id",
              [(await user("browser-b1@example.invalid")).id],
            )
          ).rows;
          assert.equal(created.length, 1);
          assert.equal(created[0].access_role, "ORGANIZER");
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          assert.deepEqual(errors, []);
          await context.close();
        } finally {
          await browser.close();
        }
      },
    );
    assert.equal(
      providerCalls,
      0,
      "No provider delivery occurs in signup, verification or invitation registration",
    );
  },
);

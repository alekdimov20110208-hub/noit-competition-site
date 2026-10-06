import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createAuth } from "../src/auth/auth.ts";
import { createApp } from "../src/app.ts";
import { createInvitationService } from "../src/invitations/service.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";
import {
  createEmailTasks,
  type TransactionalEmail,
} from "../src/email/service.ts";
import { verificationCallback } from "../src/routes/auth.ts";
import { createEmailVerificationToken } from "better-auth/api";
test(
  "P4A real Better Auth 1.7.7 + PostgreSQL verification/reset/invitations with fake mail (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    const tasks = createEmailTasks(),
      messages: TransactionalEmail[] = [],
      logs: string[] = [];
    const origin = "http://127.0.0.1:3001",
      secret = randomBytes(32).toString("hex");
    let app: ReturnType<typeof createApp> | undefined;
    try {
      await client.query("BEGIN");
      // Dedicated test adapter pins Better Auth queries to the same rollback-only
      // transaction as the domain fixtures. No committed identities/sessions remain.
      const pinned = {
        query: async (sql: string, values?: unknown[]) => {
          if (/^begin/i.test(sql))
            return client.query("SAVEPOINT p4a_auth_command");
          if (/^commit/i.test(sql))
            return client.query("RELEASE SAVEPOINT p4a_auth_command");
          if (/^rollback/i.test(sql)) {
            await client.query("ROLLBACK TO SAVEPOINT p4a_auth_command");
            return client.query("RELEASE SAVEPOINT p4a_auth_command");
          }
          return client.query(sql, values);
        },
        release() {},
        on: client.on.bind(client),
        removeListener: client.removeListener.bind(client),
      };
      const authPool = {
        connect: async () => pinned,
        query: client.query.bind(client),
        end: async () => {},
      } as unknown as Pool;
      const authConfig = {
        nodeEnv: "test" as const,
        betterAuthSecret: secret,
        betterAuthUrl: origin,
        publicAppUrl: origin,
      };
      const email = {
        enabled: true,
        send: async (message: TransactionalEmail) => {
          messages.push(message);
        },
      };
      const auth = createAuth(authPool, authConfig, {
        email,
        emailTasks: tasks,
      });
      const registration = createAuth(authPool, authConfig, {
        invitationRegistration: true,
        email,
        emailTasks: tasks,
      });
      const f = await createPostgresFixture(client),
        boundary = {
          ...rollbackCommandPool(client),
          query: client.query.bind(client),
        };
      const service = createInvitationService(
        boundary,
        async (fields, locale, returnTo) => {
          await registration.api.signUpEmail({
            body: {
              ...fields,
              callbackURL: verificationCallback(
                origin,
                returnTo,
                locale ?? "bg",
              ),
            },
            headers: new Headers({ "x-budograph-locale": locale ?? "bg" }),
          });
        },
        true,
      );
      const organizer = {
        id: f.organizerUser,
        email: `${f.organizerUser}@example.invalid`,
        name: "Disposable",
      };
      const recipientEmail = `${f.prefix}-invited@example.invalid`,
        password = randomBytes(20).toString("hex"),
        nextPassword = randomBytes(20).toString("hex");
      const invitation = await service.create(organizer, f.eventId, {
        email: recipientEmail,
      });
      app = createApp({
        checkDatabase: async () => {},
        authentication: {
          auth,
          baseURL: origin,
          publicAppUrl: origin,
          emailEnabled: true,
        },
        logger: { stream: { write: (line) => logs.push(line) } },
      });
      const post = (
        path: string,
        payload: Record<string, string>,
        ip = "127.0.0.1",
      ) =>
        app!.inject({
          method: "POST",
          url: `/api/auth/${path}`,
          remoteAddress: ip,
          headers: { origin, "x-budograph-locale": "en" },
          payload,
        });
      const login = (emailAddress: string, pass: string, ip: string) =>
        post("sign-in/email", { email: emailAddress, password: pass }, ip);
      await t.test(
        "invite-only creation schedules verification, generic signup stays closed, unverified login/join denied",
        async () => {
          assert.equal(
            (
              await service.register(
                invitation.token,
                { name: "Disposable invited account", password },
                "en",
                true,
              )
            ).status,
            "verification_required",
          );
          await tasks.drain();
          assert.equal(messages.length, 1);
          assert.equal(messages[0]?.kind, "verification");
          assert.equal(messages[0]?.locale, "en");
          assert.equal(
            (
              await post("sign-up/email", {
                email: recipientEmail,
                name: "Forged",
                password,
              })
            ).statusCode,
            404,
          );
          const denied = await login(recipientEmail, password, "127.0.0.2");
          assert.equal(denied.statusCode, 403);
          assert.equal(denied.json().code, "EMAIL_NOT_VERIFIED");
          const identity = (
            await client.query(
              'SELECT id,email FROM public."user" WHERE email=$1',
              [recipientEmail],
            )
          ).rows[0];
          await assert.rejects(
            service.accept(
              { ...identity, name: "Disposable" },
              invitation.token,
              {},
            ),
            (e) => (e as { code: string }).code === "EMAIL_NOT_VERIFIED",
          );
        },
      );
      await t.test(
        "valid verification returns to invitation; invalid/expired tokens fail; matching verified identity joins as MEMBER",
        async () => {
          const message = messages[0]!;
          const verified = await app!.inject({
            url: new URL(message.url).pathname + new URL(message.url).search,
          });
          assert.equal(verified.statusCode, 302);
          assert.equal(
            new URL(String(verified.headers.location)).searchParams.get(
              "returnTo",
            ),
            `/invite/${invitation.token}`,
          );
          for (const token of [
            "invalid-token",
            await createEmailVerificationToken(
              secret,
              recipientEmail,
              undefined,
              -1,
            ),
          ]) {
            const result = await app!.inject({
              url: `/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=https://attacker.invalid`,
            });
            assert.equal(
              new URL(String(result.headers.location)).origin,
              origin,
            );
            assert.ok(
              new URL(String(result.headers.location)).searchParams.has(
                "error",
              ),
            );
          }
          const identity = (
            await client.query(
              'SELECT id,email,"emailVerified" FROM public."user" WHERE email=$1',
              [recipientEmail],
            )
          ).rows[0];
          assert.equal(identity.emailVerified, true);
          assert.equal(
            (
              await service.accept(
                { ...identity, name: "Disposable" },
                invitation.token,
                {},
              )
            ).status,
            "accepted",
          );
          assert.equal(
            (
              await client.query(
                "SELECT access_role FROM public.event_member WHERE user_id=$1 AND event_id=$2",
                [identity.id, f.eventId],
              )
            ).rows[0].access_role,
            "MEMBER",
          );
          await assert.rejects(
            service.accept(organizer, invitation.token, {}),
            (e) => (e as { code: string }).code === "WRONG_ACCOUNT",
          );
        },
      );
      let cookie = "";
      await t.test(
        "existing unverified users receive generic resend; existing sessions cannot bypass verification; rate limit independent of account existence",
        async () => {
          for (const address of [
            `${f.organizerUser}@example.invalid`,
            `${f.prefix}-missing@example.invalid`,
          ]) {
            const result = await post("send-verification-email", {
              email: address,
              returnTo: "https://attacker.invalid",
            });
            assert.equal(result.statusCode, 200);
            assert.deepEqual(result.json(), { status: true });
          }
          await tasks.drain();
          assert.equal(messages.length, 2);
          assert.equal(
            new URL(messages[1]!.url).searchParams.get("callbackURL"),
            origin + "/verify-email?status=verified",
          );
          const success = await login(recipientEmail, password, "127.0.0.3");
          assert.equal(success.statusCode, 200);
          const headers = success.headers["set-cookie"];
          cookie = (Array.isArray(headers) ? headers : [String(headers)])
            .map((v) => v.split(";")[0])
            .join("; ");
          assert.equal(
            (await app!.inject({ url: "/api/me", headers: { cookie } }))
              .statusCode,
            200,
          );
          await client.query(
            'UPDATE public."user" SET "emailVerified"=FALSE WHERE email=$1',
            [recipientEmail],
          );
          assert.equal(
            (await app!.inject({ url: "/api/me", headers: { cookie } }))
              .statusCode,
            401,
          );
          await client.query(
            'UPDATE public."user" SET "emailVerified"=TRUE WHERE email=$1',
            [recipientEmail],
          );
        },
      );
      await t.test(
        "reset requests are generic for known/unknown addresses, valid token changes password, replay/expired fail, all sessions revoked",
        async () => {
          for (const address of [
            recipientEmail,
            `${f.prefix}-unknown@example.invalid`,
          ]) {
            const response = await post("request-password-reset", {
              email: address,
              redirectTo: "https://attacker.invalid",
            });
            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.json(), { status: true });
          }
          await tasks.drain();
          const message = messages.find((m) => m.kind === "reset")!;
          assert.ok(message);
          const callback = await app!.inject({
            url: new URL(message.url).pathname + new URL(message.url).search,
          });
          assert.equal(
            new URL(String(callback.headers.location)).origin,
            origin,
          );
          const token = new URL(
            String(callback.headers.location),
          ).searchParams.get("token")!;
          assert.equal(
            (
              await post("reset-password", {
                token: "invalid-token",
                newPassword: nextPassword,
              })
            ).statusCode,
            400,
          );
          assert.equal(
            (await post("reset-password", { token, newPassword: nextPassword }))
              .statusCode,
            200,
          );
          assert.equal(
            (await post("reset-password", { token, newPassword: password }))
              .statusCode,
            400,
          );
          assert.equal(
            (await app!.inject({ url: "/api/me", headers: { cookie } }))
              .statusCode,
            401,
          );
          assert.equal(
            (await login(recipientEmail, password, "127.0.0.4")).statusCode,
            401,
          );
          assert.equal(
            (await login(recipientEmail, nextPassword, "127.0.0.5")).statusCode,
            200,
          );
          await post("request-password-reset", { email: recipientEmail });
          await tasks.drain();
          const expiredUrl = new URL(
              messages.filter((m) => m.kind === "reset").at(-1)!.url,
            ),
            expiredToken = expiredUrl.pathname.split("/").at(-1)!;
          await client.query(
            "UPDATE public.verification SET \"expiresAt\"=now()-interval '1 second' WHERE identifier=$1",
            [`reset-password:${expiredToken}`],
          );
          assert.equal(
            (
              await post("reset-password", {
                token: expiredToken,
                newPassword: password,
              })
            ).statusCode,
            400,
          );
          assert.equal(
            (
              await post(
                "request-password-reset",
                { email: recipientEmail },
                "127.0.0.6",
              )
            ).statusCode,
            200,
          );
          assert.equal(
            (
              await post(
                "request-password-reset",
                { email: recipientEmail },
                "127.0.0.7",
              )
            ).statusCode,
            429,
          );
          for (const message of messages)
            assert.equal(logs.join("").includes(message.url), false);
        },
      );
      await t.test(
        "resend rotates hash in same pending invitation, preserves expiry, role/scope/expiry/revocation and no extra activity",
        async () => {
          const created = await service.create(organizer, f.eventId, {
            email: `${f.prefix}-retry@example.invalid`,
          });
          const before = (
            await client.query(
              "SELECT count(*)::int AS count FROM public.activity_entry WHERE event_id=$1",
              [f.eventId],
            )
          ).rows[0].count;
          const resent = await service.resend(
            organizer,
            f.eventId,
            created.invitation.id,
          );
          assert.equal(resent.invitation.id, created.invitation.id);
          assert.equal(
            resent.invitation.expiresAt,
            created.invitation.expiresAt,
          );
          assert.equal(resent.token === created.token, false);
          await assert.rejects(service.lookup(created.token));
          assert.equal((await service.lookup(resent.token)).state, "pending");
          assert.equal(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.activity_entry WHERE event_id=$1",
                [f.eventId],
              )
            ).rows[0].count,
            before,
          );
          await assert.rejects(
            service.resend(
              { id: f.memberUser, name: "Member", email: "m@example.invalid" },
              f.eventId,
              created.invitation.id,
            ),
          );
          await assert.rejects(
            service.resend(organizer, f.foreignEventId, created.invitation.id),
          );
          await service.revoke(organizer, f.eventId, created.invitation.id, {});
          await assert.rejects(
            service.resend(organizer, f.eventId, created.invitation.id),
          );
          const expired = await service.create(organizer, f.eventId, {
            email: `${f.prefix}-expired@example.invalid`,
          });
          await client.query(
            "UPDATE public.event_invitation SET expires_at=now()-interval '1 second',created_at=now()-interval '1 day' WHERE id=$1",
            [expired.invitation.id],
          );
          await assert.rejects(
            service.resend(organizer, f.eventId, expired.invitation.id),
          );
        },
      );
    } finally {
      await tasks.drain();
      await app?.close();
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);

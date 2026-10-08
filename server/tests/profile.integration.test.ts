import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createDatabasePool } from "../src/db/pool.ts";
import { readDatabaseEnv } from "../src/config/env.ts";
import { createAuth } from "../src/auth/auth.ts";
import { createApp } from "../src/app.ts";
import { createPostgresFixture } from "./postgres-fixture.ts";

test(
  "Profile V1 real Better Auth 1.7.7 + PostgreSQL (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    const logs: string[] = [];
    let app: ReturnType<typeof createApp> | undefined;
    try {
      await client.query("BEGIN");
      const pinned = {
        query: async (sql: string, values?: unknown[]) => {
          if (/^begin/i.test(sql))
            return client.query("SAVEPOINT profile_auth_command");
          if (/^commit/i.test(sql))
            return client.query("RELEASE SAVEPOINT profile_auth_command");
          if (/^rollback/i.test(sql)) {
            await client.query("ROLLBACK TO SAVEPOINT profile_auth_command");
            return client.query("RELEASE SAVEPOINT profile_auth_command");
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
      const origin = "http://127.0.0.1:3001",
        secret = randomBytes(32).toString("hex");
      const options = {
        nodeEnv: "test" as const,
        betterAuthSecret: secret,
        betterAuthUrl: origin,
      };
      const auth = createAuth(authPool, options);
      const registration = createAuth(authPool, options, {
        invitationRegistration: true,
      });
      const f = await createPostgresFixture(client);
      const email = `${f.prefix}-profile@example.invalid`,
        password = randomBytes(20).toString("hex"),
        nextPassword = randomBytes(20).toString("hex");
      const created = await registration.api.signUpEmail({
        body: { name: "Disposable profile", email, password },
      });
      const userId = created.user.id;
      await client.query('UPDATE public."user" SET image=$2 WHERE id=$1', [
        userId,
        "synthetic-avatar-marker",
      ]);
      app = createApp({
        checkDatabase: async () => {},
        authentication: { auth, baseURL: origin },
        logger: { stream: { write: (line) => logs.push(line) } },
      });
      let peer = 5;
      const post = (
        path: string,
        payload: Record<string, unknown>,
        cookie?: string,
        headers: Record<string, string> = { origin },
      ) =>
        app!.inject({
          method: "POST",
          url: `/api/auth/${path}`,
          remoteAddress: `127.0.0.${peer++}`,
          headers: { ...headers, ...(cookie ? { cookie } : {}) },
          payload,
        });
      const cookieOf = (response: { headers: Record<string, unknown> }) => {
        const cookies = response.headers["set-cookie"];
        return (Array.isArray(cookies) ? cookies : [cookies])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.split(";")[0])
          .join("; ");
      };
      const login = async (pass: string) => {
        const response = await post("sign-in/email", { email, password: pass });
        assert.equal(response.statusCode, 200);
        return cookieOf(response);
      };
      const me = (cookie: string) =>
        app!.inject({ method: "GET", url: "/api/me", headers: { cookie } });
      const firstCookie = await login(password),
        secondCookie = await login(password);
      const preserved = async () => {
        const user = (
          await client.query(
            'SELECT email,"emailVerified",active,image FROM public."user" WHERE id=$1',
            [userId],
          )
        ).rows;
        const otherUsers = (
          await client.query(
            'SELECT * FROM public."user" WHERE id<>$1 ORDER BY id',
            [userId],
          )
        ).rows;
        const tables: Record<string, unknown> = {};
        for (const table of [
          "event",
          "event_member",
          "task",
          "activity_entry",
          "notification",
        ])
          tables[table] = (
            await client.query(
              `SELECT row_to_json(t) AS row FROM public.${table} t ORDER BY row_to_json(t)::text`,
            )
          ).rows;
        return { user, otherUsers, tables };
      };
      const before = await preserved();
      await t.test(
        "name updates canonical identity only and keeps other users/business/history/notifications intact",
        async () => {
          const response = await post(
            "update-user",
            { name: "  Иван Георги Петров  " },
            firstCookie,
          );
          assert.equal(response.statusCode, 200);
          assert.deepEqual(response.json(), { status: true });
          assert.equal(
            (await me(firstCookie)).json().user.name,
            "Иван Георги Петров",
          );
          assert.equal(
            (await me(secondCookie)).json().user.name,
            "Иван Георги Петров",
          );
          assert.deepEqual(await preserved(), before);
        },
      );
      await t.test(
        "anonymous, missing/foreign origin, extra fields, malformed names and inactive accounts fail",
        async () => {
          assert.equal(
            (await post("update-user", { name: "Denied" })).statusCode,
            401,
          );
          for (const field of [
            "id",
            "userId",
            "email",
            "emailVerified",
            "image",
            "active",
            "role",
          ])
            assert.equal(
              (
                await post(
                  "update-user",
                  { name: "Denied", [field]: "forged" },
                  firstCookie,
                )
              ).statusCode,
              400,
            );
          for (const name of [" ", "a".repeat(101), "x\u202ey", "<x>"])
            assert.equal(
              (await post("update-user", { name }, firstCookie)).statusCode,
              400,
            );
          for (const headers of [
            {},
            { origin: "http://evil.invalid" },
            { origin, "sec-fetch-site": "cross-site" },
          ] as Record<string, string>[])
            assert.equal(
              (
                await post(
                  "update-user",
                  { name: "Denied" },
                  firstCookie,
                  headers,
                )
              ).statusCode,
              403,
            );
          await client.query(
            'UPDATE public."user" SET active=FALSE WHERE id=$1',
            [userId],
          );
          assert.equal(
            (
              await post(
                "change-password",
                { currentPassword: password, newPassword: nextPassword },
                firstCookie,
              )
            ).statusCode,
            401,
          );
          await client.query(
            'UPDATE public."user" SET active=TRUE WHERE id=$1',
            [userId],
          );
          assert.equal(
            (await me(firstCookie)).json().user.name,
            "Иван Георги Петров",
          );
        },
      );
      await t.test(
        "wrong current password and policy/forgery failures preserve password and sessions",
        async () => {
          const hashBefore = (
            await client.query(
              'SELECT password FROM public.account WHERE "userId"=$1',
              [userId],
            )
          ).rows[0]?.password;
          const response = await post(
            "change-password",
            { currentPassword: "synthetic-wrong", newPassword: nextPassword },
            firstCookie,
          );
          assert.equal(response.statusCode, 400);
          assert.equal(response.json().code, "INVALID_PASSWORD");
          for (const fields of [
            { currentPassword: password, newPassword: "short" },
            {
              currentPassword: password,
              newPassword: nextPassword,
              userId: f.foreignUser,
            },
            {
              currentPassword: password,
              newPassword: nextPassword,
              revokeOtherSessions: false,
            },
          ])
            assert.equal(
              (await post("change-password", fields, firstCookie)).statusCode,
              400,
            );
          assert.equal(
            (
              await client.query(
                'SELECT password FROM public.account WHERE "userId"=$1',
                [userId],
              )
            ).rows[0]?.password,
            hashBefore,
          );
          assert.equal((await me(secondCookie)).statusCode, 200);
        },
      );
      let rotatedCookie = "";
      await t.test(
        "password change rotates this browser, revokes all prior sessions and returns no bearer/credential fields",
        async () => {
          const response = await post(
            "change-password",
            {
              currentPassword: password,
              newPassword: nextPassword,
              revokeOtherSessions: true,
            },
            firstCookie,
          );
          assert.equal(response.statusCode, 200);
          assert.deepEqual(response.json(), { status: true });
          rotatedCookie = cookieOf(response);
          assert.ok(rotatedCookie);
          assert.notEqual(rotatedCookie, firstCookie);
          assert.equal((await me(firstCookie)).statusCode, 401);
          assert.equal((await me(secondCookie)).statusCode, 401);
          assert.equal((await me(rotatedCookie)).json().user.id, userId);
          assert.equal(
            (await post("sign-in/email", { email, password })).statusCode,
            401,
          );
          await login(nextPassword);
          assert.deepEqual(await preserved(), before);
        },
      );
      await t.test(
        "expired sessions cannot change profiles; public signup/email change remain closed; safe logs",
        async () => {
          await client.query(
            'UPDATE public.session SET "expiresAt"=CURRENT_TIMESTAMP-INTERVAL \'1 second\' WHERE "userId"=$1',
            [userId],
          );
          assert.equal(
            (await post("update-user", { name: "Denied" }, rotatedCookie))
              .statusCode,
            401,
          );
          assert.equal(
            (
              await post("sign-up/email", {
                name: "Denied",
                email: `closed-${email}`,
                password,
              })
            ).statusCode,
            404,
          );
          const current = await login(nextPassword);
          assert.equal(
            (
              await post(
                "change-email",
                { newEmail: `changed-${email}` },
                current,
              )
            ).statusCode,
            400,
          );
          assert.deepEqual(await preserved(), before);
          for (const value of [
            password,
            nextPassword,
            secret,
            email,
            firstCookie,
            secondCookie,
            rotatedCookie,
          ])
            assert.equal(logs.join("").includes(value), false);
        },
      );
    } finally {
      await app?.close();
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  },
);

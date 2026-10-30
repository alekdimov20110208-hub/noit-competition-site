import assert from "node:assert/strict";
import test from "node:test";
import { fork, type ForkOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { runtimeDisposableDatabase } from "./helpers/runtime-disposable.ts";
import { syntheticOperationalEnvironment } from "./helpers/operational-secrets.ts";

test(
  "compiled production process starts on R2: verified TLS/identity, read-only schema check, same-origin SPA/API/auth and graceful worker shutdown",
  { skip: !process.env.V1C_OWNER_FILE, timeout: 45000 },
  async () => {
    const db = await runtimeDisposableDatabase();
    const before = (
      await db.migrator.query(
        "SELECT * FROM public.schema_migrations ORDER BY version",
      )
    ).rows;
    const root = await mkdtemp(join(tmpdir(), "budograph-d2-process-"));
    const preload = join(root, "offline.mjs");
    await writeFile(
      preload,
      `globalThis.fetch=async()=>{throw Error("All provider HTTP blocked in disposable rehearsal");};
process.on("message",m=>{if(m==="STOP"){process.emit("SIGTERM");process.disconnect();}});`,
    );
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((r) => socket.close(() => r()));
    const environment: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env))
      if (
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(
          key,
        )
      )
        environment[key] = value;
    Object.assign(environment, syntheticOperationalEnvironment(), {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATABASE_URL: process.env.V1C_RUNTIME_URL,
      DATABASE_TLS_MODE: "verify-full",
      DATABASE_TLS_CA_FILE: process.env.V1C_CA_FILE,
      EXPECTED_DATABASE_ID: process.env.EXPECTED_DATABASE_ID,
      EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BETTER_AUTH_URL: "https://rehearsal.example.invalid",
      PUBLIC_APP_URL: "https://rehearsal.example.invalid",
      EMAIL_MODE: "resend",
      EMAIL_FROM: "no-reply@example.invalid",
      RESEND_API_KEY: "re_" + randomBytes(24).toString("hex"),
      SERVE_FRONTEND: "true",
      WEB_CONCURRENCY: "1",
      REMINDER_WORKER_ENABLED: "true",
    });
    const options: ForkOptions & { windowsHide: boolean } = {
      env: environment,
      execArgv: ["--import", pathToFileURL(preload).href],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    };
    const child = fork("server/dist/src/production.js", [], options);
    let output = "";
    child.stdout!.on("data", (b) => {
      output += b;
    });
    child.stderr!.on("data", (b) => {
      output += b;
    });
    const exited = new Promise((resolve) => child.once("exit", resolve));
    const origin = `http://127.0.0.1:${port}`;
    try {
      let ready = false;
      for (let n = 0; n < 100; n++) {
        if (child.exitCode !== null) break;
        try {
          ready = (await fetch(origin + "/api/health/ready")).status === 200;
        } catch {
          /* Only owned loopback startup polling. */
        }
        if (ready) break;
        await delay(100);
      }
      assert.equal(
        ready,
        true,
        "Compiled production failed to become ready; diagnostics kept secret-safe.",
      );
      assert.equal((await fetch(origin + "/api/health/live")).status, 200);
      for (const path of [
        "/",
        "/login",
        "/invite/" + "a".repeat(43),
        "/events/00000000-0000-4000-8000-000000000001/templates",
      ]) {
        const response = await fetch(origin + path, {
          headers: { accept: "text/html" },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        const html = await response.text();
        assert.ok(html.includes('id="root"'));
        const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
        assert.ok(asset);
        const script = await fetch(origin + asset);
        assert.equal(script.status, 200);
        const bundle = await script.text();
        for (const key of [
          "DATABASE_URL",
          "BETTER_AUTH_SECRET",
          "RESEND_API_KEY",
          "RATE_LIMIT_HMAC_KEY",
          "EMAIL_OUTBOX_KEYS",
        ])
          assert.ok(!bundle.includes(environment[key]!));
      }
      for (const path of ["/api", "/api/unknown", "/.env", "/server/.env"])
        assert.equal(
          (await fetch(origin + path, { headers: { accept: "text/html" } }))
            .status,
          404,
        );
      assert.equal((await fetch(origin + "/api/me")).status, 401);
      assert.equal((await fetch(origin + "/api/auth/get-session")).status, 200);
      assert.equal(
        (
          await fetch(origin + "/api/auth/sign-up/email", {
            method: "POST",
            headers: {
              origin: environment.PUBLIC_APP_URL!,
              "content-type": "application/json",
            },
            body: "{}",
          })
        ).status,
        404,
      );
      await db.migrator.query(
        "UPDATE budograph_private.environment_identity SET project_ref='wrong-target'",
      );
      try {
        assert.equal((await fetch(origin + "/api/health/ready")).status, 503);
        assert.equal((await fetch(origin + "/api/health/live")).status, 200);
      } finally {
        await db.migrator.query(
          "UPDATE budograph_private.environment_identity SET project_ref=$1",
          [process.env.EXPECTED_SUPABASE_PROJECT_REF],
        );
      }
      assert.equal((await fetch(origin + "/api/health/ready")).status, 200);
      assert.deepEqual(
        (
          await db.migrator.query(
            "SELECT * FROM public.schema_migrations ORDER BY version",
          )
        ).rows,
        before,
      );
      assert.equal(
        (await db.migrator.query('SELECT count(*)::int n FROM public."user"'))
          .rows[0].n,
        0,
        "Startup never provisions accounts",
      );
      child.send("STOP");
      assert.equal(
        await Promise.race([
          exited,
          delay(15000, undefined, { ref: false }).then(() => "timeout"),
        ]),
        0,
      );
      assert.doesNotMatch(output, /worker pass failed|startup failed/i);
      for (const key of [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "RESEND_API_KEY",
        "RATE_LIMIT_HMAC_KEY",
        "EMAIL_OUTBOX_KEYS",
      ])
        assert.ok(!output.includes(environment[key]!));
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await exited;
      }
      await db.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);

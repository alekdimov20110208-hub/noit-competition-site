import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { readOperationalSecrets } from "../src/operations/secrets.ts";
import {
  decryptEmail,
  encryptEmail,
  privateIdentifier,
  verificationMetadata,
} from "../src/operations/crypto.ts";
import {
  syntheticOperationalSecrets,
  syntheticOperationalEnvironment,
} from "./helpers/operational-secrets.ts";
import pg from "pg";
import { createAuth } from "../src/auth/auth.ts";

test("operational keys are explicit, independent, canonical and never included in validation errors", () => {
  assert.equal(readOperationalSecrets({}, false), undefined);
  const environment = syntheticOperationalEnvironment();
  assert.ok(Object.isFrozen(readOperationalSecrets(environment, true)));
  for (const changed of [
    { RATE_LIMIT_HMAC_KEY: undefined },
    { EMAIL_OUTBOX_KEY_ID: undefined },
    { EMAIL_OUTBOX_KEYS: "private rejected data" },
    {
      EMAIL_OUTBOX_KEYS: JSON.stringify({
        "local-test": environment.RATE_LIMIT_HMAC_KEY,
      }),
    },
    { EMAIL_OUTBOX_KEYS: "[]" },
    { RATE_LIMIT_HMAC_KEY: randomBytes(31).toString("base64") },
    { RATE_LIMIT_HMAC_KEY: Buffer.alloc(32).toString("base64") },
  ]) {
    assert.throws(
      () => readOperationalSecrets({ ...environment, ...changed }, true),
      (error) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(environment.RATE_LIMIT_HMAC_KEY));
        assert.ok(!error.message.includes("private rejected data"));
        return true;
      },
    );
  }
});
test("production auth cannot silently fall back to process memory or non-durable email", async () => {
  const pool = new pg.Pool({ host: "127.0.0.1", port: 1 });
  try {
    assert.throws(
      () =>
        createAuth(pool, {
          nodeEnv: "production",
          betterAuthSecret: randomBytes(32).toString("hex"),
          betterAuthUrl: "https://www.budograph.com",
        }),
      /requires durable email/,
    );
  } finally {
    await pool.end();
  }
});
test("AEAD authenticates every metadata dimension and uses fresh nonces; identifiers are domain separated", () => {
  const secrets = syntheticOperationalSecrets(),
    meta = {
      id: "a".repeat(64),
      kind: "verification",
      subject_key: "b".repeat(64),
      reference_hash: "c".repeat(64),
      expires_at: new Date(Date.now() + 60000),
      key_id: secrets.encryptionKeyId,
    };
  const value = { syntheticToken: randomUUID() },
    first = encryptEmail(secrets, meta, value),
    second = encryptEmail(secrets, meta, value);
  assert.notEqual(first, second);
  assert.deepEqual(decryptEmail(secrets, meta, first), value);
  for (const changed of [
    { id: "f".repeat(64) },
    { kind: "reset" },
    { subject_key: "f".repeat(64) },
    { reference_hash: "f".repeat(64) },
    { expires_at: new Date(meta.expires_at.getTime() + 1) },
    { key_id: "missing" },
  ])
    assert.throws(() => decryptEmail(secrets, { ...meta, ...changed }, first));
  const identity = "synthetic@example.invalid";
  assert.notEqual(
    privateIdentifier(secrets.hmacKey, "email", identity),
    privateIdentifier(secrets.hmacKey, "ip", identity),
  );
  assert.equal(
    verificationMetadata("invalid.token.signature", "synthetic"),
    undefined,
  );
});

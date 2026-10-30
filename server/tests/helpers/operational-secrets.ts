import { randomBytes } from "node:crypto";
import type { OperationalSecrets } from "../../src/operations/secrets.ts";
export function syntheticOperationalSecrets(): OperationalSecrets {
  return {
    hmacKey: randomBytes(32).toString("base64"),
    encryptionKeyId: "local-test",
    encryptionKeys: { "local-test": randomBytes(32).toString("base64") },
  };
}
export function syntheticOperationalEnvironment() {
  const keys = syntheticOperationalSecrets();
  return {
    RATE_LIMIT_HMAC_KEY: keys.hmacKey,
    EMAIL_OUTBOX_KEY_ID: keys.encryptionKeyId,
    EMAIL_OUTBOX_KEYS: JSON.stringify(keys.encryptionKeys),
  };
}

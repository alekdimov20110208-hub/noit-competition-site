import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { OperationalSecrets } from "./secrets.ts";

export function privateIdentifier(
  secret: string,
  scope: string,
  value: string,
) {
  return createHmac("sha256", Buffer.from(secret, "base64"))
    .update(JSON.stringify(["budograph-v1c4", scope, value]))
    .digest("hex");
}
export interface EmailMetadata {
  id: string;
  kind: string;
  subject_key: string;
  reference_hash: string;
  expires_at: Date;
  key_id: string;
}
function aad(meta: EmailMetadata) {
  return Buffer.from(
    JSON.stringify([
      "budograph-email-v1",
      meta.id,
      meta.kind,
      meta.subject_key,
      meta.reference_hash,
      meta.expires_at.toISOString(),
      meta.key_id,
    ]),
  );
}
export function encryptEmail(
  secrets: OperationalSecrets,
  meta: EmailMetadata,
  value: unknown,
) {
  const key = secrets.encryptionKeys[meta.key_id];
  if (!key) throw new Error("Email encryption key unavailable.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  cipher.setAAD(aad(meta));
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > 16000) throw new Error("Email payload too large.");
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptEmail(
  secrets: OperationalSecrets,
  meta: EmailMetadata,
  encoded: string,
): unknown {
  try {
    const key = secrets.encryptionKeys[meta.key_id];
    if (
      !key ||
      encoded.length > 24576 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    )
      throw Error();
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length < 29 || bytes.toString("base64") !== encoded)
      throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "base64"),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(aad(meta));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new Error("Encrypted email unavailable.");
  }
}
// Signature-verified gate/expiry metadata only. Better Auth still validates and
// consumes its own token; this helper never authorizes an authentication action.
export function verificationMetadata(token: string, secret: string) {
  try {
    if (token.length > 4096) return;
    const [head, body, signed, extra] = token.split(".");
    if (!head || !body || !signed || extra) return;
    const header = JSON.parse(Buffer.from(head, "base64url").toString());
    if (header.alg !== "HS256") return;
    const expected = createHmac("sha256", secret)
      .update(`${head}.${body}`)
      .digest();
    const signature = Buffer.from(signed, "base64url");
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(signature, expected)
    )
      return;
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      typeof value.email !== "string" ||
      value.email.length > 254 ||
      !Number.isSafeInteger(value.exp) ||
      value.exp <= 0 ||
      value.updateTo ||
      value.requestType
    )
      return;
    return {
      email: value.email.trim().toLowerCase(),
      expiresAt: new Date(value.exp * 1000),
    };
  } catch {
    return;
  }
}

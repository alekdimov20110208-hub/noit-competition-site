export interface OperationalSecrets {
  readonly hmacKey: string;
  readonly encryptionKeyId: string;
  readonly encryptionKeys: Readonly<Record<string, string>>;
}

function key(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9+/]{43}=$/.test(value) &&
    Buffer.from(value, "base64").length === 32 &&
    Buffer.from(value, "base64").toString("base64") === value &&
    new Set(Buffer.from(value, "base64")).size >= 12
  );
}

export function readOperationalSecrets(
  environment: Readonly<Record<string, string | undefined>>,
  required: boolean,
): OperationalSecrets | undefined {
  const hmacKey = environment.RATE_LIMIT_HMAC_KEY;
  const encryptionKeyId = environment.EMAIL_OUTBOX_KEY_ID;
  const encoded = environment.EMAIL_OUTBOX_KEYS;
  if (
    !required &&
    hmacKey === undefined &&
    encryptionKeyId === undefined &&
    encoded === undefined
  )
    return;
  if (!key(hmacKey))
    throw new Error(
      "RATE_LIMIT_HMAC_KEY must be an independent 32-byte base64 secret.",
    );
  if (!encryptionKeyId || !/^[a-z0-9_-]{1,32}$/.test(encryptionKeyId))
    throw new Error("EMAIL_OUTBOX_KEY_ID must name the active encryption key.");
  let entries: [string, unknown][];
  try {
    const parsed: unknown = JSON.parse(encoded ?? "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw Error();
    entries = Object.entries(parsed);
  } catch {
    throw new Error(
      "EMAIL_OUTBOX_KEYS must contain a reviewed encryption key ring.",
    );
  }
  if (
    entries.length < 1 ||
    entries.length > 3 ||
    !entries.some(([id]) => id === encryptionKeyId) ||
    entries.some(
      ([id, value]) =>
        !/^[a-z0-9_-]{1,32}$/.test(id) ||
        !key(value) ||
        value === hmacKey ||
        value === environment.BETTER_AUTH_SECRET,
    )
  )
    throw new Error(
      "EMAIL_OUTBOX_KEYS requires one to three independent 32-byte base64 keys.",
    );
  if (hmacKey === environment.BETTER_AUTH_SECRET)
    throw new Error("RATE_LIMIT_HMAC_KEY must be independent.");
  return Object.freeze({
    hmacKey,
    encryptionKeyId,
    encryptionKeys: Object.freeze(
      Object.fromEntries(entries) as Record<string, string>,
    ),
  });
}

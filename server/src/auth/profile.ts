// V1 permits only a display name. Better Auth owns identity and credentials.
export function profileName(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).length !== 1 || typeof fields.name !== "string")
    return null;
  const name = fields.name.trim();
  if (
    !name ||
    name.length > 100 ||
    /[\p{Cc}\p{Cf}\p{Cs}<>]/u.test(name) ||
    !/[\p{L}\p{N}]/u.test(name)
  )
    return null;
  return name;
}

export function profilePassword(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  if (
    Object.keys(fields).some(
      (key) =>
        !["currentPassword", "newPassword", "revokeOtherSessions"].includes(
          key,
        ),
    ) ||
    typeof fields.currentPassword !== "string" ||
    fields.currentPassword.length < 1 ||
    fields.currentPassword.length > 128 ||
    typeof fields.newPassword !== "string" ||
    fields.newPassword.length < 8 ||
    fields.newPassword.length > 128 ||
    (fields.revokeOtherSessions !== undefined &&
      fields.revokeOtherSessions !== true)
  )
    return null;
  return {
    currentPassword: fields.currentPassword,
    newPassword: fields.newPassword,
    revokeOtherSessions: true,
  };
}

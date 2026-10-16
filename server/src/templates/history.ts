// Project only bounded, known provenance; never forward arbitrary audit payloads.
export function templateHistoryOrigin(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const row = value as Record<string, unknown>;
  if (
    row.templateId !== "international-aikido-seminar" ||
    row.templateVersion !== 1 ||
    typeof row.operationId !== "string" ||
    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.operationId)
  )
    return undefined;
  return {
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    operationId: row.operationId,
  };
}

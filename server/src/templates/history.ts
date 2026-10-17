import { systemBlueprint } from "./catalog.ts";

// Project only bounded, known provenance; never forward arbitrary audit payloads.
export function templateHistoryOrigin(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const row = value as Record<string, unknown>;
  const system =
    typeof row.templateId === "string"
      ? systemBlueprint(row.templateId)
      : undefined;
  if (
    (!system &&
      (typeof row.templateId !== "string" ||
        !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.templateId))) ||
    row.templateVersion !== 1 ||
    typeof row.operationId !== "string" ||
    !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.operationId)
  )
    return undefined;
  return {
    // Event members see provenance, never a private library identifier/name.
    templateId: system ? row.templateId : "private-template",
    templateVersion: row.templateVersion,
    operationId: row.operationId,
  };
}

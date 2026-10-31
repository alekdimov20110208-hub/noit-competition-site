import { EnvironmentError } from "../config/env.ts";

// Non-secret UUID generated once with Node crypto.randomUUID() on 2026-10-30.
// Proposed for owner approval with the D2.3 activation package; never auto-seeded.
export const STAGING = Object.freeze({
  projectRef: "jlladwdqdillryyfvndo",
  databaseId: "bce50118-4829-42e0-86cd-1cb41de8b1ba",
  directHost: "db.jlladwdqdillryyfvndo.supabase.co",
  productionRef: "bdcjascqqvzmmlvabhgv",
});

export function assertStagingIdentity(projectRef: string, databaseId: string) {
  if (projectRef !== STAGING.projectRef || databaseId !== STAGING.databaseId)
    throw new EnvironmentError(
      "Staging requires the exact D2.3 project and UUID pins.",
    );
}

export function stagingOwnerTarget(value: string, verifiedHost: string) {
  try {
    const url = new URL(value);
    const direct = verifiedHost === STAGING.directHost;
    const session = /^aws-\d+-eu-central-1\.pooler\.supabase\.com$/.test(
      verifiedHost,
    );
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      (!direct && !session) ||
      url.hostname !== verifiedHost ||
      decodeURIComponent(url.username) !==
        (direct ? "postgres" : `postgres.${STAGING.projectRef}`) ||
      !url.password ||
      (url.port && url.port !== "5432") ||
      url.pathname !== "/postgres" ||
      url.search ||
      url.hash ||
      /\s/.test(value) ||
      decodeURIComponent(value).toLowerCase().includes(STAGING.productionRef)
    )
      throw new Error();
    return url;
  } catch {
    throw new EnvironmentError(
      "Staging owner target refused before network I/O.",
    );
  }
}

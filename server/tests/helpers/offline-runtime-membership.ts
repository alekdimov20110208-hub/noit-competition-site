// In-memory PG17 membership semantics, not a SQL engine or hosted evidence.
import { offlineStagingClient } from "./offline-staging-client.ts";

export function offlineRuntimeMembership(
  options: {
    omitRuntimeSet?: boolean;
    cleanupFailure?: boolean;
  } = {},
) {
  const fixture = offlineStagingClient();
  const read = fixture.db.query.bind(fixture.db);
  const afterBootstrap = new Error("Synthetic boundary after bootstrap.");
  const state = {
    roles: new Set<string>(),
    runtimeMembership: { admin: true, inherit: false, set: false },
    runtimeDefinition: "",
    commits: 0,
    rollbacks: 0,
    roleChecks: 0,
    bootstrapCalls: 0,
  };
  const denied = () =>
    Object.assign(new Error("SYNTHETIC_PERMISSION_ONLY"), {
      code: "42501",
      detail: "SYNTHETIC_SECRET_NOT_FOR_REPORT",
    });
  fixture.db.query = (async (sql: string) => {
    fixture.calls.push(sql);
    if (sql.includes("CREATE ROLE budograph_runtime")) {
      state.bootstrapCalls++;
      // A non-superuser CREATEROLE creator automatically has ADMIN, not SET.
      // The explicit membership must enable SET before the engine's role check.
      for (const statement of sql.split("\n")) {
        const create = /^CREATE ROLE (budograph_\w+) (.*);$/.exec(statement);
        if (create) {
          state.roles.add(create[1]!);
          if (create[1] === "budograph_runtime") {
            state.runtimeDefinition = create[2]!;
            state.runtimeMembership = {
              admin: true,
              inherit: false,
              set: false,
            };
          }
        }
        const grant = /^GRANT budograph_runtime TO postgres WITH (.*);$/.exec(
          statement,
        );
        if (grant && !options.omitRuntimeSet) {
          if (!state.roles.has("budograph_runtime")) throw denied();
          for (const key of ["admin", "inherit", "set"] as const) {
            const option = new RegExp(
              `\\b${key.toUpperCase()} (TRUE|FALSE)\\b`,
            ).exec(grant[1]!);
            if (option) state.runtimeMembership[key] = option[1] === "TRUE";
          }
        }
      }
      return { rows: [] };
    }
    if (sql === "SET LOCAL ROLE budograph_runtime") {
      state.roleChecks++;
      if (!state.roles.has("budograph_runtime") || !state.runtimeMembership.set)
        throw denied();
      return { rows: [] };
    }
    if (sql.includes("SELECT has_database_privilege(current_user"))
      return { rows: [{ unsafe: false }] };
    if (sql === "COMMIT") {
      state.commits++;
      return { command: "COMMIT", rows: [] };
    }
    if (sql === "ROLLBACK") {
      state.rollbacks++;
      state.roles.clear();
      return { command: "ROLLBACK", rows: [] };
    }
    if (sql === "SET ROLE budograph_migrator") throw afterBootstrap;
    if (sql === "RESET ROLE" && options.cleanupFailure) throw denied();
    // Only fixed catalog replies in memory; no network API or live SQL driver.
    return read(sql);
  }) as typeof fixture.db.query;
  return { ...fixture, state, afterBootstrap };
}

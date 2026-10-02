import { EnvironmentError } from "../config/env.ts";
import type { Auth } from "./auth.ts";
import type { Pool } from "pg";

export interface DevelopmentAccount {
  readonly label: "organizer" | "member";
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

// Provisioning inputs are separate from normal startup configuration.
export function readDevelopmentAccounts(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DevelopmentAccount[] {
  const accounts = (["organizer", "member"] as const).map((label) => {
    const prefix = `BUDOGRAPH_${label.toUpperCase()}`;
    const email = environment[`${prefix}_EMAIL`]?.trim().toLowerCase();
    const password = environment[`${prefix}_PASSWORD`];
    const name = environment[`${prefix}_NAME`]?.trim();
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !password ||
      password.length < 16 ||
      password.length > 128 ||
      !name ||
      name.length > 100 ||
      /REPLACE_/i.test(`${email} ${password} ${name}`)
    ) {
      throw new EnvironmentError(
        `${prefix} requires a valid email, name, and a password of 16–128 characters; replace placeholders.`,
      );
    }
    return Object.freeze({ label, email, password, name });
  });
  if (accounts[0]?.email === accounts[1]?.email) {
    throw new EnvironmentError("Development account emails must be different.");
  }
  return accounts;
}

// No HTTP route imports this module. Better Auth owns account creation/hashing.
export async function provisionDevelopmentAccounts(
  pool: Pool,
  auth: Auth,
  accounts: readonly DevelopmentAccount[],
): Promise<
  { label: DevelopmentAccount["label"]; result: "created" | "already-exists" }[]
> {
  const results: {
    label: DevelopmentAccount["label"];
    result: "created" | "already-exists";
  }[] = [];
  for (const account of accounts) {
    const existing = await pool.query(
      'SELECT id FROM public."user" WHERE email = $1',
      [account.email],
    );
    if (existing.rowCount) {
      results.push({ label: account.label, result: "already-exists" });
      continue;
    }
    await auth.api.signUpEmail({
      body: {
        email: account.email,
        password: account.password,
        name: account.name,
      },
    });
    const created = await pool.query(
      'SELECT id FROM public."user" WHERE email = $1',
      [account.email],
    );
    if (created.rowCount !== 1)
      throw new Error("Development account was not created.");
    results.push({ label: account.label, result: "created" });
  }
  return results;
}

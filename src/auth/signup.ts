import { validDisplayName } from "./profile.ts";

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  returnTo: string;
}
export type SignupError =
  | "invalidName"
  | "invalidEmail"
  | "invalidPassword"
  | "mismatch"
  | "limited"
  | "unavailable"
  | "closed"
  | "failed";

export function validateSignup(fields: SignupInput): SignupError | null {
  if (!validDisplayName(fields.name)) return "invalidName";
  const email = fields.email.trim();
  const [local, domain] = email.split("@");
  if (
    email.length > 254 ||
    !local ||
    local.length > 64 ||
    domain?.split(".").some((label) => label.length > 63) ||
    !/^(?!\.)(?!.*\.\.)[a-z0-9_'+.-]*[a-z0-9_+-]@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(
      email,
    )
  )
    return "invalidEmail";
  if (fields.password.length < 8 || fields.password.length > 128)
    return "invalidPassword";
  if (fields.password !== fields.confirmPassword) return "mismatch";
  return null;
}

export async function signupAvailability(
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const result = await fetch("/api/registration", {
      signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    return result.ok && (await result.json()).enabled === true;
  } catch {
    return false;
  }
}

export async function signupCommand(
  fields: SignupInput,
  locale: string,
): Promise<SignupError | null> {
  try {
    const result = await fetch("/api/registration", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        "x-budograph-locale": locale,
      },
      body: JSON.stringify(fields),
    });
    if (result.status === 429) return "limited";
    if (result.status === 404) return "closed";
    if (!result.ok) return result.status >= 500 ? "unavailable" : "failed";
    return (await result.json()).status === true ? null : "failed";
  } catch {
    return "unavailable";
  }
}

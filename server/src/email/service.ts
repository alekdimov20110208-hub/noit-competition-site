import type { ServerConfig } from "../config/env.ts";
import type { TransactionDatabase } from "../db/transaction.ts";
export type EmailLocale = "bg" | "en";
export type EmailKind = "invitation" | "verification" | "reset";
export interface TransactionalEmail {
  kind: EmailKind;
  to: string;
  url: string;
  locale: EmailLocale;
  eventName?: string;
  expiresAt?: string;
}
export interface TransactionalEmailService {
  enabled: boolean;
  send(message: TransactionalEmail): Promise<void>;
  enqueue?(
    database: TransactionDatabase,
    message: TransactionalEmail,
  ): Promise<string>;
  reserve?(database: TransactionDatabase): Promise<void>;
  dispatch?(
    target?: string,
    batch?: number,
  ): Promise<{ accepted: number; deferred: number }>;
}
export class EmailDeliveryError extends Error {
  constructor() {
    super("Transactional email delivery unavailable.");
  }
}
export function emailLocale(value: unknown): EmailLocale {
  return value === "en" ? "en" : "bg";
}
export function trustedEmailUrl(origin: string, path: string) {
  const url = new URL(path, origin);
  if (
    url.origin !== new URL(origin).origin ||
    url.username ||
    url.password ||
    !/^\/(invite\/[A-Za-z0-9_-]{43}|api\/auth\/verify-email|api\/auth\/reset-password\/[A-Za-z0-9_-]+)$/.test(
      url.pathname,
    )
  )
    throw new EmailDeliveryError();
  const callback = url.searchParams.get("callbackURL");
  if (callback) {
    const target = new URL(callback, origin);
    if (
      target.origin !== new URL(origin).origin ||
      !/^\/(verify-email|reset-password)$/.test(target.pathname) ||
      target.hash
    )
      throw new EmailDeliveryError();
  }
  return url.href;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderEmail(message: TransactionalEmail) {
  const bg = message.locale === "bg";
  const subject =
    message.kind === "invitation"
      ? bg
        ? "Покана за събитие в BudoGraph"
        : "Your BudoGraph Event invitation"
      : message.kind === "verification"
        ? bg
          ? "Потвърдете имейла си в BudoGraph"
          : "Verify your BudoGraph email"
        : bg
          ? "Възстановяване на парола в BudoGraph"
          : "Reset your BudoGraph password";
  const action =
    message.kind === "invitation"
      ? bg
        ? "Отворете поканата"
        : "Open invitation"
      : message.kind === "verification"
        ? bg
          ? "Потвърдете имейла"
          : "Verify email"
        : bg
          ? "Задайте нова парола"
          : "Reset password";
  const description =
    message.kind === "invitation"
      ? bg
        ? `Поканени сте в „${message.eventName ?? ""}“. Ще се присъедините като Участник след вход и изрично приемане.`
        : `You are invited to “${message.eventName ?? ""}”. You will join as Member after signing in and explicitly accepting.`
      : message.kind === "verification"
        ? bg
          ? "Потвърдете, че този имейл адрес е ваш. След това влезте и приемете поканата си."
          : "Confirm ownership of this email address. Then sign in and accept your invitation."
        : bg
          ? "Използвайте защитената връзка, за да зададете нова парола. След успешна промяна всички сесии ще бъдат прекратени."
          : "Use the secure link to set a new password. A successful reset ends all sessions.";
  const expiry = message.expiresAt
    ? bg
      ? `Валидна до ${message.expiresAt} (UTC).`
      : `Expires at ${message.expiresAt} (UTC).`
    : bg
      ? "Връзката е валидна 1 час."
      : "The link expires in 1 hour.";
  const ignore = bg
    ? "Ако не очаквате това съобщение, игнорирайте го."
    : "If you did not expect this message, ignore it.";
  return {
    subject,
    text: `BudoGraph\n\n${description}\n\n${action}: ${message.url}\n\n${expiry}\n${ignore}`,
    html: `<!doctype html><html lang="${message.locale}"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#172027"><h1 style="font-size:24px">BudoGraph</h1><p>${escape(description)}</p><p><a href="${escape(message.url)}">${action}</a></p><p>${escape(expiry)}</p><p>${ignore}</p></body></html>`,
  };
}
export function createTransactionalEmailService(
  config: Pick<
    ServerConfig,
    "emailMode" | "emailFrom" | "resendApiKey" | "publicAppUrl"
  >,
  safeLog: (kind: EmailKind) => void,
  request: typeof fetch = fetch,
): TransactionalEmailService {
  return {
    enabled: config.emailMode === "resend",
    async send(message) {
      if (config.emailMode !== "resend") throw new EmailDeliveryError();
      try {
        const url = trustedEmailUrl(config.publicAppUrl, message.url);
        const content = renderEmail({ ...message, url });
        const response = await request("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
          headers: {
            authorization: `Bearer ${config.resendApiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: config.emailFrom,
            to: [message.to],
            ...content,
          }),
        });
        // Provider bodies are never logged or forwarded. Acceptance is not inbox delivery.
        if (!response.ok) throw new EmailDeliveryError();
        const result = (await response.json()) as { id?: unknown };
        if (typeof result.id !== "string" || !result.id)
          throw new EmailDeliveryError();
      } catch {
        safeLog(message.kind);
        throw new EmailDeliveryError();
      }
    },
  };
}
// Non-serverless Fastify owns these tasks for its process lifetime and drains them
// before closing PostgreSQL. No token-bearing data is logged or persisted here.
export function createEmailTasks() {
  const pending = new Set<Promise<void>>();
  return {
    submit(work: () => Promise<void>) {
      const task = Promise.resolve()
        .then(work)
        .catch(() => {})
        .finally(() => pending.delete(task));
      pending.add(task);
    },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}

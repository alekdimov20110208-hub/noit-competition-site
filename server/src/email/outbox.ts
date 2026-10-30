import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { TransactionDatabase } from "../db/transaction.ts";
import type { OperationalSecrets } from "../operations/secrets.ts";
import {
  decryptEmail,
  encryptEmail,
  privateIdentifier,
  verificationMetadata,
  type EmailMetadata,
} from "../operations/crypto.ts";
import type { SharedControls } from "../operations/limits.ts";
import { OperationalError } from "../operations/limits.ts";
import {
  EmailDeliveryError,
  renderEmail,
  trustedEmailUrl,
  type TransactionalEmail,
  type TransactionalEmailService,
} from "./service.ts";

type Job = EmailMetadata & {
  ciphertext: string;
  attempts: number;
  lease_nonce: string;
  lease_until: Date;
};
type Payload = { message: TransactionalEmail; providerBody: string };
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const terminal = new Set([
  "accepted",
  "permanent",
  "expired",
  "obsolete",
  "uncertain",
  "blocked",
]);
async function providerAccepted(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return false;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new Error("Provider acknowledgement unavailable.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    id?: unknown;
  };
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 256
  );
}
export interface DurableEmailService extends TransactionalEmailService {
  enqueue(
    database: TransactionDatabase,
    message: TransactionalEmail,
  ): Promise<string>;
  reserve(database: TransactionDatabase): Promise<void>;
  retryBlocked(id: string): Promise<boolean>;
  dispatch(
    target?: string,
    batch?: number,
  ): Promise<{ accepted: number; deferred: number }>;
}

// Explicit request-scoped service, with no timer, public route or shutdown queue.
export function createEmailOutbox(
  database: Pool,
  config: {
    publicAppUrl: string;
    betterAuthSecret: string;
    emailFrom: string;
    resendApiKey: string;
    operations: OperationalSecrets;
  },
  controls: SharedControls,
  safeLog: (state: string) => void,
  request: typeof fetch = fetch,
): DurableEmailService {
  const { operations: secrets } = config;
  const identifier = (scope: string, value: string) =>
    privateIdentifier(secrets.hmacKey, scope, value);
  async function metadata(
    tx: TransactionDatabase,
    message: TransactionalEmail,
  ): Promise<EmailMetadata> {
    const url = new URL(trustedEmailUrl(config.publicAppUrl, message.url));
    let reference: string, subject: string, expiry: Date;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) ||
      message.to.length > 254 ||
      message.to !== message.to.trim().toLowerCase() ||
      message.url.length > 8192 ||
      (message.eventName?.length ?? 0) > 1000 ||
      !["bg", "en"].includes(message.locale)
    )
      throw new EmailDeliveryError();
    if (message.kind === "invitation") {
      const token = url.pathname.split("/")[2];
      if (!/^\/invite\/[A-Za-z0-9_-]{43}$/.test(url.pathname))
        throw new EmailDeliveryError();
      reference = sha(token!);
      const result = await tx.query(
        `SELECT i.id,i.expires_at FROM public.event_invitation i JOIN public.event e ON e.id=i.event_id
        WHERE i.token_hash=$1 AND i.invited_email=$2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL
        AND i.expires_at>clock_timestamp() AND e.archived_at IS NULL`,
        [reference, message.to],
      );
      const row = result.rows[0] as
        { id: string; expires_at: Date } | undefined;
      if (!row) throw new EmailDeliveryError();
      subject = identifier("invitation-subject", row.id);
      expiry = row.expires_at;
    } else if (message.kind === "verification") {
      if (url.pathname !== "/api/auth/verify-email")
        throw new EmailDeliveryError();
      const token = url.searchParams.get("token") ?? "",
        value = verificationMetadata(token, config.betterAuthSecret);
      if (!value || value.email !== message.to) throw new EmailDeliveryError();
      reference = sha(token);
      subject = identifier("verification-subject", message.to);
      expiry = value.expiresAt;
    } else if (message.kind === "reset") {
      const token = url.pathname.slice("/api/auth/reset-password/".length);
      if (
        !/^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
        token.length > 256
      )
        throw new EmailDeliveryError();
      const result = await tx.query(
        `SELECT v."expiresAt" FROM public.verification v JOIN public."user" u ON u.id=v.value
        WHERE v.identifier=$1 AND lower(u.email)=$2 AND u.active=TRUE AND v."expiresAt">clock_timestamp()`,
        [`reset-password:${token}`, message.to],
      );
      const row = result.rows[0] as { expiresAt: Date } | undefined;
      if (!row) throw new EmailDeliveryError();
      reference = sha(token);
      subject = identifier("reset-subject", message.to);
      expiry = row.expiresAt;
    } else throw new EmailDeliveryError();
    return {
      id: identifier(
        "email-message",
        // The same native JWT can be generated twice within one second. Keep
        // distinct user-visible language/return destinations from deduplicating
        // into the wrong Event callback; retries of the same intent stay stable.
        JSON.stringify([
          message.kind,
          message.to,
          reference,
          message.locale,
          url.searchParams.get("callbackURL") ?? "",
        ]),
      ),
      kind: message.kind,
      subject_key: subject,
      reference_hash: reference,
      expires_at: expiry,
      key_id: secrets.encryptionKeyId,
    };
  }
  async function enqueue(tx: TransactionDatabase, message: TransactionalEmail) {
    const meta = await metadata(tx, message);
    const normalized = { ...message, expiresAt: meta.expires_at.toISOString() };
    // Freeze the exact provider body, including sender/template/locale/callback,
    // so a warm-instance/config/code change cannot change an idempotent retry.
    const payload: Payload = {
      message: normalized,
      providerBody: JSON.stringify({
        from: config.emailFrom,
        to: [message.to],
        ...renderEmail(normalized),
      }),
    };
    const encrypted = encryptEmail(secrets, meta, payload);
    try {
      await tx.query(
        "SELECT budograph_private.enqueue_email($1,$2,$3,$4,$5,$6,$7)",
        [
          meta.id,
          meta.kind,
          meta.subject_key,
          meta.reference_hash,
          meta.expires_at,
          meta.key_id,
          encrypted,
        ],
      );
    } catch {
      throw new OperationalError();
    }
    return meta.id;
  }
  async function valid(job: Job, message: TransactionalEmail) {
    if (
      message.kind !== job.kind ||
      !message.to ||
      new Date(message.expiresAt!).getTime() !== job.expires_at.getTime()
    )
      return false;
    const url = new URL(trustedEmailUrl(config.publicAppUrl, message.url));
    if (job.kind === "invitation") {
      if (sha(url.pathname.split("/")[2] ?? "") !== job.reference_hash)
        return false;
      return (
        (
          await database.query(
            `SELECT i.id FROM public.event_invitation i JOIN public.event e ON e.id=i.event_id
        WHERE i.token_hash=$1 AND i.invited_email=$2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL
        AND i.expires_at>clock_timestamp() AND e.archived_at IS NULL`,
            [job.reference_hash, message.to],
          )
        ).rows.length > 0
      );
    }
    if (job.kind === "verification") {
      const token = url.searchParams.get("token") ?? "",
        meta = verificationMetadata(token, config.betterAuthSecret);
      if (
        !meta ||
        meta.email !== message.to ||
        sha(token) !== job.reference_hash ||
        meta.expiresAt.getTime() <= Date.now()
      )
        return false;
      return (
        (
          await database.query(
            'SELECT id FROM public."user" WHERE lower(email)=$1 AND active=TRUE AND "emailVerified"=FALSE',
            [message.to],
          )
        ).rows.length > 0
      );
    }
    const token = url.pathname.slice("/api/auth/reset-password/".length);
    if (sha(token) !== job.reference_hash) return false;
    return (
      (
        await database.query(
          `SELECT v.id FROM public.verification v JOIN public."user" u ON u.id=v.value
      WHERE v.identifier=$1 AND lower(u.email)=$2 AND u.active=TRUE AND v."expiresAt">clock_timestamp()`,
          [`reset-password:${token}`, message.to],
        )
      ).rows.length > 0
    );
  }
  async function dispatch(target?: string, batch = 5) {
    const deadline = Date.now() + 20000;
    const nonce = randomUUID();
    const jobs = (
      await database.query(
        "SELECT * FROM budograph_private.claim_email($1,$2,$3)",
        [batch, nonce, target ?? null],
      )
    ).rows as Job[];
    let accepted = 0,
      deferred = 0;
    for (const job of jobs) {
      const finish = async (state: string, outcome: string, delay = 0) => {
        const result = await database.query(
          "SELECT budograph_private.finish_email($1,$2,$3,$4,$5) AS done",
          [
            job.id,
            nonce,
            state,
            outcome,
            Math.min(86400, Math.max(0, Math.ceil(delay))),
          ],
        );
        const actual = (result.rows[0] as { done: string | null }).done;
        if (actual) safeLog(actual);
        return actual;
      };
      if (Date.now() >= deadline) {
        await finish("retry", "budget", 5);
        deferred++;
        continue;
      }
      let payload: Payload;
      try {
        payload = decryptEmail(secrets, job, job.ciphertext) as Payload;
        if (!payload?.message || typeof payload.providerBody !== "string")
          throw Error();
      } catch {
        await finish("blocked", "invalid");
        continue;
      }
      // Failed database preflight/limiter is fail-closed: no provider call. The
      // lease remains recoverable if the database is unavailable at completion.
      if (!(await valid(job, payload.message))) {
        await finish("obsolete", "obsolete");
        continue;
      }
      const budget = await controls.delivery();
      if (!budget.allowed) {
        await finish("retry", "budget", budget.retryAfter);
        deferred++;
        continue;
      }
      const start = await database.query(
        "SELECT budograph_private.start_email($1,$2) AS started",
        [job.id, nonce],
      );
      if (!(start.rows[0] as { started: boolean }).started) {
        deferred++;
        continue;
      }
      // A frozen process can resume after its lease was recovered elsewhere.
      // Recheck wall time immediately after the last SQL await and bound I/O by
      // the remaining lease; SQL fencing alone cannot cancel an external send.
      const remaining = Math.min(
        10000,
        job.lease_until.getTime() - Date.now() - 1000,
        job.expires_at.getTime() - Date.now(),
        deadline - Date.now(),
      );
      if (remaining <= 0) {
        deferred++;
        continue;
      }
      let state = "unknown",
        outcome = "unknown",
        delay = Math.min(3600, 5 * 2 ** job.attempts);
      try {
        const response = await request("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(Math.floor(remaining)),
          headers: {
            authorization: `Bearer ${config.resendApiKey}`,
            "content-type": "application/json",
            "idempotency-key": `budograph-email/v1/${job.id}`,
          },
          body: payload.providerBody,
        });
        if (response.ok) {
          if (await providerAccepted(response)) {
            state = "accepted";
            outcome = "accepted";
          }
        } else if (response.status === 429 || response.status >= 500) {
          state = "retry";
          outcome = "temporary";
          const retry = response.headers.get("retry-after");
          if (retry) {
            const seconds = /^\d+$/.test(retry)
              ? Number(retry)
              : (Date.parse(retry) - Date.now()) / 1000;
            if (Number.isFinite(seconds))
              delay = Math.max(delay, Math.min(86400, seconds));
          }
        } else if (response.status !== 409 && response.status !== 408) {
          state = "permanent";
          outcome = "rejected";
        }
        // Bodies/links/provider IDs are never stored in diagnostics or returned.
        await response.body?.cancel().catch(() => {});
      } catch {
        /* Timeout/connection/acknowledgement uncertainty: retry same key. */
      }
      const done = await finish(state, outcome, delay);
      if (done === "accepted") accepted++;
      else if (!done || !terminal.has(done)) deferred++;
    }
    return { accepted, deferred };
  }
  return {
    enabled: true,
    enqueue,
    dispatch,
    async retryBlocked(id) {
      try {
        return (
          await database.query(
            "SELECT budograph_private.retry_blocked_email($1) AS retried",
            [id],
          )
        ).rows[0].retried as boolean;
      } catch {
        throw new OperationalError();
      }
    },
    async reserve(tx) {
      try {
        await tx.query("SELECT budograph_private.reserve_email_capacity()");
      } catch {
        throw new OperationalError();
      }
    },
    // Raw Better Auth APIs outside the C3 owner must not open a second checkout
    // or create a business effect without its SQL transaction.
    async send() {
      throw new EmailDeliveryError();
    },
  };
}

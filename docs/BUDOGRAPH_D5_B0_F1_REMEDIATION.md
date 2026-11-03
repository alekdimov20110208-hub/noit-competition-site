# D5-B0-F1 Security Findings Remediation

**READY for a new independent local review. Not deployed. Public signup remains disabled.**

Date: 2026-11-01. Branch: `staging/render-free-d2-2`.
HEAD before/after: `66b2bfcd772ad72ef9228c89a0926274397a5a62`.

The full D5-B0-R review is in the task conversation. Its three findings are the
scope of this remediation; the original D5-B0 report remains historical evidence.

## F1 — FIXED: one reset-token authority

`canonicalResetToken` accepts body-only, query-only or matching body/query values.
It rejects absent/empty/malformed tokens, conflicting sources and repeated query
parameters. The transaction wrapper removes the query token and passes the same
canonical body token to the account lookup and the native Better Auth endpoint.
An unresolved account fails closed before native reset can run. The existing
account lock and inactive check remain mandatory for every accepted reset shape.

Better Auth 1.7.7 remains unchanged. Native consume/expiry/password hashing/session
revocation and transaction-owned sibling invalidation remain in place. There is
no new token/password diagnostic output or database capability.

The initial reproduction (empty body token plus a valid query token for an
inactive account) now returns 400 and leaves the password unchanged. Integration
tests also verify conflicting/null/array/repeated/unknown inputs, body/query-only
success, rejected-input non-consumption, same-token concurrent redemption (one
200, one 400), sibling invalidation and session revocation. Existing concurrent
reset-request and rollback tests continue to pass.

## F2 — FIXED: enqueue failure is not a recipient oracle

The wrapper recognizes an eligibility-dependent enqueue failure only after the
owned transaction has rolled back and released its client. It records a fixed,
non-PII diagnostic and returns the existing generic response under the existing
750ms floor. The runtime supplies its existing safe outbox logging callback; the
standalone fallback also emits a fixed message. A failing diagnostic callback
cannot change the public response.

The generic response acknowledges no delivery outcome: it does not claim that an
email was queued or sent. A failed enqueue rolls back the new reset credential,
outbox insert and supersession changes, preserving the previous valid reset link.
Successfully committed jobs still belong exclusively to the durable worker.
Identity-independent admission/capacity failures retain common 429/503 responses.

The fault-injection test fails **after the real outbox enqueue SQL has written**.
For both recovery and resend, eligible, verified, inactive and nonexistent
recipients return the same 200/body/headers (excluding the identity-independent
Date header), no cookies or Retry-After, and the common timing floor. The test
checks unchanged outbox row count, retained previous token and non-sensitive logs.
Existing worker outage/retry, frozen payload/key, capacity and budget tests pass.

## F3 — FIXED: quota-denied requests may recover accepted receipts

The HTTP adapter catches only a creation-limiter 429 and passes that rejection to
the existing Duplicate operation. Under the existing actor/key transaction lock,
the operation still authorizes the current source, validates receipt scope/digest
and authorizes the destination. Only an exact accepted receipt may return its
original outcome. Without that receipt, the original quota error is thrown before
any business write. Other admission failures continue to fail closed.

Attempt-based accounting is retained: retries consume admission while available.
Exhaustion cannot prevent recovery of a previously accepted exact receipt. This
does not introduce a second pool checkout inside the transaction, change limiter
durability, waive the Event cap or expose a caller-controlled bypass flag.

The original six-replay reproduction now returns six 201 responses with the same
accepted result. Additional tests cover changed payload (409), a new key under
exhaustion (429 with Retry-After), revoked source/destination authority, concurrent
accepted replays and concurrent identical fresh commands creating exactly one
Event/receipt/history entry. Existing 100-owned-Event tests still pass.

## Executed validation

| Check                                                                     | Result                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| Server unit tests, excluding opt-in integration and D2/staging test files | 226 PASS, 0 FAIL, 0 SKIP                          |
| Dedicated D5-B0 isolated PostgreSQL suite                                 | 17 PASS, 0 FAIL, 0 SKIP; parent plus 16 scenarios |
| Full isolated TLS/identity/startup/operational/runtime suite              | 48 PASS, 0 FAIL, 0 SKIP                           |
| Server TypeScript                                                         | PASS                                              |
| Backend build                                                             | PASS                                              |
| ESLint and Prettier, scoped to remediation files                          | PASS                                              |
| All 16 accepted migration checksums / Git diff whitespace check           | PASS                                              |

The dedicated runner initializes a fresh loopback PostgreSQL cluster with
synthetic credentials, reproduces the existing accepted migration/permission
baseline, mocks Resend and stops/removes only its own cluster. No new application
migration, grant or role is introduced.

For the full suite, the unchanged existing runner was invoked with `--all`, from
a new task-owned working directory containing junctions to the repository's
server and dependencies. This isolates its fixed evidence output path from all
historical reports. No staging/D2.5/D3/D4 mode was selected. All new TLS fixtures
were stopped; their logs and fixture evidence remain local.

The first full run failed while enqueueing the old one-second JWT expiry fixture
(46 PASS, one failed scenario plus its parent). The expiry fixture now permits
five seconds for verified TLS/identity enqueue and then waits past expiry. No
runtime expiry policy was changed. Both failed and passing run evidence remain:

- First run: `tmp/d5-b0-f1-tls-605f7cbb-8008-4c42-ae47-806b942ae379/tmp/v1c5/`
- Passing run: `tmp/d5-b0-f1-tls-ee056e1f-7faf-4922-b45c-09c7a9ed415b/tmp/v1c5/`

These are local tests with synthetic data and providers. They do not establish
hosted staging behavior, real inbox delivery or hosted timing distributions.

## Files changed in this remediation

- `server/src/auth/safety.ts`
- `server/src/auth/auth.ts`
- `server/src/auth/transactions.ts`
- `server/src/runtime.ts`
- `server/src/events/operations.ts`
- `server/src/events/service.ts`
- `server/src/routes/events.ts`
- `server/tests/auth-security.test.ts`
- `server/tests/event-operations.test.ts`
- `server/tests/auth-security.integration.test.ts`
- `server/tests/operational-controls.integration.test.ts` (expiry fixture only)
- `docs/BUDOGRAPH_D5_B0_F1_REMEDIATION.md` (new)
- `docs/AI_ASSISTANCE_LOG.md` (append only)

All other tracked/untracked baseline files are preserved. No dependency/asset,
license, cloud environment, native package, credential or schema change is part
of this work. No commit, push or deployment occurred.

## D4 and remaining limits

Local native registration/verification/login/reset/session compatibility and
production-mode TLS/identity startup pass. Existing queued delivery semantics,
Render Free sleep delays, finite quotas and the 100-owned-Event cap remain. The
750ms floor is a minimum, not a constant-time guarantee during arbitrary stalls.
Ambiguous reset inputs now intentionally return 400; supported body/query-only
inputs remain covered.

A new independent review is required before separately authorizing D5-B1. Public
registration, hosted E2E, ingress verification and real inbox tests are not part
of this remediation. The supplied NOIT regulation is for 2025–2026 and must be
rechecked for the applicable later competition year.

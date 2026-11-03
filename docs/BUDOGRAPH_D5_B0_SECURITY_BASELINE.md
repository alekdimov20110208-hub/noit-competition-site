# D5-B0 Authentication Security Baseline

**READY for separate local review. Not deployed. Public signup remains disabled.**

Work started: 2026-10-31. Final local verification: 2026-11-01.
Branch: `staging/render-free-d2-2`.
Starting HEAD: `66b2bfcd772ad72ef9228c89a0926274397a5a62`.
Scope authorized by the owner's D5-B0 request, following the D5-A audit in chat.

## Implemented behavior

### Durable auth mail and response timing

Recovery and verification resend finish their owned SQL transaction before the
HTTP response. They never invoke durable provider dispatch. The existing email
worker owns claim/lease, current-token checks, budget admission, provider
idempotency, retry and cleanup. Jobs remain in PostgreSQL if the process stops;
there is no new fire-and-forget delivery promise or memory-only delivery queue.
Invite-only account verification also uses the worker after durable COMMIT.

Valid recovery/resend requests use a common 750ms minimum response window outside
SQL leases. This absorbs normal local/native timing differences. Verification
resend uses Better Auth 1.7.7's exported `createEmailVerificationToken`, with the
configured expiry and server-pinned public origin. Better Auth still validates
the JWT on its existing verification endpoint. Its anonymous resend endpoint's
500ms sleep is not run while holding account/outbox admission locks. The same
native generator handles durable existing-unverified-account registration retry.
No custom signing algorithm or verification endpoint was added.

Inactive/missing accounts and already-verified verification recipients get the
same public `{status:true}` response as eligible accounts. They receive no new
reset token or email job. Provider latency/outage is independent of HTTP success.
Outbox capacity is reserved before eligibility lookup, preserving identical 503
behavior for a common capacity failure. Operational failures remain fail-closed
and produce fixed, non-PII internal log messages. Untrusted mail POST origins are
403; rate admission can return 429, independently of account existence.

### Reset policy

Only the newest successfully committed reset request remains valid. Under the
existing account advisory lock, earlier native reset identifiers for that user
are deleted in the same transaction as replacement token and outbox enqueue.
An enqueue failure rolls everything back, retaining the previous valid token.
Successful reset removes remaining legacy sibling reset tokens in the same
transaction as native password update and all-session revocation.

Native single-use consumption and one-hour expiry remain. Inactive identities
cannot redeem previously issued reset tokens. The policy uses the existing
runtime SELECT/DELETE permissions and the pinned Better Auth 1.7.7 plain
`reset-password:<random>` identifier convention; a library/storage-format upgrade
must revalidate this policy.

### Abuse admission

Existing durable `consume_limits` supplies atomic, HMAC-keyed quotas. Request IP
comes from Fastify's resolved socket/exact-trusted-proxy boundary. IPv4-mapped
addresses share IPv4 quotas; IPv6 addresses share a canonical /64 quota.

| Action                     | Admission defaults                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Registration               | 5/network/15min; 20/network/UTC day; 80 global/UTC day                                     |
| Future public registration | Above, plus 3/normalized email/hour, before identity lookup                                |
| Event Create and Duplicate | 5/account/min; 20/account/UTC day; 10/network/min; 100/network/UTC day; 200 global/UTC day |
| Owned Event storage        | 100/account, including archived Events and Duplicate targets                               |

Invite-only registration already consumes the common registration network/day
budgets. `controls.registration(ip,email)` is prepared and tested for B1's future
validated public entry point; this stage exposes no public registration handler.
Event admission follows authentication and trusted-origin checks and uses the
session user ID. Create and Duplicate share a transaction/advisory-lock-protected
storage cap; concurrent creates cannot race past it. Exact Duplicate receipt
replay creates nothing and still uses its existing authorization checks.

These are application admission defaults for review, not provider plan limits.
Counters are attempt-based; retries consume admission. No role model, membership
authority, migration, permission grant or existing credential was changed.

## Verification performed

- Server tests excluding opt-in DB suites and D2/staging suites: **224 PASS,
  0 FAIL, 0 SKIP**.
- Dedicated D5-B0 PostgreSQL integration: **14 PASS, 0 FAIL, 0 SKIP** (parent plus
  13 scenario tests), with actual Better Auth and least-privilege runtime SQL.
- Server TypeScript check and server build: **PASS**.
- ESLint scoped to changed code/test/runner files: **PASS**.

Integration scenarios cover response status/body/floor; parallel resend lock
contention; native verification of the generated JWT; held/failed provider I/O;
durable retry across runtimes with the same key/body; budget denial without a
provider call; rollback on enqueue failure; duplicate reset requests; newest-only,
legacy sibling, reused and expired tokens; inactive identities; two-session
revocation; generic capacity failures and safe logs; origin/closed-signup bounds;
shared and daily quotas; IPv6 rotation; concurrent Event cap and Duplicate bypass.

The dedicated runner creates a new loopback-only PostgreSQL 17 cluster using new
synthetic credentials, checks its data-directory/port witness, verifies all 16
existing migration checksums and reproduces that unchanged baseline as a fixture.
It accepts no target URL or operation flags, loads no `.env`, uses no existing
credentials and mocks all outbound provider HTTP. After testing it stops and
removes only its exact nonce-owned cluster. No D2.5/D3/D4 launcher was executed.

Repeat locally with existing PostgreSQL binaries (default
`D:/BudoGraph-PG17-Test/pgsql/bin`, or `BUDOGRAPH_TEST_POSTGRES_BIN`):

```powershell
node scripts/verify-d5-b0.mjs
```

The older `operational-controls.integration.test.ts` assertions were adapted to
explicit worker delivery and pending job state. Its separate full TLS/identity
fixture was **not rerun** here. Neither hosted E2E nor a real inbox test is claimed.

## Files changed by D5-B0

- `server/src/app.ts`
- `server/src/auth/auth.ts`
- `server/src/auth/safety.ts` (new)
- `server/src/auth/transactions.ts`
- `server/src/events/service.ts`
- `server/src/operations/limits.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/events.ts`
- `server/tests/auth-security.test.ts` (new)
- `server/tests/auth-security.integration.test.ts` (new)
- `server/tests/helpers/d5-b0-database.ts` (new)
- `server/tests/event-authoring.test.ts`
- `server/tests/operational-controls.integration.test.ts`
- `scripts/verify-d5-b0.mjs` (new)
- `docs/BUDOGRAPH_D5_B0_SECURITY_BASELINE.md` (new)
- `docs/AI_ASSISTANCE_LOG.md` (append only)

No dependencies/assets were added; the existing GPLv3 licensing register is
unchanged. Pre-existing dirty files remain outside this implementation, except
for the append-only assistance-log entry.

## Remaining limits and B1 prerequisites

- A minimum response window is not a mathematical constant-time guarantee during
  arbitrary storage stalls, per-account contention or corruption. Hosted timing
  distributions, ingress IP handling and availability still require separate
  approved staging tests.
- Render Free sleep delays worker execution until wake-up. Durable jobs survive;
  expired credentials are suppressed. This change promises no delivery while the
  process is asleep and adds no cloud worker/configuration.
- The fixed quotas and 100-owned-Event cap need owner review for the intended
  audience/shared networks. The backend returns `EVENT_CAPACITY_REACHED`; no new
  frontend capacity message/design was added in this backend stage.
- B1 must bind `controls.registration` to the future validated HTTP command before
  account lookup and use the owned registration transaction/outbox. Removing the
  Better Auth disabled-path flags alone is insufficient. Signup duplicate,
  verification continuation and empty-account UX remain B1 work.
- Review this local diff before separately authorizing public signup or any
  cloud/deployment operation. No Supabase/Render/Vercel operation is part of B0.

The mandatory NOIT sources were read during D5-A. Rules in the supplied 2025-2026
regulation require separate verification for the actual competition year.

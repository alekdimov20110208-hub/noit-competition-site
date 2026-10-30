# BudoGraph D2 runtime integration — 2026-10-30

> D2.1 hosting update: the active `render.yaml` now uses **Free** staging,
> manual deploy and `REMINDER_WORKER_ENABLED=false`. The paid recipe described
> below is historical, archived as non-deployable reference text. Follow
> [the D2.1 runbook](BUDOGRAPH_RENDER_FREE_D2_1.md) for the current hosting plan.
> D2 runtime code and its original verification evidence are unchanged.

**Local source integration: READY. Production deployment: NOT EXECUTED.**

The existing React/Vite + persistent Fastify + Better Auth **1.7.7** + PostgreSQL
17 architecture is preserved. Event Management/Template implementations and
frontend source are unchanged. No Production SQL, migration/verification retry,
Production account creation, credential readout, Git push, paid provisioning,
Vercel change, DNS change or public release was performed.

## Implemented and verified

- Copied only SQL 0014–0016, byte-for-byte from
  `C:\NOIT-R4A-BASELINE-CANDIDATE-20261019-R2`. All 16 local hashes match both
  that baseline and the consumed independent Production verifier's immutable
  inputs. `server/migrations/production-manifest.json` preserves these pins,
  verification identity and SHA-256 provenance. SQL is `-text` in Git to prevent
  line-ending conversion. Earlier SQL bytes and the migration runner are unchanged.
- Startup checks exactly 16 original files and all applied history checksums
  through a SELECT-only boundary before listening. It never calls the migration
  runner or provisions users. Pending, missing, unknown or mismatched history
  fails closed. The consumed attempts must never be repeated.
- Production connection validation requires a password-bearing
  `budograph_runtime` URL (or its project-qualified session pooler username),
  verified CA/hostname TLS, and rejects transaction pooler port 6543. Every pool
  checkout checks database UUID/project/environment and the actual non-owner,
  non-superuser role, memberships and permanent DDL denial. R2's approved inherited
  PUBLIC TEMP is preserved; a direct runtime TEMP grant is rejected. Production
  pool max is **4**, matching the approved role's connection limit; queue max 64.
- Reused the existing local `budograph-vercel-v1c` auth transaction, identity,
  lease, shared-limit and durable-mail modules, adapting them to the actual R2
  schema and persistent hosting. These are now composed by `runtime.ts`/`main.ts`.
  The native Kysely adapter uses the same owned SQL transaction for account and
  encrypted outbox writes; mail is dispatched only after COMMIT/release.
- Public signup remains disabled. Invitation registration requires a live token;
  verification is mandatory, and membership requires separate explicit acceptance.
  Active-account checks, origin validation, session revocation and secure cookies
  remain enforced. Production cannot fall back to memory rate limits/direct mail.
- Integrated all 0016 operational functions: atomic shared limits, capacity
  reservation, encrypted enqueue, claim/start/finish, bounded cleanup and private
  blocked-job recovery capability. There is no public recovery endpoint.
  Immediate request dispatch and the **5-second non-overlapping outbox worker**
  share SQL claim/nonce fencing and stable Resend idempotency keys/frozen payloads.
  Retries stop within 23 hours, before Resend's documented 24-hour deduplication
  window; uncertain outcomes are retained without asserting inbox delivery.
  [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Existing reminder worker and new outbox worker run in the same Node service;
  shutdown waits for active passes before closing PostgreSQL. The Render recipe
  allows 120 seconds for shutdown. Frontend, API, auth, cookies and workers have
  one deployment/origin; no Vite development server is needed.

## Hosting artifact

`render.yaml` is a reviewable **single paid Node web service** with one instance,
auto-deploy disabled, no migration/pre-deploy command, same-origin frontend
serving, readiness health check and explicit secret inputs. Its plan, runtime,
health check, auto-deploy and shutdown fields were checked against the current
[Render Blueprint specification](https://render.com/docs/blueprint-spec).
No Render service was created. Keep the existing Vercel deployment and both
`budograph.com`/`www.budograph.com` records unchanged.

Use direct PostgreSQL or **session-mode** Supavisor; the reminder's advisory lock
needs a persistent database session. This agrees with
[Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
The deployable input includes root `dist/`, `server/dist/`, `server/migrations/`
(including the pin manifest), package/lock files and runtime dependencies.

The first controlled deployment can use the assigned HTTPS `onrender.com` origin
for both auth and frontend, after explicit owner approval of hosting/cost/access.
Do not put `budograph.com` into the auth origin while it still points at Vercel.
No proxy trust is enabled by default; socket-IP limits remain conservative.
Only independently verified exact ingress IPs may be added through
`TRUSTED_PROXY_IPS`; never trust arbitrary forwarded headers.

## Required owner inputs; not read from Production

| Input                               | Required value / action                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Secret-store URL using activated `budograph_runtime`, direct or session mode, database `postgres`; no URL query overrides. Never owner/migrator/service-role credentials. |
| `DATABASE_TLS_CA_FILE`              | `/etc/secrets/database-ca.pem`, uploaded separately as a verified provider CA secret file. `DATABASE_TLS_MODE=verify-full`.                                               |
| `EXPECTED_DATABASE_ID`              | Owner-chosen UUID, exactly matching the single 0015 identity row.                                                                                                         |
| `EXPECTED_SUPABASE_PROJECT_REF`     | `bdcjascqqvzmmlvabhgv`, already pinned in the Render recipe.                                                                                                              |
| `BETTER_AUTH_SECRET`                | Independent random secret, at least 32 characters; keep stable across restarts.                                                                                           |
| `BETTER_AUTH_URL`, `PUBLIC_APP_URL` | Identical public HTTPS origin, without a path; first controlled Render hostname until a separately approved domain cutover.                                               |
| `RATE_LIMIT_HMAC_KEY`               | Independent canonical base64 encoding of 32 random bytes. Keep stable across runtimes/restarts; it also derives durable idempotency identities.                           |
| `EMAIL_OUTBOX_KEY_ID`               | Active key identifier, 1–32 lowercase letters/digits/underscore/hyphen.                                                                                                   |
| `EMAIL_OUTBOX_KEYS`                 | JSON object with 1–3 independent 32-byte base64 keys, including the active identifier. Preserve previous keys while their encrypted jobs remain recoverable.              |
| `EMAIL_MODE`                        | `resend`; production rejects disabled/direct fallback.                                                                                                                    |
| `EMAIL_FROM`                        | Sender on an owner-verified domain; existing SPF/DKIM/provider domain authorization must be confirmed separately.                                                         |
| `RESEND_API_KEY`                    | Server-only sending key restricted to the verified sending domain. Confirm sender authorization and provider quotas. No real send was tested.                             |

Source budgets currently cap delivery at one admission per second, 80/day and
2400/month, with bounded backoff, attempts and storage. These are application
ceilings, not claims about the provider's purchased plan.

## Separate Production operations requiring explicit approval

These are **not migrations**, were not executed, and must not be smuggled into
startup, a Render pre-deploy hook or a migration retry:

1. If not already done, activate the pre-existing runtime LOGIN through the
   owner's secret workflow: set a newly generated password and reviewed
   `VALID UNTIL`, retaining the role's non-owner privileges and connection limit 4. The original bootstrap intentionally created no usable password and used
   an expired validity. Do not create a second role or widen grants.
2. Confirm/seed exactly one row in
   `budograph_private.environment_identity(singleton,database_id,environment,project_ref)`:
   `TRUE`, the owner-selected UUID, `production`, `bdcjascqqvzmmlvabhgv`.
   The owner must independently verify the target before a conditional INSERT;
   an existing conflicting row must stop the operation, never be overwritten.
3. Approve a one-time first Organizer bootstrap separately. It must create the
   first real Better Auth identity/credential with the pinned library's password
   hashing, establish verified email ownership, and create the initial Event and
   ORGANIZER membership transactionally through the reviewed owner procedure.
   There is no global Organizer flag: authority is Event membership. No public
   signup/bootstrap route or development provisioning CLI is enabled for this.
   The current development CLI explicitly refuses Production and is unsuitable.

The first two items are startup prerequisites if absent. The third is required
to use the invitation-based product from an empty Production database. Their
current live state was not queried in this task. No new schema migration or
additional runtime grant is required by the verified local implementation.

## Reproducible local verification

`production:test:local` creates a fresh PostgreSQL 17 cluster with a random owned
directory/port and generated synthetic credentials/CA. It accepts **no target
database URL**, loads no `.env`, witnesses its own data directory/system identity,
applies the 16 exact SQL files locally as session `postgres` / creator
`budograph_migrator`, and tests the actual `budograph_runtime` connection.
Provider HTTP is intercepted or blocked. Only this new cluster is stopped.
Credentials/cluster files stay outside the repository; logs are in ignored `tmp/`.

```powershell
$env:BUDOGRAPH_TEST_POSTGRES_BIN = 'D:/BudoGraph-PG17-Test/pgsql/bin'
$env:BUDOGRAPH_TEST_PYTHON = 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
pnpm production:build
pnpm production:test:local
pnpm server:test
pnpm test
pnpm server:typecheck
pnpm lint
```

Actual final results and the complete changed-file inventory are recorded in
`docs/evidence/D2_RUNTIME_RESULT.json`. Standard backend DB suites have explicit
skips; the D2 disposable suites are run separately with zero skips. The remaining
Vite chunk-size warning is informational; frontend source was not changed.

## Next single hosting action

**Owner approval to create the single Render Node Web Service from this recipe**,
with manual deploy, the secret-file/environment inputs above and the assigned
temporary HTTPS origin. Confirm the cost and controlled-access conditions before
provisioning. Git publication, actual deploy, DNS/domain cutover and live email
acceptance require their own explicit authorization; none occurred here.

The NOIT document supplied is for **2025–2026**. Group/category, deadlines,
documentation format, judging/defense timing and online-access period must be
checked for the actual competition year. D2 preserves GPLv3/source/docs/tests;
it makes no claim that later-year rules have been verified.

## Exact changed-file inventory

### Runtime source

- `server/src/app.ts`
- `server/src/auth/auth.ts`
- `server/src/auth/path.ts`
- `server/src/auth/transactions.ts`
- `server/src/config/env.ts`
- `server/src/db/identity.ts`
- `server/src/db/lease.ts`
- `server/src/db/pool.ts`
- `server/src/db/production-schema.ts`
- `server/src/db/transaction.ts`
- `server/src/email/outbox.ts`
- `server/src/email/service.ts`
- `server/src/email/worker.ts`
- `server/src/invitations/service.ts`
- `server/src/main.ts`
- `server/src/operations/crypto.ts`
- `server/src/operations/limits.ts`
- `server/src/operations/secrets.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/invitations.ts`
- `server/src/runtime.ts`

### Migrations and metadata

- `server/migrations/0014_production_runtime_access.sql`
- `server/migrations/0015_environment_identity.sql`
- `server/migrations/0016_durable_email_operational_controls.sql`
- `server/migrations/README.md`
- `server/migrations/production-manifest.json`

### Tests

- `server/tests/auth.test.ts`
- `server/tests/d2-runtime.test.ts`
- `server/tests/d2-startup.integration.test.ts`
- `server/tests/database-identity.test.ts`
- `server/tests/database-tls.test.ts`
- `server/tests/email.test.ts`
- `server/tests/env.test.ts`
- `server/tests/helpers/operational-secrets.ts`
- `server/tests/helpers/runtime-disposable.ts`
- `server/tests/operational-controls.integration.test.ts`
- `server/tests/operational-secrets.test.ts`
- `server/tests/production.test.ts`
- `server/tests/runtime-access.integration.test.ts`
- `server/tests/transactions.test.ts`

### Build, configuration and documentation

- `.gitattributes`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BUDOGRAPH_RUNTIME_D2.md`
- `docs/THIRD_PARTY_NOTICES.md`
- `docs/evidence/D2_RUNTIME_RESULT.json`
- `package.json`
- `pnpm-lock.yaml`
- `render.yaml`
- `scripts/production-build.mjs`
- `scripts/verify-d2-runtime.mjs`
- `server/.env.example`

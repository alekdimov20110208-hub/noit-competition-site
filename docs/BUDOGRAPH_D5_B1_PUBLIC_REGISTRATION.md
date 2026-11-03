# BudoGraph D5-B1 Public Registration

Status: **LOCAL READY** for independent review. Local implementation only;
public activation and hosted deployment remain unapproved.

Date: 2026-11-01. Branch: `staging/render-free-d2-2`.

## Scope and gate

`BUDOGRAPH_PUBLIC_SIGNUP_ENABLED` defaults to `false`. The example file explicitly
sets `false`; no actual environment file or cloud setting was read or changed.
Only the exact strings `true` and `false` parse. This stage additionally rejects
activation in `NODE_ENV=production`, which includes deployed staging. A local
opt-in requires a loopback PostgreSQL URL using `budograph_runtime`, existing
shared controls and an enabled durable outbox. Each registration transaction
checks the actual server address, port, database, role and role safety before
account lookup. Missing configuration or a failed witness fails closed.

`GET /api/registration` returns only `{ enabled: boolean }`, with no caching.
Without the configured capability, POST returns 404 before controls/account SQL.
The general `/api/auth/sign-up/email` endpoint remains disabled in every mode,
including the isolated opt-in. No private Better Auth HTTP handler is mounted.
The browser has no activation flag: it uses the server capability and hides the
login signup link unless that capability explicitly returns true. An unavailable
capability fails closed. `/signup` then shows a closed-registration state.

The production veto is deliberate: future hosted activation needs a separately
approved, reviewed change to bind this gate to the existing hosted database
identity contract. Setting a cloud environment variable alone cannot enable it.

## Registration flow and transaction ownership

1. `/signup` collects display name, email, password and confirmation. Validation,
   keyboard focus, show/hide, pending exclusion and translated BG/EN states use
   the existing visual system. Passwords enter only input/request memory and are
   cleared after server attempts. They never enter browser storage, URLs or logs.
2. POST `/api/registration` requires an exact trusted Origin, rejects cross-site
   requests, limits JSON to 4096 bytes and rejects query input/unknown fields.
   Only `name`, `email`, `password`, `confirmPassword` and optional `returnTo` are
   accepted. Confirmation is checked server-side and never forwarded to auth.
   Names follow the existing profile rules; email is canonicalized without
   provider alias rewriting; passwords require 8-128 characters.
3. `controls.registration(request.ip, email)` runs before any account lookup.
   Fastify alone resolves the direct/exact-trusted-proxy peer. The unchanged B0
   controls normalize IPv4/mapped IPv4 and IPv6 /64s and durably charge attempts:
   3/email/hour, 5/network/15min, 20/network/UTC day and 80 global/UTC day.
4. The private instance settles schema preparation, then takes one application-
   owned transaction/client. It checks local DB identity, acquires the existing
   account lock and checks outbox capacity for every recipient. The bound Kysely
   adapter uses that same lease; no nested pool checkout or simulated COMMIT.
5. Native Better Auth 1.7.7 `signUpEmail` owns password hashing, the User and the
   credential Account. New identities are active, unverified and sessionless.
   Its verification callback enqueues the encrypted durable job in the same
   transaction. Enqueue failure rolls back User, credential and outbox writes.
   Provider delivery belongs exclusively to the existing worker after commit.
6. Every admitted valid signup returns only 200 `{ status: true }`, including
   existing verified/unverified/inactive identities and recipient-dependent
   native/write/enqueue failures. No IDs, tokens or cookies are returned.
   Identity-independent admission/capacity/config failures use common 429/503
   responses; validation/Origin/gate errors precede identity lookup. A shared
   750ms minimum runs after transaction release, including common admission
   failures. No automatic retry occurs after an unknown commit outcome.
7. Native duplicate signup does not replace credentials/name or enqueue new
   mail. Concurrent same-email calls serialize and create one account/job.
   The generic continuation offers the established verification resend flow,
   under its unchanged mail and delivery budgets. It makes no delivery promise.
8. The existing `/verify-email` flow leads to normal login. Verification does
   not create a session. `returnTo` and invitation links use the existing
   allowlists. No Event, membership or role is granted at signup/verification.
9. An account without Events remains on the empty Dashboard with a direct
   Create Event link. Existing Event creation grants ORGANIZER only on the new
   Event, with the accepted creation quotas and 100-owned-Event storage cap.
   Foreign Event authority is unchanged. There is no global Admin system.

## Executed local validation

All accounts, addresses, credentials and provider responses were synthetic.
No real email or invitation was sent; no hosted database was connected.

| Check                                                                    | Result                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Server unit tests excluding opt-in integration and D2/staging test files | 230 PASS, 0 FAIL, 0 SKIP                                                 |
| Existing frontend unit suite                                             | 329 PASS, 0 FAIL, 0 SKIP                                                 |
| New frontend signup unit tests                                           | 2 PASS, 0 FAIL, 0 SKIP                                                   |
| D5-B0 plus D5-B1 isolated PostgreSQL suite, including real browser       | 31 PASS, 0 FAIL, 0 SKIP; two parents plus 29 scenarios                   |
| Full isolated TLS/identity/startup/operations/runtime suite              | 48 PASS, 0 FAIL, 0 SKIP                                                  |
| Signup browser presentation fixtures                                     | 16 BG/EN x 320/390/768/1440px x light/dark cases PASS; interactions PASS |
| Frontend/server TypeScript, production frontend/backend build            | PASS                                                                     |
| Scoped ESLint / Prettier / diff whitespace                               | PASS                                                                     |
| Existing accepted migration checksums                                    | All 16 unchanged                                                         |

The D5 suite covers gate OFF, strict fields, authority injection, CSRF, native
creation, duplicates with replacement credentials, concurrency across runtimes,
email/network/global budget exhaustion, post-insert enqueue failure/rollback,
common capacity/identity failures, BG email/resend continuation, unverified
refusal, verified login, empty Events, Event quotas/cap, foreign authority and
invitation registration/verification/explicit MEMBER acceptance. B0/F1 reset,
timing, worker retry/budget, session and Duplicate replay regressions also run.

The actual browser test uses the built frontend and actual Fastify, Better Auth,
runtime PostgreSQL and outbox. It extracts only its synthetic verification job
inside the test, follows the native link, signs in, visits the empty Dashboard
and creates the first Event, then checks its scoped ORGANIZER row. The separate
presentation runner mocks HTTP and checks labels, keyboard/show-hide, focus,
pending exclusion, mismatch, errors, safe continuation, storage and layout.

Evidence directory: `tmp/d5-b1-6b3957e3-d704-498a-9467-d7258b8041d6/`.
The initial browser attempt lacked the expected bundled Chromium revision; the
next attempt exposed the old empty-account redirect. Both failure logs remain.
The corrected passing run is `postgres-final.log`; the final expanded resend
and replacement-password run is `postgres-reviewed.log`. The UI run also caught
and fixed a 42px show/hide target caused by stylesheet specificity.

UI report/screenshots: `tmp/d5-b1-ui-e3930677-7546-4355-9187-bcf8a2f4d74b/`.
TLS evidence: the new task-owned `tls/tmp/v1c5/` under the evidence directory.
The unchanged `--all` local runner used junctions in that dedicated working
directory to avoid overwriting historical evidence. No staging/D2.5/D3/D4
operational mode was run. Disposable fixtures reproduce only the 16 accepted
migrations/permissions; they introduce no new application migration/grant/role.

Repeat with `node --run production:build`, `node --run test:signup`,
`node --run server:test:signup-isolated` and `node --run test:browser:signup`.
The isolated runner accepts no database target/operation flags and loads no
`.env`. It starts, witnesses and stops only its fresh nonce-owned loopback
cluster. Optional `BUDOGRAPH_PLAYWRIGHT_MODULE` and
`BUDOGRAPH_BROWSER_EXECUTABLE` select existing local browser tooling; the real
browser case is explicitly skipped without the module setting. The executed
passing evidence used both settings and had no skips. The standalone UI runner
serves the built artifact locally and closes its server/browser on completion.

## Files changed in this stage

- Backend: `server/src/config/env.ts`, `server/src/auth/signup.ts` (new),
  `server/src/auth/transactions.ts`, `server/src/routes/auth.ts`,
  `server/src/runtime.ts`, `server/.env.example`.
- Frontend: `src/auth/signup.ts` (new), `src/pages/SignupPage.tsx` (new),
  `src/i18n/signupMessages.ts` (new), `src/i18n/messages.ts`,
  `src/auth/AuthBoundary.tsx`, `src/pages/LoginPage.tsx`, `src/auth/auth.css`,
  `src/App.tsx`.
- Tests/tooling: `server/tests/public-signup.test.ts` (new),
  `server/tests/public-signup.integration.test.ts` (new),
  `server/tests/env.test.ts`, `src/auth/signup.test.ts` (new),
  `scripts/verify-d5-b1.mjs` (new), `scripts/verify-signup-ui.mjs` (new),
  `package.json` (three additive scripts).
- Documentation: this report, README, changelog, user guide, known limitations, test
  evidence and append-only AI assistance log.

Initial dirty/untracked paths and SHA-256 values are retained in
`baseline-status.txt` and `baseline.json` under the evidence directory. Existing
overlapping changes were extended; unrelated baseline changes and historical
reports remain intact. No dependency, asset or license was added; the existing
license register and GPL-3.0-only declaration are unchanged.

The final preservation comparison found **90 unchanged baseline files, seven
intentionally extended baseline files and zero unexpected changes/deletions**.
The original assistance-log and README prefixes still match their initial
SHA-256 values; `preservation.json` records the comparison.

## Remaining risks and independent review

No blocker remains for the authorized local implementation. Hosted enablement
is intentionally blocked. Local timing samples demonstrate a floor, not
constant-time behavior during arbitrary DB stalls, lock contention or outages.
Actual proxy/IP behavior, hosted timing distributions and inbox delivery remain
unverified. Existing Render Free sleep/worker limitations and finite email
budgets remain. The frontend build retains Vite's >500kB chunk warning; no bundle
restructuring was added to this auth stage. Browser checks used Chromium only;
no Safari/Firefox or formal screen-reader certification is claimed.

Independent D5-B1 review should inspect the stage diff against the dirty
baseline, gate OFF/production veto, narrow route/authority whitelist, controls
ordering and peer normalization, per-transaction DB witness, account/outbox
lock ownership, native-only hashing, enqueue rollback/unknown COMMIT handling,
duplicate status/body/headers/timing, unchanged D4 and invitation contracts,
frontend storage/error/focus behavior and Event-scoped authority. Reproduce the
isolated tests; review capacity exhaustion and shared-network quotas before
considering public access. Human review of AI-assisted code is still pending.

## Future separately approved staging work

First complete independent review and resolve findings. Then obtain explicit
authorization for a staging-only deployment with the gate OFF. A later reviewed
hosted-gate change must require the existing production-mode DB identity guard,
durable mail, exact ingress peer policy and approved staging identity. Verify
safe rollout/rollback, schema checksums and current runtime permissions before
any opt-in. No new migration/grant/secret is required by this local code.
Review sender/domain readiness, approved quotas and verification callbacks;
any real account/mail test needs its own explicit scope and synthetic recipient.
Production activation remains a separate decision.

The mandatory master prompt and all 30 pages of the supplied NOIT regulation
were read. Its 2025-2026 eligibility, GPLv3, delivery/availability, documentation,
assessment and schedule requirements are year-specific sources that need
verification for the actual later competition year. No legal compliance claim
or new official competition rule is made by this implementation.

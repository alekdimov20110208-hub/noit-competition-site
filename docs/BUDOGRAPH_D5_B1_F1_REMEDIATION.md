# D5-B1-F1 — Registration Final Remediation

**D5-B1-F1 REMEDIATION: READY** — local code and isolated verification only.

Date: 2026-11-01. Branch: `staging/render-free-d2-2`.
HEAD: `66b2bfcd772ad72ef9228c89a0926274397a5a62` (unchanged).
P2: **FIXED**. P3: **FIXED**. Ready for a focused final independent review.
No hosted signup activation or deployment is authorized by this report.

## P2 — Deployment configuration consistency

Previously, `readServerEnv()` accepted `NODE_ENV=development` with
`BUDOGRAPH_DEPLOYMENT_ENV=staging` and the signup flag `true`. The production
veto inspected only `NODE_ENV`; the staging origin/worker check did not enforce
production security mode. With a loopback runtime fixture, this contradictory
configuration could construct the signup capability.

`server/src/config/env.ts` now rejects unknown/empty deployment labels and
requires `NODE_ENV=production` whenever the explicit deployment label is
`staging` or `production`. Rejection also applies when signup is OFF. These are
the two existing hosted labels; no new deployment or activation mode was added.
The existing exact-boolean parsing, default `false`, production veto, database
TLS rules, staging origin/worker restrictions and runtime identity guards remain.

| Runtime                      | Deployment label               | Signup flag     | Result                                                                             |
| ---------------------------- | ------------------------------ | --------------- | ---------------------------------------------------------------------------------- |
| Missing / development / test | Missing                        | Missing / false | OFF                                                                                |
| Development / test           | Missing                        | true            | Existing local opt-in only; runtime identity/mail/control requirements still apply |
| Missing / development / test | staging / production           | Any             | Reject contradictory runtime                                                       |
| Any supported runtime        | Invalid / empty                | Any             | Reject deployment label                                                            |
| production                   | Missing / staging / production | Missing / false | OFF; other production guards still apply                                           |
| production                   | Missing / staging / production | true            | Reject; production veto retained                                                   |
| Consistent configuration     | Valid / missing                | Invalid boolean | Reject                                                                             |

No real environment file was read or changed. This proves default/parser behavior,
not the current state of any hosted environment. `server/.env.example` remains
`BUDOGRAPH_PUBLIC_SIGNUP_ENABLED=false`.

## P3 — Client email validation

The backend already enforced a 254-character total, a 64-character local part,
63-character domain labels and its ASCII syntax rules after trim/lowercase.
The client previously checked only total length and syntax.

`src/auth/signup.ts` now checks the missing local-part and domain-label limits.
Backend validation, normalization, database uniqueness and account records are
unchanged. Direct callers remain subject to the server's strict validator.

Tests compare the actual client and server validators for accepted/rejected
syntax, case/whitespace normalization, local lengths 64/65, domain and TLD label
lengths 63/64 and total lengths 254/255. Client-only tests also cover these limits.
At 320px, real Chromium tests in BG and EN submit the 65-character local part
using Enter: the localized alert receives focus, has the expected ARIA links,
preserves the fields and causes zero POSTs. Correction to 64 characters submits
once, normalizes case and continues to verification. Both new screenshots were
visually inspected; there is no horizontal overflow.

## Verification and evidence

Evidence: `tmp/d5-b1-f1-530de8a3-54bb-49f4-8fcd-de50ab709256/`.
Presentation report/screenshots: `tmp/d5-b1-ui-b8b0a48a-f726-4e13-a827-5e2366ab0536/`.

| Executed check                                                                         | Result                                                                                   | Raw evidence                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| New targeted tests against original implementation                                     | 7 pass / 3 fail, reproducing both findings                                               | `targeted-before.log`                                  |
| Targeted signup tests after fixes                                                      | 10 pass, zero skips                                                                      | `targeted-after.log`                                   |
| Server unit suite                                                                      | 233 pass, zero skips                                                                     | `server-unit.log`                                      |
| Existing frontend suite                                                                | 329 pass, zero skips                                                                     | `frontend-unit.log`                                    |
| Final targeted signup + static staging boundary tests                                  | 32 pass / 1 intentional skip                                                             | `targeted-final.log`                                   |
| D5-B1 + unchanged B0/F1 isolated PostgreSQL/browser suites                             | 31 pass, zero skips                                                                      | `postgres-browser.log`                                 |
| Isolated TLS/identity/startup/operations/runtime suites                                | 48 pass, zero skips                                                                      | `tls.log`, `tls/tmp/v1c5/all-sql-evidence.json`        |
| Browser presentation fixtures                                                          | 16 BG/EN/theme/width combinations plus interactions, including new BG/EN boundary checks | `ui.log`, presentation `report.json`                   |
| Server TypeScript and frontend/backend production build                                | PASS                                                                                     | `server-typecheck-final.log`, `build.log`              |
| Scoped TypeScript ESLint, syntax/browser execution, Prettier and Git whitespace checks | PASS                                                                                     | `lint-scoped.log`, `format-code.log`, `diff-check.log` |
| Migration file hashes against immutable manifest                                       | 16/16 match                                                                              | `migration-checksums.json`                             |

The final targeted run contains seven server signup tests and three client
signup tests; they overlap the suites above and are not additional unique tests.
Frontend coverage is 329 existing tests plus three signup tests (332 total).
The one skipped boundary test requires its separate compiled-staging opt-in;
no staging operational mode was run. The 48-test local TLS suite separately
exercised compiled production startup. Initial strict server TypeScript checking
identified an unchecked array index in the client validator imported by the
parity test; an explicit empty-local guard resolved it. Both logs are retained.
The build retains the pre-existing Vite warning about the >500kB main chunk.

The unchanged isolated suites exercise native Better Auth 1.7.7 credential
creation and login, durable email/network/global budgets, atomic
user/account/outbox creation, failed-enqueue rollback, duplicate/concurrent
registration and generic status/body/headers/timing-floor responses. They also
exercise verification-before-login, verification/resend, password recovery and
session revocation, invitation registration and explicit acceptance, empty
Dashboard/Create Event, Event budgets and scoped ORGANIZER authorization.
The bootstrap command itself was not rerun; existing-credential login and its
unchanged implementation were checked through fixtures and source preservation.
No new regression finding was observed. Timing floors do not prove constant-time
behavior under arbitrary hosted load.

Only fresh, witnessed, nonce-owned loopback PostgreSQL fixtures were used. They
reproduced the 16 accepted migrations and existing fixture permissions; no new
application migration/grant/role was introduced. All accounts, passwords and
mail were synthetic; provider delivery was mocked. Fixtures were stopped;
the D5 runner removed only its own fresh cluster. No staging/Production DB,
real account/mail, cloud configuration, D2.5/D3/D4 operation, commit, push or
deployment was used. Hosted proxy behavior, real inbox delivery, other browser
engines and formal screen-reader testing remain outside this verification.

## Changes and preservation

Only these existing files were extended:

- `server/src/config/env.ts`: two deployment consistency guards.
- `src/auth/signup.ts`: client email length checks.
- `server/tests/public-signup.test.ts`: configuration matrix and validator parity.
- `src/auth/signup.test.ts`: client email boundaries.
- `scripts/verify-signup-ui.mjs`: localized mobile/keyboard email boundary checks.
- `docs/AI_ASSISTANCE_LOG.md`: append-only task entry.

This report is the only new non-ignored file. The initial snapshot covers 599
files and 118 dirty/untracked entries. `preservation.json` checks the final
allowlist: 593 baseline files unchanged, six intentionally extended, no unexpected
change or deletion. Removing only the five code/test additions in memory restores
each exact pre-task SHA-256; reconstructed copies and `remediation-only.diff`
are retained under the evidence directory. The AI log's original byte prefix
is preserved. Prior reports/evidence, migrations/manifest, dependencies/lockfile,
native auth, transactions, budgets, routes, runtime identity, permissions,
recovery, invitations, Dashboard and Event code are unchanged from the baseline.

## Future staging deployment and separately approved activation

GO for focused final independent review and preparation of a separate staging
deployment plan with signup OFF. Deployment itself still needs separate approval.
No migration, grant, role or new secret is required by these two fixes. A future
plan must verify all 16 checksums, existing least-privilege runtime permissions,
the pinned non-Production DB identity, TLS, exact origin/ingress policy, durable
outbox/limits, worker/sender/domain readiness and approved delivery budgets.

**Environment-only activation cannot work with this code.** Staging must retain
`NODE_ENV=production`, but `readServerEnv()` rejects signup `true` in that mode.
Independently, `localSignupIdentity()` rejects production mode and every remote
DB. Changing NODE_ENV to development is now rejected for a declared hosted target.
Neither veto was relaxed in this task.

A possible later, separately approved minimal staging-only code change would:

1. Carry the validated deployment identity into the signup policy and allow an
   explicit opt-in only for `NODE_ENV=production` plus the exact approved staging
   identity; retain rejection for Production, missing/unknown hosted identity and
   all contradictory configurations, with OFF as the default everywhere.
2. Dispatch that approved staging case to a transaction-bound verifier of the
   pinned non-Production DB/project/host and least-privilege role. Preserve the
   current local-only witness for development/test; require durable mail and
   shared controls before constructing the capability.
3. Independently review negative Production/config/identity cases, public and
   native route closure, ingress/CSRF, atomicity, budgets and safe rollback.
   Deploy with the flag OFF first; activation and any real recipient/account
   smoke test require their own explicit approval and bounded plan.

This strategy is a proposal, not implemented code or approval. Production signup
activation remains outside scope. The mandatory NOIT 2025–2026 sources remain
year-specific and require verification for a later competition year.

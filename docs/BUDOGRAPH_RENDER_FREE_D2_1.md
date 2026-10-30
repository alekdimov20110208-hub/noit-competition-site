# BudoGraph D2.1 — Free Render staging preparation

Date: 2026-10-30. **D2.1 FREE STAGING: READY (local preparation only).**
Hosted startup/login/performance/email acceptance: **NOT VERIFIED**.
No deployment, service, payment method, commit, push or database operation is
authorized or performed by this stage. Live deployment remains gated by the
inputs below and separate owner approval. Original D2 results remain historical
evidence, not a claim of newly repeated tests.

## Active Free recipe

The complete configuration is the repository-root `render.yaml`:

```yaml
type: web
name: budograph-staging
runtime: node
plan: free
region: frankfurt
numInstances: 1
autoDeployTrigger: off
maxShutdownDelaySeconds: 120
buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm production:build
startCommand: pnpm production:start
healthCheckPath: /api/health/ready
```

This excerpt is explanatory, not a second Blueprint. Only root `render.yaml`
should be selected. The exact previous paid recipe is preserved in
`evidence/D2_RENDER_STARTER_REFERENCE.txt`, deliberately not a `.yaml` file.
No databases, Key Value/Redis, workers, cron jobs, disks, scaling rules, preview
resources, custom domains, pre-deploy commands or migration commands are defined.
`off` disables Git-triggered deployments; service creation and configuration
saves can still initiate a first deploy/redeploy. See the
[official Blueprint reference](https://render.com/docs/blueprint-spec).

## Exact hosting environment

Values marked **secure input** are entered later through the hosting dashboard;
no credential values belong in this document, Git, screenshots or build output.
`sync: false` entries in the Blueprint prompt for owner input. No deployment
credentials were retrieved or generated in this stage. Test keys are disposable,
generated only in memory by the verifier.

| Variable                        | Configuration / requirement                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`                  | `24.16.0`, existing D2 version                                                                                                                                                                                                                                                                                                                        |
| `NODE_ENV`                      | `production` (runtime security mode, even for test hosting)                                                                                                                                                                                                                                                                                           |
| `HOST`                          | `0.0.0.0`                                                                                                                                                                                                                                                                                                                                             |
| `PORT`                          | `10000`                                                                                                                                                                                                                                                                                                                                               |
| `WEB_CONCURRENCY`               | `1`                                                                                                                                                                                                                                                                                                                                                   |
| `SERVE_FRONTEND`                | `true`                                                                                                                                                                                                                                                                                                                                                |
| `REMINDER_WORKER_ENABLED`       | `false`                                                                                                                                                                                                                                                                                                                                               |
| `DATABASE_URL`                  | **Secure input:** activated `budograph_runtime` password-bearing PostgreSQL URL, direct or session pooler; database `postgres`; no query options. A session pooler username may be `budograph_runtime.bdcjascqqvzmmlvabhgv`. Never owner/migrator/service-role credentials or transaction pooler port `6543`. Percent-encode password URL characters. |
| `DATABASE_TLS_MODE`             | `verify-full`                                                                                                                                                                                                                                                                                                                                         |
| `DATABASE_TLS_CA_FILE`          | `/etc/secrets/database-ca.pem`                                                                                                                                                                                                                                                                                                                        |
| `EXPECTED_DATABASE_ID`          | **Secure-interface input:** existing owner-confirmed database UUID, exactly matching the 0015 identity row; not a new UUID generated at deploy time                                                                                                                                                                                                   |
| `EXPECTED_SUPABASE_PROJECT_REF` | `bdcjascqqvzmmlvabhgv`, existing D2 target pin                                                                                                                                                                                                                                                                                                        |
| `BETTER_AUTH_SECRET`            | **Secure input:** independent high-entropy secret, 32–512 characters, no whitespace; stable across restarts                                                                                                                                                                                                                                           |
| `BETTER_AUTH_URL`               | Owner-entered actual assigned HTTPS `onrender.com` origin, no path/query/credentials                                                                                                                                                                                                                                                                  |
| `PUBLIC_APP_URL`                | Explicitly the same origin as `BETTER_AUTH_URL`; do not use `budograph.com` while it points at Vercel                                                                                                                                                                                                                                                 |
| `EMAIL_MODE`                    | `resend`; production security mode rejects disabled/direct fallback                                                                                                                                                                                                                                                                                   |
| `EMAIL_FROM`                    | Owner-entered existing verified sender, bare email or `BudoGraph <email>`; sender/domain authorization must already exist because DNS changes are outside this stage                                                                                                                                                                                  |
| `RESEND_API_KEY`                | **Secure input:** server-only, domain-restricted sending key; confirm existing free quotas and no paid overage                                                                                                                                                                                                                                        |
| `RATE_LIMIT_HMAC_KEY`           | **Secure input:** canonical base64 of 32 independent random bytes; stable across restarts                                                                                                                                                                                                                                                             |
| `EMAIL_OUTBOX_KEY_ID`           | Owner-entered active key ID, 1–32 lowercase letters/digits/underscore/hyphen                                                                                                                                                                                                                                                                          |
| `EMAIL_OUTBOX_KEYS`             | **Secure input:** JSON object of 1–3 independent canonical base64 32-byte keys; must contain the active ID; retain older keys while corresponding jobs remain recoverable                                                                                                                                                                             |

`TRUSTED_PROXY_IPS` is optional and **omitted**: only independently verified
exact ingress IPs may be configured later. Current socket-IP limits are
conservative and can group testers behind the Render proxy. Do not trust `*`,
CIDRs or arbitrary forwarded headers. No `VITE_*`, `PGSSLMODE`,
`NODE_TLS_REJECT_UNAUTHORIZED`, `NODE_OPTIONS` or development provisioning
variables are required. Never add TLS-disable overrides. The package manager
remains `pnpm@11.9.0` in `package.json`; check that version in the first build log
and stop on a toolchain mismatch rather than updating the lockfile remotely.

Some fields have secure source defaults (`PUBLIC_APP_URL`, `EMAIL_MODE`,
`DATABASE_TLS_MODE`); this recipe deliberately supplies them explicitly.
Other credentials and identity fields fail closed when missing. Do not replace
the invitation-only model with public signup to compensate for absent accounts.

## CA delivery on Free

Render documents Secret Files at `/etc/secrets/<filename>`, including native Node
services, and lists environment variables/secret files on its Hobby plan.
The Free limitations do not exclude Secret Files. Thus the existing D2 path is
supported according to current documentation; it has **not been tested on a
provisioned Render service**.
[Secret Files](https://render.com/docs/configure-environment-variables#secret-files),
[pricing feature table](https://render.com/pricing),
[Free limitations](https://render.com/docs/free).

Later, obtain the provider CA bundle through the owner's authenticated provider
interface; independently verify its provenance/fingerprint and validity. In the
Render service's Environment → Secret Files, upload filename `database-ca.pem`
with only currently valid PEM CA certificates, under the combined 1 MB limit.
Render materializes the file for each runtime; this does not require a paid disk
and survives restarts through hosting configuration rather than local storage.
Do not paste any private key or store the CA in a source/build artifact. The D2
loader checks the file type/size, PEM structure, CA flag and dates, retains
`rejectUnauthorized: true` and Node hostname checking, and fails before DB I/O
if the file is unavailable. Never learn trust from the live endpoint.

No mounting fallback is currently required. If the actual Free dashboard cannot
provide Secret Files, stop the deployment and investigate under separate scope;
do not weaken TLS or purchase a plan. A possible separately reviewed fallback is
materializing an owner-verified CA from protected hosting configuration at
startup, outside the build/source tree, keeping the existing hostname verifier.
That fallback is not implemented or claimed necessary here.

## Remaining runtime prerequisites

- Owner must confirm the existing runtime LOGIN/password and `VALID UNTIL`,
  non-owner privileges, connection limit 4, and the single existing identity
  row. D2.1 neither queries nor changes their live state. If missing, the D2
  owner operations need separate authorization; never run them at startup or
  rerun the already consumed migration/verification attempts.
- The fixed D2 project/identity targets the existing Production database. A Free
  hosting label does **not** create an isolated staging database. Do not connect
  it until the owner separately approves that target and runtime effects. Do
  not silently repoint it or create a replacement database.
- Startup checks the 16 immutable migration checksums with SELECT only. The
  normal runtime still writes sessions, safety counters and encrypted outbox
  state, and its outbox worker can dispatch existing queued email as soon as it
  starts. Disabling reminders does not disable transactional email. Actual
  deployment therefore needs approval for these effects and controlled synthetic
  test data, as well as valid provider inputs.
- An empty database still needs the separately approved first Organizer/Event
  bootstrap from D2. No Production user was created here; development
  provisioning commands refuse Production. A health check alone does not prove
  that login can be used.
- One origin serves built React, `/api` and `/api/auth`. No Vercel proxy, CORS
  workaround, additional frontend service or domain cutover is needed.
- The temporary web address is publicly reachable by design; invitation-only
  authentication gates account/product access, not network access to the login
  page. Do not invite real users or publish the address for real use before
  separate public permission.

## Free limits and resource assessment

As checked on 2026-10-30, Free web compute is **512 MB RAM / 0.1 CPU**, one
instance. It sleeps after 15 minutes without inbound traffic and resumes on the
next request, often after about a minute. It can restart at any time. No
keep-alive pinging, external uptime polling to prevent sleep, or paid worker is
part of this plan. Reminder execution is disabled. The in-process outbox worker
runs only while the instance is awake: durable storage does not guarantee
continuous, timely or inbox email delivery, and long sleep can exhaust D2's
23-hour retry window. Free also blocks common SMTP ports; this application uses
the existing Resend HTTPS API. Local files are ephemeral.
[Free behavior and quotas](https://render.com/docs/free),
[compute plan specifications](https://render.com/docs/blueprint-spec#plan).

The build runs on **separate pipeline compute**, not inside the 512 MB web
instance. Hobby currently uses the included Starter pipeline (2 CPU / 8 GB RAM,
500 included minutes/month); this pipeline name is distinct from the archived
paid web plan. The existing sequential TypeScript → Vite → backend build passed
locally. The compiled Fastify/Vite routing harness used approximately 85 MiB
RSS in its initial successful run. This is a small offline routing check with
auth/DB stubs, **not** a full authenticated workload, a 512 MB memory cap test,
or a Free CPU benchmark. These observations make a first controlled Free trial
reasonable; full startup, password hashing, cold start, concurrency, peak RSS
and response latency must be measured on the actual host before claiming fit.
[Pipeline specifications and limits](https://render.com/docs/build-pipeline).

Stay on Hobby/Free and within existing Render, database and Resend free quotas.
Render grants 750 shared Free instance hours/month. Without a payment method,
quota exhaustion suspends services or prevents new builds; a workspace with an
existing payment method can incur bandwidth/pipeline overage. The owner must
confirm a no-payment-method workspace and remaining quotas before the future
trial. Do not add a card, upgrade, enable paid overage or bypass suspension.
No account/billing state was inspected or altered by D2.1.
[Quota exhaustion behavior](https://render.com/docs/free#monthly-usage-limits).

## Reproducible targeted local verification

Run from the repository root with installed locked dependencies and Node
24.16.0 / pnpm 11.9.0. No `.env` loading and no Production database URL:

```powershell
pnpm production:build
node scripts/verify-render-free.mjs
node --test server/tests/production.test.ts server/tests/d2-runtime.test.ts server/tests/database-tls.test.ts
git diff --check
```

The verifier fetches only the public official Render JSON schema, validates YAML
with the existing ESLint/Fastify tools, rejects extra services/resources/hooks,
checks explicit environment inputs and production commands, runs 13 compiled
negative-startup cases with network I/O blocked, and runs 14 compiled routing
checks against real Vite assets with explicit auth/database stubs. These are
separate assertions, not a new live PostgreSQL verification attempt. The 24
existing targeted tests additionally cover TLS hostname checks, fail-closed
configuration, same-origin serving, and exactly 16 local migration pins with a
SELECT-only fake database. The TLS refusal test uses an owned loopback socket,
not a PostgreSQL server. Full 48/222/329 suites are not repeated.

Actual final results and limits: `evidence/D2_1_FREE_STAGING_RESULT.json`.
Known Vite chunk warning (698.08 kB JS) remains; it is not a build failure.
No authentication model, runtime source, migration or dependency changes were
needed. A local diff/artifact secret scan and before/after file hashes verify the
D2.1 scope; this is not a historical whole-repository secret certification.

## First manual deployment — future owner action only

1. Review D2 and D2.1 source/evidence and approve their Git checkpoints separately.
   The current checkout already contains uncommitted D2 files. Avoid `git add .`;
   the unrelated `docs/market-research/docs - Shortcut.lnk` is excluded. The
   D2.1 file list in its evidence is incremental to that D2 checkout. Publishing
   the accepted revision to the connected Git provider requires separate push
   authorization; Render cannot deploy local-only changes from this computer.
2. After explicit approval for the test service, runtime target/effects and
   controlled access, confirm Hobby/no payment method/remaining free quotas.
   Create only one **Web Service**, native Node, Free, Frankfurt, one instance,
   repository root, with the exact build/start/health fields above and automatic
   deployments **Off**. Review the creation summary for `$0` and no extras. No
   custom domain. The assigned unique `onrender.com` hostname is authoritative;
   do not assume that the requested name will be available.
3. Prepare the verified CA and all dashboard inputs before a successful start.
   If Secret Files can only be added after creation, create initially **without
   runtime credentials** so startup fails closed. Upload the CA first while
   credentials remain absent; that save may trigger another failed deploy.
   Then enter the complete environment, using the assigned HTTPS origin for
   both URL fields. Use **Save only** where offered, and explicitly trigger
   **Manual Deploy → Deploy a specific commit** for the reviewed revision.
   Never use temporary dummy production credentials or disable TLS to get a
   green deployment. Creation itself can trigger an initial build despite Off.
4. Inspect the first successful build/start logs for the pinned toolchain,
   successful build, verified startup and listening port. A missing secret/CA,
   role/identity mismatch or migration drift is a stop condition, not permission
   to run SQL. Check readiness once, then `/login`, a deep link, a built asset,
   `/api/me` (401 unauthenticated) and `/api/auth/get-session`. Unknown API routes
   must never return SPA HTML. Do not enable recurring keep-alive health pings.
5. Separately authorize and perform controlled login/invitation/email acceptance
   only after an approved test identity/bootstrap exists. Verify secure cookies,
   mandatory verification, closed public signup, account safety and observed
   resource use. Real users and public release remain prohibited. If Free
   cannot run within quota/resources, stop and document the limitation; do not
   purchase or scale automatically. Keep Vercel and both existing domains intact.

The supplied NOIT rules are for **2025–2026**: group/category, dates,
documentation format and required online-access period require verification for
the actual participation year. This sleeping test service does not establish
competition-period availability. GPLv3 and the existing license register remain
unchanged; no dependency or asset was added.

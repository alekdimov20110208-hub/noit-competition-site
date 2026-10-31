# D3 — approved release candidate for Render Free staging

**Local release: READY. Hosted deployment: pending owner approval and private inputs.**
The owner's actual D3 runtime login report confirms PASS, TLS, staging identity,
ROLLBACK and connection close. D2.5 activation is complete. This preparation does
not repeat a database login, inspect, migration, bootstrap or create users.

## New service

Use `render.staging-d3.yaml`, branch `staging/render-free-d2-2`, repository root,
Node, Free, Frankfurt, one process, auto-deploy off, health `/api/health/ready`.
Create a **new** `budograph-staging-d3` service; confirm name availability and the
actual assigned HTTPS URL. Do not use root `render.yaml`, an existing service,
Production environment groups or custom domains.

Build:

```sh
corepack enable && corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm production:build
```

Start:

```sh
node server/dist/src/production.js
```

No pre-deploy command. Startup checks runtime identity and existing schema
read-only; it never migrates. The build includes frontend and backend, so the
first Render URL can also serve `/login` without waiting for Vercel.

Render supports a custom Blueprint path. Choose this YAML and staging branch
after publication, then approve creating/deploying only the new service. Creating
a service starts deployment; Secret File upload also triggers deployment.
Variables support **Save only**; auto-deploy off does not prevent those other
deploy triggers. [Blueprint reference](https://render.com/docs/blueprint-spec),
[environment settings](https://render.com/docs/configure-environment-variables).

## Owner-entered environment inputs

All other required non-secret names/settings are already pinned in the YAML.
Use separate staging secrets, entered privately in the new Render Dashboard:

| Variable              | Purpose / private owner input                                                             |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Activated staging runtime credential, transferred locally below; never owner credentials. |
| `BETTER_AUTH_SECRET`  | New independent high-entropy auth secret, at least 32 characters.                         |
| `BETTER_AUTH_URL`     | Actual new Render HTTPS origin, initially.                                                |
| `PUBLIC_APP_URL`      | Exactly the same origin as `BETTER_AUTH_URL`.                                             |
| `EMAIL_FROM`          | Owner-controlled, Resend-verified sender.                                                 |
| `RESEND_API_KEY`      | Restricted transactional sending key for that sender.                                     |
| `RATE_LIMIT_HMAC_KEY` | New independent 32-byte base64 secret.                                                    |
| `EMAIL_OUTBOX_KEY_ID` | Active key identifier: 1–32 lowercase letters, digits, `_` or `-`.                        |
| `EMAIL_OUTBOX_KEYS`   | JSON object mapping that identifier to a different new 32-byte base64 key.                |

Generate keys privately and retain them in the owner's password manager; do not
regenerate the outbox key on each deploy. `EMAIL_MODE=resend` is required at startup;
disabled email is rejected. Sender/key availability has not been verified here.

Upload public CA `D:\prod-ca-2021.crt` as Secret File `database-ca.pem` after
approval. Required SHA-256:
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
The YAML already sets `DATABASE_TLS_MODE=verify-full` and
`DATABASE_TLS_CA_FILE=/etc/secrets/database-ca.pem`. Never upload a private key,
local env file, DPAPI XML or owner credentials.

## DPAPI transfer without printing the credential

Local-only Git-ignored helper:
`C:\NOIT\noit-competition-site\tmp\d3-release\Copy-RenderRuntimeUrl.ps1`.
Default execution validates pinned activation/escrow/metadata/login report and
expiry without decrypting anything. It never connects to a network/database.

Helper SHA-256:
`4a6cc16481ff65fef528550e84b33053036c6c5e2576bccf614950cff3ac53df`.
Transfer does not extend the credential's existing database expiry.

After separate deployment/secret-transfer approval, open the **new staging**
service's empty `DATABASE_URL` value field. Disable clipboard history/cloud sync,
pause clipboard managers and close transcripts/screen recording. On the original
Windows user account run:

```powershell
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy RemoteSigned -File 'C:\NOIT\noit-competition-site\tmp\d3-release\Copy-RenderRuntimeUrl.ps1' -CopyToClipboard
```

It validates exact Attempt 4 artifact hashes and target, decrypts only in process
memory and copies the runtime URL to the clipboard for 60 seconds. Paste only
into the Render field. Keep the helper open: it then clears the clipboard if it
still contains its copied value. It never prints/writes the URL or changes the
escrow. If interrupted, clear the clipboard manually. DPAPI XML cannot be used on
Render/Linux. Never upload the helper/escrow or paste the value into chat.

## Minimal Git publication — only after approval

Base HEAD: `1a97ad88f4f1433536508c258a54641d76cca847`.
Nine changed/new release inputs (the owner additionally approved the exact
branch-specific Vercel exclusion):

```text
.gitignore
render.staging-d3.yaml
server/src/auth/auth.ts
server/src/config/env.ts
server/src/db/identity.ts
server/src/staging/target.ts
server/tests/staging-isolation.test.ts
docs/BUDOGRAPH_D3_RELEASE.md
vercel.json
```

Keep HEAD versions of `package.json`, lockfile, `scripts/production-build.mjs`
and root `render.yaml`; their unrelated local D2 tool changes are excluded.
No owner CLI, launchers, evidence, DPAPI or local secrets are added.

HEAD already tracks four historical machine evidence files. The release removes
**Git tracking only**, preserving all local originals. `.gitignore` excludes new
machine evidence/credential XML/claims. The resulting release snapshot contains
no machine evidence; past commits retain historical files without history rewrite.
Project test documentation such as `docs/TEST_EVIDENCE.md` remains.

After publication approval, run from `C:\NOIT\noit-competition-site`:

```powershell
$ErrorActionPreference = 'Stop'
function Git-Checked { & git @args; if ($LASTEXITCODE -ne 0) { throw 'STOP: Git operation failed' } }
if ((git branch --show-current).Trim() -cne 'staging/render-free-d2-2') { throw 'STOP: wrong branch' }
if ((git rev-parse HEAD).Trim() -cne '1a97ad88f4f1433536508c258a54641d76cca847') { throw 'STOP: base changed' }
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'STOP: index already contains changes' }
$release = @('.gitignore','render.staging-d3.yaml','server/src/auth/auth.ts','server/src/config/env.ts','server/src/db/identity.ts','server/src/staging/target.ts','server/tests/staging-isolation.test.ts','docs/BUDOGRAPH_D3_RELEASE.md','vercel.json')
$remove = @('docs/evidence/D2_1_FREE_STAGING_RESULT.json','docs/evidence/D2_2_SAFE_STAGING_RESULT.json','docs/evidence/D2_RENDER_STARTER_REFERENCE.txt','docs/evidence/D2_RUNTIME_RESULT.json')
$manifest = Get-Content -Raw -LiteralPath 'tmp/d3-release/release-manifest.json' | ConvertFrom-Json
if ($manifest.baseCommit -cne '1a97ad88f4f1433536508c258a54641d76cca847' -or $manifest.files.Count -ne $release.Count) { throw 'STOP: manifest mismatch' }
foreach ($f in $manifest.files) {
    if ($release -cnotcontains $f.path -or (Get-FileHash -LiteralPath $f.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256) { throw 'STOP: release input changed' }
}
$original = @{}; foreach ($p in $remove) { $original[$p] = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
Git-Checked add -- $release
Git-Checked rm --cached -- $remove
foreach ($p in $remove) { if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -cne $original[$p]) { throw 'STOP: local evidence changed' } }
Git-Checked diff --cached --check
$actual = @(Git-Checked diff --cached --no-renames --name-only)
if (@(Compare-Object ($release + $remove | Sort-Object) ($actual | Sort-Object)).Count -ne 0) { throw 'STOP: unexpected staged files' }
Git-Checked diff --cached --no-renames --stat
Git-Checked diff --cached --no-renames
# Review the displayed diff before the separately approved commit/push.
```

Then, only for that reviewed diff and publication approval:

```powershell
Git-Checked commit -m 'chore(staging): prepare D3 Render Free release'
Git-Checked push --set-upstream origin HEAD:refs/heads/staging/render-free-d2-2
```

No commit, index mutation or push occurred during preparation. Never use
`git add .`, commit-all, merge, force-push or a Production branch update. Before
approved publication, confirm existing hosting integrations will not deploy the
staging push unexpectedly. No Production hosting settings are changed here.

## Future separate Vercel staging frontend

Root `vercel.json` contains only `git.deploymentEnabled` with the exact key
`staging/render-free-d2-2: false`. It disables Git-triggered deployments for this
branch; other branches retain their default behavior. No `vercel.ts` or competing
wildcard rules exist. Keep the exclusion in the same incoming staging commit.
No Production Dashboard settings are changed. Before a future separately approved
Vercel staging deployment, explicitly review the intended deployment method and
this exclusion; do not remove it as part of the current Git release.
[Official Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled).

For the first deploy both URL variables equal the Render origin. Later, in a
separately approved **new Vercel project**, select one stable exact
`https://<staging-project>.vercel.app` origin and set both URL variables to it.
The staging guard now accepts that form; same-origin enforcement and Production
behavior remain intact. Better Auth trusts only that exact configured origin.
Cookies stay host-only Secure/HttpOnly/SameSite=Lax; public sign-up stays disabled.

In that separate project only, proxy `/api` to Render before the SPA fallback.
Replace the hostname placeholder with the actual new Render staging hostname:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://REPLACE_RENDER_STAGING_HOST/api/:path*"
    },
    { "source": "/((?!api(?:/|$)).*)", "destination": "/index.html" }
  ]
}
```

The current `vercel.json` has no routing settings; the JSON above is only a future
template. No existing Vercel project was changed. Frontend
requests remain relative `/api`, so the browser sees one origin and no credentialed
cross-origin CORS permission is needed/enabled. Retain API `Cache-Control: no-store`;
do not cache external API rewrites. Do not enable wildcard CORS or relax SameSite.
Canonical auth URLs use explicit server config, not forwarded headers; proxy IP
trust remains disabled pending exact verified IPs.
[Vercel rewrites](https://vercel.com/docs/routing/rewrites),
[Better Auth proxy guidance](https://better-auth.com/docs/concepts/cookies).

## Hosted acceptance, after deployment approval

Check `/api/health/live` and `/api/health/ready`: HTTP 200, `status=ok`; `/login`:
200; anonymous `/api/me`: 401. Health checks execute the normal read-only runtime
readiness check. [Render health checks](https://render.com/docs/health-checks).

A test account needs separate approved provisioning: activation created zero
users; the current provision CLI is development-only. This does not block the
first healthy backend URL. Later verify application sign-in, session, `/api/me`,
refresh and logout through the chosen frontend origin; retain no session secrets.

Free instances sleep after 15 idle minutes and cold start takes about a minute;
the reminder worker remains disabled. [Render Free](https://render.com/docs/free).

## Local verification

The candidate snapshot (HEAD plus the selected release inputs and four
Git-only evidence removals) built frontend/backend successfully using installed
dependencies. Server TypeScript and 30 targeted backend/staging tests passed,
including compiled fail-before-network checks. Six synthetic DPAPI/clipboard
tests passed; real escrow decryption and real clipboard transfer were not run.
The real escrow/receipt/login report passed the helper's non-decrypting preflight.
Release snapshot scanning found no real credentials, private key blocks, secret
files or machine evidence; non-secret placeholder/test URL literals remain in
existing documentation/tests. Fresh dependency installation and hosted startup
are deferred to the approved Render deployment. All preserved local evidence
retains its hash; the original Git index remains empty.

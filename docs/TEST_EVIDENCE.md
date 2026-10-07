# BudoGraph Test Evidence

## Optional Task due time — 2026-10-08

Baseline: `bfc405aafb955ddb9c50bf35bb40a9bb4cc3f9eb` (`fix(app): refine operational
visual hierarchy`). This extends required Event-local Task DATE with optional
minute-level wall-clock time. Event has a validated canonical timezone. Urgency,
attention, ordering, assignment/acceptance and Change authoring remain unchanged.

| Verification                        | Executed result                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration                           | PASS: immutable additive 0006 applied once; second run applied 0, recognized 6. All 100 pre-existing Task rows retained dates, versions and update metadata, with NULL times.                                                                                                                                                                                              |
| Frontend tests                      | PASS: 250 tests, 0 failed/skipped. Includes strict boundaries, malformed values, API mapping, BG/EN formatting, date-based urgency/order, current live impact and legacy date-only demo normalization.                                                                                                                                                                     |
| Backend tests                       | PASS: 126 non-integration tests; 12 opt-in integration parents skipped by default, exercised by the separate database run.                                                                                                                                                                                                                                                 |
| PostgreSQL integration              | PASS: 96 checks, 0 failed/skipped with RUN_DATABASE_INTEGRATION=1. Includes migration fixture/actual types, NULL/time persistence, add/change/remove, atomic date+time, conflicts, isolation, authority, acceptance and unchanged live Change version/history.                                                                                                             |
| Authenticated due-time browser flow | PASS: UI date-only create → 16:00 → 18:30 → remove → 23:59; refresh persistence; midnight create; clearing saves NULL; accepted responsibility preserved; one version/history row per edit; current no-op; real two-tab stale 409; Change current time without Change writes; malformed text/API rejection; Member denial; network failure; field error/focus association. |
| Responsive feature matrix           | PASS: 20 combinations of 1440/1080/768/390/320 × BG/EN × Light/Dark, covering create/edit/removal, Task list/details, date-only Tasks, Dashboard and Change impact. No horizontal overflow or application errors.                                                                                                                                                          |
| Visual Refinement V1                | PASS: 32 exact baseline/current PNG pairs (Tasks, Dashboard, Changes, Team at 1440/320 × BG/EN × Light/Dark); 32 pixel-identical, 0 differences. Global styles are byte-unchanged. Timed metadata and forms inspected visually at desktop and 320px.                                                                                                                       |
| Auth experience                     | PASS: existing 222 presentation cases and 20 interaction checks; 0 application/console errors.                                                                                                                                                                                                                                                                             |
| P4A browser behavior                | PASS: existing 180 mocked presentation/account-safety cases. Real Better Auth/PostgreSQL fake-mail behavior passed within the database suite. External Resend/domain/DNS gate NOT RUN; P4A remains PARTIAL.                                                                                                                                                                |
| Locked browser regression suites    | PASS: all nine existing authenticated suites: Auth, Task reads, responsibility/actions, workspace, Events, Task authoring, invitations, Changes and Change Dashboard. Includes 60 Change presentation and 120 Dashboard role/surface cases, four long-name stress fixtures and keyboard checks.                                                                            |
| Standard quality                    | format, format:check, lint, typecheck, test, build, server:typecheck, server:test, server:build and server:test:integration have passed. git diff --check also passes; staged secret audit is recorded separately below.                                                                                                                                                   |
| Secret/dependency audit             | Unstaged and staged audits PASS: source/frontend bundle exclude configured private values and bearer URLs; no new dependency, historical migration edit, P4A implementation edit or global-style edit. Staged diff reviewed; shortcut, local configuration and temporary evidence excluded.                                                                                |

Evidence lives in ignored `tmp/task-due-time-evidence`, `tmp/due-time-*.log`.
Browser data is clearly synthetic and intentionally retained; credentials/cookies
stay in memory. Early verifier attempts included a selector mismatch and a run
interrupted by the development backend's restart during formatting; the full stable
due-time run subsequently passed. An existing schema/read SQL test projection was
extended to select the new field rather than weakening its assertions. The initially
native time control displayed browser-locale AM/PM; visual review led to the final
plain HH:mm input with direct malformed keyboard-entry coverage. Screenshots and
temporary baseline sources are not committed. Two initial Dashboard regression
attempts did not complete: one real GET /api/events HTTP 500, and one Changes-list
timeout with the captured unavailable sign-in state during a development backend
process restart. Fresh diagnostics passed 60 authenticated API reads and 20 direct
PostgreSQL Event reads across both roles, with healthy readiness. The same backend
and configuration were temporarily run without file watching; the entire unchanged
Dashboard suite then passed all 120 matrix cases with read-only request diagnostics,
and the dedicated due-time suite passed again. Development watch mode was restored
after verification. The first isolated HTTP 500 was not reproduced and its underlying
cause was not established. No assertion was relaxed to obtain the pass.
No physical-device validation or
formal accessibility certification is claimed. The existing Vite >500 kB chunk
warning remains; builds succeed. Production migration/deployment and the separate
P4A external gate are not claimed. 2025–2026 competition rules require later-year
verification before participation.

## P4A production email and account safety — 2026-10-06

Baseline `4b81543`. Complete mandatory sources read; 2025–2026 competition rules
remain actual-year verification items. No dependency upgrades/additions, migrations,
blanket emailVerified changes or real mail sends. Resend configuration was absent.

- Frontend unit regression: **245/245 PASS**, zero skipped.
- Backend standard test command: **124 PASS**, zero failures; **11 database suites
  skipped** without opt-in. The separate real PostgreSQL run below covers them.
- `pnpm server:test:integration` with database opt-in and ignored local config:
  **90/90 PASS**, zero skipped, including real Better Auth 1.7.7 verification/reset
  and P1/P2/P3 transactions/authorization/races. Log: `tmp/p4a-integration-final.log`.
- Focused P4A database suite: **6/6 PASS**, fake mail; verification valid/invalid/
  expired, required-email enforcement, matching explicit MEMBER join, wrong-account
  denial, existing-user resend, generic known/unknown recovery, password changes,
  old/new password behavior, reset expiry/replay and all-session revocation.
- Provider/HTTP unit checks cover Resend acceptance/rejection/network/malformed
  results, sanitized errors/logs, BG/EN HTML/plain text, escaped Event names, trusted
  origins/callbacks, production bearer omission on success/failure, scoped resend,
  configuration failures and deterministic IP/identity limits. No real provider used.
- P4A browser fixtures: **180 state/language/theme/width cases PASS**, zero page
  errors; BG/EN, light/dark/system, 1440/1080/768/390/320, labels, heading/state focus,
  minimum 44px targets and no horizontal overflow. Recovery, verification-needed,
  generic confirmation, mismatch/success, throttle feedback and no token storage
  interactions PASS. Evidence: `tmp/p4a-evidence/browser/report.json` and screenshots.
- Real existing Auth browser: **15 checks and 20 responsive cases PASS**, zero
  application/console errors, closed signup, HttpOnly sessions and logout.
- Real invitations browser: **7 grouped checks**, **20 recipient + 20 dialog cases
  PASS**, zero application errors; onboarding, fixed email, explicit join, assignment/
  acceptance, concurrency, membership isolation, revocation/expiry and spoofed inputs.
- Existing Auth Experience presentation suite: **222 cases and 20 checks PASS**,
  zero application/console errors. Mock presentation evidence is not real mail proof.
- Real shared workspace regression PASS: Dashboard/Team reads and navigation,
  Organizer/Member boundaries, zero business mutation requests and safe 401/errors.
- Real P3 Dashboard regression PASS: **120 role/surface/language/theme/width cases**,
  **24 text-contrast checks**, four labelled long-name fixtures and keyboard/Back
  navigation; authoring, attention independence, stale reads, scope isolation and
  safe failure recovery passed, with zero application/console errors.
- Final `pnpm format`, `format:check`, `lint`, `typecheck`, `test`, `build`,
  `server:typecheck`, `server:test`, `server:build` PASS. After final callback/copy
  safeguards, focused real P4A database **6/6** and UI **180 cases** were rerun PASS.
  `git diff --check` PASS. Source/frontend bundle secret audit PASS; no source maps,
  dependency/migration changes or locked product surface changes found. The staged
  audit is repeated before commit. Build succeeds with the existing >500kB chunk
  warning (518.86kB JavaScript, 144.38kB gzip); code splitting is outside P4A scope.

Representative new desktop and Bulgarian mobile screenshots were visually inspected.
This is agent/browser evidence, not physical-device testing or formal certification.
The first new database adapter committed a disposable fixture before savepoint
mapping was corrected. No destructive cleanup was run. Its synthetic data is retained;
subsequent P4A fixtures roll back. The initial expiry fixture depended on SQL SET
evaluation timing and was corrected to a deterministic past expiry before the clean
90-test run. Existing browser/concurrency fixtures are retained by design.

REAL EMAIL HUMAN GATE: **NOT RUN**. Domain/DNS/verified sender/API key setup and
tester-owned inbox invitation → verification → explicit join → recovery remain
required. See BUDOGRAPH_P4A.md for instructions, exact files, security contracts and
known process-memory/restart/proxy/provider limitations. Historical evidence below
keeps its original scope.

## P3C Dashboard integration and Change clarity — 2026-10-06

Authorized baseline: `51a9b51c9044edd74609c64978a03643ab407cc1`; fetched main
matched origin/main, 0/0 and tracked clean before work. The complete master prompt
and all 30 supplied regulation pages were reread. All year-dependent 2025–2026
eligibility, team/category, dates, online availability, PDF, GPLv3/deliverable and
scoring requirements require actual-year verification. See BUDOGRAPH_P3C.md for
the narrow approved contract. Historical evidence below keeps its original scope.

### Implemented data and clarity

The disconnect was the shared presentation adapter's hardcoded legacy empty
Changes/false-persistence projection and the prototype-shaped Dashboard component.
The existing client workspace now composes validated canonical current-Event
`GET /api/events/:eventId/changes` DTOs separately from Task/Team view data. No new
server endpoint, migration, stored status or copied impact model is introduced.

Operational Changes orders by updatedAt descending then ID, keeps one collapsed
preview with the existing continuation, and shows title, current affected Task
count, response owner/unassigned, updated time and a durable detail link. One plain
authored-presence label replaces prototype response semantics. Personal attention
has at most one reason per Change: Organizer/unowned; otherwise own/no Decision;
otherwise own/Decision without Response. Missing Plan B alone never qualifies.
Automatic Dashboard reentry refresh is skipped while a Task command needs explicit
recovery, preserving confirmed data, stale warnings and disabled Task writes.
Task attention keeps its selector/order; P3 items append as separate coordination
reasons. Response ownership and descriptive operational role grant no permissions.

Detail reads Change/context → live impact → response owner → Decision → Response
→ optional Plan B. Short associated BG/EN explanations distinguish ownership from
Task assignment and describe the three authored fields. List state is plain text,
not a badge, workflow or severity system. P3A/P3B state/version/history remain intact.

### Executed checks

| Command / scope                                                     | Result                                                                                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `build`     | PASS. Build retains the existing 500 kB chunk advisory: 507.37 kB JS / 141.65 kB gzip.                                                                                      |
| `pnpm.cmd test`                                                     | 242 passed; 0 failed/skipped. Six new coordination tests and four composition/isolation tests extend the existing 232 tests.                                                |
| `pnpm.cmd server:typecheck`, `server:build`                         | PASS; server implementation is unchanged.                                                                                                                                   |
| `pnpm.cmd server:test`                                              | 115 passed, 0 failed; 10 PostgreSQL entrypoints intentionally skipped without opt-in, 125 total.                                                                            |
| `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration`       | PASS: 84 real PostgreSQL tests, 0 failed/skipped; all existing P1/P2/P3A/P3B schema, authorization, transaction, history and concurrency checks.                            |
| `git diff --check` and supplemental script/Changelog Prettier check | PASS.                                                                                                                                                                       |
| `pnpm.cmd test:browser:change-dashboard`                            | PASS: 8 workflow groups, 120 real layout cases, 24 real contrast cases, 4 labeled long-name fixtures; zero application/non-resource console errors.                         |
| `pnpm.cmd test:browser:auth`                                        | PASS: 15 checks, 20 layout cases; zero errors.                                                                                                                              |
| `pnpm.cmd test:browser:tasks`                                       | PASS: 13 checks, 5 widths; zero errors/writes.                                                                                                                              |
| `pnpm.cmd test:browser:events`                                      | PASS: 14 checks, 20 layout cases; zero errors.                                                                                                                              |
| `pnpm.cmd test:browser:task-authoring`                              | PASS: 11 checks, 20 Create/Edit layout cases; zero errors.                                                                                                                  |
| `pnpm.cmd test:browser:task-actions`                                | PASS: 16 checks, 40 Organizer/Member layout cases, zero application errors; locked explicit Task recovery verified after the guard correction.                              |
| `pnpm.cmd test:browser:invitations`                                 | PASS: 7 workflow groups, 20 recipient and 20 loaded-dialog cases; zero errors.                                                                                              |
| `pnpm.cmd test:browser:changes`                                     | PASS: 11 P3A/P3B workflow groups, 60 real list/detail/form cases and 4 labeled long-BG fixtures; zero application/non-resource console errors.                              |
| `pnpm.cmd test:browser:workspace`                                   | PASS: 11 checks, 8 layout cases; zero errors or business writes. Updated canonical Changes assertions and all prior Task/Team checks pass.                                  |
| Existing `verify-changes-ui.mjs --read-checks`                      | PASS: 2 read/draft workflow groups, 12 real BG/EN Light/Dark text and field/focus contrast cases, associated validation focus and retained failed-save drafts; zero errors. |
| Existing `verify-auth-experience-ui.mjs`                            | PASS: 222 labeled presentation states, 20 keyboard/focus cases, zero errors.                                                                                                |

Focused real backend/role scenarios cover unowned Organizer, own missing Decision,
own missing Response, Decision/Response without Plan B, prepared fallback, another
owner, Member response owner with no authoring/direct 403, and independent Task
attention. UI owner → Decision → Response → Plan B saves advance/clear attention
without changing Task state or its attention. Current API counts, owner, update
ordering, durable title and attention routes match rendered records. Refresh and
Dashboard reentry use canonical reads; Back/Forward and Event switches preserve
scope. Foreign reads fail closed; a labeled held former-Event Change read cannot
publish under the new Event. Safe server/network failure mocks clear P3 content,
retain Task signals, expose retry and never claim a false zero or use demo data.

The 120 cases are Dashboard/detail/list × Organizer/Member × 1440/1080/768/390/320
× BG/EN × Light/Dark, including expanded continuation and a real long BG title.
Checks cover unclipped document/element overflow with body clipping temporarily
disabled, horizontal panning, 44px links/controls, associated descriptions and
read-only semantics. Twenty-four real text-contrast cases include all new P3 copy.
The lowest measured text ratio is 5.34:1.
Four separate mocked long BG/unbroken owner-name cases at 390/320 in both themes
are explicitly presentation fixtures. Keyboard modality, visible focus, Enter
navigation, durable Back and absence of nested interactive controls are checked.
Fresh read-only semantic/visual review is Codex evidence; external human usability
or product acceptance, physical-device coverage and formal certification are not claimed.

### Locked presentation, preservation and failed attempts

Frozen baseline UI was served with its unchanged source and a separate ignored Vite
cache. Twenty Dashboard structural comparisons cover all five widths, languages
and themes: section order, typography, surfaces, borders, padding/gaps, left/width,
unchanged overview/focus/timeline geometry and unchanged Team Pressure dimensions
and gap below dynamic Change content. New content changes Change height and the
following section's absolute Y; full Dashboard pixel equality is not asserted.
Forty Tasks/Team captures and twenty Auth captures are exactly pixel-identical.
Sixty unaffected overview/focus/timeline section captures also match exactly.
Twenty Team Pressure interiors match after outer-position normalization and
excluding the one-pixel screenshot boundary; four normalized raw crops have only
capture-edge differences. Unnormalized Pressure screenshots are not pixel-identical.
Twenty-four sidebar geometry/style/control/keyboard comparisons pass, including
short-height scrolling. Thirteen sidebar screenshots match exactly; eleven differ
only in a one-pixel-wide strip beside the existing Event-context border. No shell,
shared stylesheet, Tasks, Team or Auth implementation changed. Raw differences
are retained rather than represented as exact pixel passes.

A read-only SQL check confirms the original human-created P3A Change's title,
version, timestamps, owner and Task links match its original evidence, with empty
P3B state. Existing rows are not recreated or reset. Synthetic browser records
are retained; opt-in integration fixtures follow their existing rollback/cleanup contract.

Early frontend runs found obsolete projection assertions and a three-request
expectation; these were updated for the canonical fourth read, then 242 tests passed.
The first focused browser attempt used visible text on collapsed rows; DOM text
checks retain the canonical assertions. Its second attempt passed the complete
matrix but asserted focus-visible in pointer modality; the full final rerun passes
with keyboard modality. Old workspace transport doubles mixed synthetic Tasks with
unmocked real impact, or expired before Dashboard reentry; explicit consistent
Change fixtures now persist until navigation checks finish. A concurrent workspace
snapshot also observed a synthetic Task created by task authoring. An overlapping
Auth attempt timed out; its subsequent isolated rerun passed. Failed attempts are
not counted as complete passes; final shared-data checks run after write suites.
The first responsibility run caught a real regression: automatic Dashboard
reentry refresh cleared the existing Task conflict-recovery state. App now skips
that automatic refresh while explicit Task recovery is required. The focused P3C
verifier and affected quality/regression gates are rerun after this correction.
The final serial browser sequence passes every suite, including the complete P3C
matrix on the corrected guard and CSS restricted to P3 coordination rows. A prior
overlapping post-correction run hit unavailable Change reads and a stale-state
check failure; those attempts remain failures, not substituted for the serial pass.

No dependencies, applied migration, secret files, infrastructure, AI, realtime,
polling, notification, email, Templates or Budget changes are added. Source/diff/
production-bundle/log/report and final staged-scope audits pass against five private
environment values and the exact 32-file manifest. Locked source and dependencies
remain unchanged. Browser
artifacts and bearer URLs are not staged. The known unrelated shortcut remains untouched.

### Exact P3C file manifest

```text
CHANGELOG.md
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/BUDOGRAPH_P3A.md
docs/BUDOGRAPH_P3B.md
docs/BUDOGRAPH_P3C.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/PRESENTATION_OUTLINE.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-change-dashboard-ui.mjs
scripts/verify-workspace-ui.mjs
src/App.tsx
src/domain/changeCoordination.test.ts
src/domain/changeCoordination.ts
src/i18n/changeMessages.ts
src/i18n/messages.ts
src/pages/ChangesPage.tsx
src/pages/DashboardPage.tsx
src/pages/changes/changes.css
src/pages/dashboard/ChangeImpact.tsx
src/pages/dashboard/ChangeReadNotice.tsx
src/pages/dashboard/OperationalFocus.tsx
src/pages/dashboard/integration.css
src/services/RemoteWorkspaceService.ts
src/services/eventActions.test.ts
src/services/taskReads.test.ts
src/services/workspaceViews.test.ts
src/services/workspaceViews.ts
```

## P3B Decision, Response and Plan B — 2026-10-05–06

Authorized starting HEAD: `112fe48300082d2963c22da0eb3ec2075cb33d7f`.
Fetched main matched origin/main, ahead/behind 0/0 before implementation. The
complete master prompt and all 30 supplied regulation pages were read; the
detailed request authorizes this narrow model, flows, architecture and tests.
P1/P2/Auth and P3A contracts remain locked. See BUDOGRAPH_P3B.md for the current
contract; later sections retain evidence from their named historical phases.
Supplied 2025–2026 eligibility, schedule, category, availability, PDF, GPLv3 and
scoring rules require verification for the actual participation year.

### Executed automated and migration evidence

| Command / scope                                                 | Executed result                                                                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd db:migrate`, then repeat                              | 1 applied / 4 already applied; repeat 0 applied / 5 already applied. Applied migration files unchanged.                                                                           |
| `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `build` | PASS. Initial formatter attempt hit a transient Windows file-access error; retry completed successfully. Build emitted the 500 kB chunk advisory (502.60 kB JS / 141.15 kB gzip). |
| `pnpm.cmd test`                                                 | 232 passed, 0 failed/skipped; eight Changes adapter tests retain all six P3A cases.                                                                                               |
| `pnpm.cmd server:typecheck`, `server:build`                     | PASS.                                                                                                                                                                             |
| `pnpm.cmd server:test`                                          | 115 passed, 0 failed; ten real-PostgreSQL entrypoints intentionally skipped without opt-in (125 total).                                                                           |
| Focused P3B validation/adapter tests                            | 12 passed: four backend and eight frontend tests, included in totals above.                                                                                                       |
| `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration`   | Final rerun: 84 passed, 0 failed/skipped, real PostgreSQL; includes 11 new P3B tests and all 73 P1/P2/P3A integration checks.                                                     |
| `git diff --check`                                              | PASS.                                                                                                                                                                             |

All seven real backend browser regressions completed successfully:

| Command                                | Executed result                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm.cmd test:browser:auth`           | 15 checks, 20 layout cases; zero application/non-resource console errors.                              |
| `pnpm.cmd test:browser:workspace`      | 11 checks, 8 layout cases; zero errors or writes. Dashboard/Tasks/Team and Event navigation preserved. |
| `pnpm.cmd test:browser:tasks`          | 13 checks, 5 widths; zero application errors or writes.                                                |
| `pnpm.cmd test:browser:events`         | 14 checks, 20 layout cases; zero application errors.                                                   |
| `pnpm.cmd test:browser:task-authoring` | 11 checks, 20 Create/Edit layout cases; zero application errors.                                       |
| `pnpm.cmd test:browser:task-actions`   | 16 checks, 40 Organizer/Member layout cases; zero application errors.                                  |
| `pnpm.cmd test:browser:invitations`    | 7 workflow groups, 20 recipient and 20 dialog cases; zero application errors.                          |

These retain the existing verifier assertions for real sessions, Event scope,
Task ownership/acceptance/lifecycle, stale conflicts, pending/failure behavior,
invite-only registration, token-hash storage, wrong-account/expired/revoked/guessed
invites, closed public signup and Origin/forged-authority defenses. Transport
doubles are explicitly labeled. P3A create/edit, current Task impact, owner,
version and isolation are included in the extended Changes verifier above.

The first full integration attempt reported 67 passes and one failure: the
schema inventory assertion still listed four migrations and blocked its remaining
schema subtests. That assertion and its already-applied count were updated to
include `0005_change_response.sql`; all prior schema/security assertions remain.
The initial attempt is not counted as a pass. The complete rerun passed all 84
tests after this test-only correction; the earlier subset is not treated as complete.

Read-only before/after SHA-256 fingerprints cover every existing P3A Change
column and Task link, including the original human-created Change. Migration
preserved every fingerprint and populated safe null P3B defaults. A later scoped
SQL read confirms the human Change's original title, version, timestamps, owner
and links still match its P3A evidence, with empty P3B state. No existing records
were recreated, deleted or reset. Rollback-only fixtures are transient; synthetic
concurrency/browser fixtures and their append-only activity are retained.

Focused PostgreSQL checks verify optional/partial state, independent add/edit/clear
of all three fields, one aggregate version/history entry per meaningful command,
server Decision provenance, current no-op preservation and stale no-op 409,
response-owner independence, Task deadline/reassignment/status independence,
Member read-only even as response owner, inactive/foreign access denial, forged
authority/provenance rejection, parameterized adversarial text, SQL bounds and
same-Event author constraints. History insertion failure rolls back the complete
create/edit. A second authorized Organizer becomes the current Decision revision
author; unrelated edits retain provenance. No Task writes occur in the Change service.

The concurrency fixture uses two independently pinned PostgreSQL connections with
different backend process IDs. Simultaneous Decision vs Response/Plan B edits at
one expectedVersion yield exactly one winner and one 409. Canonical state equals
the winner; no partial response update or losing activity is persisted. Only
creation plus one meaningful update exist. P3A concurrency tests remain intact.

### Executed Changes browser, accessibility and visual evidence

`pnpm.cmd test:browser:changes` passed **11 workflow groups**, **60 real cases**
(list/detail/form × 1440/1080/768/390/320 × BG/EN × Light/Dark) and **four labeled
long-text fixtures** (320/390 BG × both themes). Installed Edge/Chromium runs at
100% scale with externally supplied Playwright. No browser dependency was added.

Real authenticated backend/PostgreSQL workflows cover clean empty creation,
linked impact, Decision → Response → Plan B, partial states, persisted refresh,
Decision revision/provenance, associated whitespace validation, clearing/restoring
all authored state, existing Task deadline UI and reassignment/status commands,
unchanged response state/version after Task edits, unchanged Tasks after response
or owner edits, and existing P3A title/context authoring. Two real browser tabs
produce a 409: all three local drafts remain, save is blocked, conflict receives
focus/announcement, and explicit reload replaces the draft with canonical data.
Member response owners read all fields without edit controls and receive direct
403 on each authored field. Event switching, foreign detail, refresh/back/forward,
direct URLs and newly invited existing-Member read-only onboarding pass.

Labeled transport doubles verify safe network/server errors, stale-content removal,
explicit retry and no demo fallback. Long-text fixtures include bounded Decision,
Response and Plan B prose and long BG Task/member/title content; these are not
represented as database-authored data. HTML/body widths, off-screen rectangles,
test-only removal of body clipping, both panning directions, visual viewport,
44 px controls, wrapping and vertical reachability pass. Semantic headings,
textarea labels/help/errors, keyboard selection, Escape/cancel and focus restoration
are exercised. Application errors: **0**; non-resource console errors: **0**.
Seven expected resource errors occur only in deliberate denied/conflict/failure cases.

`pnpm.cmd test:browser:changes --read-checks` passed two additional groups and
**12 BG/EN Light/Dark list/detail/form-error contrast cases**. Minimum measured
text contrast is **5.10:1**; field-boundary/focus and associated validation checks
pass, including all three new textareas. Labeled network/500 failed-save doubles
retain title and all response drafts, announce safe errors and never replay writes.
Application/non-resource errors: 0; three expected failed-resource messages.
Desktop EN light detail, 320 BG dark detail and 320 BG light form screenshots were
visually inspected. No human usability acceptance, physical-device coverage or
formal accessibility certification is claimed.

Sixty deterministic, labeled locked-page captures (Dashboard/Tasks/Team × all five
widths × BG/EN × Light/Dark) match P3A pixel-for-pixel, **60/60**. The unchanged
auth presentation verifier passed **222 layout cases** and 20 keyboard/focus
checks using labeled read-only fixtures. Sidebar verification passed 24
1440/1080 × 900/740/720 height × BG/EN/theme cases and short-height 560 px
scroll/footer/logout reachability. Locked auth/shell/sidebar/Invite styles are unchanged.

Ignored local evidence lives in `tmp/p3b-evidence/` (browser/read-check reports,
migration fingerprints, scoped SQL result and pixel comparison). Credentials,
cookies and invitation bearer paths remain in memory; no database dump or secret
artifact is staged. Tests run here do not establish production deployment,
least-privilege grant certification or current competition-year compliance.

The security review confirms Event-scoped Change/response-state IDOR protection,
active Organizer authority from database membership, active-Member reads, inactive
denial, strict body whitelists, parameterized SQL, server clocks, small safe errors,
unchanged trusted-Origin/Fetch Metadata checks and no-store responses. Response
ownership and operational role grant no permissions. Activity payloads contain no
session/cookie/bearer data. Source, diff, production bundle, logs and report JSON
were audited against private environment values and private-key/JWT/database-
credential patterns; saved logs/reports also exclude invitation bearer paths.
The final staged audit checks the exact manifest and unchanged dependencies.

### Exact P3B change manifest and boundaries

The final scoped change contains these **25 files**:

```text
CHANGELOG.md
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/BUDOGRAPH_P3A.md
docs/BUDOGRAPH_P3B.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/PRESENTATION_OUTLINE.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-changes-ui.mjs
server/migrations/0005_change_response.sql
server/migrations/README.md
server/src/changes/model.ts
server/src/changes/service.ts
server/tests/change-response.integration.test.ts
server/tests/changes.test.ts
server/tests/schema.integration.test.ts
src/i18n/changeMessages.ts
src/pages/ChangesPage.tsx
src/pages/changes/changes.css
src/services/changes.test.ts
src/services/changes.ts
```

No runtime/development dependencies, lockfile, external assets, auth/session code,
locked Dashboard/Tasks/Team components, shared palette, sidebar/switcher, Invite
dialog, previous migration, routes or RLS policy changed. package.json only adds
the P3B contract document to the existing formatter scope. License register needs
no new entries. Documentation covers state semantics, version/history, independent
response ownership, independent live Tasks, setup/migration, guide, demo and presentation.
No automatic Plan B execution, automatic Task mutation, AI, notifications, email,
polling, realtime, Templates, Budget or deployment was added. The unrelated untracked
`docs/market-research/docs - Shortcut.lnk` is left untouched.

## P3A Change records and impact mapping — 2026-10-05

Authorized starting HEAD: `3c28c20c36c8c69a75ebe6cbfa9bd3e0cd6abc15`.
Fetched `main` matched `origin/main`, ahead/behind 0/0 before this change. The full
master prompt and all 30 supplied regulation pages were read. The detailed request
authorizes the P3A model, flows, architecture, test strategy and implementation.
P1/P2A/P2B/P2C/Auth designs remain locked; P3B / Plan B is not implemented.
2025–2026 eligibility, schedule, categories, availability, formatting, GPLv3/
deliverable rules and scoring must be verified for the actual participation year.

### Executed automated and migration evidence

| Command / scope                                                 | Executed result                                                                                                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd db:migrate`                                           | 1 migration applied, 3 already applied; repeat: 0 applied, 4 already applied. Previous migration files/checksums unchanged.                                             |
| `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `build` | PASS. Vite production build completed.                                                                                                                                  |
| `pnpm.cmd test`                                                 | 230 passed, 0 failed/skipped; includes six focused Changes adapter/route/localization tests.                                                                            |
| `pnpm.cmd server:typecheck`, `server:build`                     | PASS.                                                                                                                                                                   |
| `pnpm.cmd server:test`                                          | 114 passed, 0 failed; eight integration entrypoints intentionally skipped without their opt-in flag (122 total).                                                        |
| `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration`   | 73 passed, 0 failed/skipped, against configured real development PostgreSQL; includes 11 P3A checks and existing P1/P2A/P2B/P2C regressions.                            |
| Focused Change offline tests                                    | Three passed: authored whitelist/validation, deterministic derivation, and route authentication/origin/envelope/no-store behavior. Included in the offline total above. |
| Additional formatter and whitespace checks                      | `prettier --check scripts/verify-changes-ui.mjs CHANGELOG.md` and `git diff --check` passed.                                                                            |

The rollback-only P3A suite covers Organizer creation; Member read/denied writes;
inactive identities/memberships; Change/Task/owner IDOR; duplicate canonical links;
active owner selection; exact server actor/version/clock; owner/Task independence;
authored fields and complete Task-set edits; stale writes and stale no-ops;
current no-op preservation; current reassignment/assign-back/status/deadline reads;
failed activity inserts rolling back the complete create/edit; empty Events;
parameterized adversarial text; composite FKs, uniqueness and RLS. SQL DATE output
is verified under Honolulu timezone and `SQL, DMY` DateStyle, without midnight conversion.
The final rerun also verifies one Task linked to multiple Changes, canonical
`CHANGE_CREATED` / `CHANGE_UPDATED` activity names, and anon/authenticated denial
across all 11 application/auth tables including both new P3A tables.

The additional concurrency test uses **two independent PostgreSQL connections**
and simultaneous version-1 edits containing different titles, owners and Task sets.
Exactly one edit wins with version 2, one returns 409, final canonical data equals
the winner, and history contains only creation plus one meaningful update. Its
synthetic committed fixture is intentionally retained so both connections can
see it. Other new constraint/atomicity fixtures roll back; no existing business
records are deleted or reset.

### Real Changes browser and layout evidence

`pnpm.cmd test:browser:changes` passed against the running Fastify/backend and real
PostgreSQL, using externally supplied Playwright and installed Edge at 100% scale.
Development Events, Tasks, Changes and append-only history created by this run are
intentionally retained. Credentials, session cookies and invitation bearer paths
stay in memory and are absent from saved evidence.

Nine completed groups cover:

1. Organizer empty state, associated title validation, initial focus/Escape and
   zero-Task Change creation in a genuinely fresh Event.
2. Organizer creation with two real Tasks, keyboard checkboxes, response owner,
   current statuses, distinct assignees and Event-local dates.
3. Task deadline editing through its existing UI; reassignment/status commands
   through real API; Change refetch reflects current state. Reassignment clears
   acceptance and assigning back does not restore it.
4. Real stale 409 after another real command: focused/announced conflict, draft
   retained, save blocked, explicit canonical reload, then review/save. Response
   owner editing leaves Task assignment/status/acceptance/version/deadline intact.
5. Member read-only detail and direct server 403 on create/edit; direct URL,
   refresh/back/forward; Event switch drops the old Change ID; foreign detail
   safely hides Change content.
6. A newly invited existing Member joins a real fresh Event, sees its empty state
   and subsequently created Change, and has no authoring controls.
7. Explicitly mocked server/network read failures remove stale content, show
   generic retry, omit injected private errors and never substitute demo data.
8. **60 real list/detail/form cases**: 1440/1080/768/390/320 × BG/EN × Light/Dark.
   Direct HTML/body `scrollWidth <= clientWidth`, out-of-viewport rectangles,
   temporary removal of body clipping, positive/negative panning attempts,
   visual viewport and 44px control/checkbox-label targets all pass. Ordinary
   vertical scrollbars remain enabled; mobile detail reflows into sequential facts.
9. Four **explicitly mocked** long Bulgarian detail cases: 390/320 × both themes,
   200-character Change title, long Task titles and member names. They pass the
   same overflow checks and are not represented as database-authored content.

Application/uncaught errors: 0; non-resource console errors: 0. Six resource-error
messages occur during deliberate denied/conflict/network scenarios and are counted
separately. Desktop light and 320px BG dark detail, and 320px BG light form captures
were visually inspected. No human acceptance, physical-device test or formal
accessibility certification is claimed.

Ignored local evidence: `tmp/p3a-evidence/browser/report.json`, its screenshots,
`tmp/p3a-pg-final.log`, `tmp/p3a-final-*.log`. These are development evidence,
not source artifacts to stage.

### Existing browser regressions and additional accessibility checks

All following commands were rerun successfully against real local backend/data,
using the existing external Playwright/Edge runtime. Labeled transport interceptions
remain distinct from real commands. No existing assertions were removed; only the
obsolete Changes-placeholder expectation was replaced with a complete API comparison.

| Command                                                               | Completed checks / layout cases                                                                                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd test:browser:auth`                                          | 15 checks / 20 Login cases; sessions, HttpOnly cookies, intended URLs, expired-session teardown, independent users and mobile logout.                                                                                      |
| `pnpm.cmd test:browser:workspace`                                     | 11 checks / 8 Dashboard/Team cases; real API/SQL comparison, keyboard/task round-trip, switch/history/focus and safe empty/error/401 handling.                                                                             |
| `pnpm.cmd test:browser:tasks`                                         | 13 checks / 5 Task-read widths; scope, real SQL/API data, no local fallback, safe failures and independent session teardown.                                                                                               |
| `pnpm.cmd test:browser:events`                                        | 14 checks / 20 authoring cases; create/edit/switch, role/IDOR, held reads, same-user scoped roles, actual concurrent edits and stale UI recovery.                                                                          |
| `pnpm.cmd test:browser:task-authoring`                                | 11 checks / 20 authoring cases; create/edit, lifecycle independence, IDOR, concurrency, held saves/switches, network errors and actual expired-session commands.                                                           |
| `pnpm.cmd test:browser:task-actions`                                  | 16 checks / 40 Organizer/Member drawer cases; assignment, acceptance/withdrawal, all statuses, stale versions, owner impersonation denial, reassignment/assign-back, pending controls and recovery.                        |
| `pnpm.cmd test:browser:invitations`                                   | 7 checks / 20 recipient + 20 loaded-dialog cases; hash-only storage, sign-in/join, invite-only registration, Task assignment/explicit acceptance, races/idempotency, revocation/expiry, IDOR/origin and focus containment. |
| `scripts/verify-changes-ui.mjs --read-checks` with existing env files | Two checks / 12 BG/EN Light/Dark list/detail/form-error cases; text contrast, input border/focus contrast, associated validation focus and explicitly mocked failed-save draft retention/announcement.                     |

All report application-error counts are zero. These browser totals are separate
from Node test counts. Changes text contrast is at least **5.10:1** in the sampled
states; input boundaries at least **3.39:1** and focused title outline at least
**5.11:1**. New input boundaries reuse `--control-border`, preserving the existing
theme palette. Failed POST response/network interceptions do not create business
records and preserve the draft; injected private errors never appear in the UI.
Evidence: the existing `tmp/p1d*`, `tmp/p2a`, `tmp/p2b`, `tmp/p2c` browser reports,
`tmp/p3a-regression-*.log`, `tmp/p3a-evidence/read-checks/report.json` and
`tmp/p3a-read-checks.log`. Formal accessibility certification is not claimed.

### Locked designs and security review

All **60 Dashboard/Tasks/Team content captures** are pixel-identical to the saved
locked baseline, with the same labeled deterministic transport data, clock,
language/theme and widths. The shell's authorized Changes label is excluded from
content comparison. An initial shared `.change-impact` selector changed Dashboard;
that failed comparison was corrected by scoping every new selector to Changes,
then the entire comparison passed. Evidence:
`tmp/p3a-evidence/locked-comparison.json` and
`tmp/auth-overflow-evidence/locked/p3a-*.png`.

The short-height sidebar verifier passed 24 labeled transport cases at
1440/1080 × 900/740/720 × BG/EN × Light/Dark: no micro-scroll, no horizontal clipping,
unchanged typography, 44px controls and keyboard-visible logout. Each context also
checks 560px height: real vertical overflow remains scrollable and logout/footer
can be reached. No production overflow hiding or shell spacing change was added.

Explicit source/test review confirms: Event membership and identity are checked
and locked server-side; active Organizer alone authors; operationalRole never
authorizes; Change queries include Event scope; Task/owner references require that
scope and current active/canonical constraints; version checks precede writes;
all dynamic SQL values are parameters; actor IDs and timestamps come from session/
server; client roles/actor/time fields are rejected; errors use fixed sanitized
envelopes; protected responses are no-store; cookie writes preserve trusted Origin/
Fetch Metadata rules. No new logger exposes bodies, database errors, credentials,
sessions or invitation bearer URLs. New browser failures suppress raw diagnostics.
Invitation/session implementations and existing locked auth verifier are unchanged.
The working-file safety audit checks all 32 intended files, the full diff and the
production frontend bundle against seven configured private-value forms, including
the database password component. No private-value matches or excluded artifacts
were found. Values are never printed; credentials and auth/browser evidence remain
ignored. The staged audit also passed for the exact 32-file allowlist; the known
shortcut, env files, credentials, cookies, sessions, invitation bearers, database
dumps and browser auth artifacts are excluded. Staged whitespace checks passed.
The first existing workspace browser run passed Dashboard/Team checks but failed
its obsolete assertion that Changes must always be an unconnected empty placeholder.
That assertion now compares the full real scoped API title/URL list, retaining
the Templates empty-state and all prior auth/read/layout checks. The failed run
is not counted as a pass.

Preserved discrepancies: required Task DATE; current no-op preserves version/history;
existing Changes placeholder renamed rather than adding a duplicate destination;
locked Dashboard's historical unavailable-change/response copy is retained.
The dedicated Changes route reads real P3A data. No new dependency or lockfile
change; GPLv3 and the existing dependency/asset license register remain applicable.

### Exact P3A file manifest

Added:

```text
docs/BUDOGRAPH_P3A.md
scripts/verify-changes-ui.mjs
server/migrations/0004_event_changes.sql
server/src/changes/model.ts
server/src/changes/service.ts
server/src/routes/changes.ts
server/tests/changes-concurrency.integration.test.ts
server/tests/changes.integration.test.ts
server/tests/changes.test.ts
src/i18n/changeMessages.ts
src/pages/changes/changes.css
src/services/changes.test.ts
src/services/changes.ts
```

Modified:

```text
CHANGELOG.md
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-workspace-ui.mjs
server/migrations/README.md
server/src/app.ts
server/src/main.ts
server/tests/schema.integration.test.ts
src/App.tsx
src/auth/routing.ts
src/i18n/messages.ts
src/pages/ChangesPage.tsx
src/routes.ts
```

P3A architecture/model/API/flows/security and remaining limitations are documented
in `BUDOGRAPH_P3A.md`, setup/demo/user/limitation docs and the AI assistance log.
Unpaginated lists/1000-ID bound, in-memory drafts and uncertain-create-response
duplicate risk remain documented. Human usability/screen-reader, other browsers,
physical devices, production grants/hosting and offline backup rehearsal remain
separate work. The unrelated `docs/market-research/docs - Shortcut.lnk` is untouched.

## Auth horizontal-pan investigation — 2026-10-05

### Scope and acceptance status

The user's report is investigated from fetched, tracked-clean `main` at
`ee662e6de0c8a031a5c6f796cc981455a07d9302`, equal to `origin/main`.
The previously completed mandatory master-prompt/regulations review applies.
P1/P2A/P2B/P2C remain locked. The user reports a **PASS** human retest after
resetting browser zoom to **100% with Ctrl+0**. Auth Experience Polish is accepted
and locked with this test/documentation cleanup; P3 has not started.
No production CSS, markup, copy, auth/invitation behavior, backend, schema or
dependency is changed. The unrelated shortcut remains untouched.

**A normal document-overflow regression has not been reproduced.** This is an
investigation result, not evidence that the reported human symptom is imaginary,
and not a claim that a layout defect has been fixed. No offending production
DOM element/CSS property can honestly be identified in the requested normal matrix.
No production fix was applied or is needed. The browser visual-viewport zoom/offset
was the observed explanation; the subsequent human 100% zoom retest passed.
The final cleanup preserves only regression-test/documentation hardening under
`test(app): harden auth overflow verification`, not a production CSS fix commit.

### Actual-browser observation and separate visual viewport

Read-only inspection of the user's existing Brave `/login` tab found:

| Measurement                                                                 | Observed value          |
| --------------------------------------------------------------------------- | ----------------------- |
| `innerWidth` / HTML `clientWidth` / HTML `scrollWidth` / body `scrollWidth` | 440 / 440 / 440 / 440px |
| `scrollX`                                                                   | 0px                     |
| Out-of-layout-viewport element rectangles                                   | None                    |
| `visualViewport.width`                                                      | 421.602783203125px      |
| `visualViewport.scale`                                                      | 1.0436363220214844      |
| `visualViewport.offsetLeft`                                                 | 18.397212982177734px    |

Thus the visible view is magnified and shifted within a correctly sized layout.
This explains the measured tab's apparent left shift and permits visual-viewport
panning independently of document scrolling. The user subsequently confirmed that
resetting browser zoom to 100% with Ctrl+0 passed the human retest. That human
confirmation is user-reported, not an additional automated measurement. Reloading retained
that browser-controlled scale/offset. A horizontal wheel action did not change
document `scrollX`; a native drag attempt timed out and is not counted as a pass.
The existing tab's viewport state was preserved. Temporary testing overrides were
removed and the original EN/system preference was restored.

An isolated mobile-emulation browser test independently reproduced this mechanism:
440/440px document widths and `scrollX=0` throughout; setting the observed scale
reduced the visual width to 421.602783203125px; a touch drag moved its visual offset
to 18px; restoring scale 1 restored visual width 440px and offset 0. This is a
deliberate browser-emulation experiment, not a production CSS change or disabled
zoom. No change to viewport metadata or accessibility zoom support is proposed.
Evidence: ignored `tmp/auth-overflow-evidence/visual-viewport.json` and its two PNGs.

### Normal viewport measurements

Brave's isolated tab covers all five widths × BG/EN × light/dark: **20 cases**.
At scale 1, all four recorded layout widths equal the requested width and
`scrollX=0`, `visualViewport.offsetLeft=0`. At 390px, some outer rectangles measured
390.3999938964844px, a subpixel rounding observation; integer document widths
remain 390px with no horizontal scroll range. No content element exceeds the
outer wrapper. This rounding is recorded rather than treated as a confirmed cause.

Real-backend Edge Login checks on both already-running local origins (5173 and 5174) cover **40 cases**, each at 620px height, with horizontal wheel attempts and
temporary removal of the existing body clipping: no document overflow or panning.
Additional normal/unclipped Edge checks cover five widths × two languages ×
900/620/420px heights. Exploratory injected CSS zoom is distinct from real browser
zoom: at 320px and CSS zoom 1.5 it can overrun the unwrapped header preference row.
That synthetic, smaller effective layout is not substituted for reproduction of
the reported normal desktop defect; no production patch is based on it.

The strengthened existing presentation verifier covers **222 cases** / **20
keyboard combinations**, including Login, auth loading, pending invitation,
invite-only registration, a 200-character email, wrong account, expired, revoked,
accepted, unavailable, invalid and two BG mobile registration-error cases:

| Requested width | Cases | `innerWidth` | HTML `clientWidth` = HTML `scrollWidth` = body `scrollWidth` |
| --------------- | ----- | ------------ | ------------------------------------------------------------ |
| 1440px          | 44    | 1440px       | 1440px                                                       |
| 1080px          | 44    | 1080px       | 1080px                                                       |
| 768px           | 44    | 768px        | 768px                                                        |
| 390px           | 46    | 390px        | 390px; 375px when a vertical scrollbar is needed             |
| 320px           | 44    | 320px        | 320px; 305px when a vertical scrollbar is needed             |

Each case records the four widths, out-of-viewport rectangles, shell gutter
coordinates, visual-viewport scale/offset and horizontal wheel result. It asserts
`scrollWidth <= clientWidth` directly, also checks body width, and repeats the
measurements with `body.style.overflowX="visible"` only inside the browser test.
Both positive and negative `scrollTo` attempts and horizontal wheels produce zero
document movement. Test-only inline overrides are restored before screenshots.
Ordinary browser scrollbars remain enabled. All rectangles stay inside the layout
viewport in this Edge matrix, fields remain visible, BG/long-email text wraps,
controls remain at least 44px, vertical/short-keyboard scrolling is retained,
contrast/focus assertions pass, and application/console errors are zero.

The previous verifier compared against `innerWidth`, which can include a vertical
scrollbar. That weaker assertion has been corrected, but **it was not demonstrated
to have concealed an actual normal-layout failure on this baseline**.
Equal outer gutters and screenshot review support the existing intended unequal
columns at normal scale; no separate alignment defect or extra visual adjustment
is established. The user-reported successful 100% browser zoom retest closes the
investigation without a production layout change.

### Regression and automated checks

Cleanup reran `format`, `format:check`, `lint`, `typecheck`, the **224/224** frontend
tests, `git diff --check`, the explicit verifier formatting check and the hardened
auth presentation verifier (**222 cases / 20 keyboard combinations**, zero errors).
All passed without removing or weakening assertions. The additional build,
functional and locked-UI results below were verified during the investigation.

| Check                                                              | Verified result                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `build`    | Pass; all production source remains unchanged.                                                                                                                                                                                      |
| `pnpm.cmd test`                                                    | 224/224 pass, zero skipped.                                                                                                                                                                                                         |
| `git diff --check`; explicit Prettier check of the `.mjs` verifier | Pass.                                                                                                                                                                                                                               |
| Enhanced auth presentation verifier                                | 222 cases / 20 keyboard combinations, zero application/console errors; clipping-independent width/pan assertions pass.                                                                                                              |
| `pnpm.cmd test:browser:auth`                                       | 15 checks / 20 layout cases, zero application/console errors; Organizer/Member login, invalid credentials, logout and protected return pass.                                                                                        |
| `pnpm.cmd test:browser:invitations`                                | Seven workflow checks / 20 recipient cases / 20 dialog cases, zero application errors; sign-in return, invite-only creation/entry and wrong-account denial pass. The existing suite also exercises its deeper invitation workflows. |
| Locked Dashboard/Tasks/Team captures                               | 60/60 pixel-identical to the saved captures from the exact auth-polish baseline. Identical localized fixtures/fixed time are used; sticky chrome is hidden only during content-region capture.                                      |
| Sidebar/switcher                                                   | 24 cases; zero errors, Bulgarian micro-scroll fix preserved, full labels/44px controls and short-window vertical scrolling pass.                                                                                                    |
| P2C Invite member dialog                                           | 64 feedback/state cases plus four short-mobile checks; zero errors, 24px/8px feedback spacing and keyboard/retry behavior preserved.                                                                                                |

Only development test fixtures are created; no existing data reset/deletion occurs.
Ignored reports/screenshots remain under `tmp/auth-overflow-evidence`,
`tmp/auth-polish-evidence/presentation` and existing browser verifier evidence paths.
Git source comparison confirms that every production file is identical to the
baseline. Only the verifier and two evidence documents are included in the cleanup
commit. The unrelated shortcut remains untouched and untracked.

## Authentication experience polish — 2026-10-05

### Approved boundary and preflight

User-authorized visual/UX phase from tracked-clean `main` at
`de9951e6b52d44604b23118796acc287c57ea3e4`, matching fetched `origin/main`.
The complete master prompt and all 30 supplied 2025–2026 regulation pages were read.
Existing product/flow/architecture/model/testing approvals and the explicit request
authorize this polish. P1/P2A/P2B/P2C remain locked; P3 is not started. The unrelated
`docs/market-research/docs - Shortcut.lnk` is left untouched and untracked.

Before implementation, frontend **224/224**, offline backend **111 passed / six
opt-in database suites skipped**, and enabled PostgreSQL **62/62 / zero skipped**
passed. No critical failure was bypassed. Integration runs completed before live
browser writes, so rollback constraints did not interfere with real workflows.

### Presentation and scope

Actual desktop Login inspection confirmed equal columns, disproportionately small
context, wide inner gutters/gap and weak form anchoring. The final shell aligns
header/content within 1080px and uses unequal context/action columns with a quiet
divider. Seminar-specific context connects Event, responsibility/deadline and the
next decision; it introduces no feature grid, image, external font, logo or palette.
At 800px and below, the operational readout compresses into a short context and
single-column form. At 540px and below, language/theme controls occupy a deliberate
second header row; phone controls stay 44px or larger and the page scrolls normally.

Pending invitations show only the already-authorized Event name, Member context,
invited email and expiry beside the next action. Registration uses its own heading
and removes the competing pre-form action row while open; Cancel restores focus
to Create account. The invited email remains read-only, name/password constraints
are unchanged, and account creation still precedes a separate explicit join.
Wrong-account, expired, revoked, accepted and unavailable states have concise
headings and existing safe explanations/actions. Loading uses the same shell.

Only presentation/focus/copy changed. Source comparison confirms **no changes** to
Better Auth configuration/controller/transport, return routing, invitation services,
API routes, schema/migrations, authorization, role/member rules, password rules,
dependencies/lockfile, global theme/styles or authenticated page/shell components.
Public signup is neither exposed in normal Login nor enabled on the backend.

### Automated and real workflow verification

| Check                                                             | Verified result                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `build`   | Pass; production build succeeds.                                                               |
| `pnpm.cmd test`                                                   | 224/224 pass after implementation and focus correction.                                        |
| `pnpm.cmd server:test`                                            | 111 pass; six opt-in database suites skipped in this offline command.                          |
| `RUN_DATABASE_INTEGRATION=1` + `pnpm.cmd server:test:integration` | 62/62 pass, zero skipped, real PostgreSQL rollback fixtures. Backend source remains unchanged. |
| `pnpm.cmd server:typecheck`, `server:build`                       | Pass.                                                                                          |
| `pnpm.cmd test:browser:auth`                                      | 15 checks / 20 Login layout cases; zero application/console errors.                            |
| `pnpm.cmd test:browser:events`                                    | 14 checks / 20 cases; zero application errors.                                                 |
| `pnpm.cmd test:browser:task-authoring`                            | 11 checks / 20 cases; zero application errors.                                                 |
| `pnpm.cmd test:browser:invitations`                               | Seven checks / 20 recipient + 20 dialog cases; zero application errors.                        |
| `node scripts/verify-auth-experience-ui.mjs`                      | 182 presentation cases / 20 keyboard-focus combinations; zero application/console errors.      |
| `git diff --check`                                                | Pass.                                                                                          |

Real auth checks cover direct protected URLs, bootstrap, Organizer and Member
login, safe invalid credentials, duplicate pending submission, refresh, logout,
server-invalidated sessions, internal return restoration, external redirect denial,
HttpOnly cookies and no auth tokens in browser storage. Existing named transport
failures/malformed identities are explicit doubles, not actual outages.

Real P2C checks cover existing account → sign in → return → explicit join; new
invite-only Better Auth account → ordinary session → explicit join; no membership
before joining; canonical MEMBER role and empty operational role; Event switcher/
Team visibility; absent Organizer controls for Member; assignment followed by
separate acceptance; multi-Event role isolation; concurrent/idempotent acceptance;
wrong-account denial, actual revocation/expiry, invalid links, registration refusal,
closed public signup, forged roles/identity and foreign scope denial. The expiry
fixture changes only its newly created disposable invitation. Browser-created
Events/tasks/accounts/history are retained; no existing database data is deleted/reset.

### Visual/browser matrix and accessibility

Edge/Chromium **154.0.4258.53**, widths **1440, 1080, 768, 390, 320 CSS px**,
both **BG/EN × Light/Dark**. The read-only verifier labels synthetic identity and
invitation responses explicitly and saves no bearer URL or auth artifacts. It
captures Login, valid invitation, registration, wrong account, expired, revoked,
accepted, unavailable and invalid surfaces: **180 cases**, plus **two Bulgarian
phone registration-error cases**. Real recipient regression additionally tests
long email wrapping across 20 configurations.

Every presentation case has one primary heading, labelled inputs, no horizontal
overflow, targets at least 44×44px and sampled text contrast meeting 4.5:1 for
regular text / 3:1 for large text; minimum sampled ratio **4.61:1**. Keyboard checks
verify route-entry heading focus, Login email → password → submit order, Escape
leaving the nonmodal page intact, registration name focus, Cancel restoration,
safe focused/associated registration errors, one pending submission and password
discarding. A reduced 390×420 viewport checks focused-submit reachability through
normal scrolling; this is viewport emulation, not a physical software keyboard.
Background same-identity refresh preserves the focused wrong-account action in all
20 configurations. The real dialog tests preserve Tab containment/Escape/restoration.

Agent visual inspection includes the six required Login captures: **1440 EN Light,
1440 BG Dark, 1080 BG Light, 390 EN Dark, 390 BG Light, 320 BG Dark**. Desktop EN
invitation, desktop BG account creation, phone BG registration, wrong account and
expired/revoked/invalid/accepted views were also inspected. They retain intentional
whitespace, anchored actions, full copy wrapping, a compressed mobile context and
calm state feedback. The concise seminar readout and Event-specific invitation
context reduce generic appearance without adding product promises or decorative
cards. This is agent review, not new human usability feedback.

### Locked workspace and prior polish regressions

- **60/60 pixel-identical** Dashboard/Tasks/Team content comparisons: three pages ×
  five widths × two languages × two themes. Both sides use identical read-only
  localized fixtures, fixed reference time and equivalent content. The baseline
  is a `git archive` of the exact pre-polish HEAD, served separately on port 5187.
  Sticky authenticated header/mobile-nav overlays are hidden only during content
  captures; their product source/CSS is unchanged.
- **24 sidebar cases** at widths 1440/1080, heights 900/740/720, BG/EN and both themes:
  no micro-scroll, full labels, 44px controls, keyboard-visible logout and unchanged
  switcher geometry. At 560px height, normal sidebar scrolling remains available.
- **64 invitation-dialog feedback cases**, with/without pending rows, BG/EN and
  both themes at 1440/390: 24px action-to-feedback and 8px feedback-to-Retry retained;
  focus containment, association, Retry without re-submission and Escape restoration
  pass. Four short phone cases preserve dialog scrolling. **16/16 normal-dialog
  screenshots** match the prior micro-polish evidence pixel-for-pixel. Dialog CSS,
  markup and localization keys used by it are unchanged.

### Review, corrections and remaining limits

Fresh read-only self-review covered generic appearance, whitespace/proportions,
copy value, auth hierarchy, invitation/form coherence, BG/EN, phone density, focus,
scope and locked pages. It found background identity object replacement could
refocus the invitation heading. Focus now depends on signed-in state; the final
presentation suite and affected frontend checks pass. No independent external
reviewer/subagent, formal accessibility/security audit or human acceptance is claimed.

Intermediate verifier/capture corrections are not PASS evidence: a 200/null synthetic
identity incorrectly represented signed-out state and produced a safe unexpected
error; the fixture now uses the real 401 contract and asserts no Login alert. Four
initial locked images differed solely because sticky header overlays were captured
at different scroll positions. Stable overlay-hidden captures against exact HEAD
pass all 60 comparisons. Port 5174 was already occupied; the exact baseline was
started on 5187, without stopping the existing service. No product/backend behavior
was changed to satisfy these corrections.

Safe screenshots/reports live under ignored `tmp/auth-polish-evidence`; existing
real suites use their documented `tmp/p1d-evidence`, `tmp/p2a-evidence`,
`tmp/p2b-evidence` and `tmp/p2c-evidence` directories. The new verifier accepts the
same `BUDOGRAPH_PLAYWRIGHT_MODULE` / `BUDOGRAPH_BROWSER_EXECUTABLE` overrides;
Playwright/Edge were supplied from the workstation, without a project dependency.
Only this evidence and AI_ASSISTANCE_LOG.md are updated; architecture docs are not
rewritten. Credentials, sessions, cookies, invite bearer URLs and database dumps are
excluded from staging. Known P2C limitations remain: development-link delivery,
no email delivery/recovery/general verification, no Member removal/role editing,
no P3. Physical-device keyboards, Safari/Firefox and formal certification remain
unverified. GPLv3 and the existing license register are unchanged. The supplied NOIT
rules concern **2025–2026**; eligibility/categories, licensing, dates, online periods,
document format and assessment require separate actual-year verification.

### Exact changed files

- `src/auth/AuthShell.tsx`
- `src/auth/AuthBoundary.tsx`
- `src/auth/auth.css`
- `src/pages/LoginPage.tsx`
- `src/pages/InvitationPage.tsx`
- `src/i18n/authMessages.ts`
- `src/i18n/invitationMessages.ts`
- `scripts/verify-auth-experience-ui.mjs`
- `docs/TEST_EVIDENCE.md`
- `docs/AI_ASSISTANCE_LOG.md`

## P2C Invite member feedback spacing — 2026-10-05

User-authorized micro-polish from synchronized, tracked-clean `main` at
`f9247ebca14ac3281d161c419ad0071398d5f70b`. The user reports P2C human
functional acceptance. This change is confined to dialog feedback spacing.

- Before editing, actual Edge rendering and computed rectangles confirmed that
  `.team-page__heading p` supplies `margin: 10px 0 0` to the dialog error:
  action-to-feedback **10px**, feedback-to-Retry **0px**. Email-to-action is
  **22px**, action-row gap **12px**, Retry-to-pending-divider **28px**.
  Bulgarian feedback wraps to two lines at 390px.
- Only `.invitation-dialog > .login-error { margin: 24px 0 8px; }` was added
  to `src/components/invitations.css`. Browser measurements confirm **24px / 8px**
  in every error case; the other measured gaps remain unchanged. No container,
  surface, typography, control, dialog width/max-height or behavior was changed.
- Focused Edge verification uses explicitly synthetic, intercepted API responses
  and a fixed clock, without database writes. **64 dialog cases** cover 1440/390px,
  BG/EN, light/dark, no error/already-member/already-pending/safe server error,
  each with empty and visible pending invitations. Long emails wrap in pending
  rows; Bulgarian feedback wraps without collision. No horizontal overflow;
  every button remains at least 44px in both dimensions. **Four 390×560 cases**
  confirm legitimate dialog scrolling and keyboard access to the final control.
- All 64 cases preserve Tab containment, forward/backward wrapping, Escape and
  trigger focus restoration. Error cases preserve focused alert text, input
  `aria-describedby`, and a named, operable Retry button. Retry reloads the list
  and clears feedback without repeating the create POST. Zero application errors.
- **40/40 before/after screenshot comparisons are pixel-identical**: 24 locked
  Dashboard/Tasks/Team roster-detail interiors and 16 normal no-error dialogs.
  Bulgarian sidebar has no extra scroll at the checked desktop size. All themes
  and both languages were visually reviewed in the focused dialog captures.
- Requested `format`, `format:check`, `lint`, `typecheck`, `test` (**224/224**),
  `build` and `git diff --check` pass. Evidence and the disposable verifier are
  ignored under `tmp/p2c-feedback-evidence` and `tmp/p2c-feedback.mjs`.
- Initial verifier attempts exposed an omitted synthetic invitation `createdAt`
  and a screenshot taken during workspace replacement. The fixture was corrected
  and capture stabilized; the complete baseline and after runs pass. These were
  verifier issues, not application failures or backend evidence.

No backend/auth/onboarding, core page, shell, Event switcher or dependency changes.
The unrelated shortcut remains untouched and untracked. Auth Experience Polish
and P3 are not started. Supplied NOIT rules are for 2025–2026; actual competition
year requirements still need separate verification.

## P2C Event invitations and invite-only onboarding — 2026-10-04/05

Preflight: tracked-clean `main`, fetched `origin/main`, both exactly
`beebb01226eef1e4af8bcb77c19f07229d15192d`, ahead/behind 0/0. The unrelated
`docs/market-research/docs - Shortcut.lnk` is left untouched. The full mandatory
master prompt, all 30 supplied regulation pages and approved product/backend
contracts were read. The explicit P2C request authorizes implementation.
Supplied competition rules concern 2025–2026 and require actual-year verification.

### Implemented boundary and real PostgreSQL evidence

- Immutable `0003_event_invitations.sql` is applied to the real development database:
  first run **one applied/two already applied**; second run **zero applied/three
  already applied**. No old migration changed and no database reset occurred.
- Real invitation rows persist normalized email, correct Event/inviter, a unique
  SHA-256 digest and seven-day expiry. Raw tokens do not occur in invitation rows
  or ActivityEntry payloads. Crypto tests generate 100 distinct random 256-bit
  tokens and verify the hash boundary. RLS and direct Supabase-role denial include
  the new table; existing database grant boundaries are preserved.
- Active same-Event Organizer create/list/revoke, Member/foreign/guessed denial,
  active/inactive member conflicts, pending duplicates, expired/revoked replacement,
  strict input whitelists, normalized canonical email, hash lookup and minimized
  pending/terminal DTOs pass. Registration fixes email, rejects forged fields,
  and neither creates membership nor consumes the invitation.
- Matching acceptance creates one active MEMBER with neutral operational role,
  consumes the invitation and writes one server-derived activity atomically.
  Wrong canonical email and forged role fail. Same-recipient retry is idempotent.
  Actual ActivityEntry constraint failures roll create/accept back; failed acceptance
  leaves no phantom membership, and retry succeeds after the fixture is removed.
- Fresh-review tests directly deny matching accounts using expired/revoked links,
  inactive identity/membership and archived Events; inactive Organizer create/list/
  revoke is denied. Real digest uniqueness/format, normalized email, acceptance
  pairing, exclusive terminal state and same-Event accepted-membership FK constraints
  are exercised. All integration fixtures roll back their outer transaction.
- Concurrent real browser requests produce one membership/acceptance activity,
  canonical repeat acceptance and one 201/one 409 duplicate invitation create.
  Event-before-invitation locks serialize create/revoke/accept; final consumption
  rechecks database-clock expiry and rolls membership back if the deadline passed.

### Browser journeys and UI evidence

The new `test:browser:invitations` verifier uses the actual application/backend,
real PostgreSQL and separate Edge contexts. It verifies Organizer Team creation,
truthful development-link delivery, hash-only storage, pending list, wrong-account
denial, existing-account login return and direct invitation refresh, explicit join,
Team/switcher membership, invite-only Better Auth registration with read-only email,
normal session and a separate explicit join. Organizer assigns a real Task to the
new Member; it remains unaccepted until that Member explicitly accepts, then the
Organizer sees canonical acceptance. Member-in-A/Organizer-in-B authority stays
scoped; a Member cannot see/manage invitations in A. Revocation, expiry, invalid
tokens, forbidden signup, forged role/User, IDOR and missing Origin fail safely.

Responsive recipient coverage uses widths 1440/1024/768/390/320 × EN/BG × light/dark,
including a long email, labelled registration fields, visible autofocus, no horizontal
overflow and 44px action targets. Native dialog Escape and trigger restoration are
verified. Screenshots exclude bearer URLs/passwords/cookies; no HAR, trace or
storageState is saved. Final loaded-dialog and clipboard-fallback checks are recorded
in the release results below.

Locked visual comparison uses identical read-only synthetic transport fixtures,
fixed clock, same viewport/content/preferences and the actual baseline/current
application on separate Vite ports. **80 pairs** (Dashboard, Tasks, Team roster/detail,
Task drawer × five widths × both languages/themes) match dimensions and pixels:
**zero changed pixels**. The permitted new Organizer Team action is outside the
locked interior crop. No design-replacement claim is inferred from different data.

The established Bulgarian sidebar fixture passes **24 before and 24 after cases**:
1440/1080 widths, 900/740/720 heights, EN/BG and light/dark, actual language switching,
unchanged text/control/switcher dimensions, zero scroll travel, no clipping/overflow,
44px controls and keyboard logout with visible focus. The 560px fallback retains
scrolling. Representative locked Team and recipient mobile images were visually
inspected. Viewport emulation is not physical-device or Safari/Firefox verification.

### Review, safety and intermediate failures

Fresh read-only review checks public signup closure, private Better Auth handler
exposure, canonical email, role hardcoding, token randomness/hashing/expiry, locks,
revocation/idempotency, account/business atomicity boundary, privacy, switcher/Team/
assignment integration, logging/referrer policy and locked UI/scope. It adds direct
inactive/archived/terminal-account and database-constraint coverage. Backend safe
log serializers omit URLs, headers, bodies and raw exceptions; library diagnostics
are disabled and Vite proxy diagnostics redact bearer invitation path segments.
Production proxy/access-log and shared-rate-limit review remain deployment work.

Intermediate failures are retained as evidence boundaries, not counted as passes:
an external Playwright import needed the documented runtime environment; sharing
baseline/current Vite cache caused duplicate React and was fixed with an isolated
baseline cache/current restart; form selector failures led to explicit submit types;
an early matrix assertion waited on loading text and now waits for the real action.
A task-action attempt overlapped frontend HMR; its stable rerun passes. An initial
Event regression run timed out on its first Dashboard wait; isolated rerun results
are recorded below. The full parallel PostgreSQL run exposed a stale two-migration
expectation and overlapping table-lock failure fixtures. The schema assertions now
include all three immutable migrations/new RLS table; integration files run serially.
No existing check was removed or weakened to conceal failure.

Better Auth account creation remains a separate library transaction. An account
can remain after a later join failure and can sign in/retry a valid invitation;
membership/consumption/history alone are one atomic business transaction. No
outbound email provider was added: delivery is explicitly a development copy link.
Initial deployment Organizer provisioning remains an infrastructure operation.

Browser-created disposable Events/tasks/accounts from successful and intermediate
attempts are intentionally retained with history. The final run's non-secret IDs
are in ignored aggregate evidence; no existing user/data reset or destructive
cleanup occurs. Actual credentials, bearer URLs, sessions, dumps and generated
evidence are excluded from Git. P3 is not started. Human P2C acceptance and formal
production/security/accessibility certification have not been invented.

An expanded focus walk confirmed a real dialog issue: Edge moved sequential Tab
focus into browser chrome; the return focus invoked the existing workspace refetch
and unmounted the dialog. The new invitation dialog now wraps Tab/Shift+Tab at its
first/last enabled control. No shared workspace/refetch behavior was changed.
A 16-step real keyboard walk retains the modal and document focus throughout;
affected lint/typecheck, all 224 frontend tests and production build pass again.
The expanded invitation suite also checks both focus-wrap directions.

Visual inspection of the loaded desktop dialog identified a long email squeezing
the Revoke label onto multiple lines. The new dialog's revoke buttons now retain
their natural width while the email wraps; the browser verifier checks a single
rendered text line and at least 44px width. Manual-copy feedback also avoids an
incorrect above/below direction. These changes are confined to invitation UI.
One recheck still received the old CSS from Vite's in-memory module graph (confirmed
by fetching the CSS module and inspecting its loaded style). Restarting the current
Vite preview loads the changed rule. A real rendered recheck measures the desktop
Revoke target at approximately 77×44px with one text line; focus remains contained.

Two development backend watch managers were found competing for port 3001 and
restarting while verification ran. Later invitation attempts timed out at login or
the new Member task action; these attempts are not counted as passing. The verified
backend watch managers/children were stopped and one non-watch backend started for
the final run. Both live and database readiness checks return 200. The application
remains runnable; the final invitation and full PostgreSQL suites run serially.

### Release results

Frontend lint/typecheck, **224/224 tests** and build pass after the final UI changes.
Backend typecheck, **111 offline passes/six opt-in integration-file skips** and build
pass. The final enabled full PostgreSQL suite passes **62/62, zero skips**, including
**11 invitation checks**. Migration history/checksums and second-run idempotency pass.
`pnpm.cmd format`, `format:check`, explicit formatting checks for the new standalone
documentation/browser verifier and `git diff --check` pass. The final invitation
rerun passes **seven grouped checks, 20 recipient cases and 20 loaded-dialog cases**
with zero application errors. Clipboard fallback, both focus-wrap directions,
single-line Revoke labels, long-email wrapping and all real onboarding/security flows
pass against the refreshed frontend and one stable backend. Together with regressions,
this is **87 grouped browser checks / 153 layout cases**. Separate locked-core and
sidebar comparisons are reported above and are not added again to that count.

Existing browser regressions all pass with zero application errors:

| Suite                          | Grouped checks | Layout cases |
| ------------------------------ | -------------: | -----------: |
| Auth                           |             15 |           20 |
| P1 responsibility actions      |             16 |           40 |
| P2A Event authoring/navigation |             14 |           20 |
| P2B Task authoring             |             11 |           20 |
| Real Dashboard/Team workspace  |             11 |            8 |
| Real Task reads                |             13 |            5 |
| P2C invitations/onboarding     |              7 |           40 |

Read-only workspace/task-read verifiers send zero business mutation requests.
The responsibility suite verifies all six activity types and leaves the controlled
task assigned to Member, unaccepted, `not-started`; it preserves history.

The complete 38-file manifest is in `BUDOGRAPH_P2C.md`. Staging is restricted to
that manifest. The final audit compares configured sensitive values against the
staged diff without printing their values, checks for live invitation bearer paths
and excluded artifacts, and confirms old migrations/lockfile are unchanged.
The authorized commit/push identity and final sync state are reported in the final
delivery message; a commit cannot embed its own hash in its contents.

Staged audit result: **PASS, 38 files, exact manifest match**. Six configured
sensitive environment values (plus the parsed database password) are checked without
printing them; none occurs in the staged diff. No live invitation bearer path,
excluded artifact, old-migration edit or lockfile change is staged. The known
unrelated shortcut remains untracked and untouched. The staged whitespace check passes.

## Post-P2B Create Event copy correction - 2026-10-04

Baseline: `58c3b20a6f3dc15279f20bf437165b1050ef124c`, synchronized
`main`/`origin/main`, clean tracked worktree. The user confirmed P2B automated
verification and the complete requested human smoke flow passed. This correction
changes only `events.fresh` in the EN/BG catalog plus directly associated evidence
and assistance documentation. The unrelated shortcut remains untouched.

- Old EN: "This event starts with your Organizer membership and no tasks. Task
  authoring is not yet available."
- New EN: "This event starts with your Organizer membership and no tasks. After
  creating it, add tasks from Tasks."
- Old BG: "Новото събитие започва с вашето членство като организатор и без задачи.
  Създаването на задачи все още не е налично."
- New BG: "Новото събитие започва с вашето членство като организатор и без задачи.
  След създаването му можете да добавяте задачи от „Задачи“."

Read-only date review confirms shared `Intl.DateTimeFormat` and the existing
`en-GB`/`bg-BG` language mapping, including the Event header and page consumers.
The same `2026-10-04` calendar date renders as `4 Oct 2026` and `4.10.2026 г.`
respectively. No semantic inconsistency or independent hardcoded formatter was
found in these paths. No date-formatting change is required or made.

Focused Edge browser verification uses explicitly synthetic, intercepted read-only
responses; it performs no Event, Task, auth or database writes. Before/after runs
each pass **12 cases**: BG/EN, light/dark, widths 1440/390/320. Correct current copy,
no horizontal overflow, reachable 48px submit controls, unchanged field geometry
and unchanged desktop sidebar metrics pass with zero application errors.
Representative EN desktop and BG 320px screenshots were visually reviewed.

The existing sidebar/layout verifier passes **24 cases**: BG/EN, light/dark,
1440/1080 widths and 900/740/720 heights. Sidebar scroll travel is zero, controls
and footer remain visible, keyboard logout works, and 560px fallback scrolling
remains available. Dashboard/Tasks/Team remain usable without horizontal overflow.
All 72 captured locked-page dimensions match the P2B baseline; 71 images are
pixel-identical. One Dashboard capture differs in 255 pixels around the existing
empty-state dashed border; its dimensions and source are unchanged. This is not
claimed as a 72-image pixel-identical pass.

An initial pre-edit Create Event harness run failed an assumed zero-scroll assertion
with a different synthetic Event fixture (3px travel). The focused verifier now
checks preservation against its own baseline; the established sidebar fixture
independently retains strict zero-scroll assertions and passes all 24 cases.
No product code or styling was changed to accommodate the verifier.

Executed frontend checks: `pnpm.cmd format`, `pnpm.cmd format:check`,
`pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test` (**218/218**),
`pnpm.cmd build`, and `git diff --check`: **PASS**. Current product source no longer
contains the obsolete Task-authoring claim; historical evidence stays historical.
No page/component/CSS, backend, database, auth, dependency or date logic changes.
P2C is not started. Supplied competition requirements remain specific to 2025-2026
and require verification for the actual participation year.

## P2B real Task authoring - 2026-10-04

Preflight: clean tracked `main`, fetched `origin/main`, both at
`8c0642e68f7a99313a20add64dc2324029320bca`, ahead/behind 0/0. The unrelated
`docs/market-research/docs - Shortcut.lnk` stays untouched. Full mandatory master
prompt, all 30 supplied regulation pages and approved architecture/backend contract
were reviewed before implementation. Existing approvals and explicit P2B request
authorize this stage. NOIT requirements supplied belong to 2025-2026 and require
verification for the actual participation year; no current-year compliance claim.

### Backend commands, validation and responsibility semantics

- POST `/api/events/:eventId/tasks` returns canonical 201 `{ task }`; PATCH
  `/api/events/:eventId/tasks/:taskId` returns canonical 200 `{ task }`.
  Active current-Event Organizer membership is required. Member authoring is
  denied 403; foreign/missing Event or Task is denied 404. Archived writes and
  inactive identities/memberships are denied. Authenticated server membership
  and route IDs control actor and scope; display names never grant authority.
- Create requires trimmed title (1-200), real calendar DATE and existing priority.
  Optional free-text category (0-100), context (0-5000) default to empty text.
  Optional assignee is null or an active same-Event member with active identity.
  Update whitelists only those five authored fields and required expectedVersion.
  Unknown metadata/assignment/acceptance/status fields are rejected. Safe 400
  field codes cover text, NUL/lone surrogates, dates, priority, assignee and version.
- UUID, actor, creator/updater, scope and timestamps are server-controlled. New
  Tasks start version 1, `not-started`, unaccepted, including initially assigned
  Tasks. Detail edits preserve assignment, acceptance actor/time and lifecycle.
  Existing reassignment/unassignment clears acceptance; assigning back requires
  explicit reacceptance by the assignee. Dedicated responsibility commands remain.
- Task and one `task.created`/`task.updated` ActivityEntry commit atomically.
  Initial assignment belongs to the created payload, without redundant assigned
  activity. Updates record only changed-field before/after values and version
  metadata. Stale versions fail 409 before no-op handling; current no-ops preserve
  version/timestamp/history. Meaningful edits increment once. Two simultaneous
  same-version writes produce one 200, one 409 and exactly one new history record.
- Strict `YYYY-MM-DD` DATE strings, years 0001-9999 and leap-day validation match
  the existing calendar model. No instant/browser-local conversion is introduced.
  Real browser timezone Pacific/Honolulu verifies November 1 preparation deadline
  in a November 2 Event, unchanged SQL/DTO DATE, and edit to October 31.
- Seven new offline backend tests and eight rollback-only PostgreSQL checks cover
  server defaults/metadata, active/scoped roles and assignees, fresh Event zero to
  one, accepted-task editing, no-op/stale versions, activity and actual constraint
  failure rollback for both commands. Outer fixture rollback is verified. No
  destructive database cleanup, schema change, migration or dependency was added.

### UI, canonical state and real browser

Quiet Create action in the existing Tasks header and contextual Edit details in
the existing drawer reuse one focused BG/EN form. Fields have associated labels
and errors, native DATE, existing priority control, creation-only optional active
same-Event assignee. Member authoring controls are absent. Save/cancel/pending,
first-invalid focus, Escape and focus restoration are verified. A new Task opens
the existing `?task=...` deep link and survives full refresh. Tasks, Dashboard and
Team continue deriving their existing views from the same canonical scoped data.

RemoteWorkspaceService/controller own commands, safe errors and canonical Event
refresh. Pending submissions block duplicates. Lost responses refetch, never
replay automatically; failed workspace refresh blocks further writes. 409 loads
latest fields/version and requires explicit review/save. Failed conflict refresh
blocks Save while keeping explicit reload usable. Open drafts retain their original
version across focus/online reads; Event/identity switches still abort/discard old
requests, forms and completions. No presentation fetch or demo/local fallback.

Final controlled real-account Edge run: **11 checks / 20 layout cases**,
zero application errors, no failure field. Covers fresh real Event 0 to real Task,
real Organizer create/edit/optional Member assignment, independent real Member
acceptance/status, preserved acceptance on edit, unassign/assign-back/reaccept,
real 403/404/foreign assignee/forged-fields denial, stale/no-op/explicit retry and
simultaneous concurrency, focus/online draft retention, failed conflict recovery,
A/B/A isolation and switching during held real create and edit, and actual expired
create AND edit 401 with no database write. Initial persistence is compared to
PostgreSQL server actor/default/version/date/history; details survive deep-link
refresh and Dashboard/Team derive the new real task.

**20/20** Create+Edit cases at 1440/1024/768/390/320, BG/EN, light/dark: actual html
language/theme asserted, no horizontal overflow, 48px triggers/44px options and
reachable 48px submit, associated native field labels, keyboard priority selection,
viewport-contained popup and Escape. Representative desktop BG-light and narrow
BG-dark forms are visually inspected. Evidence is Chromium behavior, not formal
screen-reader, physical-device, Safari/Firefox or certification work.

Named transport failures (400/403/404/500/network), failed refresh, held responses,
and fixed-clock visual fixtures are explicit test doubles. They never stand in
for live persistence/authorization/responsibility/concurrency. Intentional UI-created
development Events/tasks remain, including incomplete earlier runs. No destructive
cleanup, auth dumps, HAR, traces, cookie jars, storage-state or database exports.

### Automated checks and preserved regressions

- Frontend **218/218**, zero failures/skips, including 17 new authoring tests.
- Offline backend **106 passed**, zero failures; five integration suites skipped
  only in the offline command. Separately enabled PostgreSQL: **51/51**, zero
  failures/skips, including all eight new authoring checks.
- Format/format:check/lint/frontend typecheck/tests/build, backend
  typecheck/tests/build, new verifier Prettier check and git diff --check: PASS.
  No legitimate test baseline is removed or weakened.
- Completed unchanged P1/P2A browser regressions: auth **15 checks / 20 layouts**; task reads **13 / 5**; responsibility actions **16 / 40**; workspace **11 / 8**; Event authoring **14 / 20**. Every suite has zero application errors and no failure field. Read/workspace suites issue zero Event/task business mutations. Actual sessions, responsibility activity, SQL/API/DOM derivation, scoped navigation, optimistic Event edits, refresh and expiry remain verified.
- Locked visual comparisons: 80 before/after pairs across the same five widths,
  BG/EN, light/dark for Dashboard/Team/Tasks/existing drawer. Only new authoring
  controls are excluded from equivalent-content captures. Dashboard 19/20, Team
  20/20, Tasks 20/20 and drawer 15/20 are exact. Remaining Dashboard difference:
  262 dashed-border antialias pixels, max channel delta 11, identical geometry.
  Each remaining drawer differs at one pixel by one channel level. A transient
  skip-link capture was repeated with that unrelated overlay excluded. Representative
  captures are visually inspected. Locked page/style/sidebar composition is preserved;
  src/styles.css and Dashboard/Team product components are unchanged.
- BG sidebar **24/24**: 1440/1080 x 900/740/720 x EN/BG x light/dark. Zero unwanted
  travel (no 3px/23px recurrence), no clipping/overflow, unchanged text/control
  dimensions and switcher height, >=44px targets, Tab reaches visible logout.
  At 560px legitimate scrolling and logout/footer reachability remain. These are
  explicitly synthetic read-only fixtures and use the historical sidebar baseline.

### Fresh read-only review and intermediate failures

Fresh read-only self-review covers permissions/server fields, transactions,
expectedVersion, acceptance/dedicated assignment, Event/member scoping, DATE,
ActivityEntry, stale responses, locked UI, P1/P2A and scope. Confirmed corrections:
focus/online reads could discard/rebase a draft; new form dropdown sizing disrupted
assignee selection; failed conflict refresh disabled explicit recovery. Affected
unit and completed browser checks were rerun. No subagent/external reviewer or
human acceptance is claimed.

Incomplete runs are not PASS evidence. Initial harness failures counted native
Event-switcher options as assignees, overlapped login with source-format HMR,
and encountered POST 404 from an old non-watching backend (restarted with updated
source). Later failures exposed the confirmed dropdown/draft issues; other runs
reset language/theme through the initial preference script, then retained BG in
an expiry step expecting EN. The verifier now asserts actual html language/theme.
The first sidebar run completed layout assertions but lacked its historical
baseline JSON; input was restored and the full comparison rerun. A documentation
write hit Windows encoding and was restored/recreated as UTF-8. Only final completed
runs count; harness corrections do not weaken authorization/concurrency assertions.

### Security, documentation and remaining scope

Server validation, parameterized SQL, same-origin cookie authorization, exact
Origin/Fetch Metadata guard, body bounds and safe errors remain authoritative.
No browser metadata grants permission and no secret-bearing AI call was added.
Staged safety audit: exactly 28 intended files; no excluded environment/shortcut/temporary/auth artifacts. Six actual configured private values were checked privately against complete staged contents, staged diff and built frontend; no matches. No private values were printed. The final documentation is included in the repeated staged audit before commit.

README, backend development, user guide, deployment/demo plan, known limitations,
test evidence and AI assistance log are updated. No runtime/development dependency,
asset, migration or schema change; GPLv3/license register remains unchanged.
Exact commit/push/main equality/ahead-behind are reported in the final reply after
all acceptance checks pass. The unrelated shortcut may remain untracked.

**TASK DELETION NOT YET IMPLEMENTED. INVITATIONS NOT YET IMPLEMENTED.
EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED. CHANGES/PLAN B NOT YET IMPLEMENTED.
DEPENDENCIES NOT YET IMPLEMENTED. REALTIME NOT IMPLEMENTED.** Production,
backup/restore/offline demonstration, actual-year regulations, physical-device
checks and human usability acceptance remain separate. P2C is not begun.

### Complete P2B changed-file manifest (28)

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-authoring-ui.mjs
server/src/app.ts
server/src/routes/tasks.ts
server/src/tasks/model.ts
server/src/tasks/service.ts
server/tests/task-authoring.integration.test.ts
server/tests/task-authoring.test.ts
src/App.tsx
src/components/BudoSelect.tsx
src/components/TaskAuthoringForm.tsx
src/components/TaskDrawer.tsx
src/components/taskAuthoring.css
src/hooks/useRemoteTasks.ts
src/i18n/messages.ts
src/i18n/taskAuthoringMessages.ts
src/pages/TasksPage.tsx
src/services/RemoteWorkspaceService.ts
src/services/taskAuthoring.test.ts
src/services/taskAuthoring.ts
src/services/taskReadState.ts
```

## P2A Bulgarian sidebar micro-scroll fix — 2026-10-03

Baseline: synchronized `main`/`origin/main` at
`8be4b620da7acc12415474f76dc5ed711cd58a51`; tracked tree clean. The user reports
all P2A functional flows PASS and requests only this confirmed visual defect.
The unrelated `docs/market-research/docs - Shortcut.lnk` remains untouched.

### Confirmed cause and focused change

Actual rendered Edge layout at both 1440 and 1080 px widths: Bulgarian wraps
the brand subtitle onto a second line (+15 px) and the Event switcher actions
onto two rows (+44 px). The minimum content/padding stack is EN 684 px / BG
743 px. At 740 px viewport height, BG scrollHeight is 743, clientHeight is 740,
and setting scrollTop confirms exactly 3 px of scroll travel; EN has zero.
At 720 px height BG travel is 23 px. Box sizing is border-box, sidebar height
equals viewport height, and measured dimensions are whole pixels. Navigation,
Event actions, select and logout remain at least 44 px high.

Only product change: `src/styles.css`, desktop widths >=961 px and heights
<=768 px. Sidebar vertical padding becomes 20/14 px (saves 8), brand bottom
padding 18 px (saves 4), nav top margin 18 px (saves 4), nav gap 4 px (saves 5),
footer top padding 10 px (saves 4). This recovers 25 px without changing fonts,
labels, controls, switcher layout or legitimate overflow-y auto. Taller desktop
and mobile layouts retain their existing rules. Only the two related evidence/
assistance logs are additionally updated.

### Browser and frontend results

- Headless Microsoft Edge renders the real application with explicitly synthetic,
  read-only safe identity/Event/task/member transport fixtures and a fixed clock.
  No backend/auth/database writes or session artifacts are involved.
- **24/24** cases pass: widths **1440/1080**, heights **900/740/720**, **EN/BG**,
  **Light/Dark**. Language/theme changes use the actual preference controls.
  Every normal sidebar has zero scroll travel, no horizontal overflow, no clipped
  labels/controls and unchanged text/control dimensions and switcher height.
- Keyboard Tab reaches logout with a visible focus outline and the complete
  control inside the viewport in every case. At 560 px height, all 12 contexts
  retain real scrolling and the final controls/footer remain reachable.
- **72/72** Dashboard/Tasks/Team interior screenshot pairs are pixel-identical.
  All **8/8** tall (900 px) EN/BG Light/Dark sidebar pairs are exact after one
  targeted repeat. The initial 1440 EN dark sidebar comparison differed at four
  rounded-corner pixels (maximum channel delta 5); geometry was unchanged, and
  the repeat is exact. The initial comparison assertion is not counted as PASS.
- Representative corrected BG 1440 light and 1080 dark sidebar screenshots
  were visually inspected: full text, switcher actions, account and footer fit.
- `pnpm.cmd format`, `pnpm.cmd format:check`, `pnpm.cmd lint`,
  `pnpm.cmd typecheck`, `pnpm.cmd test` (**201/201**, zero skips),
  `pnpm.cmd build` and `git diff --check`: PASS.

Local ignored reproduction/report/screenshots: `tmp/sidebar-scan.mjs`,
`tmp/sidebar-verify.mjs`, `tmp/sidebar-compare.py`, `tmp/sidebar-scroll/`.
No new human verification, device coverage or accessibility certification is
claimed. Dashboard/Tasks/Team interiors, backend/database/auth and P2B remain
outside this change. Commit/push synchronization is reported in the final reply.

## P2A Event authoring and multiple-Event navigation — 2026-10-03

Preflight: `main`, clean tracked worktree, freshly fetched `origin/main` equal to
`24ac5baf1139a20b601cfd63940e1dfe4ea4db80`, a documented P1 audit-fix descendant
of requested `dfccbe92d3ea851376225dc0ab905e39fd5cf821`; ahead/behind 0/0.
The unrelated `docs/market-research/docs - Shortcut.lnk` was left untouched.
The full mandatory master prompt, all 30 regulation pages, approved backend
contract and current P1 architecture were reviewed before implementation.
2025–2026 dates/categories/licensing/document/online requirements still need
actual-year verification; no current-year compliance claim is made.

### Automated code and database checks

Before changes, frontend **169/169**, offline backend **80 passes / three opt-in
skips**, enabled PostgreSQL **34/34**, typechecks/builds/lint/format all passed.
Immutable P1 browser baselines were also recorded before equivalent new-route
verification; aborted live runs during shared HMR/watch changes are not counted.

Final implementation checks: `pnpm format`, `format:check`, `lint`, `typecheck`,
`test`, `build`, `server:typecheck`, `server:test`, `server:build`: PASS.
Frontend **201/201**, zero skips/failures. Offline backend **103 total / 99 passes /
four opt-in integration-root skips**, zero failures. Explicit enabled database
command `$env:RUN_DATABASE_INTEGRATION='1'; pnpm server:test:integration`:
**43/43**, zero skips/failures. A preliminary invocation without the required
gate skipped all four integration roots and is not database verification.
The five changed/new browser `.mjs` files receive explicit Prettier checks because
the project format command does not include scripts.

Real PostgreSQL rollback-only cases verify independent Event creation by a Member,
trusted owner, active ORGANIZER membership, no cloned Tasks, correct mixed roles,
accessible-only lists, all four field edits, calendar semantics, version/history,
atomic create/update failure rollback, stale/no-op semantics, inactive/archive/
foreign denial, and NUL/lone-surrogate validation without database changes.
Valid emoji remain accepted. Existing schema/RLS/least-privilege read checks,
immutable history, P1 responsibility commands and scoped reads also pass.
No database reset/drop, account deletion, migration edit or schema addition occurs.

### Focused read-only review

Independent agent reviews and root review cover transaction locks/atomicity,
owner/Organizer invariants, Origin/Fetch Metadata, parameterized SQL, role versus
identity, date/timezone semantics, expectedVersion/no-op behavior, scoped URL/auth
allowlisting, stale requests, permission affordances, locked pages and narrow scope.
Confirmed findings were fixed: a list-to-scoped-read membership revocation race
could retain an edit context; denied Event entries are now removed and matching
403/404 regression tests pass. NUL and malformed Unicode names could reach
PostgreSQL text/JSONB errors; server and frontend reject them safely and real
create/edit tests prove canonical data/history unchanged. This is code review and
executed verification, not external/formal security certification or human acceptance.

Further integrated review caught cross-Event browser Back consuming saved Dashboard
focus/scroll while reads were still loading; restoration now waits for the scoped
content. Event-form feedback focus now runs after the alert commits and pending
controls settle, including failed conflict reloads. A deferred pre-write Event-list
read could publish old metadata after a confirmed edit; Event commands now settle
an existing read/task refetch before writing, while new focus reads coalesce with
the command. Five deferred regressions verify full same-Event workspace/version
preservation, create/list ordering, task refresh, conflict/no replay and prompt
cancel/no write. Browser cases cover committed alert
focus and delayed cross-Event Back rather than asserting only immediate responses.
Actual mobile focus testing also found a Create target partly covered by fixed
navigation despite being geometrically in the viewport. The new Event form now
uses the existing focus-reveal helper after native focus, keeping fields/buttons/
alerts above the real fixed header/nav; stale/unmounted focus frames are canceled.
This is scoped form behavior, with no locked core CSS change.

### Browser/visual verification method and intermediate runs

Chromium/Edge runs use separate real controlled Organizer and Member sessions,
the running development backend and read-only SQL proof. Named transport doubles
cover zero memberships, held reads and 400/403/404/500/network failures; equivalent
content visuals use fixed-clock, read-only intercepted P1 fixtures. Those cases
are labelled and are not presented as live database behavior or human feedback.

Incomplete attempts are not passing-suite evidence. Shared archive/current Vite
dependency cache produced duplicate React; the archive cache was isolated and the
current Vite cache rebuilt. Initial live P1 runs during HMR/backend watch changes
were replaced by immutable archived baselines. An Organizer edit diagnostic helped
confirm the pre-write stale-list race fixed above. Error-focus assertions were
changed to await the exact failed response and settled pending controls, avoiding
an older alert. Native-select verification initially ran before Event loading;
it now waits for ready/current value and validates the actual selected accessible
ID. Preference seeding originally reset every navigation to EN/light; conditional
seeding and explicit document language/theme/localized heading assertions corrected
the matrix and actual viewport recaptures. A concurrent auth run hit the real
sign-in limiter and was rerun sequentially. The expired-edit test now waits for
initial reads to settle, so it specifically verifies a command 401 instead of an
earlier protected-read 401. Credentials/raw backend errors/auth material are not saved.
An incomplete final P1 action run was interrupted by backend watch restarts;
it is excluded and the completed rerun uses the same backend without watch mode.

### Completed current-browser checks

- P2A authoring: **14 grouped checks / 20 layout configurations**, PASS, zero
  application errors. Each configuration verifies both Create and Edit, actual
  BG/EN document language/localized heading, light/dark theme, labels, date/timezone
  controls, >=44px targets, overflow, native-focus hit testing and manual scroll
  reachability. Widths: 1440/1024/768/390/320. Native keyboard switching, committed
  alert focus, held initial loading and delayed cross-Event Back focus/scroll pass.
- Real independent sessions verify Organizer create/edit and Member create,
  MEMBER in the original Event versus owner/ORGANIZER in the newly created Event,
  scoped switcher options, Dashboard/Tasks/Team page equivalence, deep links,
  refresh, Back/Forward, task-detail dropping and late-request isolation. Fresh
  Dashboard/Tasks are empty and Team contains only the creator. Poisoned old local
  demo state is unused. Creation issues one pending command without a page reload.
- Read-only SQL confirms trusted owner/active Organizer, no cloned tasks,
  canonical fields/versions, EVENT_CREATED and useful changed-field EVENT_UPDATED
  payloads. Two simultaneous real edits with one expectedVersion yield exactly
  one 200/one 409 and one history addition. Stale form 409 loads canonical fields
  and requires explicit review/save; no replay occurs. Actual expired edit PATCH
  returns 401, clears the shell, preserves the Event and leaves the independent
  Member session authenticated. Real Member edit403 and foreign read/route404,
  plus forged owner/role/actor field400 cases, fail closed.
- Preserved P1 workspace: **11 grouped checks / eight real page-width cases**,
  PASS. Real Dashboard/Team counts, identities, task round-trip, history/focus/
  scroll and shared reads are retained; no business write request is sent.
- Preserved P1 Tasks reads: **13 grouped checks / five widths**, PASS, no task
  command requests, zero application errors; real scoped rows/roles, failure,
  refresh, deep links and protected-read expiry remain covered.
- Preserved P1 auth: **15 grouped checks / 20 Login layout cases**, PASS, zero
  application/console errors. Real sign-in/session/sign-out/revocation, return
  allowlisting and the mobile account menu remain covered.
- Preserved P1 responsibility actions: **16 grouped checks / 40 role/language/
  theme/width drawer cases**, PASS, zero application errors. Real assignment,
  acceptance, withdrawal, all statuses, self-assigned Organizer acceptance,
  reassignment clearing, task409, foreign/role denial, pending/duplicate prevention,
  failed-refetch recovery, keyboard controls and actual mutation401 remain covered.
  SQL confirms **24 confirmed UI changes / 24 ActivityEntry rows**, all six task
  action types, correct server actors, and final controlled task **Member-assigned,
  unaccepted, not-started, version306**. History from incomplete attempts is retained.

All five current browser suites total **69 grouped checks / 93 layout cases**, PASS,
zero application errors. The additional eight native-focus mobile Create/Edit
checks and 21 corrected actual shell/form viewport images support visual inspection.

These are agent-run Chromium/Edge desktop/emulation results, not real-device,
Safari/Firefox, screen-reader certification, human acceptance or invented feedback.

### Intentional retained development Events

All **10** `BudoGraph P2A ...` Events from complete/incomplete UI attempts remain
in the development database, as permitted. Each has exactly **one membership and
zero Tasks**. No original Event/account was deleted or reset. Version and activity
counts are recorded below; history is retained, not cleaned destructively.

| Event ID                             | Account label/run suffix          | Version | Activity rows |
| ------------------------------------ | --------------------------------- | ------: | ------------: |
| 8d004297-6103-4580-9d63-d8d268a8ce4a | Organizer / 6f657643              |       2 |             2 |
| 96a5aecc-6856-4934-8950-aa20c6a39537 | Organizer / 17e79bb2              |       2 |             2 |
| 4aa73faa-1d2f-49e6-a4cd-8c3492036938 | Organizer / abd91634              |       4 |             4 |
| 97137f46-4614-4a53-8207-e97461e80f9b | Member / abd91634                 |       1 |             1 |
| 5e69c3ae-d451-4a9f-b5e5-07a8b710fb27 | Organizer / 77534830              |       4 |             4 |
| 938b3d87-5ffb-4546-8968-07dd5259275e | Member / 77534830                 |       1 |             1 |
| f6efadf2-89a7-417d-8797-8345a0a37817 | Organizer / 0237d19c              |       4 |             4 |
| 465cc5f7-2a9d-4d30-bd92-c6ba2906c527 | Member / 0237d19c                 |       1 |             1 |
| a32aa42a-54db-4d15-a8ca-f4c9b8d34062 | Organizer / e1a9a556 (final pass) |       4 |             4 |
| c1e397c7-69e3-474c-bb91-8d7940c8522f | Member / e1a9a556 (final pass)    |       1 |             1 |

Private SQL owner/actor proofs use actual server-derived identities; credentials,
session values and controlled account emails are not included here. Local ignored
`tmp/p2a-evidence` holds sanitized reports/screenshots and the attempt ledger.

### Locked equivalent-content visuals

Immutable baseline/current pairs cover Dashboard, Tasks, Team and an other-assignee
task drawer at **1440/1024/768/390/320 × BG/EN × light/dark: 80 pairs**. The fixed
clock/content transport fixture is read-only and creates no real Tasks. Core
capture dimensions match in all 80; horizontal overflow is absent. The added
mobile sticky switcher legitimately overlays ordinary `.app-main` screenshots, so
header/mobile-nav visibility was hidden symmetrically only for the core comparison.
No core page region was masked. Actual shell and form viewport captures are separate.

**67/80 first core pairs are pixel-identical**. Twelve remaining pairs differ in
only **1–18 pixels**, maximum RGB channel delta **1**; the remaining 1440 BG-dark
Dashboard pair differed by 390 pixels, almost all delta <=2 with one delta12 pixel.
An unchanged-current recapture of that pair is exactly identical to baseline,
demonstrating raster/compositor variance. Repeats of the other twelve retain only
the tiny RGB1 differences. Difference images and representative actual/core
desktop/mobile captures were inspected: no core content, geometry or design change
was found. This is not a claim that all first screenshots were pixel-identical.
An unchanged-current 390 EN-light Dashboard repeat is also exactly identical to
both baseline and first current capture (zero changed pixels).
Shared core CSS, Dashboard and TaskDrawer source are unchanged; Team changes are
scoped-link/history handling, and Tasks/read-notice changes localize inaccessible
Event feedback. New CSS is limited to Event authoring/switcher selectors.

### Staged safety and completion boundary

Staged review contains exactly the **46 intended manifest files** below. Private
comparison of **seven configured credential/secret values** (including database
password, full connection URL, auth secret and controlled account inputs) against
the full staged contents, staged diff and frontend bundle finds **zero matches**.
No environment file, cookie/session dump, browser auth state, HAR/trace, temporary
evidence or unrelated shortcut is staged. Staged whitespace is clean.

Applied migrations, dependency lockfile, shared core CSS, Dashboard and TaskDrawer
are unchanged. No schema/dependency/asset addition or destructive database operation
is included. Local current Vite5173 and non-watch backend3001 remain runnable;
temporary archive helpers stopped. Normal documented `server:dev` remains available.
P2A is complete; task authoring, invitations, Event archive/delete and Changes/Plan B
are not implemented. P2B is not started. Production/offline/backup verification and
actual-year NOIT rule verification remain separate work.

### Changed files (46)

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-auth-ui.mjs
scripts/verify-event-authoring-ui.mjs
scripts/verify-task-actions-ui.mjs
scripts/verify-task-reads-ui.mjs
scripts/verify-workspace-ui.mjs
server/src/app.ts
server/src/events/model.ts
server/src/events/service.ts
server/src/main.ts
server/src/routes/events.ts
server/tests/event-authoring.integration.test.ts
server/tests/event-authoring.test.ts
server/tests/event-validation.test.ts
server/tests/events.test.ts
src/App.tsx
src/auth/routing.ts
src/components/AppLink.tsx
src/components/AppShell.tsx
src/components/EventSwitcher.tsx
src/components/WorkspaceReadNotice.tsx
src/components/eventSwitcher.css
src/hooks/useRemoteTasks.ts
src/i18n/eventMessages.ts
src/i18n/messages.ts
src/pages/EventFormPage.tsx
src/pages/TasksPage.tsx
src/pages/TeamPage.tsx
src/pages/events/events.css
src/pages/events/helpers.test.ts
src/pages/events/helpers.ts
src/routes.test.ts
src/routes.ts
src/services/RemoteWorkspaceService.ts
src/services/eventActions.test.ts
src/services/taskActions.test.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
src/services/workspaceViews.test.ts
```

## P1 final-audit closure fixes — 2026-10-03

Authorized baseline `dfccbe92d3ea851376225dc0ab905e39fd5cf821`, `main` and
`origin/main` synchronized before changes. The final read-only audit confirmed
three findings: Organizer own-task acceptance blocked by frontend role logic,
Dashboard navigation verification assuming an attention item, and superseded
current deployment/demo guidance. This change closes only those findings.

### Correction and focused review

Acceptance display eligibility now depends on the current Event membership being
the current assignee, for Organizer and Member alike. Missing task/Event, archived
Event and foreign-Event guards remain. The backend authorizes every command and
was not changed. Four added role/acceptance-state unit cases cover own assignment,
another assignee, archive and Event mismatch; existing Organizer expectations and
missing-task coverage were corrected/retained.

The workspace browser verifier uses any visible real Dashboard task link. With
no link, its labelled one-response transport fixture reuses an already loaded
real task ID, tests drawer/history/focus/scroll navigation, then restores and
rechecks real reads. Explicit accepted In-progress and completed-only fixtures
prove no-attention and no-link behavior. No production selector or business data
is altered by this read verifier.

The deployment/demo plan now describes Better Auth, configured PostgreSQL/Supabase
development data, shared real Dashboard/Tasks/Team, controlled accounts and no
runtime demo fallback. Old reset/local/offline instructions are historical.
Current Event creation, task authoring and Changes/Plan B persistence are absent;
Backend P2 has not started. The user guide distinguishes authorization role from
acceptance eligibility and prohibits accepting on another person's behalf.

Focused source review found no further confirmed defect in these corrections.
CSS, page/drawer components, routing, backend authorization, database/schema,
migrations, dependencies and lockfile remain unchanged. No database reset occurred.
The unrelated `docs/market-research/docs - Shortcut.lnk` remains untouched.

### Executed checks

- Frontend format/write, format check, lint, typecheck, **169/169 tests**, build:
  PASS. Both changed `.mjs` browser verifiers also received explicit formatting.
- Backend typecheck, **80/80 offline tests**, build: PASS. Three opt-in integration
  roots skip in the offline suite; those skips are not database evidence.
- Explicit PostgreSQL integration suite: **34/34**, zero skips, PASS; existing
  rollback-only fixtures against the approved development database.
- Workspace browser: **11 grouped checks / eight real page-width cases**, PASS,
  zero application errors and zero Event/task business mutation requests.
- Task-action browser: **16 grouped checks / 40 role/language/theme/width drawer
  cases**, PASS. Real UI commands and read-only SQL prove Organizer self Accept,
  Withdraw (assignment retained and acceptance fields cleared), reaccept and
  reassignment clearing. Organizer viewing Member assignment has no acceptance
  control; a direct real-session acceptance request returns **403** with unchanged
  canonical row. Member accepts normally. Real stale-version **409**, pending
  controls, recovery and mutation **401** regressions remain covered.
- All **24 confirmed UI changes** have matching scoped ActivityEntry action,
  actor and version. History remains intact. Normal UI commands leave the
  controlled task assigned to Member, unaccepted, `not-started`.
- Auth browser: **15 grouped checks / 20 Login layout cases**, PASS, zero page
  or console errors; real session invalidation, isolated roles, HttpOnly cookies,
  no browser token storage and closed public signup remain verified.
- `git diff --check` and staged scope/secret audit: PASS. Exactly eight intended
  files staged; 229 tracked files, staged contents/diff and production bundle
  contain no configured credentials. Environment files, shortcut, browser auth
  artifacts and ignored evidence are absent from the staged paths.
- Preserved Tasks read browser: **13 grouped checks / five widths**, PASS, zero
  application errors and zero task mutation requests; real reads, forbidden demo
  IDs, empty/loading/error states, refresh and read-session expiry remain covered.
- Baseline/current visual comparison: **80/80 exact pixel matches** for Dashboard,
  Tasks, Team and another-assignee drawer, at 1440/1024/768/390/320, BG/EN,
  light/dark. These are labelled equivalent transport fixtures, not SQL proof.
  **40 additional labelled Organizer self-assigned Accept/Withdraw layout cases**
  verify both states, languages/themes and widths, no overflow, 44px controls,
  zero page errors and zero writes. Representative desktop/narrow images were
  inspected. The only intended new display behavior is the existing acceptance
  control becoming available to the self-assigned Organizer.

Ignored local browser reports/screenshots remain under the existing `tmp/p1d*-evidence`
paths and `tmp/p1-closure-evidence`. They are not staged, and no cookies, HAR,
traces, storageState or session dumps were saved. Failure fixtures and visual
fixtures are explicitly separate from actual backend behavior.

### Intermediate harness issues and limits

Starting the archived reference through pnpm initially aborted on its dependency
junction; invoking the existing Vite CLI directly worked without installation.
The initial visual run matched 74/80 pairs; six drawer captures included opening
animation frames. Using the application's reduced-motion mode and waiting for
animations to settle produced 80/80 exact matches, without editing product code
or masking screenshot regions. Those initial attempts are not counted as passes.

This is agent-run Edge/Chromium verification, not new human acceptance, physical
device/Safari/Firefox coverage, formal security/accessibility certification or
production deployment proof. Hosting, operational backups and production hardening
remain separate. The supplied 2025–2026 NOIT rules need actual-year reverification.

## P1D.3 real Dashboard and Team — 2026-10-03

Authorized baseline `6566c25b3fd8021963bf6e85a50ecc7921961b7a`, `main`, freshly
fetched `origin/main`, ahead/behind 0/0, no tracked changes. The unrelated shortcut
remains untouched. Mandatory master prompt, 30-page supplied 2025–2026 regulations,
approved backend contract and locked UI were read before implementation. Actual-year
eligibility, categories, dates, GPLv3, availability, role accounts, PDF format and
rubric still need verification. This implements the explicitly authorized P1 slice.

### Data, selectors and scope

Authenticated data mode: **Dashboard REAL, Tasks REAL, Team REAL**. One existing
RemoteWorkspaceService/controller owns the Event/member/task snapshot across routes.
Both roles read active members. Task-assignee name context preserves historical
inactive assignees separately from Team/counts/pressure. Operational roles never grant
authority. Initial Event selection is earliest accessible start date then UUID;
navigation and refetch pin it, scope loss fails closed, full reload resolves again.

Event Overview uses stored name/date/timezone and existing completion/lifecycle
counts. Unsupported guest/location/status are honestly absent. Operational Focus,
Team summaries and pressure retain deterministic selectors. Timeline preserves real
DATE strings and uses actual task deadlines and Event start/end boundaries, classified
with the Event-local calendar. No invented milestones, scores or future tasks.
**Changes/Plan B persistence: NOT YET IMPLEMENTED until P3.** The existing region
contains no fictional responses. Plan B and Templates show truthful unconnected states.
No activity feed, endpoint, migration, dependency, member mutation or P2/P3 work added.

### Verification

Before implementation: frontend **155/155**, backend offline **80/80** (its three
opt-in roots skipped), and explicitly enabled PostgreSQL **34/34**, zero skips.
The initial default integration skip was not counted as a database pass.

Final frontend **165/165** includes mapping, active/historical relationship context,
unsupported fields, real DATE/timezone, Dashboard/Team selectors, real IDs, foreign
Event exclusion, empty data, malformed members, member endpoint 401/403/500, current
Event pinning and lost membership. Existing navigation/auth/action tests remain.
The old per-role request assertion now expects active-member reads for both roles.
Final opt-in PostgreSQL regression: **34/34**, zero skips, against the approved
development database, using rollback-only fixtures; server/schema source unchanged.

`test:browser:workspace`: **9 grouped checks**, eight real viewport/page cases
(1440/768/390/320), zero app errors, **zero business mutation requests**. Real
independent controlled Organizer/Member sessions proved:

- Event name/DATE/timezone, active member IDs/names/roles, task titles/status/priority/
  deadline/assignment/acceptance member/version match authenticated API and targeted
  read-only PostgreSQL queries. Dashboard counts/focus/pressure and Team roster order/
  responsibility/acceptance facts match existing selectors over those real responses.
- Member sees the same authorized Event and no Organizer assignment controls. Dashboard
  and Team real task links open the real drawer. Escape, Back/Forward, exact focus and
  scroll restoration pass. Core-page navigation adds zero Event/member/task requests.
- Refresh preserves canonical data. Poisoned old local Event/member/task/Change/template
  names never render; the old localStorage workspace stays untouched. Plan B/Templates
  show no fictional records or task links.
- Both pages handle loading, empty tasks/members, no Event, safe retryable 500/403.
  These are **labelled transport interceptions**, not actual backend outages.
  Real sign-out then protected read returns 401, clears Dashboard/Team shell/data and
  returns to Login; the independent other session remains valid.

Preserved auth browser regression: **15 grouped checks / 20 Login cases**. Preserved
Tasks read browser regression: **13 grouped checks / five viewports**. Preserved
action browser regression: **14 grouped checks / 40 role/language/theme/viewport
drawer cases**, real responsibility/status/409/activity versions/actors/401 and safe
errors. The recovery extension checks stale-summary warnings/retry on Dashboard/Team
before retaining the original closing/switching drawer recovery checks. Intercepted
errors and a read-only synthetic second row are separate test evidence. The action
verifier intentionally appends development history and leaves the controlled task
assigned to Member, unaccepted, `not-started`. No history is destroyed.

### Visual lock and fresh review

The exact Git archive of the baseline served equivalent-content comparisons with
the same installed dependencies and a separate Vite cache. Safe synthetic auth,
UUID-remapped local content, matching Event boundaries and no fictional Changes are
**visual-only fixtures**, not PostgreSQL proof. Matrix: 1440/1024/768/390/320 × BG/EN ×
light/dark. Real screenshots also cover four viewport widths on Dashboard/Team with
zero overflow. Representative real and controlled narrow/desktop images were inspected.

Team workspace, Tasks register and drawer each matched **20/20 pixels exactly**. All
**140/140 region interiors** match after excluding the single capture-edge pixel.
Dashboard
Operational Focus, Timeline, Team Pressure and Overview metrics preserve content,
ordering, geometry and composition. Regional screenshots normalize capture origin
to exclude intended unsupported Event text and Change empty-state differences above
them; tiny one-pixel crop-edge differences and earlier transient native drawer focus pixels are capture
artifacts, not composition changes. Whole Dashboard content intentionally differs
for real/missing fields and truthful Changes absence. All CSS, Tasks UI, navigation/
focus/history source, lockfile and backend/schema source remain unchanged.

A fresh read-only self-review covered real/demo separation, Event/member scope,
authority, unsupported data, dates, links, loading/session/cancellation, lock preservation
and scope creep. Confirmed finding: failed command refetch left Dashboard/Team stale
summaries without Tasks' warning. Fixed with a safe warning/retry and extended recovery
browser coverage. No other confirmed finding remained. Agent review is not human
acceptance, product validation or formal security/accessibility certification.

### Intermediate failures and remaining limits

Bundled pypdf replaced an unavailable extractor import. First typecheck found fixture
display-flag compatibility; display-only types were broadened without inventing real
authority. An expanded browser run timed out after initial checks; a later attempt
saw a refused Vite connection. A task-owned listener and full rerun passed. The archived
visual harness initially had duplicate React/shared-cache behavior; isolated cache
and deduplication fixed it. Fractional crop origins/fixed chrome caused screenshot
differences which were isolated and inspected, not concealed or reported as passes.
The recovery extension passed its original assertions but a later keyboard harness
step sent End before the listbox focus animation frame. Explicit waits now require
the listbox option and final option to have focus; no assertion was weakened and no
product selection-control change was made.

Ignored evidence/logs/screenshots: `tmp/p1d3-evidence/` and `tmp/p1d3-*.log`. No credential,
cookie jar, session dump, HAR, trace or storageState is saved. Production hosting,
onboarding/recovery/invitations, offline/backup demonstration, other browser engines/
physical devices, actual-year rules and human validation remain outside P1D.3.
No user feedback, survey result, certification or commercial outcome is invented.

### Completion checks and staged audit

All requested checks passed: `pnpm.cmd format`, `format:check`, `lint`, `typecheck`,
`test` (165/165), `build`, `server:typecheck`, `server:test` (80 offline passes),
`server:build`, opt-in `server:test:integration` (34/34, zero skips), both browser
regressions plus workspace/auth browser checks, script formatting and `git diff --check`.
The complete final action rerun passed all 14 checks and 40 drawer cases, including
the new core-page stale warnings and explicit keyboard focus assertions.

The staged audit checked exactly **28 intended files**, actual configured sensitive
values privately against complete staged contents/diff/frontend bundle, and excluded
environment/credential/shortcut/tmp/browser artifacts. No secrets or excluded files
were found. Authenticated runtime source has no demo initialization/fallback, browser
auth storage or hardcoded Event UUID. Locked CSS/Tasks/navigation, dependency lockfile,
backend and schema files are unchanged. Staged whitespace passes.

**P1D.3 REAL WORKSPACE: PASS. P1 CORE COMPLETE: YES.** P2 was not begun. This is the
approved core completion, not production deployment or completed competition packaging.

Changed files (28):

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-actions-ui.mjs
scripts/verify-workspace-ui.mjs
src/App.tsx
src/components/AppShell.tsx
src/components/WorkspaceReadNotice.tsx
src/domain/workspace.ts
src/i18n/messages.ts
src/i18n/workspaceMessages.ts
src/pages/DashboardPage.tsx
src/pages/TeamPage.tsx
src/pages/dashboard/ChangeImpact.tsx
src/pages/dashboard/EventOverview.tsx
src/pages/dashboard/OperationalFocus.tsx
src/pages/dashboard/PreparationTimeline.tsx
src/pages/dashboard/helpers.ts
src/pages/team/helpers.ts
src/services/RemoteWorkspaceService.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
src/services/workspaceViews.ts
src/services/workspaceViews.test.ts
```

## Phase 1 baseline — 2026-08-04

Verified on 2026-08-04 in the local Windows workspace using Node.js
`v24.16.0` and pnpm `11.9.0`.

### Automated checks

The following commands were run from the repository root after the Phase 1
implementation was assembled:

| Command             | Result                                                          |
| ------------------- | --------------------------------------------------------------- |
| `pnpm format:check` | Passed; all scoped files matched Prettier formatting.           |
| `pnpm typecheck`    | Passed; the strict TypeScript project build reported no errors. |
| `pnpm lint`         | Passed; ESLint reported no errors or warnings.                  |
| `pnpm test`         | Passed; 8 tests passed with 0 failures.                         |
| `pnpm build`        | Passed; Vite produced the production bundle in `dist/`.         |

The focused tests cover readiness and task counts, overdue calculation,
upcoming and attention queues, team workload, immutable state transitions,
change-to-task relationships, saved-state validation and fallback, and the
fictional seed scenarios.

### Browser verification

The Vite development build was exercised in the Codex in-app Chromium browser
at a `1440 x 900` desktop viewport, an intermediate `1080 x 900` viewport, and
a `390 x 844` mobile viewport.

Verified behavior:

- Dashboard, Tasks, Team, Changes & Plan B, and Templates rendered at desktop
  and mobile breakpoints.
- The desktop sidebar changed to the compact mobile header and fixed bottom
  navigation at the mobile breakpoint.
- No horizontal document overflow was detected on the checked desktop or
  mobile views.
- At 1080 px, task rows used the intended three-column reflow, placed status and
  acknowledgement controls on the second line, and clipped no controls.
- Targeted edge checks at 1260 px and 1130 px confirmed the five-column and
  three-column task layouts respectively, with no clipped controls or overflow.
- Task status and owner filters reduced the visible list correctly; owner
  grouping produced five team sections.
- A task status update and acknowledgement were reflected in its row and detail
  drawer.
- The task drawer opened at desktop and mobile sizes, focused its close control,
  trapped forward and reverse `Tab` movement, retained select focus after a
  status update, closed with `Escape`, and restored focus to its task trigger.
- The task status and acknowledgement survived a browser reload, exercising the
  `localStorage` adapter.
- Selecting a team member updated the assigned-task detail area.
- Before resolution, the change showed affected work and the direct-contact
  escalation. Its response then advanced to resolved and could be acknowledged.
- Resolving the only active change produced a meaningful dashboard empty state
  rather than a blank panel.
- The template reset used a confirmation step, restored the fictional seed,
  and displayed a success status. The reset returned the task and change state
  to its original demonstration values.
- The checked browser console contained no warning or error entries.

### Demonstration-data check

A scoped source scan found no known interview-associated names or identifiers,
private-call references, `mailto:` or `tel:` links, or email-address-like
strings under `src/`. The visible seed identities and venue are fictional and
the interface labels the workspace as fictional demonstration data.

### Evidence boundary

These results verify the listed local checks only. They are not production,
security, usability, formal accessibility, device-coverage, or product-market
validation. The demonstration data is synthetic, and no interview respondent
or real participant data was used in the browser checks.

## Phase 2A verification — 2026-08-06

Verified in the local Windows workspace with Node.js `v24.16.0`, pnpm `11.9.0`,
Vite `6.4.3`, and the Codex in-app Chromium browser.

### Automated checks

The following commands were run from the repository root after the Phase 2A
source and documentation changes:

| Command             | Result                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm format`       | Passed; Prettier applied the repository formatting configuration.    |
| `pnpm format:check` | Passed; every scoped source and documentation file matched Prettier. |
| `pnpm lint`         | Passed; ESLint reported no errors or warnings.                       |
| `pnpm typecheck`    | Passed; the strict TypeScript project build reported no errors.      |
| `pnpm test`         | Passed; 31 tests passed with 0 failures, skips, or cancellations.    |
| `pnpm build`        | Passed; Vite transformed 1,622 modules and produced `dist/`.         |

The production output reported a 338.72 kB JavaScript bundle (95.35 kB gzip),
a 46.44 kB CSS bundle (9.17 kB gzip), and a 2.04 kB HTML document (0.86 kB
gzip).

The focused tests cover the existing workspace calculations and persistence
validation plus:

- Bulgarian-only primary-locale detection and English fallback;
- versioned, independently valid language/theme preference parsing;
- explicit preference persistence and storage-failure fallback;
- Light/Dark/System resolution and live System `matchMedia` change handling;
- typed English/Bulgarian catalog parity, interpolation, plural rules, and
  `Intl` date, range, number, percent, and relative-date formatting;
- non-mutating localization of every known fictional demo field;
- canonical task-link creation/parsing, typed History-state marker recognition,
  malformed or duplicate query handling, valid/unknown/wrong-event task
  resolution, and rejection of ambiguous duplicate saved task IDs;
- readiness, mutually exclusive status totals, overdue overlap, workload, and
  explicit workload signals, plus the 44-task/18-milestone synthetic stress
  fixture.

### Browser and long-content verification

The Phase 2A Vite development source was exercised at viewport widths of 320,
390, 768, 1080, and 1440 pixels. Standard and synthetic stress workspaces were
used; the stress workspace contains 44 tasks, 18 milestones, long Bulgarian
copy, a long event name, long fictional member names, multiple badges, and long
task details.

Verified behavior:

- The application document had no content-caused horizontal overflow at any of
  the five required widths after two discovered mobile defects were corrected:
  a legacy document minimum width and the owner filter's intrinsic minimum.
- The desktop sidebar remained available at 1080 and 1440 pixels. The sticky
  compact header and five-item bottom navigation were in bounds and usable at
  320, 390, and 768 pixels.
- Language and theme controls remained visible at every checked width.
- The long stress-event heading wrapped without escaping its hero at 320, 390,
  768, and 1440 pixels. Long task titles, descriptions, Bulgarian copy, member
  names, status badges, and affected-work content also remained bounded.
- The 44-task stress list rendered all rows at 320, 390, and 768 pixels. The
  owner filter and first task status control remained in bounds, and task dates
  did not reserve a crushing fixed column on mobile.
- A long task detail opened at 320 pixels in a 320-pixel drawer; its content had
  no horizontal overflow and its description stayed inside the content area.
- The stress milestone section initially showed six chronological entries. Its
  disclosure opened the remaining 12 entries inside a 420-pixel capped scroll
  region rather than extending the page without limit.
- The Changes view at 390 pixels wrapped its long synthetic change title,
  showed the scenario-specific escalation instruction, and did not show the
  removed generic `Direct contact recommended` Dashboard instruction.
- The Team view at 320 pixels wrapped the long fictional member names without
  overflow.

### Localization, theme, and URL interaction checks

- Selecting Bulgarian changed `document.documentElement.lang` to `bg`,
  localized the current view and accessible preference names, and remained
  selected after refresh. Selecting English restored `en` and English UI copy.
- Selecting Light applied `data-theme="light"` and survived refresh. Selecting
  Dark applied `data-theme="dark"`. Selecting System remained pressed and
  resolved to the checked device's dark preference. Live device-preference
  change handling was verified by the automated `matchMedia` listener test; the
  operating-system preference itself was not changed during this browser pass.
- A Dashboard attention item had exactly one canonical
  `/tasks?task=task-guest-itinerary` target and opened that task's dialog.
- Refresh preserved the valid task URL and reopened the same task. Browser Back
  returned to the Dashboard with no dialog, and Forward restored the exact task
  and dialog.
- `/tasks?task=missing-task` opened no dialog, displayed the localized
  task-not-found notice, and kept the full task list available.

After this interactive browser pass, the final reviewer hardening split the
Dashboard into domain-specific section components, added bounded change and
workload continuations and explicit workload signals, strengthened task-return
focus restoration, and rejected duplicate saved task IDs. Those changes passed
the recorded formatter, lint, strict typecheck, 31-test suite, production build,
and read-only code review; a second interactive browser session was not
recorded, so the browser evidence above applies to the checked revision rather
than every final reviewer adjustment.

### Demonstration-data and privacy check

A scoped source scan covered interview identifiers, named interview references,
contact-link schemes, email-like strings, passwords, secrets, and API-key-like
text. The only `interview` match in application source was the stress fixture's
explicit statement that it contains no interview details. No private interview
content or real contact information was found. The standard and stress
workspaces label their people, venues, events, and incidents as fictional or
synthetic.

### Evidence boundary

This evidence covers the listed commands and one in-app Chromium session. It is
not a formal accessibility or contrast certification, clean-console audit,
real-device test, cross-browser matrix, security assessment, production-hosting
test, offline-package test, or product/usability validation. System-theme live
response was simulated in an automated unit test rather than by changing the
host operating-system setting. The historical NOIT regulation in this
repository applies to the 2025–2026 competition year and must be reverified for
any later year.

## Phase 2A.1 responsive stabilization — 2026-08-06

The final Phase 2A.1 application source was tested after its last component and
CSS change and before documentation-only evidence edits. Its exact source
identity is the Phase 2A parent commit
`f9f1ffece3a529f188bb9b8f3f6fa744087e4217` plus the application patch whose
Git object hash is `19b7e9d8b0c15d5e18659484889e50088b3122f4` (`index.html`,
`package.json`, and `src/`). The final commit hash is retained in Git history
and the completion report rather than embedded here, which would make this
document self-referential.

Verified locally on Windows with Node.js `v24.16.0`, pnpm `11.9.0`, Vite
`6.4.3`, and the Codex in-app Chromium browser.

### Root-cause and automated protection

The browser screenshots were traced to layout rules rather than data or routing
defects:

- status badges inherited aggressive word-breaking and allowed normal wrapping;
- mobile affected-task and deadline rows retained desktop horizontal
  competition between long titles and status metadata;
- the workload identity retained a `170px` flex basis after its parent switched
  to a column, turning a desktop width basis into vertical empty space;
- the five summary metrics used an undifferentiated two-column flow, leaving an
  orphaned fifth item;
- the document reserved a fixed bottom amount that did not share the fixed
  navigation's safe-area calculation;
- header controls had desktop gaps and sizing at the narrowest breakpoint; and
- the full Changes & Plan B navigation label was too long for the desktop
  sidebar measure.

Three CSS-contract tests were added. They assert indivisible status labels,
deliberate mobile summary/deadline/workload/affected-task compositions, and
safe-area-aware navigation and page spacing. The complete suite now contains 34
tests.

### Final browser matrix

The Dashboard was checked in the following explicit combinations:

| Viewport | Language  | Theme preference | Workspace |
| -------- | --------- | ---------------- | --------- |
| 320 px   | Bulgarian | Dark             | Stress    |
| 327 px   | English   | System           | Stress    |
| 360 px   | English   | Light            | Standard  |
| 390 px   | Bulgarian | Light            | Stress    |
| 768 px   | English   | Dark             | Stress    |
| 1080 px  | Bulgarian | System           | Standard  |
| 1440 px  | English   | Light            | Standard  |

The checked device resolved System to Dark. Live System preference changes are
covered by the existing `matchMedia` listener test. In addition, Dashboard,
Tasks, Team, Changes & Plan B, and Templates were each checked with the stress
workspace at 320 px in Bulgarian/Dark and at 390 px in English/Light.

Results from the final source:

- No tested page produced application-content horizontal overflow or a clipped
  interactive control. No visible status badge clipped or wrapped internally.
- At 320 and 390 px, every page's final content item could be scrolled 39–41 px
  clear of the fixed navigation. The page and navigation use the same
  `safe-area-inset-bottom` basis.
- The 320–390 px task summary used an intentional full-width total followed by
  a balanced two-by-two status grid.
- Affected tasks stacked title before status; deadlines stacked date, content,
  and status; workload identities used natural heights of 31–63 px instead of a
  170 px vertical basis. No large unexplained workload gap remained.
- The 320 px header kept the wordmark plus all five language/theme buttons in
  bounds with no overlap or clipped controls. Touch controls remained 32 px
  square inside the compact grouped control.
- The stress Tasks page rendered all 44 rows at 320 and 390 px. The stress
  Dashboard rendered all 18 milestone nodes; its disclosure opened the 12-item
  continuation in the existing 420 px capped scroll region.
- A 143-character mixed English/Bulgarian task title opened in a full-width
  320 px drawer. Its 273 px title area had equal client and scroll widths, its
  badges remained intact, and the document had no horizontal overflow.
- The drawer initially focused its close control, retained focus inside on
  `Tab`, closed with `Escape`, and restored focus to the originating task link.
- A Dashboard attention link opened exactly
  `/tasks?task=task-guest-itinerary`; refresh reopened the same task, Back
  returned to the Dashboard and restored its trigger focus, and Forward
  reopened the drawer. An unknown task ID displayed the localized warning and
  opened no dialog.
- The Bulgarian desktop sidebar uses the concise `План Б` label in a single
  44 px row while the full page heading remains unchanged.

### Console audit

The final interactive session accumulated zero application warnings and zero
application errors. The screenshot's `/favicon.ico` 404 was application-owned;
an explicit blank data favicon now prevents that implicit request without
introducing a permanent logo. The screenshot's asynchronous message-channel
entries were not reproduced in the controlled app console, and a source scan
found no browser-extension/runtime messaging API use. They are therefore
reported as browser-extension or DevTools-runtime noise, not silently counted
as application success.

### Verification boundary

This is controlled Chromium emulation, not physical-device, Safari, Firefox,
screen-reader, zoom, or formal performance/accessibility certification. The
browser pass verifies the listed source identity and interactions only. The
2025–2026 NOIT regulation remains historical and requires re-verification for a
later competition year.

## Phase 2B.1 visual identity and Dashboard refinement — 2026-08-12

Phase 2B.1 was verified in the local Windows workspace with Node.js
`v24.16.0`, pnpm `11.9.0`, Vite `6.4.3`, and the Codex in-app Chromium
browser. The final browser pass began after the last application-source change;
the remaining evidence edits were documentation-only.

### Baseline and automated checks

Before editing, the synchronized clean `main` baseline at `ff5d2f5` passed
format checking, lint, strict typechecking, all 34 tests, the production build,
and `git diff --check`.

After implementation, the repository checks passed as follows:

| Command                 | Result                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `pnpm.cmd format`       | Passed; Prettier applied the repository formatting configuration. |
| `pnpm.cmd format:check` | Passed; every scoped file matched Prettier.                       |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.                    |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.               |
| `pnpm.cmd test`         | Passed; 38 tests, 0 failures, skips, or cancellations.            |
| `pnpm.cmd build`        | Passed; Vite transformed 1,620 modules.                           |
| `git diff --check`      | Passed; no whitespace errors.                                     |

The production output contained a 340.86 kB JavaScript bundle (96.23 kB
gzip), a 48.77 kB CSS bundle (9.57 kB gzip), and a 2.16 kB HTML document
(0.93 kB gzip). New focused tests cover preparation-window boundaries,
local-calendar behavior around midnight in a non-UTC timezone, the combined
task/milestone sequence, resolved-change filtering, team-pressure partitioning,
and the distinction between task acceptance and change acknowledgement.

### Final Dashboard matrix

The final application source was checked in these exact combinations:

| Viewport | Language  | Theme preference       | Workspace |
| -------- | --------- | ---------------------- | --------- |
| 320 px   | Bulgarian | Dark                   | Stress    |
| 327 px   | English   | System (resolved Dark) | Stress    |
| 390 px   | Bulgarian | Light                  | Stress    |
| 768 px   | English   | Dark                   | Stress    |
| 1080 px  | Bulgarian | System (resolved Dark) | Standard  |
| 1440 px  | English   | Light                  | Standard  |

For every Dashboard case, the document had no application-content horizontal
overflow, no out-of-bounds checked control, no clipped status badge, and no
noncanonical task target. The first Operational Focus item was visible before
the bottom navigation or viewport edge. At 320, 327, and 390 px, the compact
event overview measured 500, 449, and 451 px respectively; it left the start of
actionable work in the first viewport even with the long stress event. The
stress Dashboard exposed 33 canonical task links across its different
question-specific contexts without copying a task table into Change Impact.

### Primary-page and interaction checks

Dashboard, Tasks, Team, Changes & Plan B, and Templates were each checked at:

- 320 px in Bulgarian/Dark with the stress workspace;
- 390 px in English/Light with the stress workspace; and
- 1440 px in English with the standard workspace in both Light and Dark.

All 20 page/theme combinations rendered meaningful content without horizontal
overflow, clipped checked status labels, out-of-bounds checked controls, or an
unexplained section gap. The stress Tasks page still rendered all 44 canonical
task rows at both mobile widths. The fixed mobile navigation retained a 66 px
height while the main content retained 106 px bottom space on the checked
emulation.

Interaction checks verified:

- explicit Bulgarian/English and Light/Dark choices survived reload;
- System remained selected and resolved to the checked host's Dark preference;
- a Dashboard focus item opened the canonical
  `/tasks?task=task-guest-itinerary` target;
- reload reopened that task; Back closed it and restored the exact
  `focus:task-guest-itinerary` trigger; Forward reopened it;
- an unknown task ID opened no dialog, showed the localized warning, and kept
  all 16 standard task links available;
- the 390 px task drawer was exactly viewport-width with no document overflow,
  focused its close control, kept forward and reverse `Tab` inside the dialog,
  closed with `Escape`, and restored the originating Dashboard link;
- task acceptance displayed `Accepted` and the clarified description, survived
  reload through the unchanged saved boolean, and returned to `Not accepted`
  after the verified demo reset; and
- the reset restored the fictional workspace and the template's updated
  `Task acceptance` wording.

### Console and production-preview check

The final development session accumulated zero application warnings and zero
application errors. A production preview at `127.0.0.1:4174` rendered the
standard Dashboard at 1440 px and 320 px without overflow or out-of-bounds
checked controls, exposed all 16 canonical standard task links, contained no
legacy Dashboard section nodes, and produced zero application warnings or
errors. This is a local rendering and bundle-size sanity check, not a formal
performance benchmark.

### Independent review

A separate read-only review found and prompted correction of one local-calendar
edge case: preparation grouping now derives the user's local calendar date and
compares DST-safe day ordinals, so a Europe/Kyiv midnight cannot place dated
work in the previous UTC bucket. It also caught stale evidence figures before
commit. After those corrections, the independent reviewer reran formatting,
lint, typechecking, all 38 tests, the production build, and whitespace checks;
spot-checked the Dashboard at 320 px and 1440 px; and reported no remaining
confirmed findings.

### Evidence boundary

This phase verifies a visual-system and information-hierarchy refinement. It is
not product-market validation, proof of usability, a formal accessibility or
contrast audit, physical-device testing, cross-browser certification,
screen-reader testing, or production-hosting validation. The historical
competition regulation in this repository applies to 2025–2026; its dates,
category wording and limits, submission format, online-availability window,
test duration, defence duration, and scoring split require re-verification for
any later competition year.

## Phase 2B.1.1 visual hierarchy polish — 2026-08-12

Phase 2B.1.1 was a focused visual refinement of the existing Dashboard, not a
redesign or a new product phase. The clean synchronized baseline was
`546d5da2b3e17ce4c0c78c6fc88859741a561028`. Pre-edit browser inspection covered
Light and Dark at desktop and mobile widths. The five existing Dashboard
components, their order, calculations, storage versions, routes, deep links,
localization, preference behavior, and task-drawer contracts were retained. No
schema, dependency, or Phase 2B.2 feature was added.

### Measured hierarchy changes

The measurements below compare equivalent Phase 2B.1 and Phase 2B.1.1 browser
states. Values are rounded to the nearest CSS pixel.

| Measurement                                      | Phase 2B.1 | Phase 2B.1.1 | Change                   |
| ------------------------------------------------ | ---------: | -----------: | ------------------------ |
| 1440 px EN standard Event Overview height        |     411 px |       300 px | 111 px / 27.0% shorter   |
| 320 px BG/Dark stress Event Overview height      |     500 px |       392 px | 108 px / 21.6% shorter   |
| 320 px stress first Operational Focus row top    |     691 px |       581 px | 110 px earlier           |
| 1440 px standard Change Impact section height    |     466 px |       388 px | 78 px / 16.7% shorter    |
| 320 px stress Change Impact section height       |     956 px |       854 px | 102 px / 10.7% shorter   |
| 320 px stress uppercase leaf-level text elements |         67 |            5 | 62 internal labels fewer |

The visible task-count formula and the persistent overdue explanation were
removed from the overview; their calculations were not changed and remain
covered by the workspace tests. Task progress remains explicitly named as task
progress, exposes completed/total detail in the progressbar accessible name,
and is not presented as readiness, safety, or a go/no-go decision. The compact
planning-state line retains an explicit fictional-demo label in both languages.

Full critical fills were replaced with scoped low-intensity risk mixes plus
risk edges and textual priority labels. Team-pressure rows use neutral
operational surfaces with risk or time edges, and the critical change uses a
quieter tint than the immediate decision queue. Internal action, priority,
timeline-window, timeline-kind, change-detail, and checkpoint labels use normal
casing; the five retained uppercase elements are high-level section eyebrows.

At 320 px, event fact text increased from 10.24 px to 11.2 px, task-count labels
from 8.8 px to 10.4 px, focus action text from 10.4 px to 11.2 px, focus
reason/owner/deadline text to 11.52 px, and timeline date/owner/state text to
11.52 px. The density reduction came primarily from removing redundant copy
and tightening spacing rather than shrinking essential text. A scoped computed
contrast spot-check across decision, risk, time, metadata, change, and workload
text measured a lowest pair of 4.61:1 in both application themes. This was not a
formal accessibility audit.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier reported the scoped files unchanged.  |
| `pnpm.cmd format:check` | Passed; every scoped file matched Prettier.            |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 38 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,620 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 340.44 kB JavaScript bundle (96.19 kB gzip), a
48.59 kB CSS bundle (9.53 kB gzip), and a 2.16 kB HTML document (0.93 kB gzip).
No new CSS-string test was added because this phase introduced no behavior that
benefited from brittle styling assertions.

### Final Dashboard browser matrix

The final application source was checked in these exact combinations:

| Viewport | Language  | Theme | Workspace |
| -------- | --------- | ----- | --------- |
| 320 px   | Bulgarian | Dark  | Stress    |
| 390 px   | Bulgarian | Light | Stress    |
| 768 px   | English   | Dark  | Stress    |
| 1440 px  | Bulgarian | Light | Standard  |
| 1440 px  | English   | Dark  | Standard  |

The respective Event Overview heights were 392, 345, 477, 350, and 300 px. In
every case there was no document horizontal overflow, out-of-bounds checked
control, clipped priority/timeline/workload status, duplicate task-focus key, or
noncanonical task target. Stress data exposed 33 canonical task links and
standard data exposed 16. Mobile main content retained 106 px bottom space for
the fixed navigation; desktop retained 70 px. Visual inspection confirmed
neutral breathing room between risk signals, no unexplained large blank region,
and meaningful first-item action/title content in the initial 320 and 390 px
viewports.

### Other-page regression matrix

Tasks, Team, Changes & Plan B, and Templates were each checked at:

- 320 px in Bulgarian/Dark with stress data;
- 390 px in English/Light with stress data; and
- 1440 px in English/Light with stress data.

All 12 combinations rendered their localized heading and meaningful content
with no horizontal overflow, out-of-bounds checked control, or clipped checked
interactive control. This was regression verification only; none of those page
layouts was redesigned.

### Interaction, console, and production checks

A Dashboard focus item retained the exact canonical target
`/tasks?task=task-guest-itinerary`. It opened the localized task drawer with the
close control focused; reverse and forward `Tab` wrapped between the last and
first drawer controls; `Escape` closed the drawer, cleared its URL state, and
restored `focus:task-guest-itinerary`. Direct navigation to the same deep link
reopened the drawer. The checked English/Light preferences survived that direct
navigation. The unchanged routing/storage test suite additionally covers
encoded links, invalid parameters, workspace matching, and versioned
preferences.

The final development browser session recorded zero application warnings and
zero application errors. A built production preview at `127.0.0.1:4174`
rendered the standard Dashboard at 320 px Bulgarian/Dark and 1440 px
English/Light with all 16 canonical task links, no horizontal overflow or
out-of-bounds checked control, and zero application warnings or errors. Its
Tasks navigation reached `/tasks` and the localized Tasks heading. This was a
local rendering and bundle sanity check, not a formal performance benchmark.

### Independent review

A separate read-only diff review found three concrete issues during the final
polish: Light-theme `Important` priority text initially measured about 2.85:1;
the interim 320 px composition could split `23%` and let the longest Bulgarian
count label exceed its cell; and the evidence still contained measurements from
before that interim correction. The final scoped fixes use the darker existing
warning text on a neutral gold-edged row (measured at 5.09:1), keep the progress
value on one line, and give all four Bulgarian count labels 60 px client and
scroll widths without shrinking the text. The evidence now records the final
392 px overview and 581 px first-row position.

After those fixes, the reviewer reran formatting checks, lint, strict
typechecking, all 38 tests, and whitespace checks; spot-checked 320 px
Bulgarian/Dark stress and 1440 px English Light/Dark standard; and reported no
remaining confirmed functional, information-loss, five-component,
fictional-boundary, semantic-color, Phase 2B.2, or other-page-scope finding. The
reviewer's spot-check was narrower than the primary matrix and does not expand
the evidence boundary below.

### Evidence boundary

This evidence demonstrates the listed implementation checks and controlled
Chromium viewport observations. It is not proof of usability, accessibility,
organizer effectiveness, product-market fit, physical-device compatibility, or
cross-browser behavior. `docs/NOIT_REGULATIONS_2025_2026.pdf` remains a
historical, year-specific source; its dates, categories and limits, submission
and documentation rules, online-availability and test-account requirements,
GPLv3/licensing conditions, test and defence timing, scoring, and privacy forms
must be reverified for the actual competition year.

## Phase 2B.2 Tasks workspace redesign — 2026-08-15

Phase 2B.2 was implemented from the clean synchronized baseline
`3b274bad3efb995b3087e0307ef3d3410c7d937c`. The approved Phase 2B.1 Dashboard
remained locked. The scope changed only the existing Tasks workspace and its
drawer, localized copy, focused pure helpers and tests, responsive contracts,
and supporting documentation. It did not add a dependency, asset, route,
backend, account, database, schema version, or product module. Stable task IDs,
canonical `/tasks?task=<task-id>` URLs, and `budograph.workspace.v1` were
retained.

### Implemented Tasks contract

- The page header now exposes a compact total/active/blocked/overdue summary.
  Overdue remains an overlapping timing flag rather than a status.
- Search covers localized title, category, context, and owner. Status, owner,
  and category filters combine, provide a zero-result/clear path, and can be
  grouped by owner without dropping tasks whose owner is unknown.
- Desktop rows form a flat operational register with Task, Responsibility,
  Deadline, and Status columns. Accepted/Not accepted is a quieter
  responsibility signal and never replaces task status.
- A real canonical title link provides the full-row hit target. Inline status
  and acceptance editors were removed; the grouped drawer is the primary
  editing surface for those two independent values.
- Tablet and mobile rows use a purpose-built summary rather than stacking the
  desktop cells. The drawer separates identity, responsibility and acceptance,
  progress and timing, operational relationships, and metadata.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier formatted the scoped source and docs. |
| `pnpm.cmd format:check` | Passed; every configured file matched Prettier.        |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 47 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,621 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 348.66 kB JavaScript bundle (97.73 kB gzip), a
54.31 kB CSS bundle (10.56 kB gzip), and a 2.16 kB HTML document (0.93 kB
gzip). The suite added pure filtering/ordering coverage, explicit
status-versus-Accepted reducer invariants, localized Tasks copy assertions, and
mobile-summary, drawer, and filter-focus CSS contracts. No DOM test framework
was added solely for this phase.

### Search, filter, register, and drawer interactions

The standard workspace rendered 16 rows and the development stress fixture
rendered 44. English search for `driver` returned 1 of 16 tasks. Bulgarian
case-insensitive search for `ШОФЬОР` returned the localized airport/backup-driver
task. A combined status, Anton Ravin owner, and Travel category filter returned
1 of 16; all three filter controls exposed their active treatment. An unmatched
query returned 0 of 16 with the empty state, and both clear paths restored all
16 rows. Owner grouping produced five groups, five registers, and all 16 rows.

Selecting whitespace in the final status area of the first row opened the exact
canonical target `/tasks?task=task-guest-itinerary`, proving that the stretched
real link covers the row. The row contains no inline status or Accepted control
that can conflict with that target; editing is confined to the drawer. Direct
load and refresh of `/tasks?task=task-hotel-rooming` both reopened the same
drawer, and closing a direct-load drawer returned safely to `/tasks`. A separate
Back/Forward check opened `task-airport-transfer`, returned to the list, and
reopened the exact detail. An encoded unknown ID displayed the localized notice
while retaining the usable task list and did not open a substitute drawer.

The drawer initially focused its close button. Reverse `Tab` wrapped to the
last status control, forward `Tab` wrapped back to close, and `Escape` closed
the drawer, removed the task query, and restored focus to
`task-list:task-guest-itinerary`. The close button and the backdrop also closed
to the list. Browser testing caught and corrected an interim mouse-down
click-through: the final backdrop closes on its completed click, after which the
URL is `/tasks`, no drawer remains, and focus returns to the originating row.

In the production preview, changing the guest-itinerary status from Blocked to
In progress left its separate state label at Not accepted. Accepting it then left
the In progress status unchanged. Refreshing the canonical detail preserved
both values on that preview origin. The reducer tests separately assert the two
state-preservation invariants and serialization of both fields under the exact
`budograph.workspace.v1` key.

### Final Tasks browser matrix

The latest development source was checked in controlled in-app Chromium
emulation at all seven requested widths. `clientWidth` reflects the viewport
after the browser scrollbar. `Tail space` is the document space below the final
row; the mobile navigation measured 66 px high in each mobile/tablet case.

| Viewport | Language  | Theme | Workspace | Rows | Filter height | First row | Tail space |
| -------: | --------- | ----- | --------- | ---: | ------------: | --------: | ---------: |
|   320 px | Bulgarian | Dark  | Stress    |   44 |        257 px |    274 px |     107 px |
|   327 px | English   | Light | Standard  |   16 |        257 px |    193 px |     106 px |
|   360 px | Bulgarian | Light | Stress    |   44 |        257 px |    252 px |     107 px |
|   390 px | English   | Dark  | Stress    |   44 |        148 px |    237 px |     107 px |
|   768 px | Bulgarian | Dark  | Stress    |   44 |        105 px |    157 px |     107 px |
|  1080 px | English   | Light | Standard  |   16 |        105 px |     76 px |      71 px |
|  1440 px | Bulgarian | Light | Standard  |   16 |         60 px |     94 px |      71 px |

Every case had equal document client and scroll widths, zero out-of-bounds
visible controls, zero measured overflow in the summary, filters, rows, badges,
and register, and a reachable final row above the fixed mobile navigation. The
long stress title explains the taller narrow rows; the title, owner, deadline,
status, priority, and acceptance remained available rather than being silently
discarded. At widths up to 600 px, rendered priority, acceptance, deadline-meta,
and status text measured 11.2 px after final review; this was raised from the
smaller interim treatment without introducing overflow.

At 320 px Bulgarian/Dark with stress data, the open drawer measured 305 px
client and scroll widths, 900 px client height, and 1,755 px scroll height. Its
three controls had no measured overflow; the current Blocked status and separate
overdue warning were both present. Scrolling reached the exact 855 px maximum,
placed the final metadata section at 872 px within the 900 px viewport, and
retained 28 px bottom padding. The drawer intentionally covered the bottom
navigation while open so the two interaction layers did not compete.

A scoped computed-color spot-check sampled 192 visible Tasks and drawer text
pairs in Light and 168 in Dark. The lowest sampled pair was Important text at
4.62:1 in both themes. This is a focused rendered-color check, not a formal
accessibility or contrast audit.

### Locked-page, console, and production checks

Dashboard, Team, Changes & Plan B, and Templates were each checked at 320 px
Bulgarian/Dark with stress data and at 1440 px English/Light with standard data.
All eight combinations rendered their localized heading and meaningful content
with equal document client/scroll widths and zero out-of-bounds visible
controls. This was regression inspection only; none of those page layouts was
redesigned.

The final development browser session recorded zero application warnings and
zero application errors. The rebuilt production preview at
`127.0.0.1:4173` rendered all 16 standard task rows and repeated the search,
combined-filter, empty-state, grouping, full-row, drawer, direct-load, refresh,
invalid-ID, focus, independent-edit, persistence, and corrected-backdrop checks
with zero application warnings or errors. This was a local rendering and bundle
sanity check, not hosting or performance validation.

### Independent review

Three read-only reviewers separately audited source behavior, visual hierarchy,
tests, and documentation. The source review found that the three filter selects
temporarily suppressed the global keyboard outline without supplying a wrapper
focus treatment, and that the drawer acceptance action combined a changing
action name with toggle-button state. The final code adds a visible
`:focus-within` ring with a focused contract test and presents acceptance as a
normal action button while its state remains labelled above it. A production
browser recheck computed the focused wrapper's border and 2 px ring and found
no `aria-pressed` on that action.

The visual review independently verified the corrected backdrop, canonical URL,
desktop register, and drawer, then identified mobile row metadata at roughly
10.2–10.6 px. The final mobile override raises essential priority, acceptance,
deadline-meta, and status text to 11.2 px. The 320, 327, 360, and 390 px rows
were remeasured afterward with zero horizontal overflow and zero application
warnings or errors. The documentation/test reviewer found no unsupported claim
or missing requested document. These independent checks were narrower than the
primary matrix and do not expand the evidence boundary below.

### Evidence boundary

These results are controlled in-app Chromium observations, not proof of
usability, accessibility, organizer effectiveness, physical-device behavior,
cross-browser compatibility, screen-reader support, production security,
product-market fit, or completed offline rehearsal. The workspace remains an
unauthenticated local prototype with fictional data. The available regulation
is the historical 2025–2026 document; its dates, exact category/group wording,
online-availability window, documentation format, test and defence timing and
weighting, declarations, and registration procedure must be reverified for the
actual competition year.

## Phase 2B.2.1 BudoGraph dropdown system and final Tasks polish — 2026-08-15

Phase 2B.2.1 started from the synchronized baseline
`dc17285340850f84e6e52d8e5ad88798a4882fb8`. It replaced only the Phase 2B.2
Tasks Status, Owner, and Category filter selects and the drawer Current status
select. The approved task register, drawer information architecture, Dashboard,
Team, Changes & Plan B, Templates, routes, task schema, 16-task seed, 44-task
development stress fixture, `budograph.workspace.v1`, and
`budograph.preferences.v1` remained in place. No dependency, asset, backend, or
product module was added.

### Implemented selection-control contract

`BudoSelect` is a controlled, dependency-free generic component. Its real
`button` trigger exposes `aria-haspopup="listbox"`, `aria-expanded`, stable
`aria-controls`, and a label/value relationship. The popup is a
`role="listbox"` containing uniquely identified `role="option"` elements with
`aria-selected`; roving DOM focus leaves exactly one option at `tabIndex=0`.
There is no invented `aria-activedescendant` state because focus is placed on
the active option itself.

Pure helpers resolve selection by value rather than array index, bound Arrow
and Home/End movement, reject invalid commits, preserve the old value on
cancel, and calculate collision-aware popup geometry. Placement prefers a side
that fits the ideal height and otherwise uses the roomier side. Width is
clamped to 12 px viewport gutters, height never exceeds the available side,
and tall lists scroll internally.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier formatted the scoped source and docs. |
| `pnpm.cmd format:check` | Passed; every configured file matched Prettier.        |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 54 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,623 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 353.49 kB JavaScript bundle (99.65 kB gzip), a
56.81 kB CSS bundle (11.04 kB gzip), and a 2.16 kB HTML document (0.93 kB
gzip). The added pure tests cover reordered and unknown selected values,
bounded Arrow/Home/End navigation, valid commit versus cancellation, horizontal
clamping, above/below collision, roomier-side selection, and a tiny-space height
bound. Existing tests continue to cover combined filters, localized labels,
Status-versus-Accepted independence, storage keys, routes, and responsive
contracts. No DOM test framework was introduced.

### Controlled development-browser matrix

The final development source was inspected in controlled in-app Chromium. Page
`clientWidth` is 15 px below the requested emulation width when the vertical
scrollbar is present; drawer-open measurements use the full requested width.

| Requested state                                    | Rendered result                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 px, English, Light, closed                    | 16 rows; document 1,425/1,425 px client/scroll width; compact controls and count retained.                                                                                      |
| 1440 px, English, Light, three open states         | Status 190 x 199.6 px, Owner 220 x 237.6 px, and Category 260 x 260 px; all below the trigger and inside the viewport. Category client/scroll height was 258/464 px.            |
| 1440 px, English, Dark, three open states          | Same bounded geometry; selected/focused text used light ink on the dark authored surface, with burgundy selection and blue focus rather than system blue.                       |
| 390 px, Bulgarian, Light, three open states        | 375/375 px document width, two-column controls, result count on its own quiet line below Search, and no out-of-bounds trigger or option.                                        |
| 320 px, Bulgarian, Dark, stress, three open states | 44 rows, 305/305 px document width, one-column 276.8 px controls, and no popup/mobile-navigation overlap. The 14-option Category list measured 258/540 px client/scroll height. |
| 1440 px, English, Light/Dark drawer                | Current status measured 225.2 x 161.6 px, stayed inside the drawer, and retained one selected/focused option.                                                                   |
| 390 px, Bulgarian, Light drawer                    | The 343.2 x 161.6 px popup fit below in normal use. With the trigger deliberately placed at y=721.6–765.6, it opened above at y=554.0–715.6.                                    |
| 320 px, Bulgarian, Dark drawer                     | Drawer and document widths were both 320 px; the 272.8 x 161.6 px popup stayed usable with no horizontal overflow or blocked bottom-navigation interaction.                     |

Every recorded popup had one selected option, one active option, one tabbable
option, zero clipped option text, and equal document client/scroll widths. At
320 px stress, `End` reached the last fictional Category option with the active
row fully inside the listbox and above the mobile navigation. Mobile owner,
deadline, status, priority, category, deadline metadata, and acceptance text
all computed to the approved 11.2 px floor. The 390 px and 320 px result counts
sat between Search and the filter controls without adding a card.

The focused/selected text samples were `rgb(23, 33, 45)` on
`rgb(248, 233, 237)` in Light and `rgb(237, 242, 247)` on
`rgb(58, 32, 42)` in Dark. These scoped rendered-color observations confirmed
the intended warm/dark surfaces and readable state treatment; they are not a
formal contrast or accessibility audit.

### Interaction, focus, and persistence observations

- ArrowDown on a closed trigger opened the listbox at the selected value.
  ArrowDown and ArrowUp moved option focus while selection remained unchanged;
  Home, End, and a bounded ArrowUp reached the expected first/last positions.
- Escape cancelled and returned focus to the trigger. Space committed Not
  started and reduced the visible standard rows to 9; Enter restored All
  statuses and all 16 rows. Mouse selection of Mira Velin returned 3 rows and
  trigger focus; clicking Search outside an open Owner list closed it without
  changing the value.
- A second pointer click on the already-open Status trigger collapsed it to
  `aria-expanded="false"`, removed the listbox, and kept trigger focus. Moving
  directly from an open Status control to Owner still closed Status and opened
  Owner at its selected option.
- Four rendered controls (the three filters and drawer status) were real
  buttons with unique trigger IDs. The open drawer listbox had stable IDs
  across reopen, four unique option IDs, one `aria-selected="true"`, one
  `tabIndex=0`, and focus on that same option.
- In the drawer, the first Escape closed only the listbox and focused its
  trigger. The second Escape closed the drawer, restored the prior canonical
  URL including its development fixture state, and restored focus to the
  originating real task link. Forward Tab from the final focused option invoked
  the existing drawer trap, closed the popup through blur, and focused the
  drawer close button.
- The controlled browser's synthetic Tab transport did not perform Chromium's
  native page-level focus traversal even on the ordinary Search input. No
  physical Tab/Shift+Tab claim is made from that transport. DOM inspection
  showed the expected Search → Status trigger → active option → Owner
  trigger → Category trigger order, and moving focus to the next trigger
  closed the prior popup without trapping it. Physical-keyboard and
  assistive-technology repetition remains required.
- Changing the first task from Blocked to In progress preserved Not accepted
  through refresh. Accepting it preserved In progress through another refresh.
  Both values were then restored to Blocked and Not accepted and verified after
  refresh.

### Locked pages, console, production preview, and independent review

Dashboard, Team, Changes & Plan B, and Templates were spot-checked at 1440 px
English/Dark. Each retained its expected heading and meaningful content with
equal 1,425 px document client/scroll widths and no horizontal overflow. The
development browser session recorded zero application warnings and zero
application errors.

The final bundle was served locally from `127.0.0.1:4173`. Its 1440 px
English/Light standard Tasks page rendered 16 rows and the bounded 258/464 px
Category list. Its 320 px Bulgarian/Dark standard Tasks page and drawer had
equal document client/scroll widths, 11.2 px mobile metadata, internally
scrollable Category options, and a bounded Current status popup. The production
origin's pre-existing first-task state was restored to Blocked/Not accepted and
verified after refresh. The production session recorded zero application
warnings and errors. The stress fixture remains a development-only diagnostic;
the production build correctly retained the 16-task fictional demonstration.

Separate read-only reviews found and drove six confirmed corrections: the
initial Dark filtered-trigger accent text measured about 4.43:1 and now uses
the existing light ink while burgundy remains on the icon/border; the Light
popup now uses the established warm neutral surface; placement now chooses a
fully fitting or roomier side instead of a fixed 160 px threshold; and the
initial zero-delay Tab close could leave focus on `body`, so popup lifetime now
follows focus leaving the popup or returning to the trigger. Later live checks found that
synthetic Enter/Space did not invoke the native button click in the controlled
browser and that clicking an already-open trigger could close on blur and then
reopen on click. The trigger now handles Enter/Space explicitly and uses a
short-lived pointer-origin marker so a pointer click closes exactly once while
Shift+Tab-to-trigger still closes through blur. Final read-only source/test
review found no remaining confirmed ARIA, state, routing, schema, style-scope,
or unnecessary-dependency defect.

### Evidence boundary

These are controlled in-app Chromium checks, not physical-device, Safari,
Firefox, screen-reader, or formal accessibility certification. In particular,
the automation limitation above leaves physical page-level Tab/Shift+Tab for
human repetition. Visual polish is not proof of usability or organizer
effectiveness. The workspace remains an unauthenticated local prototype with
fictional data. The available regulation is the historical 2025–2026 source;
its dates, exact category/group wording, online-availability window,
documentation format, test and defence timing and weighting, declarations, and
registration procedure must be reverified for the actual competition year.

## Phase 2B.2.2 — task attention and deadline semantics (2026-09-28)

This entry records the focused correction from baseline
`24795ec6c5551f2091a6bbdb9224279de0693a9f`. Historical entries above describe
previous behavior and checks; this entry supersedes their task-attention score
and UTC deadline semantics. It does not start Team 2B.3.

### Final semantic contract

- **Status = lifecycle:** `not-started`, `in-progress`, `blocked`, `completed`.
- **Priority = impact:** Normal, Important, Critical. It is not an urgency score.
- **Timing = derived local calendar relationship:** yesterday or earlier is
  overdue for open tasks; Today is local today; Near is days 1–7 inclusive;
  Later is day 8 onward. Upcoming deadlines include Today/Near/Later for open
  tasks and never become a persisted or editable task status.
- **Needs attention = derived operational signal:** an open task qualifies for
  any of blocked, overdue, not accepted, or Critical with a Today/Near deadline.
  Important alone and far-future Critical alone do not qualify. Completed tasks
  are excluded even when unaccepted or Critical.
- **Accepted = separate responsibility acknowledgement:** the stored field
  remains `Task.acknowledged`; changing status never accepts responsibility.
- **At risk remains narrower:** blocked and/or overdue, counted once per task.
  Unaccepted and near Critical work alone do not increase Team at-risk counts.
- **Dependency prose remains independent:** `blockedBy` does not imply blocked
  lifecycle status. Milestone `upcoming` remains unchanged.

`taskTiming.ts` validates date-only values and compares calendar ordinals to the
reference clock's local year/month/day. UTC arithmetic is used only for day
ordinals, avoiding DST day-length errors; no deadline becomes a UTC end-of-day
instant. The shared calculations feed overdue/upcoming, attention, Dashboard
preparation windows and next checkpoints, Tasks ordering and counts, and Team
workload/timing. Core calculations accept explicit reference times.

Attention uses a documented lexicographic order, with no additive score:

1. Blocked **or** overdue share the strongest operational-failure class;
   remaining eligible tasks form the second class. Neither condition receives
   a blanket preference over the other.
2. Within each class, the earliest deadline comes first; invalid dates sort last.
3. Equal deadlines use more simultaneous reasons, then unaccepted responsibility,
   then impact (Critical/Important/Normal), then stable ID.

For example, an Aug 1 overdue task comes before an Aug 2 blocked/overdue task,
which comes before an Aug 3 overdue task. A later Critical task cannot leapfrog
these failures because of its priority. Tasks retains its distinct established
ordering: overdue, then blocked, then deadline and stable ID.

The domain exposes every applicable attention reason. Operational Focus joins
localized reasons in one text line/flow, labels priority explicitly, retains
canonical task links, shows five items initially, and reveals all remaining
items inline using a real localized Show more/Show less button. The button
exposes `aria-expanded` and `aria-controls` and retains keyboard focus. No CSS,
BudoSelect implementation, route, navigation, other disclosure pattern, Task
schema, storage key, demo date or milestone lifecycle was changed. Team now
keeps the actual lifecycle badge and appends Overdue separately to deadline text.

### Midnight refresh and independent review

A small local-calendar hook publishes the current date on subscription and
uses one timeout for the next local midnight. Each callback samples the real
clock again and rearms the timeout. Window focus and visible-tab events refresh
and rearm after suspension; unmount removes listeners and cancels the timer.
Dashboard, Tasks (including memoized counts/filter ordering and the drawer) and
Team receive the same reference date within their page. This does not write any
new persisted state.

The independent read-only review found one confirmed startup race: if initial
render preceded midnight but effect subscription followed it, the initial
implementation scheduled tomorrow's update while retaining yesterday's sample.
Initialization now uses the same immediate refresh path as subsequent updates.
A deterministic render-before/effect-after regression test was added. The
reviewer independently reran all nine focused tests, confirmed the fix, and
reported no further confirmed findings. Browser/layout verification below was
performed separately by the implementing agent; no human review is claimed.

### Automated evidence

All required commands passed on the final implementation:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 63 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed; Vite production build        |
| `git diff --check`      | Passed                               |

Nine new tests in `taskSemantics.test.ts` and `localCalendarClock.test.ts`
cover the eligibility matrix, combined reasons and EN/BG reason text,
explainable ordering/ties, dependency prose, independent acceptance, unchanged
four status values, rejection of persisted task Upcoming, Team at-risk scope,
invalid dates, and clock initialization/rearm/cleanup. Boundary cases cover
yesterday/today/tomorrow/day 7/day 8 and 1 ms before/at local midnight in
Europe/Kyiv, America/Los_Angeles and UTC. They assert agreement between domain
selectors, Dashboard timeline/checkpoints, Tasks ordering and Team counts.
Clock tests also cover Kyiv's 23-hour and 25-hour DST days. The prior selector
test now expects earlier overdue work before later Critical work; unrelated
existing assertions were retained.

### Production-browser evidence

Controlled Playwright checks used installed Edge/Chromium **154.0.4258.37**,
headless, against the production preview at local port 4173, with a 900 px
viewport height and Europe/Kyiv timezone. No browser or project dependency was
installed. Synthetic semantic fixtures used an explicit **2026-08-12** clock;
unchanged-seed screenshots used an explicit **2026-09-28** clock. Seed source
files were not edited. Test storage was confined to isolated browser contexts.

| Surface                       | Viewports / language / theme                           | Result                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard semantic fixture    | 1440 EN Light; 1440 EN Dark; 390 BG Light; 320 BG Dark | Correct five-item preview, eight eligible expanded items and deterministic order; excluded far Critical/Important/completed/dependency-only tasks; all simultaneous reasons visible                                    |
| Dashboard unchanged demo seed | Same four configurations                               | Existing layout inspected; stale scenario remains visible; bounded focus list                                                                                                                                          |
| Tasks                         | 1440 EN Dark; 320 BG Dark                              | Operational row order; status/search/owner/category filters; mouse and keyboard BudoSelect; exactly four localized drawer statuses; no Upcoming option; separate overdue and lifecycle labels                          |
| Team                          | 1440 EN Dark; 320 BG Dark                              | Regression spot-check; actual lifecycle and overdue text both visible                                                                                                                                                  |
| Local midnight                | Dashboard, Tasks and Team at 1440 EN Light             | Controlled clock crossed 23:59:59.500 to 00:00:00.500 without reload; due-today task became overdue, Dashboard removed it from future timeline and admitted day-8 Critical work into Near; workspace storage unchanged |

All **15 browser cases passed**. Dashboard disclosure was exercised with Enter
and Space; the same button retained focus, had visible focus styling and
updated both its label and `aria-expanded`. Its `aria-controls` matched the
list. Canonical focus links opened the correct Tasks drawer and Escape returned
to Dashboard. Tasks status edits persisted after reload without accepting the
task or adding/changing its stored fields; listbox Escape followed by drawer
Escape worked. Screenshots of the required configurations, expanded mobile
focus, Tasks register/drawer, and Team were visually inspected. No unexpected
layout regression or horizontal page overflow was observed. Application
console warnings, errors and uncaught page errors: **0**.

Local reproducibility/evidence artifacts are retained in ignored
`tmp/phase-2b-2-2-browser.mjs` and `tmp/phase-2b-2-2-evidence/` (JSON report and
screenshots). They are local audit artifacts, not new runtime dependencies or
committed product fixtures. This is controlled Chromium evidence, not
physical-device, Firefox, Safari, screen-reader or formal accessibility testing.

### Changed files and unresolved follow-up

- Domain: `src/domain/taskTiming.ts`, `src/domain/taskAttention.ts`,
  `src/domain/workspace.ts`, `src/domain/taskSemantics.test.ts`,
  `src/domain/workspace.test.ts`.
- Calendar refresh: `src/hooks/localCalendarClock.ts`,
  `src/hooks/localCalendarClock.test.ts`, `src/hooks/useLocalCalendarNow.ts`.
- Consumers: `src/pages/DashboardPage.tsx`,
  `src/pages/dashboard/OperationalFocus.tsx`, `src/pages/dashboard/helpers.ts`,
  `src/pages/TasksPage.tsx`, `src/pages/tasks/helpers.ts`,
  `src/components/TaskDrawer.tsx`, `src/pages/TeamPage.tsx`.
- Catalog/test registration/evidence: `src/i18n/messages.ts`, `package.json`,
  `docs/TEST_EVIDENCE.md`, `docs/AI_ASSISTANCE_LOG.md`.

**Confirmed unresolved follow-up — Demo Freshness / Critique Verification:**
the fictional seminar still runs **18–20 September 2026**. At the explicit
28 September reference date all 13 open seed tasks are overdue, and historical
milestones still carry their existing Current/Upcoming narrative. Corrected
calendar semantics intentionally expose this stale scenario. Refreshing seed
dates and reviewing milestone narrative are separate work; neither was done
here. Team 2B.3 and the deferred visual critique items remain out of scope.

The product remains a fictional, unauthenticated browser-local prototype.
The mandatory regulation read for this project is the historical **2025–2026**
NOIT source; dates, category/group details, submission requirements and defence
rules must be reverified for the actual later competition year.

## 2026-09-28 — Phase 2B.2.3B deterministic demo scenario

Implemented from accepted baseline `c87fb9a90ac75494b1d00df09497950ebd1a0639`
under the explicit Phase 2B.2.3B request. Earlier evidence above describes its
historical source and clocks; it has not been rewritten.

### Demo-time boundary and unchanged real-calendar semantics

`src/data/demoTime.ts` defines the reference date **2026-09-07**, a fictional
edit timestamp **2026-09-07T09:00:00.000Z** (noon in Varna), and timestamp display
zone **Europe/Sofia**. App samples a fresh local-noon Date once and passes it to
Dashboard, Tasks (including drawer), and Team. Date-only calculations therefore
read 7 September in every host timezone. Reported and updated timestamp labels
use the same explicit Varna zone through the existing typed i18n adapter.
Every page includes a quiet, localized demo-snapshot paragraph; it is 18 px
high in the checked configurations and adds 12 px bottom space. The BG date
renders as `7.09.2026 г.` in the checked Edge runtime. Screen-reader text explains
the fictional reference and Varna timestamp convention.

The pure timing and attention functions have no demo special case. They still
accept arbitrary reference dates; their existing real local-calendar, midnight,
DST, invalid-date and multi-reason tests pass unchanged. The live-clock hook
and scheduler are retained unchanged but are not subscribed by this fixed demo.
No `Date.now()` date shifting, schema change, storage migration, dependency,
backend or authentication was introduced. Task edits deliberately use the
fictional snapshot timestamp, not a real-world audit timestamp.

### Verified fixture and operational results

The event remains **18–20 September 2026**, eleven days after the snapshot.
People, ownership, task statuses, priorities, acceptance flags and stable IDs
are preserved. Open-task deadlines and their update timestamps were refreshed
around plausible preparation order; completed July work remains historical.

| Measure                                         | Result                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| All tasks                                       | 16                                                                                                         |
| Completed / in progress / not started / blocked | 3 / 3 / 9 / 1                                                                                              |
| Active (in progress + not started)              | 12                                                                                                         |
| Completed progress                              | 19% (3/16), not event-day readiness                                                                        |
| Open timing: overdue / Today / Near / Later     | 1 / 1 / 7 / 4                                                                                              |
| Accepted / not accepted, all tasks              | 11 / 5                                                                                                     |
| Critical / Important / Normal                   | 5 / 8 / 3                                                                                                  |
| Operational Focus                               | 7 eligible; 5 initially displayed                                                                          |
| Preparation Timeline                            | 12 Today/Near/Later task entries + 3 active milestones, with existing bounded previews                     |
| Team Pressure                                   | Lina: 1 overdue, 0 blocked; Anton: 1 blocked, 0 overdue; other 3 have no pressure flag but still have work |

The overdue accessibility check (5 September) demonstrates overdue plus not
accepted. Arrival confirmation (7 September) demonstrates blocked plus not
accepted plus Critical Today. Airport transfer (8 September) and first-aid
coverage (10 September) demonstrate Critical Near. The rota, check-in kit and
sound check also require acceptance. The accepted Critical final walk-through
on 17 September does not qualify on priority alone because it is Later.
Ranking, attention eligibility, five-item behavior and Team at-risk semantics
are unchanged.

Milestones remain separately persisted/manual: venue confirmed on 10 July is
Completed; travel plan on 9 September is Current/In focus; participant brief
on 14 September and final walk-through on 17 September are Upcoming. No past
milestone is presented as Upcoming, and no automatic milestone lifecycle was
invented.

The change is reported on 7 September at 10:30 Varna time. The fictional flight
moves the instructor's Friday 18 September arrival from 14:00 to 18:30. Mira
owns the in-progress response affecting itinerary, pickup, hotel and programme.
All four tasks' updated timestamps follow the report and precede snapshot noon.
Dashboard ChangeImpact's Next checkpoint is the arrival confirmation due Today.
The historical date-like suffix in the change ID stays an opaque stable ID,
maintaining existing localization/storage compatibility; no ID-based clock
behavior was added. BG and EN describe the same new arrival scenario.

### Persistence and reset

Production-browser checks loaded the actual old fixture from accepted commit
`c87fb9a`, with an additional saved acceptance edit. Initial load and reload
preserved every serialized workspace value, including old dates. Opening and
cancelling reset preserved it too. Explicit confirmation restored exactly the
new seed, kept `budograph.preferences.v1`, and survived reload. Accepting the
arrival task afterwards changed acceptance independently of its blocked status,
used the fixed snapshot update timestamp, and persisted on reload.
`budograph.workspace.v1` and its shape are unchanged. Existing old workspaces
are intentionally shown against the disclosed reference until explicitly reset;
opening the app or changing the real clock never replaces their data.

### Automated evidence

Environment: Windows, Node **24.16.0**, pnpm **11.9.0**, Vite **6.4.3**.
All required commands were executed successfully:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 70 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed, production bundle            |
| `git diff --check`      | Passed                               |

Seven new tests in `src/data/demo.test.ts` cover stable reference under mocked
real dates, timezone-equivalent output, meaningful status/timing/acceptance and
attention coverage, future preparation and milestone order, owned change and
checkpoint chronology, risk versus responsibility, and preservation/reset of
saved v1 state. Timestamp and calendar comparisons cover Europe/Sofia, UTC,
America/Los_Angeles, Pacific/Kiritimati and Pacific/Pago_Pago. Existing independent
Phase 2B.2.2 calendar/attention/clock tests remain unchanged.

The first run had 69 passes and one failure: an old seed test specifically
required the blocked task to be overdue at an August reference. The updated
scenario intentionally makes it due Today. That fixture-coupled assertion was
corrected to verify a critical blocker and separate overdue coverage against
the explicit demo reference; generic domain-test dates were not replaced.
The subsequent complete suite passed all 70 tests.

### Production browser and visual verification

Installed Edge/Chromium **154.0.4258.37**, headless Playwright, production preview
on local port 4173; 900 px viewport height. No dependencies were installed.
Fresh-state matrix used a simulated real date in **2035** to prove the reference
does not accidentally follow today's clock. Storage was isolated per case.

| Page             | Required configurations                                | Result                                                                                                                                   |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard        | 1440 EN Light; 1440 EN Dark; 390 BG Light; 320 BG Dark | Passed: disclosure, event dates, five/seven Focus behavior, multiple reasons, future timeline, differentiated pressure, Today checkpoint |
| Tasks            | 1440 EN Dark; 390 BG Light                             | Passed: one overdue row/count, independent blocked status, new deadlines and snapshot update metadata                                    |
| Team             | 1440 EN Light; 390 BG Light                            | Passed: two distinct at-risk people, three without pressure flags, existing layout retained                                              |
| Changes / Plan B | 1440 EN Light; 390 BG Light                            | Passed: localized travel narrative, 10:30 Varna report time, four affected tasks and Mira's response                                     |
| Templates        | 1440 EN Light                                          | Passed: template and explicit reset entry retained                                                                                       |

Additional browser cases compared complete rendered Dashboard, Tasks, Team,
Changes and arrival drawer text in UTC/2024, Los Angeles/2035 and
Kiritimati/2040: identical in all three. Advancing the real clock to 2050,
raising focus and reloading preserved both text and workspace values. A fourth
case checked old-fixture preservation, reset cancellation/confirmation,
preferences, task acceptance, fixed edit timestamp and reload.

All **15 browser cases passed** (11 layout cases + 3 clock/timezone cases +
1 persistence/reset case). Application console warnings/errors and uncaught
page errors: **0**. No horizontal page overflow or snapshot-text overflow was
observed. Screenshots were visually inspected across the required matrix,
including lower Dashboard content, BG reset confirmation and the settled drawer.
The first drawer capture caught its entrance animation; the evidence harness
was corrected to await animation completion and the matrix rerun successfully.
That intermediate capture was not an application defect.

Reproducibility artifacts are retained locally in ignored
`tmp/phase-2b-2-3b-browser.mjs` and `tmp/phase-2b-2-3b-evidence/` (JSON report and
screenshots). They are not committed product files. Browser emulation does not
constitute physical-device, Firefox/Safari, screen-reader or formal accessibility
certification, and no real-user outcomes are claimed.

### Independent review, file scope and deferred work

A separate read-only agent reviewed the implementation against `c87fb9a` for
clock dependence, clock consistency, timezone behavior, persistence mutation,
fictional chronology/milestones, localization overlay compatibility, current
documentation and locked layout scope. It independently ran **18 focused tests,
18 passed**, and reported **no confirmed defects**. Production-browser evidence
was produced and visually inspected by the implementing agent; no human review
is claimed.

Changed areas:

- Demo boundary/fixture/tests: `src/data/demoTime.ts`, `src/data/demo.ts`,
  `src/data/demo.test.ts`, `src/domain/workspace.test.ts`, `package.json`.
- Shared reference and snapshot edits: `src/App.tsx`, `src/hooks/useWorkspace.ts`,
  `src/pages/DashboardPage.tsx`, `src/pages/TasksPage.tsx`, `src/pages/TeamPage.tsx`.
- Disclosure and timestamp/localized copy: `src/components/AppShell.tsx`,
  `src/styles.css`, `src/i18n/createI18n.ts`, `src/i18n/formatters.ts`,
  `src/i18n/useI18n.ts`, `src/i18n/messages.ts`, `src/i18n/demoMessages.ts`.
- Current documentation/evidence: `README.md`, `docs/USER_GUIDE.md`,
  `docs/PRESENTATION_OUTLINE.md`, `docs/DEPLOYMENT_AND_DEMO_PLAN.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/TEST_EVIDENCE.md`, `docs/AI_ASSISTANCE_LOG.md`.

The only visual addition is the quiet global disclosure paragraph. Dashboard
and Tasks design, sidebar, 961–980 px Tasks compression, drawer/mobile-nav
transparency, Timeline/Team Pressure disclosure wording, Focus return-context
behavior and Team layout were deliberately not changed. Team 2B.3 was not
started. Historical NOIT **2025–2026** requirements still need verification for
any later competition year.

## 2026-09-28 — Phase 2B.2.3C narrow desktop and sticky surfaces

Baseline: `5c6dfc8609c8afc90fb528f0d5813ab73c1691e8`, clean `main`, equal to
`origin/main`, ahead/behind 0/0 before implementation. This explicitly authorized
phase changes only responsive task-result layout and the two confirmed sticky
surfaces. Mandatory project sources were already read completely during this
project session and were unchanged; the NOIT regulation is the historical
**2025–2026** source and needs verification for a later competition year.

### Reproduced cause and implemented contract

At 961 px BG, the old four-column row had only 651 px client width. Its minimum
tracks (230 + 140 + 108 + 112 px), three 11 px gaps and 60 px horizontal padding
required 683 px. The status text crossed the arrow by **9.4375 px** for Not started
and **1.109375 px** for Completed in the browser. The compact row previously
waited until the viewport was 800 px, ignoring the 252 px sidebar above 960 px.

`#task-results` now provides a named inline-size container. At **50rem or less**
of available results width, the existing two-level compact row is reused
unchanged: task/title/context above responsibility, deadline and status. The
query encloses grouped results too; filters and the drawer remain outside it.
The existing four-column register remains the default and the existing mobile
summary rules at 600 px and below remain unchanged. No font reduction,
operational-text truncation, new cards or information-hiding workaround was
introduced. Sidebar collapse was deliberately **not implemented**; the fix is
responsive content behavior.

Measured transitions with the default 16 px root font:

| Viewport width    | Results layout                      | Reason                                                    |
| ----------------- | ----------------------------------- | --------------------------------------------------------- |
| 1109 px and wider | Four-column register                | Results exceed 800 px                                     |
| 961–1108 px       | Two-level compact row               | Sidebar remains; results are at most 800 px               |
| 841–960 px        | Four-column register                | Sidebar disappears and the recovered width exceeds 800 px |
| 601–840 px        | Two-level compact row               | Results are at most 800 px                                |
| 600 px and below  | Existing three-level mobile summary | Existing mobile override                                  |

The browser checked BG and EN immediately around 1108/1109, 960/961, 840/841 and
600/601 px, plus the existing padding change at 800 px. No uncovered width band
or collision was observed. These viewport values describe the current shell;
the actual task adaptation is based on content width and a rem threshold.

Only `.task-drawer__topbar` and `.mobile-nav` changed from
`var(--surface-translucent)` to the existing opaque `var(--surface)`:
white in Light and `#111a25` in Dark. Normal application header, global tokens,
borders, shadows, navigation destinations and drawer structure were preserved.

### Automated evidence

Windows, Node 24.16.0, pnpm 11.9.0, Vite 6.4.3. The following commands passed:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 73 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed; production bundle            |
| `git diff --check`      | Passed                               |

Three focused CSS-contract tests were added in `src/responsive-layout.test.ts`:
available-width compact layout with all operational cells retained; four-column
wide default; and solid sticky header/navigation surfaces. The six existing
responsive tests, including mobile summary, safe-area, focus and bounded
selection rules, were retained unchanged. These source-contract tests are
supplemented by actual browser geometry and interactions below; they do not
alone establish rendered correctness.

### Production-browser evidence

Installed Edge/Chromium 154.0.4258.37, headless Playwright, production preview
on port 4173, 900 px viewport height, Europe/Sofia and isolated local storage.
No dependency was installed. The normal fixture and its fixed demo reference
were unchanged. Separate synthetic long-BG fixtures were injected only into
isolated browser storage.

**47 normal Tasks configurations passed**:

- 1440 EN Light and Dark.
- BG and EN at 1100, 1024, 1000, 980, 970, 961, 960, 900 and 768 px.
  BG used Dark at 1024, 970 and 960; the other cases used Light.
- 390 BG Light, 360 EN Dark and 320 BG Dark.
- BG and EN Light at 1109, 1108, 1107, 841, 840, 839, 801, 800, 799, 601,
  600 and 599 px.

All requested width/language/theme combinations are included. Measurements
checked page scroll width, computed row mode, operational cell intersections,
actual text-range bounds and visible arrow intersections across all rows.
No column collision, badge/arrow overlap or horizontal page overflow was found.
Screenshots were visually inspected across the required matrix and representative
transition pairs, stress cases and regression pages.

**11 synthetic stress configurations passed**, each checked both ungrouped and
grouped: 1109, 1108, 1024, 980, 961, 960, 841, 840, 768, 390 and 320 px BG Dark.
All 44 fictional tasks remained present, including long Bulgarian titles and
owner names, status, priority, Accepted and deadline text. Wrapping preserved
meaning without collision or clipping of those operational fields.

**Four interaction/reflow configurations passed**:

- 1109 EN Light, 961 BG Dark and 390 BG Light: search; status filtering; owner
  grouping; bounded owner/category BudoSelect popups with Home/End/Escape and
  restored trigger focus; visible task-link focus; Enter and full-row pointer
  activation of canonical task links; initial drawer close focus; Tab/Shift+Tab
  trap; four status choices; first Escape closing the popup, second closing the
  drawer; close-button action and task-link focus restoration.
- 720 CSS px BG Dark with reduced-motion preference: row reflow passed and
  drawer animation duration was 0.00001 s. This is a layout-width equivalent
  of a 1440 px viewport at 200% zoom, **not a native browser-zoom or text-only
  zoom certification**.

**Six scrolling-surface configurations passed**:

- Drawer header at 961 BG Light and Dark, before and after 210 px drawer scroll.
- Bottom navigation at 390 and 320 BG, both Light and Dark, compared at page
  scroll offsets 160 and 620 px.

Decoded pixels of each header/navigation region were identical before and
after underlying content scrolled: no bleed-through. Screenshots were also
visually inspected. Computed opaque backgrounds were `rgb(255, 255, 255)` and
`rgb(17, 26, 37)`. Muted foreground contrast against these surfaces measured
**6.03:1 Light / 8.43:1 Dark**. All five navigation routes and their selected
states worked; each target was at least 44 by 44 px. At page end, content cleared
the navigation on every route. Existing safe-area CSS was retained; a physical
device with nonzero safe-area insets was not tested.

**Six locked-page regression spot checks passed**: Dashboard 1440 EN Light and
390 BG Dark; Team 1440 EN Light and 390 BG Light; Changes 390 BG Dark;
Templates 320 BG Light. Screenshots showed the existing design and no horizontal
page overflow. No polish was applied to these pages.

Application console warnings/errors: **0**. Uncaught page errors: **0**.
Local reproducibility artifacts are ignored product-external evidence:
`tmp/phase-2b-2-3c-browser.mjs` and `tmp/phase-2b-2-3c-evidence/` (JSON report,
full-page/fold screenshots and scrolled-surface captures). This controlled
browser evidence does not claim physical-device, Firefox/Safari, screen-reader,
formal accessibility certification or human usability results.

### Independent review and scope

A separate read-only agent reviewed the CSS/test diff against the accepted
baseline for width gaps, BG fit, clipped information, overflow, sticky opacity,
contrast, safe areas, keyboard/focus risks and locked-design scope. It
independently ran **9 responsive tests, 9 passed**, and found **no confirmed
defects**. It verified that the compact block was moved unchanged, all rules
from the 600 px breakpoint onward were unchanged, and the named container
excluded filters and the drawer. No review-driven source fix was necessary.
Production-browser verification was performed by the implementing agent;
no independent human review is claimed.

Only four tracked files changed: `src/styles.css`,
`src/responsive-layout.test.ts`, `docs/TEST_EVIDENCE.md` and
`docs/AI_ASSISTANCE_LOG.md`. Demo timing/data, task semantics, typography,
252 px desktop sidebar, Lucide, the top application header and locked
Dashboard/Tasks design remain unchanged outside the specified responsive fix.
Timeline/Team Pressure disclosure wording, Operational Focus return-context
and Team layout critique remain deferred. Team 2B.3 and backend/authentication
were not started. Historical evidence above is retained.

## 2026-09-29 — Phase 2B.2.3D Dashboard disclosure and return context

Accepted baseline: `729ab3e2a8dd92870fa19a235b84e7e959319ad6`, clean `main`.
Work began on 28 September and verification finished after local midnight.
This authorized interaction correction preserves the approved Dashboard/Tasks
appearance, CSS, Phase 2B.2.3C layout/surfaces, task semantics and demo reference.
Mandatory master/regulation sources were previously read completely in this
project session and remain unchanged. The NOIT **2025–2026** regulation remains
historical and must be checked for the actual later competition year.

### Final interaction contract

- Operational Focus initially shows five tasks. Its controlled expansion state
  belongs to the current Dashboard browser-history entry, represented in App
  through `dashboardNavigation.ts`. Toggling replaces that entry; it does not
  push another entry or write browser-local workspace/preferences storage.
- Opening a task records its task/focus key and current scroll offset in that
  Dashboard entry, then pushes the existing canonical task route. Back restores
  expansion before focus restoration. Forward reopens the task; Back again
  returns to the same origin. Drawer close/Escape uses the existing history-back
  behavior for app-opened details. Direct task deep links still close by replacing
  the route with `/tasks`, without navigating outside the app.
- Reload retains context for that same history entry. A new Dashboard navigation
  starts collapsed, including explicit navigation to the current Dashboard URL.
  No URL parameters, persistence schema or global state library were added.
- Return focus prefers the connected/visible original link, then its remounted
  exact counterpart. A closed Timeline/Change Impact disclosure uses its visible
  originating summary rather than attempting to focus a hidden descendant.
  A visible same-task link or Focus disclosure provides a fallback when editing
  removes the original row from the current attention list.
- Saved page scroll is restored without animation. Additional movement happens
  only when the focus target needs clearing of the fixed header or bottom nav.
  Focus Show more/less retains focus on its semantic button, keeps it visible,
  preserves `aria-expanded`/`aria-controls`, and allows Shift+Tab to reach the
  last newly revealed task. Expansion is not permanently forced.
- All four Timeline window disclosures and both Team Pressure disclosures now
  use the actual native `details.open` state for their visible labels through
  `DashboardDisclosure`. Native summary keyboard/expanded semantics are retained;
  redundant ARIA was not added. Change Impact source/behavior is unchanged.
- EN uses “Show less” for Timeline and “Show fewer people” for Team Pressure;
  BG uses “Покажи по-малко” and “Показване на по-малко хора”. Existing localized
  count/people wording remains in collapsed controls. Quiet people continue to
  mean people without pressure flags, not available capacity.

Read-only priority spot-check: the current demo shows **Lina first** (one overdue,
one at risk) and **Anton second** (one blocked, one at risk). Both appear in the
pressure preview. No weak tie-breaker hides Anton and no ranking change was made.

### Automated and browser evidence

Windows, Node 24.16.0, pnpm 11.9.0, Vite 6.4.3; installed Edge/Chromium
154.0.4258.37 via headless Playwright, production preview on port 4173,
900 px viewport height, isolated storage and Europe/Sofia browser timezone.

Required checks passed: `pnpm.cmd format`, `pnpm.cmd format:check`,
`pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test` (**78 passed, zero failed,
skipped or todo**), `pnpm.cmd build`, and `git diff --check`.
Five unit tests were added: four route-history context tests covering initial
state, serialization, collapse/reset and malformed context; one bilingual
disclosure-label test. Existing tests were retained. The browser regression
script is committed as `tests/dashboard-disclosure.browser.mjs` and formatted
with Prettier; it complements the pure unit suite with actual UI behavior.

| Dashboard configuration | Result |
| ----------------------- | ------ |
| 1440 EN Light           | Passed |
| 1440 EN Dark            | Passed |
| 1024 EN Light           | Passed |
| 390 BG Light            | Passed |
| 360 EN Dark             | Passed |
| 320 BG Dark             | Passed |

Every matrix case checked the initial five rows, Show more/less with Enter/Space,
button focus/visibility and control relationship, access to revealed rows,
task six, canonical route, Back/Forward/Back, close/Escape, Dashboard reload,
fresh Dashboard navigation and history length. Task six returned with a visible
solid focus outline and **zero difference from its saved scroll offset** in all
six cases. Centered disclosure expand/collapse also required zero scroll change;
the separate lower-viewport-edge case verifies the reveal fallback.

Every matrix case also checked Timeline and quiet-team expand/collapse labels,
native expanded accessibility properties through the Chromium accessibility
tree, keyboard focus after collapse, hidden Timeline origin fallback, unchanged
snapshot disclosure, no page horizontal overflow, and Lina/Anton visibility.
Mobile nav retained its opaque theme surface and all five targets of at least
44 by 44 px. Returned rows and fallback controls cleared the header/nav.
Screenshots of the restored row were visually inspected in all six configurations.

Seven additional browser cases passed:

1. EN synthetic overflow: all four Timeline windows, Team Pressure overflow and
   unchanged Change Impact expanded/collapsed labels, keyboard and native state.
2. The same synthetic disclosure coverage in BG at 320 px.
3. Direct valid task load/reload and Escape replacement without an extra entry.
4. Direct invalid task load/reload: localized warning, no drawer and 16 task rows.
5. Task seven, detail-page reload, Escape return and reduced motion at 320 BG Dark.
6. Completing task six removes it from attention; return focuses the visible
   Focus section control rather than removed content.
7. Focus disclosure aligned near mobile bottom navigation; expand/collapse keeps
   the focused control visible at 320 BG Light.

**13 implementing-agent browser cases passed** (six matrix + seven additional).
Application console warnings/errors and uncaught page errors: **0**.
The new synthetic fixture exists only in the browser regression script; product
demo data/time are unchanged. Encoded canonical links remain covered by route
unit tests. These checks are controlled emulation, not real-user results,
physical-device, screen-reader or Firefox/Safari certification.

Re-run after `pnpm.cmd build` with a production preview running. The script uses
an existing external Playwright installation: optionally set
`PLAYWRIGHT_MODULE_PATH` to its absolute `index.mjs` path and
`BROWSER_EXECUTABLE_PATH` to an installed Chromium/Edge executable, then run
`node tests/dashboard-disclosure.browser.mjs`. Without those overrides it uses
resolvable `playwright` and its default Chromium. `BUDOGRAPH_BASE_URL` optionally
overrides `http://127.0.0.1:4173`. No dependency was installed or added to the app.
Raw report/screenshots are in ignored `tmp/phase-2b-2-3d-evidence/`.

### Findings corrected and independent review

The first browser run exposed a focused disclosure button outside the viewport
after a toggle; the scoped reveal helper fixes this. A build initially rejected
a new test's access to an unknown preserved history property; explicit type
narrowing corrected the assertion. A browser-harness locator initially matched
two summaries; it was corrected to select the intended first summary. Verification
also waits for native smooth focus scrolling to settle before measuring geometry.
These intermediate failures are not described as passes.

A separate read-only agent confirmed that closed native `details` descendants
can retain client rectangles but reject focus, leaving BODY active after a
Timeline task return. The visibility guard and originating-summary fallback
were added. The reviewer independently re-tested this path at **1440, 390 and
320 px**, found the summary visible and focused with zero console/page warnings
or errors, and passed **31 route/i18n/Dashboard-helper/demo tests**. It reported
no remaining confirmed defects. No independent human review is claimed.

Files changed: `src/App.tsx`, `src/dashboardNavigation.ts`,
`src/navigationFocus.ts`, `src/pages/DashboardPage.tsx`,
`src/pages/dashboard/OperationalFocus.tsx`,
`src/pages/dashboard/PreparationTimeline.tsx`,
`src/pages/dashboard/TeamPressure.tsx`,
`src/pages/dashboard/DashboardDisclosure.tsx`, `src/routes.test.ts`,
`src/i18n/messages.ts`, `src/i18n/i18n.test.ts`,
`tests/dashboard-disclosure.browser.mjs` and the two evidence logs.
CSS/typography, sidebar, Tasks layouts, deterministic data/time, attention and
workload ranking were not changed. Team 2B.3, backend/authentication, Plan B
redesign and Templates redesign remain deferred. Historical entries are intact.

## Phase 2B.3 — Team Responsibility Workspace — 2026-09-30

Implemented after explicit human approval of the design contract at baseline
`82102f3003ae1cead099aead5930568797d1d559`. The contract remains unchanged as the
approved pre-implementation specification. This entry records implementation
verification; it does not rewrite earlier entries where Team was deferred.

### Scope and behavior

Team now uses an operational roster and one shared member detail body, inline
on desktop or in a fullscreen portal sheet at constrained widths. The roster
uses canonical attention representatives: blocked/overdue failures, other
attention, open work without attention, then no open work. Ties follow canonical
ordering and stable source order. A fresh entry selects Lina in the fictional
seed; valid manual/history selection takes precedence thereafter.

Counts are factual open/attention totals with subordinate overlapping reasons.
There are no capacity, productivity or performance scores. Status, priority,
timing and Accepted remain independent. Attention and upcoming partition tasks
without duplication; the initial five-row budget is allocated 3/2 with unused
slots reassigned to attention first. Each section can show all its rows.
Completed history starts collapsed; defensive invalid-date open work has a
separate disclosure. No canonical domain helper, demo clock/data or schema changed.

Real task anchors use `/tasks?task=<encoded-id>`. The existing Tasks drawer owns
editing. Team history stores selected member, disclosures, sheet state, focus
origin and scroll only in `history.state.budographTeam`. Desktop selection
replaces context; a compact roster selection pushes one same-route sheet entry.
Back/Close/Escape return to Team; Forward reopens the task. Removed/changed
origins use a visible fallback. Open Tasks goes to the full unfiltered `/tasks`
register, with no unsupported owner-filter promise.

### Automated checks

Windows, Node `v24.16.0`, pnpm `11.9.0`:

| Command                                             | Result                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| `pnpm.cmd format`                                   | Passed; final source formatting was already stable. |
| `pnpm.cmd format:check`                             | Passed.                                             |
| `pnpm.cmd lint`                                     | Passed, no errors or warnings.                      |
| `pnpm.cmd typecheck`                                | Passed.                                             |
| `pnpm.cmd test`                                     | **94 passed, 0 failed**; 16 new focused Team tests. |
| `pnpm.cmd build`                                    | Passed; production Vite bundle generated.           |
| `git diff --check`                                  | Passed.                                             |
| Explicit Prettier check of both new browser scripts | Passed.                                             |

New unit coverage includes canonical attention, representative selection,
blocked/overdue union counts, separate acceptance, stable roster grouping,
current-event ownership, zero-task members, mutually exclusive task sections,
five-row budget allocation, 100-task completed-heavy data, encoded links,
selected-member fallback, history serialization/malformed context, sheet state,
and matching interpolated BG/EN catalogs. Existing tests were not weakened.

### Browser matrix and interactions

Production preview on `http://127.0.0.1:4173`, isolated headless Microsoft Edge
`154.0.4258.37` contexts, Europe/Sofia timezone, **900 CSS px height**:

- Full matrix: **1440, 1024, 768, 390 and 320** × **EN/BG** × **Light/Dark**
  (20 cases).
- Additional primary cases: **1280 BG Light, 960 EN Light, 961 BG Dark,
  900 EN Light, 430 EN Light, 360 EN Dark** (6 cases).
- **23 additional cases**, including four dense fixtures at 1440 EN Light,
  1024 BG Dark, 390 BG Light and 320 BG Dark; direct valid/invalid Tasks URLs;
  completed/accepted task edits; resize and available-width fallback; full
  register navigation; reduced motion; default-detail engagement/reload;
  stale task/member/event data; empty roster; malformed history; and native
  accessibility-tree/contrast checks in both themes.

**49 Team browser cases passed.** Every primary matrix case checked initial
selection, keyboard selection, canonical task href, Back/Forward/Back, Task
Escape/Close, restored member/focus, and unchanged localStorage. Compact cases
also checked the sheet, focus trap, inert shell, close/back/forward/reopen and
44 px close control. Desktop cases checked the 38/62 roster/detail ratio,
selection focus and skip-to-detail control. No horizontal document or Team
region overflow was measured; no sampled Team text was below 12 px.

Measured available width explains the transition: 961 px remains compact;
967 px gives **659 px** of Team width and is compact; 968 px gives **660 px**
and uses the split. 1024 px uses the split. A forced 650 px content container at
1440 px also switches to compact. Resizing preserves selection and does not
push history. An interacted-with default detail becomes a sheet; inactive
roster mode stays closed. 1440→720 CSS px reflow (equivalent layout width to
200% zoom at 1440) preserves the open disclosure and has no clipping. This is
viewport emulation, not a claim of testing browser zoom controls.

Dense fixtures are created only in the browser script, never in product seed
or persistent developer data. They exercise **24 members**, a person with
**100 tasks: 20 attention, 10 upcoming, 70 completed**, overlapping blocked/
overdue/not-accepted reasons, long Bulgarian names/roles/titles and unbroken
strings, zero tasks, completed-only work, and accepted work without attention.
Show more/less exposes the complete relevant sets. Returning from a task reload
preserved a deep expanded-row origin and scroll; completed task returns also
restored their expanded disclosure. All completed history starts collapsed.

The existing `tests/dashboard-disclosure.browser.mjs` also passed unchanged:
**13 cases** (6 matrix + 7 extra), including Dashboard focus/disclosures,
Task Back/Forward/Close/Escape, direct URLs, reduced motion and edited origins.
Across both suites: **62 browser cases**, **0 application console warnings,
0 application console errors and 0 uncaught page errors**. Screenshots were
visually inspected for desktop, constrained BG detail, mobile roster/sheet,
and 320 px long-content stress.

### Accessibility and limits

Native accessibility-tree checks confirmed selected buttons, expanded native
summaries, a modal named by the member heading, and exclusion of inert shell
navigation. Keyboard checks covered Enter/Space, heading→Close, Tab/Shift+Tab
wrap, Escape, visible return targets and disclosure focus. The sheet uses one
scrolling body, opaque topbar, `100dvh`, safe-area padding and body scroll lock;
only one member detail tree is interactive. Reduced motion adds no animation.

Measured 58 rendered text/background pairs per theme on the default Team
workspace. Minimum contrast was **5.10:1 Light** and **4.98:1 Dark**; each sample
met its WCAG AA text-size threshold. These are scoped measurements, not a full
accessibility certification. No physical-device safe-area/rotation test,
Safari/Firefox test or human screen-reader session is claimed. Native AX-tree
inspection does not substitute for a screen-reader user review. No real-user
usability, productivity or organizer-effectiveness results are claimed.

### Independent review and corrected findings

A separate read-only agent reviewed product semantics, ordering/selection,
navigation, accessibility source, responsive design, localization and adherence
to the approved contract. It found two P2 issues: interacting with the default
inline detail did not mark it viewed for resize; and the summary gave all five
counts equal large-number emphasis. Both were corrected with engagement-aware
history state and compact primary/subordinate text. The reviewer re-read both
fixes and reported no remaining confirmed source findings. It did not run the
browser suite; browser evidence above belongs to the implementing agent.

Intermediate verification also corrected a test's shortened seed member ID,
a TypeScript narrowing assertion, an incorrect expected Anton task count, and
a harness assumption that 961 px always had enough content width for a split.
Those failures are not counted as passes. Final source and production bundle
were stable before the successful browser run and final automated checks.

### Files and reproduction

Team implementation: `src/pages/TeamPage.tsx`, `src/pages/team/MemberDetail.tsx`,
`MemberSheet.tsx`, `helpers.ts`, `helpers.test.ts`, `team.css`,
`src/teamNavigation.ts`, `src/teamNavigation.test.ts`, and
`src/i18n/teamMessages.ts`. Minimal shared integration: `src/App.tsx` remounts
Team on history entry changes and lets Team restore its own focus;
`src/i18n/messages.ts` registers new Team strings; `package.json` adds the two
unit-test files to the existing test command. Dependencies and lockfile did
not change. `docs/USER_GUIDE.md` describes the implemented interaction.
Dashboard, Tasks, TaskDrawer, BudoSelect, shared CSS/shell/navigation, Plan B,
Templates, domain semantics, storage and seed/time files remain unchanged.

After `pnpm.cmd build`, run a production preview on port 4173, then
`node tests/team-workspace.browser.mjs`. It imports the focused boundary checks
in `tests/team-workspace-edges.mjs`. As with the existing Dashboard script,
`PLAYWRIGHT_MODULE_PATH` can point to an already installed Playwright
`index.mjs`, `BROWSER_EXECUTABLE_PATH` to Edge/Chromium, and
`BUDOGRAPH_BASE_URL` to another preview origin. No app dependency was added.
Raw report/screenshots are ignored under `tmp/phase-2b-3-evidence/`; existing
Dashboard regression output is under `tmp/phase-2b-2-3d-evidence/`.

Backend/auth, invitations/permissions, real collaboration, Plan B/Templates
redesign and Change Consequence Path are not implemented by this phase. The
2025–2026 competition requirements are historical and require verification for
a later competition year.

## Phase 2B.4B — cross-page design-language alignment — 2026-10-01

Implemented the approved narrow alignment from baseline
`7c585a1e3fec84ae1ffeba426f332f417d803b5e`. This is not a global redesign.
Dashboard retains its five sections and operational ordering/limits; Tasks
retains its four-column register, content-width compact treatment, mobile
summary, filters and grouping. Team source, layout and content remain locked.

### Scope and measured typography

Dashboard focus, timeline and checkpoint titles and pressure names now use
14 px/700; Tasks titles use 14 px/700 instead of 13.12 px/770. Operational
metadata, owner/acceptance/deadline text and scoped status/priority labels use
12 px. Register and compact summary labels remain subordinate at 11 px.
Existing font families, semantic palette, surfaces, radius and shadows remain.
Comparable dates/counts use tabular numerals in these scoped elements.

EventOverview Overdue now uses `--risk-on-structure`, like Blocked; progress
and preparation timing retain gold. Removed only Dashboard's “What changed”
and “Team view”, Tasks' “Preparation work”, and TaskDrawer's “Ownership”,
“Current state” and “Record” kickers. All h1/h2/h3 headings and section
`aria-labelledby` relationships remain. “Task relationships” remains because
it identifies the relationship context above “Operational context”. Other
PageHeader callers still render their supplied eyebrow.

Controlled before/after measurements use the same installed headless Edge,
fresh isolated storage, language/theme and viewport. The before bundle was
built from a Git archive of the exact baseline under ignored `tmp/`, using
existing dependencies; it was served separately on port 5195. Its asset hashes
match the audited baseline (`index-C2XmWAmA.css`, `index-CYNGnRfi.js`). The final
bundle was served on port 5194 (`index-B8adJ7rs.css`, `index-CDEcCUEB.js`). These
measurements supersede approximate cross-browser positions from Phase 2B.4A.

| Representative measure, CSS px            |       Before |       After |
| ----------------------------------------- | -----------: | ----------: |
| Dashboard focus title, desktop            |        13.12 |          14 |
| Dashboard focus metadata, desktop         |        10.88 |          12 |
| Dashboard timeline title                  |        12.16 |          14 |
| Dashboard pressure name                   |           12 |          14 |
| Tasks title                               |        13.12 |          14 |
| Tasks acceptance, desktop                 |        10.56 |          12 |
| Tasks deadline / updated text             | 11.2 / 10.24 |     12 / 12 |
| Dashboard text-button height, desktop     |           28 |          44 |
| Dashboard disclosures, audit baseline     |     about 34 | at least 44 |
| Tasks filter / grouping control height    |           36 | at least 44 |
| Tasks search outer height                 |           38 |          44 |
| TaskDrawer close control                  |      38 × 38 |     44 × 44 |
| First Tasks row height, 1440 EN           |           76 |          76 |
| First Dashboard focus row height, 1440 EN |        111.3 |       117.2 |

The search input occupies 42 px inside its 44 px bordered wrapper. The 390 BG
group button grows to fit its two-line label. Existing BudoSelect truncation
in constrained triggers and complete option labels remain intact.

### Browser matrix and vertical rhythm

`tests/interface-alignment.browser.mjs` adds 21 cross-page cases and 18 Tasks
boundary cases. Each primary row below covers Dashboard, Tasks and Team;
positions are the document Y of the first operational row, before → after.

| Viewport / language / theme |   Dashboard Y |       Tasks Y |        Team Y |
| --------------------------- | ------------: | ------------: | ------------: |
| 1440 × 1000 EN Light        | 542.1 → 542.1 | 337.2 → 320.2 | 242.3 → 242.3 |
| 1440 × 1000 EN Dark         | 542.1 → 542.1 | 337.2 → 320.2 | 242.3 → 242.3 |
| 1280 × 900 BG Light         | 621.6 → 621.6 | 380.8 → 371.8 | 237.9 → 237.9 |
| 1024 × 900 EN Light         | 613.9 → 613.9 | 364.1 → 355.1 | 232.7 → 232.7 |
| 390 × 844 BG Light          | 505.0 → 505.0 | 489.7 → 494.6 | 264.2 → 264.2 |
| 360 × 800 EN Dark           | 476.6 → 476.6 | 621.2 → 639.0 | 241.7 → 241.7 |
| 320 × 740 BG Dark           | 505.0 → 505.0 | 621.2 → 639.0 | 264.2 → 264.2 |

Larger mobile controls cost 4.9 px at 390 and 17.8 px at 360/320 above the first
Tasks row after removing the kicker. No new section or spacing system was
added. Dashboard starts at the same Y; text wrapping makes the first focus
row 20.9 px taller at 390, 23.2 px at 360 and 6.6 px at 320. This is the bounded
readability tradeoff, not a claim that all row heights are unchanged.

Tasks boundaries **1100, 1024, 1000, 980, 970, 961, 960, 900, 768** passed in
both EN and BG. The existing available-width query produces compact rows at
1100–961, four columns at 960 and 900 after the sidebar disappears, and compact
rows again at 768. Grouped and ungrouped registers passed cell overflow,
cell collision and badge/arrow checks. Every primary and boundary case had
document scroll width equal to viewport width. Filter popups stayed within
both viewport axes; Enter/Space, Home/End, Escape and restored trigger focus
passed. Grouping and zero-result search/reset passed across the primary matrix.

The unchanged Team suite passed **49 cases** and the unchanged Dashboard suite
passed **13 cases**: a total of **101 browser cases** including the new 39.
Existing suites cover disclosures, task routes, Back/Forward/Close/Escape,
return focus/scroll, direct URLs, edits, responsive transitions, stress fixtures
and reduced motion. The Dashboard suite was rerun after the checkpoint-title
review correction; the final new suite also covers TaskDrawer and Team.
All seven Team baseline/final initial screenshots are byte-for-byte identical,
and Team source/navigation have an empty Git diff.

### Accessibility, visual review and checks

New drawer checks preserve responsibility/progress/metadata h3 headings,
conditional relationships, Tab/Shift+Tab wrapping, Escape ordering for the
status listbox versus drawer, and return focus to the original task link.
The close control measures 44 × 44 px. The existing focus-ring and reduced-
motion CSS and behavior were retained. Scoped rendered text/background
sampling (including composited translucent backgrounds) passed AA thresholds:
Dashboard 78 samples per matrix case, minimum **4.61:1 Light / 4.98:1 Dark**;
Tasks 93 desktop or 78 mobile samples, minimum **4.62:1 Light / 5.92:1 Dark**.
Drawer text was sampled as well. This is not a full accessibility certification.

Screenshots were inspected for the desktop Dashboard/register/Team comparison,
1024 compact register, 390 BG mobile register, 320 BG Dashboard/pressure and
drawer, and desktop operational changes. The final runs reported **zero
application console warnings/errors and zero uncaught page errors**.

Passed: `pnpm.cmd format`, `pnpm.cmd format:check`, `pnpm.cmd lint`,
`pnpm.cmd typecheck`, `pnpm.cmd test` (**94/94**), `pnpm.cmd build`,
`git diff --check`, plus explicit Prettier checking for the new browser script.
The existing responsive unit contract now expects the aligned 12 px mobile
utility labels; architecture and breakpoint assertions remain in place.

### Focused read-only review and limits

A separate read-only diff/render review pass used the requested independent-
review checklist: scope, typography hierarchy, wrapping/density, touch targets,
risk color, retained headings, breakpoint behavior, Team preservation and
semantic preservation. This was performed by the implementing agent; no second
agent or human reviewer is claimed. It found a checkpoint title still smaller
than its updated utility text and a tabular-number selector targeting a `time`
element absent from drawer metadata. Both were corrected locally and affected
browser checks rerun. No remaining confirmed source/render finding was found
in this scoped pass.

Two intermediate harness failures were corrected: focus restoration needed to
wait for the existing animation-frame callback; animated geometry needed a
subpixel tolerance rather than exact floating-point equality. They were test
synchronization issues, not product behavior changes, and are not counted as
passing runs.

Intentional visual differences remain: Team has 15 px task links and 16 px
person names; Dashboard and Tasks retain denser 14 px operational titles.
Page titles, surfaces, structural kickers, badges/icons and information
architecture retain their page-specific purposes. No physical-device,
Safari/Firefox, browser zoom control, human screen-reader or real-user study is
claimed. The historical 2025–2026 NOIT requirements require verification for a
later competition year.

Changed implementation files: `src/styles.css`, `src/components/PageHeader.tsx`,
`src/components/TaskDrawer.tsx`, `src/pages/TasksPage.tsx`,
`src/pages/dashboard/ChangeImpact.tsx`, `src/pages/dashboard/TeamPressure.tsx`.
Changed/added tests: `src/responsive-layout.test.ts`,
`tests/interface-alignment.browser.mjs`. Evidence is appended to this file and
`docs/AI_ASSISTANCE_LOG.md`. No dependency, lockfile, domain, demo/time, routing,
BudoSelect implementation, shell/navigation, backend or data changes were made.
The unrelated untracked `docs/market-research/docs - Shortcut.lnk` was not read,
edited, deleted or staged.

Reproduction: build, start a production preview and run
`node tests/interface-alignment.browser.mjs` with the same optional
`PLAYWRIGHT_MODULE_PATH`, `BROWSER_EXECUTABLE_PATH` and `BUDOGRAPH_BASE_URL`
variables documented for the existing suites. Final screenshots/report are
ignored under `tmp/phase-2b-4b-evidence/`; the controlled baseline comparison
is under `tmp/phase-2b-4b-before/`. No runtime package was installed.

## Phase 2B.4C — Dashboard + Tasks human-led de-SaaS refinement — 2026-10-02

### Scope and controlled baseline

Implemented the approved `BUDOGRAPH_2B4C_DESAAS_DESIGN_CONTRACT.md` from
`6386bd2a95e0342aadf9f44f160e621cc21c49ac`. The four human-provided screenshots
and the approved contract drove the work. A controlled browser baseline was
captured before code changes: 24 page cases, Dashboard factual snapshots, and
16 Team images (initial and second-member selection at eight configurations).
These are synthetic demo observations, not real-user feedback.

Group 1 removed the Event Overview hero shell, decorative metadata icons and
KPI layout; retained all event facts/counts and the exact accessible progress;
made queue titles precede plain action guidance, reasons and metadata; and
made the preparation sequence date-led without rails/dots. Group 2 flattened
change records into change/impact/owner/response relationships with an adjacent
checkpoint, separated severity from response status, and joined pressure
signals/counts after removing Dashboard-only initials and tinted person rows.
Both groups passed focused tests and their own 16-case Dashboard/Team browser
review before the next group began.

Group 3 added the approved event-specific Tasks context, a single wrapping
textual totals summary, and a common controls/results region. Priority is
plain semantic text next to category. Register columns, lifecycle badges,
acceptance, initials, chevrons, links, row sizing and responsive modes remain.
All four contract guardrails are implemented without replacement pills or
stat tiles. No architecture or data semantics were redesigned.

### Verification

All required checks passed: `pnpm.cmd format`, `pnpm.cmd format:check`,
`pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test` (**94/94**),
`pnpm.cmd build`, and `git diff --check`. The new browser script also passed
an explicit Prettier check. Group 1 and Group 2 focused runs each passed
30 tests; the Tasks focused run passed 21 tests.

The final production build was served with Vite preview at
`http://127.0.0.1:5190`, using the existing Playwright runtime and installed
headless Microsoft Edge. No dependencies were installed.

| Width × height | Language | Theme | Pages                  |
| -------------- | -------- | ----- | ---------------------- |
| 1440 × 1000    | EN       | Light | Dashboard, Tasks, Team |
| 1440 × 1000    | EN       | Dark  | Dashboard, Tasks, Team |
| 1280 × 900     | BG       | Light | Dashboard, Tasks, Team |
| 1024 × 900     | EN       | Light | Dashboard, Tasks, Team |
| 768 × 1024     | EN       | Light | Dashboard, Tasks, Team |
| 390 × 844      | BG       | Light | Dashboard, Tasks, Team |
| 360 × 800      | EN       | Dark  | Dashboard, Tasks, Team |
| 320 × 740      | BG       | Dark  | Dashboard, Tasks, Team |

`tests/desaas-composition.browser.mjs`: **24 page cases + 34 boundary cases**.
Tasks was checked in EN and BG at **1280, 1100, 1024, 1000, 980, 970, 961,
960, 900, 800, 768, 600, 430, 420, 390, 360 and 320 px**. Every boundary checks
ungrouped/grouped row geometry, popup bounds, keyboard operation, heading
alignment and document overflow. No existing breakpoint was moved.

The harness compares Dashboard facts to the controlled baseline when present
and independently verifies demo facts/counts/progress, canonical attention
order/reasons/owners, timeline windows/order/previews/kinds/lifecycle, change
fields/checkpoint, and pressure membership/order/roles/counts. Tasks checks
all four cell roles, category/priority, ownership/acceptance, deadlines and
lifecycle; event-wide totals remain unchanged by search and each filter.
It exercises empty search/clear, grouping, invalid links, task opening,
Back/Forward, reload with a task open, Escape and focus restoration.
Keyboard listbox navigation/cancellation, drawer focus trap, nested Escape,
44 px controls, sampled text contrast and native disclosures are checked.
The existing Dashboard suite also covers dense disclosures and reduced motion.

Existing unmodified suites passed: `tests/dashboard-disclosure.browser.mjs`
(**13 cases**) and `tests/team-workspace.browser.mjs` including its imported
edge suite (**49 cases**). Final runs reported **zero application console
warnings/errors, zero uncaught page errors and no document-level horizontal
overflow**.

All 16 final Team images match the baseline byte-for-byte. Team source,
styles and navigation remain unchanged. Direct comparisons also confirmed
unchanged palette/font/shell/shared pre-Dashboard CSS, Drawer and Changes CSS
blocks, components, domain, data, routes, App and package/lock files.

### Fresh read-only review and fixes

A separate read-only pass reviewed the complete diff and rendered screenshots
against the requested checklist. It was performed by the implementing agent;
no second agent or human acceptance of the finished interface is claimed.
Screenshots were inspected in both themes/languages across the matrix, with
additional Tasks inspection at 961/960, 600 and 420 px, and Dashboard lower
sections at desktop and 390/320 px.

Confirmed findings were fixed within scope: plain Important text on the
selected row had 4.42:1 contrast, so that state now uses the existing ink token;
the Tasks header inherited centered alignment at 768 px after totals moved,
so Tasks alone now aligns its header with the working region; a redundant
phone padding override suppressed the milestone spacing, so it was removed.
Regression assertions cover these cases and affected browser checks were rerun.
No further confirmed information loss, behavior change, clipping, weak
checkpoint affordance, replacement KPI/pill pattern or Team regression remained
in this pass.

Intermediate non-passing runs are not counted as evidence. The harness was
corrected to use DOM text for closed timeline disclosures and normalize
Node/browser Intl date-range whitespace. One Team run overlapped a production
rebuild and encountered a transient preview HTTP failure; its complete rerun
against the stable build passed all 49 cases.

Intentional differences remain: Dashboard is a flat operational readout;
Tasks retains its useful table surface and lifecycle badges; Team retains its
locked roster/detail layout and larger person/task type. The existing phone
Event Overview still hides guest text and Review all tasks, with Tasks
available through existing navigation. Queue/timeline heights remain natural,
not artificially equal. Other-browser, physical-device, human screen-reader
and real-user testing are not claimed. Competition-year-specific 2025–2026
NOIT requirements require verification for later years.

Changed files: the five Dashboard components, `src/pages/TasksPage.tsx`,
`src/i18n/messages.ts`, `src/styles.css`, `src/responsive-layout.test.ts`,
`tests/desaas-composition.browser.mjs`, and appended entries in this evidence
file and `docs/AI_ASSISTANCE_LOG.md`. No backend, authentication, database,
dependency, asset, demo clock/storage, Plan B/Templates redesign or Change
Consequence Path work occurred. The unrelated untracked shortcut was not
read, modified, deleted, staged or committed.

Reproduce after building and starting a production preview:
`node tests/desaas-composition.browser.mjs`, with optional
`PLAYWRIGHT_MODULE_PATH`, `BROWSER_EXECUTABLE_PATH` and `BUDOGRAPH_BASE_URL`.
`BUDOGRAPH_REVIEW_STAGE` defaults to `final`; `baseline`, `group1` and `group2`
are available for staged comparison. Ignored screenshots/factual snapshots
and JSON reports are under `tmp/phase-2b-4c-evidence/`. Baseline comparison is
additional to the fixture-derived assertions and requires the saved baseline.

## Backend P1A foundation - 2026-10-03

Implemented under the explicit P1A request and approved Backend Foundation
Contract v1.0. Preflight: branch `main`, HEAD and freshly fetched `origin/main`
`c19c2c04743f041d9216b6328501ed13498d3633`, ahead/behind `0/0`, no tracked or
staged changes. The known untracked shortcut remained outside scope.
The entire master prompt, approved contract, and supplied 30-page 2025-2026
regulations were read before implementation.

### Executed checks

Verified locally on Windows using Node.js `v24.16.0`, pnpm `11.9.0`, and the
existing Git/TypeScript/ESLint/Prettier tools. No PostgreSQL, Docker, Testcontainers,
or cloud database was installed or provisioned.

| Command                     | Result                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| `pnpm.cmd format`           | PASS; locked frontend files stayed unchanged.                               |
| `pnpm.cmd format:check`     | PASS; includes backend source/tests/config and development guide.           |
| `pnpm.cmd lint`             | PASS; Node globals for server and existing frontend/Vite coverage retained. |
| `pnpm.cmd typecheck`        | PASS; existing frontend configurations unchanged.                           |
| `pnpm.cmd test`             | PASS; 94/94 frontend tests, zero failures/skips.                            |
| `pnpm.cmd build`            | PASS; frontend production build completed.                                  |
| `pnpm.cmd server:typecheck` | PASS; strict NodeNext source, scripts, and tests; no skipLibCheck addition. |
| `pnpm.cmd server:test`      | PASS; 35/35 backend tests, zero failures/skips.                             |
| `pnpm.cmd server:build`     | PASS; dedicated ignored output in `server/dist/`; tests not emitted.        |
| `git diff --check`          | PASS.                                                                       |

The 35 backend tests comprise configuration validation/safe errors (4), Fastify
injection and request-log safety (6), migration file/history logic and explicitly
mocked client behavior (17), lazy pool/error boundary (1), Git ignore probes (2),
and shutdown/startup failure behavior (5). Real PostgreSQL is not exercised by
these tests. The migration concurrency test uses an explicitly simulated lock;
it does not prove PostgreSQL advisory-lock behavior.

Additional runtime checks executed: source and compiled server/migration entrypoints
exit with status 1 and a safe field-specific message when DATABASE_URL is absent.
The compiled HTTP runtime bound an ephemeral loopback port; liveness returned 200
and the real pool's connection attempt to deliberately refused loopback port 1
produced a safe readiness 503. Synthetic connection details did not appear in logs.
SIGTERM and SIGINT handlers were driven with `process.emit`; cleanup exited with
status 0. This does not claim actual Windows OS signal delivery was verified.
No readiness-success check against a live database was performed.

REAL POSTGRESQL INTEGRATION CHECK:
**NOT RUN - no approved test database configured.**

### Security, lifecycle, and scope review

The first code change hardened `.gitignore`; `git check-ignore` and automated
probes verify root/nested `.env` and `.env.*` protection, explicit `.env.example`
allowance, and ignored compiled server output. No temporary environment files
were created. `server/.env.example` contains unmistakable placeholders only.
Changed-file searches reviewed key prefixes, private-key markers and credential
URLs; URL matches were only reviewed synthetic/invalid test inputs or placeholders.
No real database credentials, passwords, tokens, environment files, auth code,
wildcard CORS or generated backend JavaScript were added to the intended source.

Confirmed findings fixed during review:

- Fastify's malformed-URL fallback echoed raw URL components outside the normal
  error handler. A safe framework error handler and regression test now cover it.
- Checked-out pg clients lose pg-pool's idle error listener. The migration runner
  now handles client connection error events safely, stops further work, destroys
  failed sessions and retains its listener through release. EventEmitter mocks
  cover active-query errors, errors between queries and listener handoff.
- Runtime validation now preserves safe EnvironmentError field diagnostics without
  exposing raw startup/pg errors; shutdown cleanup survives failed reporting.
- Existing Vite lint coverage was retained when server Node globals were separated.
- Migration SQL checkout line endings are pinned to LF in `.gitattributes` so exact
  byte checksums can remain reproducible across Windows and Linux.

Migration metadata is fixed `public.schema_migrations`; inserts parameterize
version/name/checksum and timestamps originate in PostgreSQL. One checked-out
client owns the advisory lock and per-file transactions. History changes,
renames, missing files, duplicate versions, and late versions fail; failed SQL or
metadata writes are not marked applied. Failed rollback/unlock destroys the client.
Migration files are trusted reviewed repository SQL, must be transaction-compatible,
and must not control transactions/locks/metadata themselves. No down runner exists.

No business SQL migration files were added. No real database was migrated, so no
real metadata or business tables were created by this task. No Better Auth, users,
sessions, Event/EventMember/Task/ActivityEntry tables, task commands, permissions,
remote frontend services, Plan B/Templates work or deployment was implemented.

`git diff` confirms the entire tracked frontend `src/`, browser tests, HTML,
Vite configuration, frontend tsconfigs and workspace setup are unchanged. Demo
state/date/storage, routes/history/focus, selectors and locked Dashboard/Tasks/Team
remain unchanged. No new browser visual run is claimed for this infrastructure-only
phase. All 227 previously locked package versions remain present; only the required
backend dependency tree was added (plus refreshed ESLint deprecation metadata).

Documentation: backend development guide and migration authoring guide added;
README, known limitations, direct-dependency/license register and AI assistance
log updated. Full installed MIT license texts for fastify, pg and @types/pg were
reviewed; no legal certification or full transitive redistribution audit is claimed.
The historical 2025-2026 NOIT rules still require verification for a later year.

### Final independent read-only review and staged audit

A separate regulation/documentation agent performed a fresh read-only review of
all 29 staged files after the fixes, including the complete migration tests,
client error-event handling, runtime/configuration, dependency/config diff and
final documentation. Review result: PASS, no remaining confirmed issues. This is
an independent agent review of the implementation, not human acceptance or an
external security assessment. The primary agent also reviewed the complete scope.

The final staged audit found only the intended 29 files: six root infrastructure/
README files, five documentation files, and 18 files under server/. No real
secret files or credentials, generated server output, frontend changes, business
SQL files, or unrelated shortcut were staged. `git diff --cached --check` passed.
`pnpm.cmd install --frozen-lockfile` also passed with the resolved lockfile.
The unrelated shortcut remained untracked and untouched.

## Backend P1A - subsequent human PostgreSQL verification - 2026-10-03

Implementation baseline: `75e76c2192322015ce815581b74672726411aec8`
(`feat(server): establish backend foundation`). The human supplied the following
manual results from the approved Supabase-hosted PostgreSQL development database.
Codex recorded these results without accessing secrets or rerunning database
operations. Earlier implementation evidence above remains historical; its
NOT RUN status describes the earlier verification boundary.

### Secret protection and real health checks

The human ran `git check-ignore -v server/.env` and reported:

```text
.gitignore:79:**/.env   server/.env
```

The human's Git status confirmed `server/.env` was not tracked. Only the known
unrelated untracked `docs/market-research/docs - Shortcut.lnk` remained.
The human configured the local secret DATABASE_URL; its value was not shared
with AI or committed.

| Manual request                                                                 | Result                               | Evidence                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `GET http://127.0.0.1:3001/api/health/live`                                    | HTTP 200, `{"status":"ok"}`          | Fastify liveness succeeded.                                                                                  |
| Initial `GET http://127.0.0.1:3001/api/health/ready`                           | HTTP 503, `{"status":"unavailable"}` | Before credentials were corrected, database-unavailable behavior was safe and exposed no connection details. |
| Readiness after the human corrected local credentials and restarted the server | HTTP 200, `{"status":"ok"}`          | Successful real PostgreSQL connectivity.                                                                     |
| Final readiness after migration verification                                   | HTTP 200, `{"status":"ok"}`          | PostgreSQL readiness remained successful.                                                                    |

### Real migration-runner verification

The human manually executed `pnpm.cmd db:migrate` twice:

```text
Run 1: Migrations complete: 0 applied, 0 already applied.
Run 2: Migrations complete: 0 applied, 0 already applied.
```

Both successful runs connected to real PostgreSQL and executed migration
infrastructure. Repeating the empty run was safe/idempotent. Zero applied
migrations is expected for P1A because no business SQL migration files exist.
No business migrations, business tables, or auth tables were created. This
does not claim application of pending SQL files, direct metadata inspection,
live checksum-change rejection, concurrent locking, or transactional rollback.

REAL POSTGRESQL INTEGRATION VERIFIED: **YES**
REAL MIGRATION RUNNER VERIFIED: **YES**
BUSINESS TABLES CREATED: **NO**
AUTH IMPLEMENTED: **NO**
BACKEND P1B STARTED: **NO**

## Backend P1B — authentication, relational schema and authorization — 2026-10-03

Implemented under the explicit P1B request and approved Backend Foundation
Contract v1.0. Preflight: `main`, HEAD and freshly fetched `origin/main`
`96621f5da8fdd64bb4bf50d0962b8070441b8427`, ahead/behind `0/0`, no tracked/staged
changes. The unrelated `docs/market-research/docs - Shortcut.lnk` remained
untracked and untouched. Mandatory master prompt, 30-page regulations and
complete approved contract/P1A implementation were read. The 2025–2026 rules
remain historical and require verification for the actual participation year.

### Auth/schema provenance and implementation boundary

Only `better-auth` **1.7.7** (MIT) was added as a direct dependency, pinned in
`package.json` and `pnpm-lock.yaml`. Official current PostgreSQL/Fastify/options/
CLI documentation and installed 1.7.7 behavior were checked. The matching
official generator is **`auth@1.7.7`**, invoked through pinned `pnpm dlx`, using
the locally installed runtime configuration and existing `pg.Pool`.
`@better-auth/cli@latest`, unmanaged auth migrations, application ORMs and an
Admin plugin were not used.

`0001_better_auth_core.sql` contains reviewed generated SQL, including the
server-controlled `user.active` field. Auth instants are generated as
`TIMESTAMPTZ` natively, without a hand-written table reconstruction or type
rewrite. Raw generated SQL SHA-256:
`1ff812a96bd306d7124d1d5a3e74b20d7ae5c04e2948bab0d8614e768641d670`.
The migration adds provenance comments only, with LF checkout normalization.
The generator was rerun before migration and matched the runtime schema.
Temporary generator output is ignored and is not committed.

`0002_budograph_core.sql` adds Event, EventMember, Task and ActivityEntry with
UUID business IDs, finite `DATE` calendar values, named timezone validation,
version constraints, scoped membership/actor foreign keys, current acceptance
consistency, soft-delete metadata and JSONB history. One narrow database trigger
rejects history UPDATE/DELETE/TRUNCATE. Auth and business tables have RLS enabled
with no browser policies. Backend Event authorization still runs separately;
the current trusted database identity bypasses owner RLS, and production
least-privilege runtime/migration-role separation remains deployment work.

Runtime authentication disables public email/password signup and also disables
its HTTP path. The isolated DEVELOPMENT-only CLI instance uses supported
`auth.api.signUpEmail`, with automatic signup login disabled. Better Auth owns
password hashing, account creation and database sessions. Active User state is
checked at session issuance and protected reads. `/api/me` returns only user
id/name/email; authorization helpers derive identity from that trusted boundary.
Event membership, access role and task lookup are persisted, parameterized and
Event-scoped; descriptive operational role grants no authority.

`BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required for auth-capable runtime;
database-only migration commands retain the separate typed DB environment.
Cookies are HttpOnly/SameSite=Lax and Secure for HTTPS/production. Trusted origins
contain exactly the configured auth origin, with default CSRF checks retained.
No separate frontend auth origin/CORS is configured. Auth memory rate limiting
uses the direct peer IP supplied by the server, ignoring forged client IP headers.
Fastify forwards distinct Set-Cookie headers, status, headers and body; library
diagnostics are disabled and application logs omit credentials/cookies/raw errors.

### Executed real PostgreSQL/auth verification

The approved Supabase development database was accessed through native Node
environment loading. `server/.env` was never read or printed by the agents.
The read-only preflight reported PostgreSQL **17.11** and only
`public.schema_migrations`; there were no conflicting auth/business tables.
The human confirmed creation of synthetic development credentials and a random
auth secret in the separate Git-ignored `server/.env.p1b.local`. Values were
generated locally with Node crypto, never printed or placed in command arguments,
source, evidence, screenshots or Git. The normal server does not require
provisioning credentials. The development-only commands load that optional
file; compiled `server:start` does not automatically load development credentials.

| Verification                          | Observed result                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First explicit `pnpm.cmd db:migrate`  | `2 applied, 0 already applied`                                                                                                                                           |
| Second explicit `pnpm.cmd db:migrate` | `0 applied, 2 already applied`                                                                                                                                           |
| Migration metadata                    | Both immutable filenames/checksums match repository bytes                                                                                                                |
| Auth schema                           | `user`, `session`, `account`, `verification` present                                                                                                                     |
| Business schema                       | `event`, `event_member`, `task`, `activity_entry` present                                                                                                                |
| First `pnpm.cmd server:provision`     | Organizer and Member: `created`                                                                                                                                          |
| Repeated provisioning                 | Both: `already-exists`; no password reset or duplication                                                                                                                 |
| Real auth verifier                    | PASS: actual loopback listener/live/readiness, HTTP signup 404, direct runtime signup disabled, rejected signup creates no user                                          |
| Organizer and Member                  | Both sign in with separate cookies; `/api/me` safe identity and Better Auth session lookup succeed                                                                       |
| Session persistence/logout            | Each login adds a real session row; logging out Organizer leaves Member authenticated; each logout invalidates lookup/protected access and returns row count to baseline |
| Negative auth/origin checks           | Missing/malformed session → 401; wrong password → 401; untrusted cookie-auth origin → 403; no wildcard CORS                                                              |
| Response/log safety                   | Safe application identity; passwords, auth/database secrets and cookie/session values absent from captured logs                                                          |
| Compiled runtime smoke                | Actual compiled main: live 200, real readiness 200, protected `/api/me` 401, safe logs                                                                                   |
| Final persistent counts               | 2 users, 2 credential accounts, 0 sessions; 0 Events/Members/Tasks/ActivityEntries                                                                                       |

Applied migration checksums:

- `0001`: `3eea6d946b15cfc651e83f32d454c3f5b4bae28062421f9fa2ba2eeea14c3d91`
- `0002`: `f6bba034c1f709cb4f6768c5350823aae7c01f384ab5ce9dd652a23deb5b9785`

The opt-in `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration` run
passed **17/17 tests**, zero failures/skips (parent plus 16 subtests). It proves
real migration idempotence/checksums; all eight tables/RLS/no public policies;
actual `anon` and `authenticated` SQL-role read denial across all eight tables;
Event date/name/timezone/version constraints; membership uniqueness/role/active
consistency; valid/invalid lifecycle and priority; whitespace-only title rejection;
cross-Event assignee and creator/updater/deleter FKs; paired/scoped acceptance;
date-only values under Pacific/Honolulu; JSONB/server-time history and matching
actor User/member/Event; append-only behavior and restrictive history references;
real scoped authorization with inactive User/member and operational-role denial.
All generated schema fixtures were rolled back and their absence checked.
No database/schema reset, unrelated-row deletion or TRUNCATE was executed.
Role denial was exercised through SQL, not the external Supabase REST API.

### Automated/regression checks and review

Executed on Windows with Node.js `v24.16.0` and pnpm `11.9.0`:

| Command                                                 | Result                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm.cmd format` / `format:check`                      | PASS; locked frontend files unchanged                                     |
| `pnpm.cmd lint`                                         | PASS                                                                      |
| `pnpm.cmd typecheck` / `build`                          | PASS; frontend production output unchanged                                |
| `pnpm.cmd test`                                         | PASS: 94/94 frontend tests, no failures/skips                             |
| `pnpm.cmd server:typecheck` / `server:build`            | PASS                                                                      |
| `pnpm.cmd server:test`                                  | PASS: 57 passed, 1 intentional opt-in database suite skipped, no failures |
| `pnpm.cmd server:test:integration` with explicit opt-in | PASS: 17/17 against approved PostgreSQL, no skips                         |
| `pnpm.cmd server:verify-auth`                           | PASS against real PostgreSQL after final script fixes                     |
| `pnpm.cmd server:auth-schema` after migrations          | PASS: schema up to date, no new SQL file, no migrations applied           |
| `pnpm.cmd install --frozen-lockfile`                    | PASS                                                                      |
| `git diff --check`                                      | PASS                                                                      |

Offline tests retain P1A coverage and add real-library signup/malformed-cookie/
origin probes, supported active-user session hook, cookie/configuration safety,
safe identity/log errors, nine authorization tests and two provisioning-input
tests. Their injected session/database cases are explicitly unit tests; the
separate real verification establishes database-backed auth behavior.
Backend DOM type libraries are needed for Better Auth's WHATWG signatures;
`skipLibCheck` avoids its unused unconditional `bun:sqlite` declaration.
Project code retains strict checking; no Bun dependency or false declaration shim
was added. This limitation is documented, not hidden.

Confirmed findings fixed before final verification:

- PostgreSQL `btrim` alone did not reject tab/newline-only required text; reviewed
  checks use whitespace-aware regex and real negative tests before SQL application.
- Verification failure cleanup needed a trusted Origin for cookie-auth logout;
  it now revokes only its pending sessions and checks cleanup responses.
- CLI cleanup failures could escape safe error handling or skip pool closure;
  cleanup now uses static failures and the existing ordered shutdown boundary.
- Official CLI generation returns exit 0 with no output for an up-to-date DB;
  each invocation now has a unique ignored output path and reports actual output
  presence, preventing stale SQL from being called newly generated.
- The initial auth verifier exceeded the library's 3-per-10-second sign-in limit
  with its negative probes (429). Origin verification now uses cookie-auth logout;
  the runtime rate limit was retained. Intermediate failures are not passing evidence.

Fresh read-only agent reviews covered current official API/library behavior,
provenance, auth/session/cookies, public signup, SQL constraints/history/RLS,
provisioning, migration safety, query scope, tests and scope exclusions. Findings
above were fixed and affected verification rerun. This is agent review, not formal
security certification or human product acceptance.

Dashboard/Tasks/Team and all tracked frontend source, routes, localStorage demo
behavior, selectors and appearance are unchanged. No frontend login/integration,
remote workspace service, Event bootstrap, task mutation endpoints, Plan B,
Templates, Budget, AI or notification backend was added. The two-user task
responsibility loop and transactional ownership/deactivation/lifecycle commands
remain P1C. No real Event or demo migration is implied by controlled account
provisioning. Production deployment, restore verification, browser auth E2E and
separate runtime DB privileges remain limitations.

Final staged audit: **PASS** — 31 intended backend/tooling/documentation files,
no locked frontend changes, secret files, actual loaded credential values,
private keys, credential-bearing Supabase URLs, generated build output or
shortcut. Environment-name matches were configuration references/placeholders;
test passwords were explicit synthetic sentinels. Both applied SQL checksums
remained unchanged. `git diff --cached --check` passed. Fresh independent reviews
reported no remaining confirmed actionable findings after fixes.

## Backend P1C — two-user responsibility loop — 2026-10-03

Authorized baseline: `221031b7d5cb04cb56c24e208e04d305009825b2` on `main`,
freshly fetched `origin/main` equal, ahead/behind 0/0, tracked worktree clean.
Only `docs/market-research/docs - Shortcut.lnk` was untracked; it was untouched.
The complete master prompt, supplied 30-page 2025–2026 regulation, approved
backend contract and P1B implementation were read before implementation.
The earlier contract documentation-only restriction does not override this
explicit human authorization to implement P1C. Historical competition rules
still require verification for the actual participation year.

### Preflight and implemented scope

P1B preflight passed: backend typecheck, 57 offline tests (one intentional DB
skip), 17/17 real PostgreSQL schema tests and the real two-account auth verifier.
P1C adds five task routes, strict command DTO validation, transactional scoped
authorization, responsibility/status commands, canonical task DTOs, explicit
development Event bootstrap and a reproducible real HTTP verification script.
No frontend source, migration SQL, dependency or lockfile was changed.

### Real approved PostgreSQL and HTTP evidence

| Verification                      | Observed result                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit `server:bootstrap-event` | First run created one Event, two memberships and one minimal task; repeated run reported all already-exists with identical UUIDs.                                                                    |
| Organizer session                 | Actual loopback HTTP login, safe identity, Better Auth lookup and additional database session row passed.                                                                                            |
| Member session                    | Separate memory-only cookie jar independently resolved Member; distinct from Organizer, with its own database session row.                                                                           |
| Both reads                        | Both active memberships read the same live Event task; deadline stayed `2026-10-04`.                                                                                                                 |
| Assignment                        | Organizer assigned the task to Member; Member refetch and SQL state confirmed the membership reference. Member assignment returned 403.                                                              |
| Acceptance                        | Organizer impersonation returned 403. Member acceptance persisted its resolved member ID and database instant; Organizer refetch saw it. Forged actor/time/role/history fields returned 400.         |
| Current-version acceptance repeat | Returned canonical unchanged state; version and original acceptance instant remained unchanged.                                                                                                      |
| Status                            | Current Member changed status to in-progress; current acceptance remained unchanged. Organizer status authority also passed.                                                                         |
| Stale request                     | Old expectedVersion returned 409 with `TASK_VERSION_CONFLICT`; no stale overwrite/history.                                                                                                           |
| Withdrawal                        | Organizer impersonation returned 403; Member withdrawal cleared both acceptance fields and recorded history; explicit Member reacceptance succeeded.                                                 |
| Reassignment                      | Organizer reassigned to their own active membership; SQL showed new assignee and both acceptance fields null together. Activity recorded prior accepted member/time and clearing.                    |
| Old assignee                      | Member acceptance and status writes after reassignment returned 403.                                                                                                                                 |
| Unassignment / assign-back        | Organizer accepted their own task, then unassigned; SQL showed assignment/acceptance null. Assigning back to Member left acceptance empty.                                                           |
| History                           | Previous Member acceptance remained stored with server actor/instant; all six dotted command action types were present.                                                                              |
| Actual concurrent writes          | Simultaneous Organizer/Member HTTP status commands with the same version used independent pg transactions: exactly one 200 and one 409, one version increment and one additional activity.           |
| Event boundary                    | Both real sessions denied foreign Event/task IDs with 404; Organizer could not mutate a foreign task using Event A's path; foreign membership assignment returned 404. SQL version stayed unchanged. |
| Operational role                  | A persisted MEMBER with operational text `Organizer` still received assignment 403.                                                                                                                  |
| Missing auth                      | Task read without a session and reads after logout returned 401.                                                                                                                                     |
| Session isolation / cleanup       | Organizer logout left Member authenticated; both verifier-created sessions were revoked and session counts returned to baseline.                                                                     |
| Foreign fixtures                  | Unique synthetic identity/Events/members/tasks existed only in a fixture transaction; rollback and absence queries passed. Controlled auth users were not deleted.                                   |
| Log safety                        | Captured logs contained none of the loaded database/auth secrets, account passwords/emails, cookie strings or encoded/decoded cookie values.                                                         |

The real workflow intentionally persists changes/history on the separate
development task; it does not reset or delete history. Both the initial run and
post-review rerun of `pnpm.cmd server:verify-responsibility` passed. This is actual
backend HTTP verification with the real auth library/database, not browser UI E2E.

Final read-only database inventory: **2 Users, 2 credential Accounts, 0 Sessions,
1 development Event, 2 EventMembers, 1 Task, 22 ActivityEntries**. All six action
types are present. No P1B/P1C disposable identity remains. These counts reflect
the two intentional verifier runs, not imported demo data or user activity.

### Automated checks

| Check                                                | Result                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Frontend `pnpm.cmd test`                             | 94/94 passed; locked UI source unchanged.                                        |
| Backend `pnpm.cmd server:test`                       | 74 passed, zero failed, two intentional opt-in DB suites skipped.                |
| PostgreSQL explicit opt-in `server:test:integration` | 27/27 passed, zero failed/skipped: P1B 17 plus P1C 10 including parent/subtests. |
| `pnpm.cmd format` / `format:check`                   | Passed.                                                                          |
| `pnpm.cmd lint`                                      | Passed.                                                                          |
| Frontend and backend typechecks/builds               | Passed.                                                                          |
| `git diff --check`                                   | Passed.                                                                          |

Seventeen new offline tests cover strict input/version validation, assignment,
reassignment, unassignment, acceptance/withdrawal and impersonation, independent
status, permissions/operationalRole, version increments, stale no-op rejection,
idempotent current-state results, missing/foreign/inactive lookup results,
history construction, mutation/activity failure rollback and failed-rollback
client destruction, DTO/query scope, HTTP origin/forged fields/conflict/log safety,
and development bootstrap configuration without passwords. Injected pg/session
cases are test doubles and are not represented as real SQL evidence.

The P1C real SQL suite verifies command/state/history behavior, stale writes,
withdrawal/reacceptance, reassignment/unassignment/assign-back, permissions,
foreign/inactive users/members, actual constraint-failure rollback of task/history,
soft-deleted reads/mutations, archive write denial and repeatable bootstrap.
Outer fixture transactions and command savepoints are explicitly test-only;
all disposable rows are rolled back and absence verified. Concurrent real pg
transactions are covered separately by the two-session HTTP verifier.

### Fresh review, confirmed correction and boundaries

A fresh read-only review checked route/service separation, persisted roles,
Event-scoped SQL and FKs, locked User/membership/assignment state, acceptance
impersonation/clearing, version checks before no-op handling, atomic history,
rollback/disconnection cleanup, safe HTTP failures/logs, strict fields/origin,
bootstrap reruns, test evidence and scope exclusions. No subagents were used.
This is a focused code/security review, not formal certification or human acceptance.

A non-ISO PostgreSQL `DateStyle` probe exposed pg TIMESTAMPTZ parsing returning
null during DTO serialization. That intermediate run failed and is not passing
evidence. Commands now set ISO DateStyle locally and format DATE explicitly as
YYYY-MM-DD. The real suite retains SQL/DMY + Pacific/Honolulu session setup as
a regression probe; all 27 tests and the real HTTP verifier passed after correction.
Applied migration checksums are unchanged from P1B: 0001 `3eea6d946b15cfc651e83f32d454c3f5b4bae28062421f9fa2ba2eeea14c3d91`,
0002 `f6bba034c1f709cb4f6768c5350823aae7c01f384ab5ce9dd652a23deb5b9785`.

Dashboard/Tasks/Team, all frontend source/demo behavior and styles remain locked.
No frontend auth, RemoteWorkspaceService, Event/task authoring UI, invitation,
Plan B/Templates/Budget/AI/notifications/chat/realtime or generic policy/audit
framework was implemented. Production hosting, separate least-privilege DB
grants, restore verification and browser integration remain unfinished.

Final staged audit passed for 18 intended runtime/script/test/documentation files.
No environment, credentials, cookie jars, shortcut, locked frontend or applied
migration files were staged. Exact loaded database/auth/account credential values
were absent from the staged diff; password/session/cookie word matches were
configuration, verification code or synthetic tests, not usable credentials.
Staged diff whitespace validation passed and freshly fetched main remained
synchronized before the implementation commit.

## P1D.1 authentication UI — 2026-10-03

Baseline: `a189a33119766c285cb21e284e191eb8d22bb91f`, main == origin/main,
tracked worktree clean. Only the known unrelated shortcut was untracked and
was not changed/staged. Before implementation, frontend 94/94 and backend
74 passing offline tests passed. The default backend command skipped its two
opt-in PostgreSQL suites; explicit `RUN_DATABASE_INTEGRATION=1` subsequently
passed all 27 real database tests. The real P1C two-user HTTP verifier passed
assignment, acceptance, withdrawal, clearing, conflicts, authorization, history,
rollback fixtures and isolated logout. Its intentional development history is
preserved; no migrations/reset/destructive operation occurred.

### Browser and UI evidence

Real browser script: `scripts/verify-auth-ui.mjs`, run through the existing
Playwright runtime with desktop Microsoft Edge **154.0.4258.53** against Vite
`http://127.0.0.1:5173` and real Fastify/PostgreSQL on port 3001. Controlled
account values came from ignored local configuration, never this document.
Reports/screenshots are local ignored evidence under `tmp/p1d-evidence/`.
No HAR, trace, cookies, storageState or session dump is saved.

| Scenario                              | Observed result                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated load/direct Tasks URL | Session loading hides App, then Login with canonical intended task destination.                                                                                                                                       |
| Login semantics                       | Explicit labels, email/password types, username/current-password autofill, keyboard submit, no signup/recovery/social controls.                                                                                       |
| Invalid credentials                   | Generic email-or-password message; password cleared; accessible alert focused.                                                                                                                                        |
| Duplicate submit                      | Delayed real command plus two form submissions issued one POST; disabled/aria-busy submitting state.                                                                                                                  |
| Organizer                             | Real UI login, intended task route, safe `/api/me` identity matching configured Organizer and same identity after refresh.                                                                                            |
| Authenticated Login                   | Replaced with workspace, no loop.                                                                                                                                                                                     |
| Organizer logout                      | Real server sign-out; `/api/me` 401; direct Team and history navigation remain logged out with no protected content.                                                                                                  |
| Member                                | Independent real login/identity, distinct from Organizer, refresh persistence and real logout/401.                                                                                                                    |
| Invalidated open session              | Actual server sign-out outside React followed by focus recheck removes identity/shell and shows session-ended Login. This verifies invalid-session handling, not waiting through the natural multi-day expiry period. |
| Server/malformed response             | Explicitly injected 500 and malformed identity show safe text and fail closed; raw details never displayed.                                                                                                           |
| Backend unavailable                   | Backend actually stopped, Vite still running: direct protected bootstrap and Login submission show understandable safe errors. Backend restarted afterward.                                                           |
| Redirect safety                       | External returnTo rejected; allowlist and canonical task-query unit cases pass.                                                                                                                                       |
| Cookie/storage safety                 | Real session cookie HttpOnly/SameSite=Lax; no session token in document.cookie, localStorage or sessionStorage. React state contains only safe identity by code review.                                               |
| Public signup                         | Real POST through proxy remains 404.                                                                                                                                                                                  |
| Mobile account access                 | Real Member session, wordmark menu via keyboard at 768/390/320; logout passes with no shell overflow.                                                                                                                 |

Login matrix: **20/20** cases — widths 1440, 1024, 768, 390 and 320 × BG/EN ×
light/dark, at 900px viewport height. No horizontal overflow; authentication
controls at least 44px, inputs/submit 48px; visible focus and Email → Password →
Sign in Tab order pass. Desktop and narrow BG/dark screenshots were visually
inspected. No auth animation was introduced. No application page errors or
unexpected console errors occurred; expected failing HTTP requests are not
classified as application-console failures. Screen-reader/real-device/other
browser/password-manager product certification is not claimed.

### Locked frontend regression

Captured current baseline and authenticated after screenshots for Dashboard,
Tasks and Team: **60 comparisons**, same five widths × BG/EN × light/dark.
36 main-capture images are pixel-identical. The 24 narrow captures differ by
121–152 pixels solely at rows 25–35 of the overlapping sticky mobile header;
the wordmark is now the minimal account menu trigger. The workspace region
below that header is pixel-identical in every comparison, with matching image
dimensions and zero overflow. This is the necessary minimal shell account
surface; no locked page composition, data or behavior was redesigned.

Existing ignored browser harnesses were rerun with only the origin updated and
real session cookies supplied in memory (then server logout), retaining their
original assertions. Tasks 2B.2.3C: **47 layouts, 11 stress, 6 surfaces, 4
interactions, 6 regressions**, no console/application errors. Dashboard 2B.2.3D:
**6 matrix, 5 extra** cases including disclosures, Back/Forward/Close/Escape,
focus/scroll return, blocked storage and reduced motion, no errors. Team source,
styles, selectors/history and its 16 existing domain/navigation tests are
unchanged and pass; the 20 Team screenshots are included above.

### Automated checks and review

| Command                                                  | Result                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm.cmd test`                                          | 106/106 pass: original 94 plus 12 auth state/routing cases.                   |
| `pnpm.cmd server:test`                                   | 75 pass, zero failures; two opt-in DB suites skipped in this default command. |
| `RUN_DATABASE_INTEGRATION=1` + `server:test:integration` | 27/27 pass, zero skipped.                                                     |
| `server:verify-auth` / `server:verify-responsibility`    | Real backend checks pass.                                                     |
| `test:browser:auth`                                      | Real browser checks and 20 responsive cases pass.                             |
| Stopped-backend mode                                     | Pass against the actually stopped backend.                                    |
| `format` / `format:check` / `lint`                       | Pass.                                                                         |
| Frontend/backend `typecheck` and `build`                 | Pass.                                                                         |
| `git diff --check`                                       | Pass.                                                                         |

An intermediate Login target-size check failed because the later shared button
rule overrode the initial height. The scoped Login rule was corrected to 48px
and the full browser matrix rerun passed. The initial delayed-request harness
held the request beyond the client's timeout; its synchronization was fixed.
The first origin-boundary test used schema validation against a deliberately
unavailable test database and omitted a cookie; the test now explicitly isolates
the origin boundary with an invalid synthetic cookie, while real browser runs
keep full production-library/schema behavior. None of these failed runs is
presented as final passing evidence.

One intermediate backend auth verifier ran alongside the browser suite; their
shared account sessions interfered with the verifier's database session-count
assertion. Its final run was isolated after browser completion and passed.

Fresh read-only review covered the official client API, safe-user-only state,
cookie/token/password handling, non-disclosing errors, closed signup, exact
origins, allowlisted redirects/no loops, stale-session races, keyboard/mobile
layout and scope. `/api/me` lacked an explicit cache policy; `Cache-Control:
no-store` was added for both authenticated and 401 responses and verified by the
focused test. No subagents/human acceptance/security certification is claimed.

Documentation updated: README, backend development, known limitations, user
guide, deployment/offline demo plan, AI assistance log, this evidence and dependency-use notice. No dependency
or lockfile change; no remote workspace, Event/task authoring, assignment UI,
onboarding, Plan B/Templates/Budget/AI implementation. LocalDemoWorkspaceService
remains intentional; P1D.2 has not begun. Production HTTPS/proxy/hosting,
least-privilege DB grants, restore drills and actual-year NOIT rule verification
remain limitations. Idle foreground expiry recognition waits for the next
focus/visibility/online/navigation recheck; there is no aggressive polling.

Final staged security audit passed for **27 intended files**, including the
deployment/offline demo note. Environment/credential/session files and the
unrelated shortcut are absent. Exact loaded database/auth secrets and controlled
account email/password values are absent from the staged diff and built bundle.
Auth source has no browser-storage writes or console logging. Keyword matches
for password/session variables are only implementation/test/documentation text,
not real credentials. Locked page/service/history sources, lockfile and applied
migration checksums are unchanged. Staged whitespace checks passed.

## P1D.2A remote Tasks reads — 2026-10-03

Implemented the explicitly requested read-only Tasks slice from
`dca54ab5050ba956c4920ff78216b6e44c797145` on `main`. Fresh origin fetch matched
the expected baseline, ahead/behind 0/0, with no tracked changes. The known
untracked `docs/market-research/docs - Shortcut.lnk` remains excluded/untouched.
The complete master prompt, supplied 30-page 2025–2026 regulations, approved
backend contract, current Tasks/service/auth/semantic contracts and locked
responsive tests were read before implementation. The request authorizes this
stage; no new concept, MVP, schema, core workflow or visual redesign was added.

The supplied rules confirm the 2025–2026 source/docs/user-guide/security/license/
role-account obligations. Categories, dates, online availability, PDF format,
GPLv3/eligibility and rubric remain year-specific and require official actual-year
verification. The 15 September 2026 date is an internal project target.

### Architecture and authorization evidence

`RemoteWorkspaceService` owns authenticated, no-store GETs and DTO projection.
`TaskReadController` owns coalescing, cancellation/revision checks and deliberate
loading/ready/error state. `useRemoteTasks` enables that path only on Tasks and
clears on leaving, logout or account change. React consumes application-facing
models. The existing LocalDemoWorkspaceService boundary (`useWorkspace`, reducer,
localStorage seed/persistence) remains unchanged for Dashboard and Team.

New `GET /api/events` lists only the current session User's active,
non-deactivated Event memberships and rechecks active User. It projects minimal
Event calendar/timezone/current membership data, with no-store. Zero is valid
empty, one auto-selects; multiple sort by earliest `startDate`, then UUID. This is
a documented temporary policy without an Event switcher or persisted privileged
ID. Archived Events stay readable under existing policy. Every subsequent task
request still rechecks active membership and Event scope.

Existing task-list reads now include scoped assignee IDs/names/operational-role
text and existing `blockedBy`/`blocks` text. Summaries use assignee IDs captured in
the authorized task result, preserving that snapshot's names if a later
assignment changes. Historical inactive assignees remain named. Operational-role
text is never authorization; access role comes from authenticated membership.
No Team API, migration, new dependency or task-command behavior was added.

Mapping preserves lifecycle/priority, DATE strings, assignment, acceptance
boolean/actor/instant, server update instant and version. Only the nullable owner
display field adapts to the old selector shape. Malformed/inconsistent responses
fail closed. Real task clocks use the selected Event's calendar/timezone, with
minute clock ticks and focus refresh; demo pages retain the fixed reference day.

### Automated checks

| Check                                        | Observed result                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Baseline `pnpm.cmd test`                     | PASS: 106/106                                                                |
| Baseline `pnpm.cmd server:test`              | PASS: 75; two opt-in database suite skips                                    |
| `pnpm.cmd format` / `format:check`           | PASS                                                                         |
| `pnpm.cmd lint` / `typecheck`                | PASS                                                                         |
| `pnpm.cmd test`                              | PASS: 128/128; all prior tests retained                                      |
| `pnpm.cmd build`                             | PASS                                                                         |
| `pnpm.cmd server:test`                       | PASS: 78; three explicitly opt-in database suite skips                       |
| `pnpm.cmd server:typecheck` / `server:build` | PASS                                                                         |
| Opt-in `pnpm.cmd server:test:integration`    | PASS: 33/33, zero skips, real approved PostgreSQL                            |
| `pnpm.cmd test:browser:tasks`                | PASS: real Organizer/Member sessions plus explicitly intercepted state tests |
| `git diff --check`                           | PASS                                                                         |

Frontend coverage includes DTO mapping, zero/one/multiple Event selection,
Organizer/Member reads, cookie options, loading/coalescing, empty account/Event,
500/network/malformed responses, retry, 401 vs 403/404, real Event-calendar date
handling in positive/negative host offsets, no hardcoded development UUID,
no storage/token/demo fallback, StrictMode cancellation and late-response
rejection. Auth tests prove a task 401 clears identity and invalidates an older
pending `/api/me` result. Backend tests prove parameterization, safe/no-store
Event HTTP responses and captured-assignee scope.

The new PostgreSQL read suite uses disposable fixtures inside a rollback-only
transaction. It proves persisted Organizer/Member roles/shared Event, foreign and
inactive denial, identical scoped tasks/assignee names, DATE and relationships
under Honolulu timezone plus SQL/DMY DateStyle, historical assignee display,
soft-deleted task/summary absence, and final fixture absence. Existing P1B/P1C
constraint/transaction/concurrency tests still pass. No development workflow
state was changed by browser verification or direct SQL evidence queries.

### Real browser evidence and data distinction

Executed with installed Edge/Chromium **154.0.4258.53**, Playwright from the
existing verification runtime, real Better Auth and the approved PostgreSQL
backend. Credentials were read only from ignored configuration. Sessions were
independent, memory-only browser contexts; no cookie/session dumps, HAR, trace or
storageState were saved. Reports/screenshots are ignored under
`tmp/p1d2-evidence/`.

Organizer signed in, discovered the real development Event, displayed its
`Verify the two-user responsibility loop` task and retained it after refresh.
The verifier directly queried PostgreSQL read-only and matched live row title,
category, context, DATE, status, priority, assignment and version to HTTP DTOs,
then matched rendered task titles. Browser-local demo tasks were deliberately
renamed `P1D2_LOCAL_ONLY_SENTINEL`; that sentinel never appeared in remote Tasks.
This is controlled fixture/data-source evidence, not a claim of user validation.

Member independently signed in and received the same Event and identical task
DTOs; authenticated membership supplied MEMBER rather than an email/name guess.
Refresh passed. Real deep links opened the expected read-only drawer; acceptance
and status controls were disabled. No task mutation request was issued, and the
before/after remote task state was identical. Fictional Dashboard/Team task links
show the safe invalid-task notice rather than opening any local demo drawer.

An explicitly held real request showed loading with the existing header,
register headings and toolbar, unknown counts and zero stale rows. Under
StrictMode only one Event and one task request reached the transport. Empty
Event and empty account, sanitized 500 plus explicit retry and 403 authorization
denial were deliberately intercepted responses, clearly separate from live-data
proof. 403 retained a valid `/api/me` identity. No fallback occurred.

For expiry the verifier held a real task request, revoked only the Organizer's
actual server session, then let the backend return real 401. Login displayed the
session-ended state; shell/task data disappeared. Member's independent session
remained valid. HttpOnly/SameSite=Lax cookie checks and browser storage checks
passed; Member logout removed real task content. Zero application errors.

### Visual regression and fresh review

Before and after captures covered 1440/1024/768/390/320 px × BG/EN × light/dark,
60 page cases per run. All 40 Dashboard/Team `.app-main` crops matched pixels
exactly. Tasks' real-data captures were reviewed at desktop and narrow widths:
same typography, summary, toolbar, register/four cells, compact reflow, and drawer
composition; real task text, counts and dates differ as expected. No shared CSS,
Dashboard, Team, local service/reducer/data or history contract changed.

A separate **explicitly mocked** equivalent-content/time Tasks run remapped the
old local fixture to valid remote IDs/DTOs solely for visual comparison. All 20
image sizes matched; differences were confined to the top 60 px shell overlay
containing the replaced data-mode notice. Below that overlay all 20 Tasks crops
matched pixels exactly. These fixture screenshots prove composition, not real
PostgreSQL reads. The real 20-case Tasks matrix and five-width browser layout
checks had zero horizontal overflow. Drawer changes are limited to read-only
label/disabled controls; no extra section, card or typography hierarchy was added.

Intermediate browser attempts failed and are not counted as PASS evidence.
The real browser exposed an incorrectly bound native fetch receiver; the adapter
now calls the detached transport, with a regression test and passing reruns.
The first equivalent-content visual fixture used randomized task ordering; its
final comparator preserves original ID tie ordering so content is equivalent.

A fresh read-only self-review covered the adapter, Event resolution, real/demo
separation, date/clock semantics, auth/cancellation, UI lock and scope. It found
the assignment-summary consistency issue and fixed only that confirmed issue;
the focused test, PostgreSQL suite and real browser rerun passed. Filter
validation waits for ready data so loading does not clear valid category filters;
removed owner filters reset safely. Security review confirms parameterized Event
and task scope, server-derived membership, cookie auth, no browser tokens, no
hardcoded development IDs, no fallback/raw errors and clearing stale data.
This is agent review, not human acceptance or security certification.

Documentation updated: README, backend development, known limitations, user
guide, this evidence and AI assistance log. Final commit and remote-sync results
are reported after Git completion. Remaining limits:
read-only task commands, demo Dashboard/Team and their fictional deep links,
temporary multi-Event selection, full-list reads, no realtime/offline Task cache,
production hosting/grants/recovery/restore work and actual-year NOIT verification.
P1D.2B was not begun.

### Final staged scope audit

The staged audit passed for **33 intended files**. No environment/credential
file, cookie jar, session dump, generated evidence or unrelated shortcut is
staged. Exact loaded database/auth secrets and controlled account email/password
values are absent from the full staged content/diff and built frontend bundle.
The remote boundary contains no browser auth storage, logging, demo fallback or
hardcoded development UUID. Locked CSS, Dashboard/Team source, local service/data,
semantic/history contracts, dependency lockfile and schema/migrations are
unchanged. Staged whitespace checks pass. Final checks separately captured each
command's zero exit code, rather than relying on a chained shell's last result.

Audited changed paths:

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-reads-ui.mjs
server/src/app.ts
server/src/events/service.ts
server/src/main.ts
server/src/routes/events.ts
server/src/routes/tasks.ts
server/src/tasks/model.ts
server/src/tasks/service.ts
server/tests/events.test.ts
server/tests/task-reads.integration.test.ts
server/tests/tasks.test.ts
src/App.tsx
src/auth/state.test.ts
src/auth/state.ts
src/components/AppShell.tsx
src/components/BudoSelect.tsx
src/components/TaskDrawer.tsx
src/hooks/useRemoteTasks.ts
src/i18n/messages.ts
src/i18n/taskReadMessages.ts
src/i18n/useI18n.ts
src/pages/TasksPage.tsx
src/pages/tasks/helpers.ts
src/services/RemoteWorkspaceService.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
```

## P1D.2B — Real task responsibility UI — 2026-10-03

Authorized baseline: `407c3627c1d7e620e70d92d9ab49931b574d4044`, `main`, freshly
fetched origin sync `0/0`, tracked worktree clean. The unrelated shortcut was excluded.
Mandatory master prompt, all 30 pages of the supplied NOIT regulations, approved
backend contract, task semantics, drawer/register and locked design guidance were
read before implementation. Supplied rules are **2025–2026**; actual-year dates,
eligibility, categories, licensing, online availability and document format still
need official verification.

### Automated verification

| Check                                                     | Observed result                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Baseline frontend / offline backend                       | PASS: 128 frontend; 78 backend, 3 opt-in skips                     |
| Baseline real PostgreSQL / Tasks browser                  | PASS: 33 database checks; existing browser read/auth behavior      |
| `pnpm.cmd format` / `format:check` / `lint` / `typecheck` | PASS                                                               |
| `pnpm.cmd test` / `build`                                 | PASS: 155 tests, including 27 new action tests; build passes       |
| Backend `typecheck` / `test` / `build`                    | PASS: 80 offline tests, 3 explicitly opt-in skips                  |
| Opt-in `pnpm.cmd server:test:integration`                 | PASS: 34/34, zero skips, real approved PostgreSQL                  |
| `pnpm.cmd test:browser:task-actions`                      | PASS: 14 workflow checks, 40 drawer cases, zero application errors |
| Final `pnpm.cmd test:browser:tasks`                       | PASS: prior read/auth/error/empty behavior, zero task writes       |

Service/controller tests cover exact bodies, expectedVersion, all commands,
canonical projection, safe 400/401/403/404/409/500 mapping, abort/late responses,
role/member/archive affordances, minimum candidate fields, same-Event refresh,
duplicate coalescing, no pre-confirmation writes, conflict/refetch, blocked writes
after failed refresh, retained confirmed response and revoked membership clearing.
The PostgreSQL extension proves active same-Event candidates, inactive membership
and User exclusion, safe fields and historical assignee display. All prior
P1B/P1C/read/auth checks remain. Applied migrations are unchanged.

### Real two-session UI and activity evidence

Independent memory-only Edge/Chromium **154.0.4258.53** contexts use real Better Auth,
backend HTTP and PostgreSQL. Credentials come only from ignored configuration.
No cookie jar, session dump, HAR, trace, storageState or credential screenshot is
saved. Ignored report/screenshots: `tmp/p1d2b-evidence/browser/`.

- Organizer assigns using real active member IDs and human-readable names; refreshed
  Member sees assignment and Accept. Organizer has no acceptance/withdrawal control;
  other/unassigned Members have no acceptance/status control; Member cannot assign.
- Real Member acceptance/withdrawal is server-confirmed. SQL verifies member/time,
  cleared acceptance and preserved assignment; Organizer refresh shows acceptance.
- Member sends all four statuses independently of acceptance. Organizer refresh
  sees canonical status. Backend still authorizes every command.
- Organizer changes status while Member holds an older version. Member's actual
  stale command returns **409**; the drawer shows refreshed Blocked state and a short
  conflict message. No overwrite or automatic replay occurs.
- Reassignment/unassignment clear acceptance in both UIs. Assigning back retains
  empty acceptance and Member must explicitly accept again.
- A held response from a real acceptance command preserves Not accepted before
  delivery, disables related controls and produces exactly one request.
- A second real 409 plus an explicitly intercepted failed GET marks the display
  stale and disables actions; explicit Refresh recovers. The failed GET is a double.
- Actual revoked Member session produces mutation **401**, clears its app and returns
  to Login, while the independent Organizer session remains valid.

Explicit 400/403/404/500/network transport doubles separately prove accessible,
sanitized feedback, retained safe content, refetch and no command retry. These
do not claim real permission/resource/outage conditions; actual authorization and
transaction failures remain covered by P1C unit/PostgreSQL checks.

Read-only SQL found **21 ActivityEntry records for 21 confirmed UI changes** in the
passing run. All six types (`task.assigned`, `task.reassigned`, `task.unassigned`,
`task.accepted`, `task.acceptance_withdrawn`, `task.status_changed`) matched response
versions and authenticated scoped actors. Reassignment records `acceptanceCleared`.
No activity UI was added. The single controlled task ends assigned to Member,
unaccepted, `not-started`, version **157** in the final passing run. Intermediate-run history is preserved;
no controlled account/task/membership/history was deleted or reset via SQL.

### Accessibility, review and limits

Both roles × BG/EN × light/dark × 1440, 1024, 768, 390 and 320 CSS px: **40/40**,
no horizontal overflow, action targets at least 44px. Keyboard status mutation uses
Enter/End/Enter; native assignment has a real label and keyboard focus. Existing
drawer focus/Escape/return behavior remains. Pending/error/conflict feedback uses
status/alert semantics. Representative desktop/narrow BG-dark screenshots were
visually inspected. This is Chromium evidence, not formal screen-reader/real-device
coverage, accessibility certification or user validation.

A fresh read-only self-review covered mutation correctness, authorization boundary,
version handling, stale state/refetch, identity/role resolution, cancellation,
duplicate submissions, accessibility, locked design and scope. It found missing
archive affordance data; safe backend `archived` state and guards corrected it.
It also found a failed-refresh recovery action could disappear after closing or
switching drawers; shared recovery feedback and a list-level refresh action fix it.
Affected tests and real-browser verification were rerun. No external reviewer,
subagent or human acceptance is claimed.

Task Origin checks now share auth's explicit helper: configured origin plus exactly
the Vite origin in development, with no production expansion. Tests reject missing,
spoofed/foreign Origin and cross-site Fetch Metadata. Backend validation/scoped
membership/task/assignment/version checks remain authoritative. No client actor,
timestamp, role, email/name or localStorage data grants permission. Browser storage
was checked for credentials/tokens. No dependencies, schema, authoring, activity UI,
Team/Dashboard integration, realtime or server polling were added.

Intermediate failures are not PASS evidence: an initial browser run did not complete;
Edge could not expose a 409 body to Playwright although UI recovery worked, so the
verifier now checks status/DOM/canonical reads. Another verifier step used a stale
Organizer version after Member acceptance; its legitimate 409 required adding an
explicit refresh before unassignment. Request-count and format assertions were
updated for the member endpoint and formatting. Only the completed passing run
is counted. Additional recovery-verifier runs stopped on a missing second real task
and an overly broad selector; neither is counted as a pass. A clearly marked
read-only transport row now tests drawer switching without creating a database
task, and the selector targets the status button. Final completion evidence follows.

### Completion evidence

- Final responsibility rerun: **14 checks / 40 drawer cases**, zero application
  errors. Failed-refresh recovery passes after closing/switching drawers; the second
  row is an explicit read-only transport fixture. Real commands/history remain on
  the existing controlled task. SQL confirms **21 changes / 21 ActivityEntry records**,
  all six types, and the final Member-assigned/unaccepted/`not-started` state at
  version **157**. Actual mutation 401 and isolated session clearing pass afterward.
- Final auth regression: **15 checks / 20 Login layout cases**, plus the actual mobile
  account menu; zero application errors. Real login/session/logout/revocation remain
  covered; injected failure/malformed identity cases remain labelled doubles.
- Final read regression: **13 checks / 5 viewport cases**, zero application errors,
  **zero task commands**. Prior empty/loading/error, deep-link, poisoned demo and
  real expired-session behavior remains covered.
- Locked visuals: **20/20 Dashboard and 20/20 Team** `.app-main` comparisons are
  pixel-identical to preimplementation snapshots. **20/20 Tasks** equivalent-content
  register comparisons are also pixel-identical using explicitly intercepted,
  fixed-clock visual fixtures. Widths are 1440/1024/768/390/320, BG/EN, light/dark.
  All 60 after snapshots have zero horizontal overflow. The 40 real role/drawer
  captures cover only the expected contextual controls and acceptance state.
- The recovery fix reran frontend typecheck/lint, **155/155 tests**, build and format
  checks. Backend source was unchanged after its **80-test / 34-database-test** pass.
- Staged safety review found exactly **29 intended files**, no excluded environment,
  shortcut, temporary output, cookies, session dumps, HAR, traces or auth artifacts.
  Actual configured credentials/secrets were checked privately against the staged
  diff, complete staged file contents and frontend bundle: none found. The remote
  boundary contains no browser storage, demo fallback, console output or hardcoded
  development UUID. Locked Dashboard/Team/demo/navigation files, dependencies and
  migrations are unchanged; existing CSS rules are unchanged. Staged whitespace is clean.

### Changed files (29)

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-actions-ui.mjs
scripts/verify-task-reads-ui.mjs
server/src/auth/auth.ts
server/src/events/service.ts
server/src/main.ts
server/src/routes/auth.ts
server/src/routes/tasks.ts
server/src/tasks/service.ts
server/tests/events.test.ts
server/tests/task-reads.integration.test.ts
server/tests/tasks.test.ts
src/App.tsx
src/components/TaskDrawer.tsx
src/hooks/useRemoteTasks.ts
src/i18n/taskReadMessages.ts
src/pages/TasksPage.tsx
src/services/RemoteWorkspaceService.ts
src/services/taskActions.test.ts
src/services/taskAffordances.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
src/styles.css
```

## BudoGraph Visual Refinement V1 - 2026-10-08

Baseline and remote `main` confirmed:
`1b1d24458321395af4195ea6bc763d3178aed342`
(`feat(app): add production email and account recovery`). The user approved
exactly five presentation/content fixes. Product changes are limited to
`src/styles.css`, `src/pages/changes/changes.css` and
`src/i18n/teamMessages.ts`; this evidence and AI_ASSISTANCE_LOG.md are the only
documentation changes.

### Presentation and accessibility evidence

- **200/200 before and 200/200 final after cases**: ten screens at
  1440/1080/768/390/320, BG/EN, Light/Dark. Screens cover fully quiet, partial and
  populated Dashboard, Changes, Team, Tasks, Login, forgot-password, pending
  verification and reset-password. Every case has zero horizontal overflow,
  document panning and application errors. Long BG Task/Change/Event strings are
  explicit transport fixtures, not backend edits.
- Empty Dashboard Attention, Operational Changes and Team pressure retain the
  existing section order, heading, meaning and status semantics. Their local
  presentation is left aligned, naturally sized, without padding, dashed border,
  decorative icon or colored wrapper. At 390px BG the three empty bodies change
  from 270px each (810px total) to 67.6875/47.34375/67.6875px (182.71875px total).
  Preparation Timeline and empty states outside these sections are unchanged.
- Next action changes only from muted ink/weight 500 to primary ink/weight 600;
  font size, row padding, ordering, metadata and attention semantics are retained.
- Context-free Change timestamps have their own block with 6px top spacing.
  All **20/20 context-bearing row captures are pixel-identical** to baseline.
- Dark mobile active text is `--accent-dark` (#e18298) on `--accent-soft`
  (#3a202a): **5.526943246:1**, previously 4.426702661:1. All measured mobile
  active states meet 4.5:1. Light nav, inactive nav and nav backgrounds are
  unchanged. No palette or navigation architecture change is made.
- Team EN copy: "Acceptance is explicitly confirmed and saved for this event."
  BG: "Приемането на отговорност се потвърждава изрично и се запазва за това
  събитие." Both languages wrap cleanly at all widths, with no offline/realtime
  claim or technical implementation language.
- **100/100 locked content captures are pixel-identical**: 20 each Event
  overview, Preparation Timeline, populated Operational Changes, populated Team
  pressure and Tasks. Only the approved active-nav text color is temporarily
  frozen to baseline in these component captures because fixed nav can overlap
  them; actual full-page captures and contrast measurements are unmodified.
  **80/80 full Auth/verification/recovery captures are pixel-identical** without
  normalization. Main heading text and link destinations match in all 200 cases.
- **20/20 keyboard cases** at all five widths, BG/EN and Light/Dark: native
  Dashboard disclosures and Attention disclosure toggle with Enter/Space,
  summaries retain the existing 3px solid focus ring, and quiet statuses retain
  meaningful heading/description text without icons. No formal WCAG
  certification is claimed; semantics and content do not rely only on color.

Temporary evidence is outside Git at
`C:/Users/Lenovo/AppData/Local/Temp/budograph-visual-refinement-v1/`.
`VISUAL_COMPARISONS.md` links the representative quiet desktop/mobile Light/Dark,
partial/populated Dashboard, context/no-context Change and BG/EN Team images.
`before/report.json`, `after/report.json`, `comparison-report.json` and
`keyboard-report.json` record raw measurements. No generated screenshot or log
is committed.

### Executed checks

- `pnpm.cmd format`, `format:check`, `lint`, `typecheck`, `test`, `build`: PASS;
  **245 frontend tests passed**, none failed or skipped. The final CSS timestamp
  scope correction was formatted and rebuilt. Build retains the existing Vite
  bundle-size warning; no bundle restructuring is introduced.
- `pnpm.cmd server:typecheck`, `server:test`, `server:build`: PASS. Backend suite:
  **124 passing, 11 opt-in PostgreSQL suites skipped, 135 total**, zero failures.
  Skipped integration suites are not reported as passes. Backend source,
  database schema and migration files are unchanged.
- All six requested/relevant existing browser suites completed with exit code 0.
  Live suite results below are separate from the frozen visual fixtures.

`test:browser:change-dashboard`: PASS, zero application/console errors.
Its real backend/PostgreSQL workflow checks canonical Event Changes,
updatedAt ordering, durable links, affected Task count and response owner.
Organizer unowned attention, owner/no-Decision, owner/Decision/no-Response,
one item maximum per Change, exclusion of other owners and missing-Plan-B-only,
read-only Member owners and unchanged Task attention are verified. Real
Event switching/late reads and labeled safe failures also pass. Coverage includes
120 role/surface/layout cases, 24 text-contrast cases, four explicitly labeled
long-name fixtures, keyboard/focus navigation and causal copy checks.

`test:browser:changes`: PASS, zero application/console errors. Real Organizer
create/edit, Task selection/impact, Decision/Response/Plan B, refresh/provenance,
whitespace validation, unchanged Task semantics, two-tab optimistic conflict,
draft retention/explicit reload, Member denial and newly invited Member access
are covered. Labeled transport failures pass without demo fallback. All 60 real
list/detail/form BG/EN Light/Dark cases at the five requested widths have no
overflow/panning and retain 44px targets; four explicitly mocked long-BG mobile
detail cases pass.

`test:browser:workspace`: PASS, 11 checks and eight real responsive captures,
zero application errors and zero Event/Task business mutation requests.
Dashboard counts/focus/pressure and Team identities/roles/assignment/acceptance
summaries match real API/SQL. Organizer and independent Member sessions preserve
authorized state, canonical refresh, task-link focus/scroll/history and shared
reads; poisoned localStorage is unused. Labeled loading/empty/no-Event/500/403
states, canonical Changes links, truthful Templates empty state and actual
Dashboard/Team 401 recovery also pass.

`test:browser:tasks`: PASS, 13 checks/five real layout cases, zero application
errors and zero task mutation requests. Real DTO/rendered content matches
read-only PostgreSQL; independent roles, refresh, canonical drawer/deep links,
four-cell register semantics, safe injected failures/empty states, actual
expired-session recovery, HttpOnly authentication and logout are covered.

`test:browser:auth`: PASS, 15 checks/20 Login layout cases, zero application and
console errors. Real Organizer/Member login, refresh, logout, invalidated-session
recheck, intended-route behavior, generic focused errors, duplicate-submit
prevention, HttpOnly cookies, absence of browser-stored tokens, closed public
signup, rejection of external returnTo, visible keyboard focus and mobile account
menu are verified. Injected server/malformed-identity failures are labeled.

`test:browser:account-safety`: PASS, **180 mocked HTTP presentation cases** across
five widths, BG/EN and Light/Dark/System, with zero page errors. Recovery request,
pending/verified/invalid verification, valid/invalid reset, password mismatch,
generic feedback, rate-limit feedback, focus transitions, 44px targets and absent
stored tokens are covered. No real verification/recovery email was sent or
production Resend delivery inferred. P4A behavior remains unchanged; the human
domain/DNS/Resend gate is still outstanding.

Existing browser reports remain ignored at
`tmp/p3c-evidence/browser/report.json`, `tmp/p3b-evidence/browser/report.json`,
`tmp/p1d3-evidence/browser/report.json`, `tmp/p1d2-evidence/browser/report.json`,
`tmp/p1d-evidence/browser/report.json` and `tmp/p4a-evidence/browser/report.json`.
Their generated screenshots/logs are not staged. Staging is restricted to the
three intended product files and these two mandatory documentation files; final
staged safety and commit/push/sync results are supplied in the completion report.

Initial visual comparison revealed an unnecessary shift in rows with context;
the timestamp block/spacing was narrowed to the title's direct time sibling and
the complete after matrix was recaptured. Pixel comparisons initially included
the intended fixed active-nav recoloring; explicit nav-color normalization in
locked content captures isolates page content, without changing actual full-page
evidence. A temporary keyboard harness initially checked a generic details class
rather than its owning section; corrected harness passes all 20 cases. The first
temporary secret-scan attempt stopped on an encoding-name typo before scanning;
the corrected private scan completed. These intermediate harness runs are not
counted as passes.

No Operational Changes readout redesign, Decision/Response differentiation,
larger preference controls, extra spacing/typography, animation, other empty
states, sidebar, Tasks or Auth refinement is implemented. P4A domain/DNS/Resend
human delivery verification remains outstanding. Supplied NOIT 2025-2026 rules
require actual-year verification. The unrelated shortcut is untouched.

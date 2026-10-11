# BudoGraph Event Management Stage 1 — 2026-10-09

## Authorization and status

The explicit human request approves Stage 1 of the Event Management contract.
The approved problem, concept, MVP, flows, architecture, data model and test
strategy remain unchanged. Baseline HEAD is
`fbf4db18b4d139f1ab45f762f9cd2e2c1a34ca87`, on `main`.
The initial tracked tree was clean; `docs/market-research/docs - Shortcut.lnk`
is preserved and must never be staged, changed, deleted or committed.

Implementation, all mandatory verification and final quality checks are complete.
Stage 1 is **TECHNICAL PASS**.
Human Acceptance is **PENDING**; Stage 1 is **NOT LOCKED**.

The final Profile run passed 13/13 groups and 20/20 layouts using one isolated,
rollback-only disposable Organizer on official local PostgreSQL 17.11, with
independently verified row/session/process/runtime cleanup. Established accounts,
shared credentials, Supabase and the shared backend were untouched. All other
mandatory passing evidence is preserved, not rerun. The exact inventory, actual
counts, labelled mocks and historical failures are reconciled in the current
2026-10-11 section of [TEST_EVIDENCE.md](TEST_EVIDENCE.md).

The only final harness corrections synchronize the existing Tasks route focus
before opening the mobile account menu and await active reduced-motion
transitions before geometry measurement. Original assertions/deadlines and locked
product styling remain unchanged. The unrelated shortcut and temporary evidence
are excluded from the conditional Stage 1 commit. The approved commit message is
`feat(app): add event management listing and navigation`; its SHA belongs in Git
history after publication. No further tests, later stage or LOCK are authorized
by technical completion.

## Behavior

`/events` is an authenticated global page, like `/account` in route scope. Direct
URLs, refresh, login return-to and ordinary Back/Forward retain that global route.
Both URL rewriting paths explicitly exclude global pages. `/events` has no
Dashboard highlight and does not add a sixth bottom-navigation item.
The existing five Event-scoped route types retain their URLs and behavior.
Switching Events retains the workspace page type, clears Task/Change detail
context, and opens Dashboard when starting from a global page.
An inaccessible explicit Event ID never falls back to a different Event.

The page uses only the existing authenticated `GET /api/events`. Its SQL requires
active same-Event membership and an active identity; archived results retain that
requirement. There is no global Event directory or global Organizer role.
The controller's small listing-only mode cancels former workspace reads and does
not request Tasks, Team, Changes or notifications for the management listing.
Identity changes still receive a fresh controller before effects; unauthorized
reads clear Event metadata and expire the session. Loading/failure states hide
old rows. Retry uses a fresh authorized read, with fixed localized failure copy.

The page provides one Create action, Active by default, Archived, client-side
name search, count and simple rows with name, calendar start/end dates, timezone
and current membership role. Active Events have Open; archived Events have an
explicit historical-workspace action. Only active same-Event Organizers see Edit.
Members can create independent Events under the existing API authorization.
No-Event and no-active-Event legacy entry goes to `/events`; archived workspace
URLs stay readable. Filtered-empty, empty, loading and failure states are separate.

Desktop and mobile switchers keep selection and replace Create/Edit with exactly
one `/events` link: **Manage / Управление**. It is independent of Event or role.
The mobile selector takes remaining width; Manage is one line with a minimum
44 × 44px target. Focused listing controls scroll above fixed mobile navigation.
Page interiors, forms, auth implementation, brand, global CSS and preferences are
preserved. Removing old wrapping actions can change sidebar vertical spacing;
this is an authorized switcher change, recorded separately from locked interiors.

`/events/new` and `/events/:eventId/edit` continue using their existing form,
server validation, optimistic version/conflict recovery, canonical reload and
successful-save navigation. No management-detail or Duplicate route is added.

## Scope

No backend endpoint, schema, migration, dependency, infrastructure or asset is
added. No deployment occurs. Stages 2–7 are **NOT STARTED**: management detail and
form redesign, history retention, command receipts, duplication, archiving and
Clear All Tasks remain future work. Templates, Budget, PWA, Web Push and motion
are excluded. Canonical-name confirmation belongs to the future Archive stage.

## Preserved historical verification and recovery

This section retains the earlier partial executions and credential blocker.
The current 2026-10-11 reconciliation in TEST_EVIDENCE.md supersedes their status
without erasing historical failures. Fresh Profile is now complete; the other
fourteen principal suites retain post-implementation PASS evidence, totaling
170 functional groups and 831 layout/presentation cases including Profile.

All counts below describe actual execution; mocked presentation is not real
session or business-write evidence. Logs and screenshots remain ignored in
`tmp/event-management-stage1`, without credentials, cookies or session dumps.

| Gate                      | Actual result                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline frontend         | 263 passed, 0 failures/skips                                                                                                                                       |
| Final frontend            | 273 passed, 0 failures/skips; 10 new route/listing/controller tests                                                                                                |
| Backend unit/regression   | 148 results: 133 passes, 15 expected opt-in integration skips, 0 failures                                                                                          |
| Real PostgreSQL           | `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration`: 113 passes, 0 failures/skips                                                                        |
| PostgreSQL concurrency    | Included real independent-connection Change/response concurrency tests; synthetic committed concurrency fixtures retained as established; other fixtures roll back |
| Profile V1 PostgreSQL     | Parent + 5 subtests pass, including password/session rotation and preservation of identity/business/history data                                                   |
| Static/build checks       | Frontend/backend typecheck, ESLint, formatting and both builds pass; existing >500 kB Vite warning remains                                                         |
| Stage 1 synthetic browser | 10 grouped functional checks and 28 layout cases; 0 application errors                                                                                             |
| Stage 1 real browser      | 0 real account checks completed; Organizer login rejected (401); full command exits unsuccessfully                                                                 |
| Browser engines           | Microsoft Edge Chromium only; no physical-device, Firefox/WebKit or formal accessibility claim                                                                     |

The 28 cases are 320/360/390/768/960/1024/1440px × BG/EN × Light/Dark.
They cover long Event names, translated copy, one-line Manage, minimum touch size,
visible focus, keyboard reachability above fixed chrome, no horizontal overflow,
permissions, Active/Archived and search. Functional fixtures cover login return,
Create/Edit navigation, history, refresh, switch detail reset, no-Event/archived
entry, explicit inaccessible IDs, Task failure isolation, loading and safe retry.

Full existing browser suite results and locked-screen pixel counts are recorded
in the accompanying `TEST_EVIDENCE.md` Stage 1 section. Failed sign-in attempts
are not counted as passes, and historical demo-only suites are identified there.

Early unsuccessful attempts are retained: missing Playwright/browser runtime
paths, stopped Vite preview, stale Vite routing-module cache, invalid synthetic
name whitespace and an archived fixture still using the intentional Task-failure
flag. These were corrected without changing product assertions. The strict
locked pixel comparison remains strict; every measured difference is recorded.

## Verification recovery

Recovery reran the complete independent matrix successfully: 273 frontend tests;
133 backend passes with 15 opt-in skips; 113 real PostgreSQL results, no failures
or skips, including concurrency and Profile V1 rollback fixtures; frontend/backend
typechecks, ESLint, full formatting and both builds. Account Safety passes 1 group
/ 180 cases, Auth Experience 20 checks / 222 cases and Stage 1 fixtures 10 groups
/ 28 layout cases. Strict locked comparisons pass 112/112 with two negative
controls. The scope/secret audit passes for 25 files and seven configured private
value forms, including the production bundle. No dependencies, migrations,
destructive operations or unrelated files are introduced. No file is staged.

The final read-only credential check still finds the Organizer test password
mismatch. Twelve existing authenticated browser suites and Stage 1's complete
real-account gate remain blocked; full real Create/Edit and browser security
verification are incomplete. The earlier attempted real suites are not relabelled
as passes. Human acceptance remains pending, with no commit/push or Stage 1 LOCK.

### Authentication diagnosis

The exact browser request is `POST /api/auth/sign-in/email` with only `email` and
`password`; in-memory equality checks confirm both match the harness inputs.
The response is 401 `INVALID_EMAIL_OR_PASSWORD`, with no authenticated page or
application exception. The Organizer identity is the correct canonical email,
one active user and one credential account. The official `better-auth/crypto`
`verifyPassword` returns false for the configured password. The configured Member
password verifies true and a real Member browser login returns 200.

The harness loads `server/.env` followed by `server/.env.p1b.local` using Node's
environment-file flags. Neither Organizer variable exists in the first file and
neither is inherited from the invoking process. Both effective values match the
second file: email line 4, password line 5. No competing definition or value
transformation was found. `test:browser:auth` loads only the second file, which
contains these same inputs. Browser `.fill()` preserves the password; the client
only trims the email. No dotenv dependency or product change is required.

Better Auth 1.7.7's installed sign-in route rejects an incorrect password with 401
before its email-verification check; required-but-unverified email would instead
produce 403 `EMAIL_NOT_VERIFIED`. Thus the observed 401 is explained by stale local
test configuration, consistent with the prior owner-performed password change.
Only read-only SQL and in-memory password verification were used to diagnose it.
No password/hash edit, replacement Organizer, provisioning, auth bypass or email
is performed. Updated configuration will be read by each newly launched harness.

An additional real Member probe completes 3 checks: login return to global
`/events`, exact authorized listing/Edit capabilities and refresh persistence.
It has 0 application errors and 0 unexpected console errors. Its single console
network diagnostic is the observed, required anonymous `/api/me` 401 before login.
This probe does not replace any blocked Organizer/Create/Edit/security suite.

### Seven visual differences

All original before/after PNGs were preserved and all seven pairs were inspected.
Coordinates below are inclusive and relative to the original locked-page capture,
not the viewport. Each viewport is 900px high; all seven use Bulgarian.

| Screen    | Viewport  | Theme | Exact bounds `(x0,y0)–(x1,y1)` | Pixels / channels | Maximum channel delta | Affected pixels                               |
| --------- | --------- | ----- | ------------------------------ | ----------------- | --------------------- | --------------------------------------------- |
| Dashboard | 960 × 900 | Dark  | `(343,452)–(343,452)`          | 1 / 1             | 1                     | Critical-priority text glyph                  |
| Dashboard | 390 × 900 | Light | `(126,1645)–(126,1645)`        | 1 / 1             | 1                     | First-aid/incident timeline text glyph        |
| Changes   | 390 × 900 | Light | `(358,493)–(358,493)`          | 1 / 3             | 18                    | Empty-state dashed border's lower-right curve |
| Dashboard | 390 × 900 | Dark  | `(127,1645)–(127,1645)`        | 1 / 1             | 1                     | Same timeline text glyph                      |
| Changes   | 390 × 900 | Dark  | `(190,322)–(358,493)`          | 2 / 4             | 15                    | Search-X icon and lower-right border curve    |
| Changes   | 320 × 900 | Light | `(3,227)–(288,496)`            | 6 / 14            | 14                    | Empty-state dashed border                     |
| Changes   | 320 × 900 | Dark  | `(3,227)–(288,496)`            | 5 / 11            | 12                    | Empty-state dashed border                     |

These pixels are **inside locked interiors**, not exclusively inside the shell.
No changed text, style, visible interior layout, focus target or accessibility
attribute was found. At 390px the approved switcher/header shrinks 155→111px;
at 320px BG it shrinks 197→153px. Both move the otherwise identical interior up
44px. Matched DOM snapshots retain text, roles, labels, hrefs, tab order, computed
styles and relative geometry. Raw bounding-box differences are limited to
zero-size hidden nodes and about 0.0000305px SVG floating-point measurements.
The 960px one-channel difference does not reproduce in fresh paired captures.
Real authenticated keyboard/workflow regression remains blocked separately.

The narrow comparison restores only the recorded original `.app-header` height
**during capture**, preserving the interior's raster origin. It retains exactly
the original capture protocol's shared header/mobile-nav/sidebar visibility
exclusions. No interior region is masked, no pixel tolerance is allowed, and no
reference PNG is regenerated or overwritten. Actual shell dimensions, focus,
touch targets and overflow are checked by the separate unmodified-shell matrix.

`pnpm.cmd test:browser:locked-screens` now gives **112/112 exact pixel matches**,
with strict dimension equality, 0 application/console errors, and before/after
SHA-256 checks proving each original reference stayed byte-identical. Two deliberate
interior heading-colour changes are rejected (Dashboard: 8,061 changed channels;
Changes: 3,791). The initial font-size detector self-test also triggered the strict
dimension rejection; the colour controls verify pixel rejection independently.
No product visual fix is needed. This resolves the seven comparison investigations
without treating interior differences as shell pixels or weakening protection.

Playwright and Sharp are supplied externally through
`BUDOGRAPH_PLAYWRIGHT_MODULE` / `BUDOGRAPH_SHARP_MODULE`; no project dependency is
added. `BUDOGRAPH_BROWSER_EXECUTABLE` selects the installed Edge. Original ignored
references remain in `tmp/event-management-stage1/locked`; the verifier requires
all 112 and has no reference-generation mode. Recovery JSON/logs/images remain
under ignored `tmp/event-management-stage1/recovery`, with no credentials/cookies.

## Exact change manifest

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BUDOGRAPH_EVENT_MANAGEMENT_STAGE_1.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TEST_EVIDENCE.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-event-management-ui.mjs`
- `scripts/verify-locked-screens-ui.mjs`
- `scripts/verify-profile-ui.mjs`
- `src/App.tsx`
- `src/auth/routing.ts`
- `src/components/AppShell.tsx`
- `src/components/EventSwitcher.tsx`
- `src/components/eventSwitcher.css`
- `src/hooks/useRemoteTasks.ts`
- `src/i18n/eventMessages.ts`
- `src/pages/EventManagementPage.tsx`
- `src/pages/events/eventManagement.css`
- `src/pages/events/listing.test.ts`
- `src/pages/events/listing.ts`
- `src/routes.test.ts`
- `src/routes.ts`
- `src/services/eventActions.test.ts`
- `src/services/taskReadState.ts`

## Competition-year boundary

The complete master prompt and supplied 30-page 2025–2026 regulations were read.
The supplied rules confirm VIII–X Software Applications, up to two student
authors, complete source, user/technical/setup documentation, role test accounts,
licensed resources and GPLv3. Dates, eligibility, categories, team limits, rubric,
online availability periods, PDF format and defence/submission rules must be
verified in the actual participation year's official regulations. The supplied
document's online-access requirement extends at least one week before the
regional round through one month after the final round. It is not asserted as a
current-year rule. September 15, 2026 is a historical internal project deadline.
Stage 1 scope and approval/LOCK gates are internal product decisions.

## Exact human acceptance checklist

- [x] Complete all mandatory technical browser coverage, including real controlled Stage 1 sessions and the isolated disposable Profile regression; preserve existing evidence.
- [x] Resolve the seven strict locked-screen differences; 112 original references match exactly with the documented shell-height normalization. Human visual acceptance remains pending.
- [ ] Sign in with real Organizer and Member accounts; direct `/events`, refresh, Back/Forward and login return-to stay global without Dashboard highlight.
- [ ] Confirm only authorized Events appear; roles/dates/timezone are accurate; Active defaults; Archived and search behave correctly.
- [ ] Confirm loading, failure/retry, filtered-empty, zero-Event and archived-only cases remain useful.
- [ ] Open active and readable archived workspaces; switch Events from Tasks/Changes detail and global management; check that stale detail never follows.
- [ ] Confirm Create works for an eligible Member and Organizer; Edit appears only for active same-Event Organizers; archived/member/foreign edits remain denied.
- [ ] Exercise existing real Create/Edit validation, optimistic conflict/reload and successful-save navigation.
- [ ] Check BG/EN and Light/Dark at 320, 360, 390, 768, 960, 1024 and 1440px with long names; Manage is one line, at least 44px, reachable by touch/keyboard, without horizontal scrolling or header overlap.
- [ ] Verify Dashboard, Tasks, Team, Changes, Auth, Brand and Profile V1 workflows and interiors; keep five bottom items.
- [ ] Review and understand source changes and evidence; verify current-year competition rules before registration.
- [ ] Explicitly accept Stage 1 and authorize LOCK only after successful technical verification. Stages 2–7 require separate approval.

EVENT MANAGEMENT STAGE 1: TECHNICAL PASS

DATABASE MIGRATION: NONE

STAGES 2–7 STARTED: NO

HUMAN ACCEPTANCE: PENDING

STAGE 1 LOCKED: NO

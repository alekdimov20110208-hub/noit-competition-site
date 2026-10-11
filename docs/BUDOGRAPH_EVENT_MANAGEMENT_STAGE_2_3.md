# BudoGraph Event Management Stages 2 + 3 — 2026-10-11

## Final LOCK record

The project author explicitly confirmed **HUMAN PASS — 6/6** on **2026-10-11**
for Event Management Stage 2 and Stage 3 and authorized their final LOCK.
Accepted implementation: `9372f4974f1746008f1d3f3ec2c2b7b65e4535bc`
(`feat(app): improve event management UX and history`), committed and pushed to
`origin/main`. Previous Stage 1 LOCK documentation commit:
`43d1b515cbcefc64ff1b708a84f6f11675cfb552`.

| Accepted feature                            | Technical gate  | Human gate                   | Final status       |
| ------------------------------------------- | --------------- | ---------------------------- | ------------------ |
| Stage 1 — Global Event Listing & Navigation | PASS, preserved | Existing 6/6 PASS, preserved | LOCKED — PRESERVED |
| Stage 2 — Detail & UX                       | TECHNICAL PASS  | HUMAN PASS                   | LOCKED             |
| Stage 3 — Event History                     | TECHNICAL PASS  | HUMAN PASS                   | LOCKED             |
| Combined Stage 2 + 3                        | PASS            | 6/6 PASS                     | LOCKED             |

This is a documentation-only acceptance task. The author-confirmed checks below
are human acceptance, not a new automated or browser run. No application, test,
schema, dependency, configuration, infrastructure, credential or database change
is made by this LOCK task. No product/browser/PostgreSQL/password/session matrix
is rerun, and no service restart occurs.

### Locked Stage 2 scope

The existing `/events/new` and `/events/:eventId/edit` forms gain clearer hierarchy,
required-field copy, calendar-date/one-day and timezone explanations, accessible
field descriptions and explicit return to Event Management. Form Cancel and
management-return buttons are disabled during save where implemented. Existing
server validation, expectedVersion concurrency, canonical conflict recovery and
successful-save navigation remain. Same-Event active Organizers edit; eligible
Members can create independent Events and become their Organizers. BG/EN,
Light/Dark and responsive desktop/mobile behavior are accepted.

Existing routes and architecture are preserved. Drafts remain in memory; a
general unsaved-navigation guard is not implemented or included in this LOCK.

### Locked Stage 3 scope

Event-scoped `/events/:eventId/history` reads existing PostgreSQL ActivityEntry
through server-authorized `GET /api/events/:eventId/history`. Active same-Event
Organizer and Member reads show actor/action/time, stored versions and transitions
where available, and related Task/Change links where available. Pages contain at
most 50 records with deterministic timestamp/UUID ordering. Event isolation,
revoked/inactive/foreign access protection, localization/themes, responsive UI
and preservation of existing history are accepted.

Fastify, Better Auth, PostgreSQL, existing Event modules, ActivityEntry persistence
and routing/navigation contracts are reused. No migration, dependency, separate
audit persistence, retention change or historical rewrite is introduced.
Recorded versions/transitions are historical values; displayed actor names and
related titles are current joins. Full past Decision/Response/Plan B text is not
reconstructed or retained by this feature. The History row link is the accepted
Stage 1 listing compatibility addition; original controls and permissions remain.

### Author-confirmed human acceptance

Acceptance date: **2026-10-11**. Combined result: **6/6 PASS**.

- [x] Event Create/Edit, validation and conflict handling.
- [x] Organizer/Member permissions and ownership restrictions.
- [x] History actor/time information, versions and related links.
- [x] Event switching, pagination and navigation.
- [x] Responsive layout, BG/EN and Light/Dark.
- [x] Final usability assessment and source/evidence review.

### Preserved technical evidence and invariants

The [implementation evidence](TEST_EVIDENCE.md#event-management-stages-2--3--2026-10-11)
and preserved report below remain the technical source: frontend 280/280;
backend 135 PASS / 16 expected opt-in skips; PostgreSQL 119/119; browser 99 groups /
228 cases; direct History 9 groups / 28 layouts; additional link workflow 8 groups;
112/112 locked visual comparisons plus two negative controls; 2395 ActivityEntry
records unchanged; security PASS with zero secret findings. These are existing
implementation results, not executions during this documentation task. The
authorized single backend reload, live/ready checks, preserved Vite/configuration
and fixture/session cleanup remain recorded implementation evidence.

The [Stage 1 LOCK record](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_1.md#stage-1-lock-record)
is unchanged. Its earlier Stage 2 NOT STARTED wording records that historical
acceptance date; this separately authorized implementation and LOCK supersede
only that later-stage status. Authenticated `/events`, filters/search, Manage,
Create/Edit routes, Better Auth/PostgreSQL, Event permissions, ActivityEntry and
Task/Change behavior, locked Dashboard/Tasks/Team/Changes interiors, Brand/Profile
acceptance, five-item navigation, BG/EN, Light/Dark and responsive compatibility
remain preserved. No prior failures or pre-acceptance evidence are erased.

### Excluded and deferred scope

Stage 4 durable operation idempotency, Stage 5 Duplicate Event, Stage 6 Archive
Event and Stage 7 Clear All Tasks are **NOT STARTED**. The Archived filter does
not perform archiving. General unsaved-navigation protection and full historical
coordination-text reconstruction remain unavailable. Templates, Budget, Calendar,
PWA, Web Push and unrelated work remain outside this acceptance. The 572.83 kB
build advisory and other [known limitations](KNOWN_LIMITATIONS.md) are retained.
NOIT 2025–2026 regulations do not automatically apply to 2026–2027; actual-year
eligibility, dates, categories and submission/defence/licensing requirements need
separate verification. This LOCK is an internal product acceptance.

EVENT MANAGEMENT STAGE 1: LOCKED — PRESERVED

EVENT MANAGEMENT STAGE 2: TECHNICAL PASS / HUMAN PASS / LOCKED — YES

EVENT MANAGEMENT STAGE 3: TECHNICAL PASS / HUMAN PASS / LOCKED — YES

COMBINED HUMAN ACCEPTANCE: 6/6 PASS

STAGE 4: NOT STARTED

STAGES 5–7: NOT STARTED

The report from **Authorization and baseline** to the end of this file is
preserved pre-human-acceptance implementation evidence. Its PENDING/NOT LOCKED
wording and unchecked original checklist are historical; the Final LOCK record
above supersedes only that acceptance status.

---

## Authorization and baseline

Combined owner request authorizes Stage 2 form/workflow UX and Stage 3 minimal
read-only canonical history, internal checkpoints and conditional commit/push.
Starting HEAD: `43d1b515cbcefc64ff1b708a84f6f11675cfb552` on `main`, equal to remote.
Tracked tree was clean. The unrelated `docs/market-research/docs - Shortcut.lnk`
is untouched and excluded. Accepted Stage 1 implementation is
`8959b51eb054f71ddf9cafe7136f096edcc9b1f5`, HUMAN PASS 6/6, LOCKED.
Its existing LOCK record and earlier evidence are unchanged.

## Stage 2 implementation and checkpoint

Reuse `/events/new` and `/events/:eventId/edit`, existing form, service/controller,
server validation and Event commands. Add visible form hierarchy, required-field
copy, calendar-date/one-day guidance, timezone semantics and associated help.
Add explicit management return and disable form navigation while saving.
No second management/detail system, global CSS or locked workspace redesign.
Existing expectedVersion/conflict reload, failed-reload save block, Member-created
independent ownership and successful canonical Dashboard navigation remain.
Drafts retain original version during refetch; existing in-memory navigation
limitations are documented rather than implying a new unsaved guard.

Before Stage 3: 59 focused frontend tests, frontend typecheck/lint/build, real
Event Authoring 14 groups / 20 BG/EN Light/Dark layouts and 9 PostgreSQL results
passed. Real creation/edit persisted; Member/foreign Edit denied; validation,
concurrency/explicit conflict recovery, scope switching, Back/Forward and actual
expired session passed. UI-created controlled development Events are retained
under the established policy, never removed through destructive SQL.

## Stage 3 implementation

One read-only Event-scoped `/events/:eventId/history` surface, with a History link
on authorized management rows. That link is the sole listing compatibility change
needed for Member/Organizer discovery; old filters/search/Create/Open/Edit and
permissions remain. No switcher or sixth navigation destination is added.

`GET /api/events/:eventId/history?before=<ActivityEntry UUID>` reuses Event modules,
Fastify, Better Auth, `pg`, current-state tables, existing ActivityEntry and index.
A single SQL read enforces current active identity/membership and keeps cursors
within the same Event. Pages are bounded to 50 (51-row lookahead), sorted by exact
stored timestamp then UUID descending. Archived authorized reads remain possible.
No history-write endpoint, schema/migration, new audit event, backfill, retention
change, dependency or asset is introduced.

Display actual action/actor/time, related IDs/current titles, recorded versions,
changed fields, Task status and Change coordination-presence transitions where
stored. Existing Task/Change deep links are reused. Current names/titles are
identified honestly; full old Decision/Response/Plan B prose and missing metadata
are not fabricated. Payloads, emails and auth details are not returned.
Cancellation, identity/Event remounts and safe errors prevent stale cross-scope
publication. Failed reads never masquerade as empty history; 401 clears identity.

## Verification status

Stage 2, Stage 3 and combined mandatory technical verification are PASS.
Human acceptance remains PENDING; Stage 2 + 3 are NOT LOCKED.

| Gate                                 | Verified result                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Frontend regression                  | 280/280, no skips/failures                                                        |
| Backend default                      | 135 PASS / 16 opt-in skips (151 total), no failures                               |
| Full real PostgreSQL                 | 119/119, no skips/failures; independent concurrency and Profile rollback fixtures |
| Format, lint, both typechecks/builds | Exit 0; existing 500 kB advisory remains                                          |
| Fresh principal browser suites       | 99 functional groups / 228 layout or presentation cases                           |
| Direct shared-runtime History        | 9 groups / 28 cases, Organizer and Member through 5173/3001                       |
| Original locked interiors            | 112/112 exact pixels; 2 deliberate-change controls detected                       |

The eight fresh suites are Event Authoring 14/20, Management 12/28, Auth 15/20,
Workspace 11/8, Task Actions 16/40, Task Authoring 11/20, Changes 11/64 and History
9/28 (groups/cases). Changes includes four labelled long-text fixtures; transport
empty/error states are explicitly fixtures, never PostgreSQL business evidence.
Widths span narrow 320/360/390, tablet and desktop to 1440; BG/EN and Light/Dark,
44px targets, visible keyboard focus and overflow checks pass. Original visual
references/hashes, masks and comparison tolerances are unchanged. Profile's full
accepted Stage 1 browser result is preserved against unchanged source; fresh
Profile navigation is read-only because established password rotations are out
of scope. See TEST_EVIDENCE for exact paths and retained failed runs.

Final review strengthened Task/Change relationship assertions, including real
Change detail rendering. The affected direct workflow rerun passed 8 groups with
explicit layout skip and verified session/resource cleanup; the completed 28-case
matrix is retained. Repeated checks are excluded from the principal 99/228 total.

The owner-authorized single reload ran only after verifiers/cleanup finished and
exact BudoGraph process ownership was confirmed. Backend 3001 PID 25912 became
28236 using the same Node entry/flags/environment files; Vite PID 26668 stayed.
Liveness/readiness returned 200, new anonymous History 401, then real Organizer/
Member reads 200. An initial helper import preflight failed before any stop;
diagnostics are retained, corrected, and actual reload attempts equal one.
No automatic second restart occurred.

Independent whole-row fingerprints show all **2395 ActivityEntry records**
unchanged during reload and direct read-only browser verification. Fingerprints
also preserve Event, membership, Task, Change, links, invitations, User, Account
and Session data across the reload and after browser cleanup. Environment/config
and shortcut hashes match. The direct runner independently verifies owned session
removal, peer-session isolation and closed browser/pool resources. PostgreSQL
fixtures are absent after rollback; intentional UI-created development Events,
Tasks, Changes and appended history remain under existing fixture policy.
No established credentials were rotated, no destructive operation occurred.

API and PostgreSQL tests prove active same-Event authorization, foreign/inactive
denial, actor/target/version preservation, microsecond/tie ordering, bounded cursor
pages, archived reads and source immutability. Real browser navigation proves
refresh, Back, Event switching, Task/Change links and revoked-session clearing.
Security scan covers authorized source, frontend build and new text logs/artifacts
with zero configured-secret findings, protected-file changes or migrations.

## File and publication scope

36 authorized files: 13 frontend route/page/service/style/test files, 5 backend
service/route/test files, 9 browser runners, package scripts and 8 documentation
files. Existing runners retain original default paths and assertions; optional
new output paths preserve earlier artifacts. No dependency/license asset change.
Stage 1's sole compatibility addition is the History row link documented above;
locked product interiors and the Stage 1 LOCK document remain untouched.

Publication follows final diff/whitespace/security and formatting checks. Combined
commit subject: `feat(app): improve event management UX and history`.
The published commit's SHA is available through Git history and the final report. Unrelated
shortcut, ignored secrets, build outputs and evidence are excluded from staging.

## Limitations and deferred scope

Recorded operational history is not an exhaustive audit or historical name/prose
archive. There is no realtime update, snapshot pagination across future writes,
general unsaved-navigation guard or durable write idempotency. Build retains the
existing 500 kB advisory. Physical devices, other engines and formal accessibility
certification are unclaimed; external mail inbox validation remains separate.
Stages 4–7 (durable idempotency, Duplicate, Archive, Clear All Tasks) are NOT STARTED.
No deployment, new AI/email, templates, budget, calendar, PWA or push work.

## Competition-year boundary

The mandatory master prompt and supplied 30-page NOIT regulations were read.
All supplied competition rules refer to 2025–2026 and need actual participation-year
verification: eligibility/categories/team limit, GPLv3/licensing/deliverables,
dates/online period, documentation format, rubric and defence/submission rules.
The historical September 15, 2026 internal deadline is not an official NOIT date.
Stage labels, approvals and LOCK gates are internal product decisions.

## Human acceptance checklist

- [ ] Organizer creates/edits an Event, reviews validation and conflict recovery.
- [ ] Member creates an independent Event; foreign/member Event edits remain denied.
- [ ] Open history from management; verify actor/action/time and Task/Change links.
- [ ] Switch Events, reload, Back/Forward, older records and recovery without leakage.
- [ ] Check BG/EN, Light/Dark and narrow mobile; preserve Stage 1 and locked interiors.
- [ ] Review/understand source and evidence; explicitly approve Stage 2 + 3.

HUMAN ACCEPTANCE: PENDING

STAGE 2 + 3 LOCKED: NO

STAGES 4–7: NOT STARTED

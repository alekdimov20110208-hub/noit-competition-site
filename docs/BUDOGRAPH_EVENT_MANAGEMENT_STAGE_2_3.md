# BudoGraph Event Management Stages 2 + 3 — 2026-10-11

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

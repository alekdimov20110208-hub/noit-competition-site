# BudoGraph Event Management Stage 6 — Archive Event

Implementation and evidence: **2026-10-13–14**. Overall status: **TECHNICAL PASS**.
The one authorized shared-backend reload and direct integration are **PASS**.
This report freezes verified technical evidence before the implementation commit;
actual publication SHA/remote equality are recorded in the final response, Git
history and ignored local `tmp/event-management-stage6/publication.json`.
Human Acceptance is **PENDING**; Stage 6 is **NOT LOCKED**. Stage 7 is **NOT STARTED**.

## 1. Authorization, baseline and runtime isolation

The project author expressly authorized Stage 6 implementation, verification and
conditional publication. Starting `main` and freshly fetched `origin/main` both
equal `892bc68b92d0586c3c881da9cb3e503afd701227`. Tracked tree/index were clean.
The unrelated `docs/market-research/docs - Shortcut.lnk` is untouched and excluded.
Accepted Stages 1–5, their dedicated LOCK files and original visual references
remain protected. No Stage 7 or later roadmap work is included.

At preflight, the shared backend was supervised by `node --watch` (watcher PID 2176,
backend PID 10200), with shared Vite PID 26668. Editing its watched source would
cause an unauthorized reload. Implementation therefore used the attached
`C:/Users/Lenovo/.codex/worktrees/event-archive-stage6/noit-competition-site`
checkout at the same starting revision. Main's product files were kept unchanged
while owned temporary service factories/Vite ran separately. No shared service was
stopped before the author's separate authorization. Section 9 records the later
completed controlled promotion and direct shared verification.

## 2. Recovered governing contract

Original chat: **Review Event Management contract**,
`01a11d79-8140-7ca1-8d65-f700d7fe45ea`, retrieved read-only. The existing evidence
copy is `C:/NOIT/noit-competition-site/tmp/event-management-stage45/original-contract.md`.
The accepted Stage 4 + 5 report records the author's original contract approval.
Its detailed Archive rules govern over the foundation's earlier ownership-policy
placeholder; ownership remains a distinct relation and is not a generic role.

| Decision         | Stage 6 contract                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Authority        | Current active authenticated identity and active same-Event Organizer membership; non-owner Organizers qualify. Members do not.   |
| Ownership        | Preserved, never accepted from the client or changed by Archive. No owner-only policy is introduced.                              |
| Confirmation     | Exact canonical Event name, case-sensitive, with no trimming, fuzzy comparison or Unicode normalization.                          |
| Version          | Required reviewed Event version; stale requests conflict before no-op handling.                                                   |
| Retry            | Required UUID Idempotency-Key, actor/key uniqueness, durable PostgreSQL receipt and canonical SHA-256 digest.                     |
| Replay           | Current identity and source Organizer authorization precede receipt lookup; only exact accepted replay bypasses version checking. |
| Existing archive | Fresh current-version exact confirmation is a recorded no-op; stale requests conflict.                                            |
| Navigation       | Archive returns to global `/events`; subsequent workspace selection is explicit.                                                  |
| Retention        | Business rows, team memberships, invitations, reminders, notifications and immutable history remain.                              |
| Exception        | Personal notification read-state writes remain allowed.                                                                           |
| Recovery         | No Unarchive, Restore, Delete Event or Clear All Tasks capability.                                                                |

## 3. Backend operation and additive migration

`POST /api/events/:eventId/archive` accepts only `expectedVersion` and
`confirmationName`, plus UUID `Idempotency-Key`. It requires a real session,
trusted Origin/Fetch Metadata, bounded JSON and no-store responses. Initial
acceptance and exact replay return `200 { event }` for the same archived Event.
Safe errors: validation 400; session 401; accessible Member/origin 403;
foreign/revoked/unavailable scope 404; known version/key/version-ceiling 409.

`server/src/events/archive.ts` validates the input before connecting, acquires
the existing actor/key advisory lock, locks Event **FOR UPDATE**, then locks and
rechecks identity/membership **FOR SHARE**. It validates the reviewed version and
exact canonical name before setting server archive/update timestamps and
incrementing version once. A terminal active INTEGER version returns
`VERSION_LIMIT_REACHED`. One `EVENT_ARCHIVED` ActivityEntry records actor, operation
ID and before/after version/archive state. Receipt, Event and activity commit
atomically; insertion faults roll everything back. No business/history DELETE occurs.

`0009_event_archive_receipts.sql` extends only the existing receipt command-type
constraint to Duplicate/Archive and constrains Archive's result to its source.
Existing primary key, restrictive foreign keys, immutable trigger, RLS and
Duplicate implementation/digest/replay semantics remain unchanged. Applied
`0001–0008` SQL/checksums are not rewritten. Explicit migration application:
**1 applied, 8 already applied**; unchanged rerun: **0 applied, 9 already applied**.
Main and the shared database now both contain the reviewed 0009 inventory.
After promotion, a main migration rerun also reports 0 applied / 9 already applied.

## 4. Read-only and locking audit

| Existing write surface                           | Archive boundary and permitted historical behavior                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Event metadata                                   | Existing Event-first exclusive transaction rejects archives; history remains readable.                                                                                                           |
| Task create/details/status/assignment/acceptance | Event SHARE lock and current archive check precede Task writes. Existing Task, acceptance and assignment values remain.                                                                          |
| Change/Decision/Response/Plan B/links            | Existing Event SHARE authorization rejects all authoring before relation replacement. Existing records/links remain readable.                                                                    |
| Invitation create/resend/revoke/accept/register  | Existing Event-exclusive checks reject archives, including account-registration callback before invocation. Pending invitation rows remain unusable, retained.                                   |
| Team                                             | Existing membership reads and Task responsibility commands only; no new membership-management API is added.                                                                                      |
| Reminder worker                                  | Candidate scan and locked delivery recheck archive eligibility; Event SHARE remains held through delivery commit. Configuration and earlier delivery history remain.                             |
| Notification read state                          | Remains permitted for the authenticated recipient in authorized Event scope. Event-first locking is now explicit before the joined membership query, avoiding reliance on query-plan lock order. |
| Duplicate                                        | Approved archived-source Organizer exception remains; destination is independent, active and empty of source operational records.                                                                |

Independent-connection tests hold real commits at controlled barriers. Archive
blocks competing Edit, Task create/status, Change create, invitation consumption
and stale Duplicate; they recheck committed archive/version state. Task, Change
and invitation writes already committed before Archive remain history. Event edit
invalidates Archive's reviewed version. A stale worker candidate cannot deliver
after Archive; an in-flight delivery holding Event completes before lifecycle commit.
Worker tests use a labelled deterministic synthetic clock and retained test identities.

## 5. Frontend and recovery

The existing management list keeps Open/Edit/History/Duplicate and its filters,
search and five primary navigation items. Eligible active rows add a separated
**Danger zone / Опасни действия** containing Archive. Archived/Member rows have
no ordinary Archive action. A native modal loads current canonical Event data,
shows the full name and retention/read-only explanation, requires exact typing,
associates validation/help text, traps focus and restores it after Cancel/Escape.
Pending submission is guarded synchronously and cannot be submitted twice.
BG/EN and existing System/Light/Dark preference behavior are preserved.

Known version conflict requires explicit canonical reload, renewed name typing
and another intentional confirmation. Network loss, malformed acknowledgement
and unknown 409 preserve the same UUID, reviewed version and confirmation in
identity/Event-scoped tab storage with memory fallback. Global management exposes
recovery even when the Event has already moved to Archived. Recovery sends the
same request, never a newly generated blind archive. Authentication failure
clears private state; access rejection disables the workflow and refreshes scope.

Successful acknowledgement refreshes canonical listing; a failed refresh shows
explicit success plus a list-refresh limitation. Archived workspaces have a
historical read-only notice. Existing canonical Task query links, Change routes,
History and explicit archived selection are preserved. Legacy selection still
excludes archives. No snapshot-at-archive reconstruction is promised.

## 6. Executed evidence inventory

Evidence is ignored local material under `tmp/event-management-stage6/` in the
prepared checkout. It is not part of repository clones or a publication artifact.
All independent and direct shared-runtime technical gates pass. The isolated
results below retain their executed counts; main repeats are recorded separately
and are not added again to principal coverage.

| Gate                                                               | Executed result / state                                                                                                                                                        | Evidence                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Archive backend unit + locked operation/HTTP regression checkpoint | 9 PASS (3 new Archive tests)                                                                                                                                                   | command output                                                               |
| Archive frontend transport/storage/controller                      | 4 PASS                                                                                                                                                                         | included full frontend log                                                   |
| Frontend full regression                                           | 290 PASS, no failures/skips                                                                                                                                                    | `frontend-tests-verified.log`                                                |
| Backend default regression                                         | 144 PASS / 24 opt-in skips, no failures                                                                                                                                        | `backend-tests-verified.log`                                                 |
| Focused real Archive PostgreSQL                                    | 10 PASS                                                                                                                                                                        | `schema-archive-final.log`                                                   |
| Independent Archive races                                          | 9 PASS                                                                                                                                                                         | `archive-races-second.log`                                                   |
| Final Schema + enhanced Archive                                    | 27 PASS, no failures/skips                                                                                                                                                     | `schema-archive-final.log`                                                   |
| Initial serial full PostgreSQL                                     | 140 PASS / 1 obsolete eight-migration inventory assertion; fixed exact inventory, not weakened checks                                                                          | `postgres-full.log`                                                          |
| Final serial full PostgreSQL                                       | 157 PASS, no failures/skips; PostgreSQL 17.11                                                                                                                                  | `postgres-verified.log`                                                      |
| Typecheck/lint/build checkpoint                                    | Frontend/backend PASS; existing Vite size advisory, 593.49 kB JS on final reviewed source                                                                                      | `build-verified.log`, `server-build-verified.log`, `*-review.log`            |
| Original locked interiors                                          | 112 exact matches; 2 deliberate changes detected; original reference files not regenerated                                                                                     | `locked-screens/report.json`                                                 |
| Final Archive browser                                              | 14 functional groups / 28 layouts + 1 short 320px/125% stress; additional 14-group keyboard Enter rerun                                                                        | `browser-complete/report.json`, `browser-enter-final/report.json`            |
| Existing critical browser regression                               | 64 groups / 124 layouts: Management 12/28, Auth 15/20, Event Authoring 14/20, History 9/28, Duplicate 14/28; zero application errors                                           | `critical-event-management/report.json`, `critical-verified-*/report.json`   |
| Direct shared backend integration                                  | PASS: one authorized reload; Archive 14/28 + 1 stress, critical 64/124, six HTTP boundary groups, zero application errors                                                      | Main `tmp/event-management-stage6/shared-verification-summary.json`          |
| Final preservation / secret / formatting                           | All original rows in 14 tables, 2528 ActivityEntries, 23 accounts, 89 sessions and 8 prior migrations/LOCK hashes preserved; secrets 0, forbidden artifacts 0; formatting PASS | `preservation-after.json`, `security-audit.json`, `format-check-windows.log` |

Initial harness issues remain recorded: invalid authored Task test payload,
unbounded race barrier after a missing required priority, runtime Sharp entry
path, unsupported Task URL and asynchronous Forward synchronization, collapsed-details focus enumeration and cross-suite auth throttling. The Archive control now mounts only when its Danger zone expands. A twelve-second inter-suite pause preserves the existing auth limiter; it is not bypassed. Only owned
stalled Archive test processes were stopped; their transaction rolled back.
The corrected race suite passes all nine results. Failed runs are not relabelled
as whole-suite passes. Existing tests retain their original assertions; the
schema inventory explicitly adds 0009 and changes the exact rerun count to nine.

## 7. Baseline, preservation and cleanup policy

Before database mutation, an explicit repeatable-read read-only baseline captured
hashes of every original row in 14 relevant tables, all eight migration checksums
and the dedicated LOCK-file hashes. Initial counts include **2528 ActivityEntries**,
**409 Events**, **47 receipts**, **23 Account rows** and **89 sessions**.
Final preservation passes for every original row hash and original migration/LOCK record. Original accounts and sessions remain 23 and 89; no real credentials or previous sessions changed. New synthetic data is not mistaken for deletion.
Normal independent race fixtures and intentional browser Events are retained;
rollback-only fixtures never commit. No real passwords, existing credentials,
business records, history, PostgreSQL instance or shared Vite are reset.
Browser-owned sessions sign out and owned browser/service/pool processes close. The final full Archive run verifies all 14 groups and 28 layouts against real service factories; a targeted follow-up also submits with keyboard Enter. The five existing principal browser suites contribute 64 groups / 124 layouts (Management includes 10 labelled synthetic groups and two real groups). Total principal Archive + critical coverage is 78 groups / 152 layouts; repeated targeted runs are not added to that total. Transport-loss cases commit real effects before losing the acknowledgement. The locked 112-case runner is separately labelled synthetic transport and never counted as business-write proof.

## 8. Changed files and documentation

Backend: new Archive service, service/route wiring, field-error type, explicit
notification Event lock, 0009 migration, Archive validation/retention/race tests,
fresh-process replay helper and exact schema migration inventory.
Frontend: Archive modal/styles, scoped recovery helper/tests, remote service and
controller command, hook/App wiring, management affordance, historical shell
notice, localized Archive/History labels and the generic Event error-map extension.
Verification: new Archive browser runner and package script/test/format inventory.

All 35 authorized changed files (temporary harness/evidence/build files are excluded):

```text
CHANGELOG.md
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/BUDOGRAPH_EVENT_MANAGEMENT_STAGE_6.md
docs/DEPLOYMENT_AND_DEMO_PLAN.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-event-archive-ui.mjs
server/migrations/0009_event_archive_receipts.sql
server/src/events/archive.ts
server/src/events/model.ts
server/src/events/service.ts
server/src/notifications/service.ts
server/src/routes/events.ts
server/tests/event-archive-concurrency.integration.test.ts
server/tests/event-archive.integration.test.ts
server/tests/event-archive.test.ts
server/tests/helpers/archive-replay.ts
server/tests/schema.integration.test.ts
src/App.tsx
src/components/AppShell.tsx
src/components/EventArchiveDialog.tsx
src/components/eventArchive.css
src/hooks/useRemoteTasks.ts
src/i18n/eventMessages.ts
src/pages/EventFormPage.tsx
src/pages/EventHistoryPage.tsx
src/pages/EventManagementPage.tsx
src/services/RemoteWorkspaceService.ts
src/services/eventArchiving.test.ts
src/services/eventArchiving.ts
src/services/taskReadState.ts
```

Relevant documentation updates: this report, TEST_EVIDENCE, KNOWN_LIMITATIONS,
BACKEND_DEVELOPMENT, USER_GUIDE, DEPLOYMENT_AND_DEMO_PLAN, AI_ASSISTANCE_LOG,
README and CHANGELOG. Dedicated Stage 1–5 LOCK reports stay byte-identical.
No dependency, lockfile, third-party asset or license-register change is required.

The isolated Windows checkout inherits `core.autocrlf=true`; unchanged files are
CRLF while the repository index is normalized. Default formatting initially
reported those checkout line endings. The complete configured check passes with
`node --run format:check -- --end-of-line auto`, preserving untouched LOCK bytes;
all changed code/docs are explicitly formatted. No formatting rules/assertions or
Git configuration are changed. `node --run` executes the existing package scripts
because pnpm's dependency-status check rejects the isolated dependency junction.
The new Archive runner owns its separate Vite cache. Existing critical runners
are not edited: an ignored loader changes only their localhost host configuration
to the owned runtime. This is isolated verification, not direct shared-runtime proof.

## 9. Authorized shared integration and prepublication evidence freeze

On **2026-10-14** the author explicitly authorized one bounded backend-only reload.
Immediately before mutation, port 3001 resolved to child **30580**, watcher **2176**,
owner **Lenovo**, executable `D:/School/Computer Science/node.exe`, with both
working directories verified as `C:/NOIT/noit-competition-site`. Parent/child
commands, creation identities and the watcher's sole child were checked. Main and
origin/main were synchronized at the expected starting SHA, no conflicting tracked
changes/tests or competing database transactions existed, and all 35 source hashes
matched the reviewed manifest. Live/ready passed. Earlier initial child 10200 had
changed to 30580 without a stop/reload command from this package; that earlier
replacement's cause remains unestablished and is not counted as an authorized reload.

Only the verified watcher/backend pair was stopped. Exactly 35 reviewed files were
promoted with byte/hash verification. Dedicated LOCK files, shortcut, environment
files and mandatory sources were checked unchanged. One new backend started at
**PID 29068**, **2026-10-14 01:21:03 +03:00**, without watch, using the existing
trusted development configuration. Vite stayed **PID 26668**; PostgreSQL was not
restarted. Both backend health endpoints return 200; anonymous Archive returns 401,
proving registration rather than the earlier absent-route 404. No second reload
or start attempt occurred.

Direct shared Archive: **14 groups / 28 layouts + 1 stress**, Chromium 148.0.7778.96,
zero application errors and verified owned-session/resource closure. It proves
owner/non-owner Organizer, Member denial, exact names and stale review, rapid submit,
history/read-only links, Active-to-Archived, actual committed lost/malformed response
recovery with the same UUID, revoked access, session expiry and archived Duplicate.
Supplementary actual shared HTTP: **6 groups**, including a real existing foreign
Event denial, durable replay/current-version no-op, **11 authoring surface denials**,
archived invitation accept/register denial, exact retained Task/Team/Change/link/
invitation/prior-history hashes and archived-source Duplicate. All targets are newly
owned synthetic Events; no established Event is archived for proof.

Unmodified Stage 1–5 critical scripts also run directly on shared 5173/3001:
Management **12/28** (10 labelled synthetic + 2 real), Auth **15/20**, Create/Edit
**14/20**, History **9/28**, Duplicate **14/28**. Total **64 groups / 124 layouts**,
zero application/console errors where measured; Chrome 155.0.8059.79. Principal
shared Archive + critical total is **78 groups / 152 layouts**; the supplementary
six groups and independent repeats are separate. Main repeats frontend **290 PASS**,
backend **144 PASS / 24 opt-in skips**, both typechecks/builds, lint, default complete
formatting and extra Archive-script/CHANGELOG formatting. The reviewed product/test
bytes match the isolated package that passed the full serial **157 PostgreSQL**
results; that full run is reviewed, not falsely relabelled as a new main rerun.

Main migration rerun: **0 applied / 9 already applied**; all checksums match,
including existing 0009. Final read-only preservation checks retain every original
row in 14 tables and every pre-reload row, including original **2528 ActivityEntries**,
**23 accounts** and **89 sessions**. Final ActivityEntry total **2698** includes
**47 new synthetic entries after reload**, with **24 new synthetic Events**. Other
post-reload deltas: memberships +32, Tasks +5, Changes +4, Change links +4,
invitations +3, notifications +4, receipts +19; Users/accounts/sessions/reminders/
migrations +0. Failed synthetic harness fixtures are retained rather than deleted.
Full counts/hashes are in main `tmp/event-management-stage6/final-preservation.json`.

Local ignored shared failures remain: the updated bundled Playwright expected an
uninstalled browser revision before any test ran; an existing owned executable
completed the Archive matrix. The supplementary harness initially expected an
unimplemented single-Event GET, corrected to scoped listing; its first invitation
acceptance probe used the wrong invited account, correctly denied by the server.
The corrected fixture invites the controlled Member before adding its synthetic
membership. These are harness/configuration corrections; no product code or prior
assertion/reference changes, failed-run relabelling or additional backend reload.

All owned tests/browsers/services/pools are closed, port 5174 is free, original
sessions remain intact and only the intended backend 29068/Vite 26668 services
remain. Dedicated LOCK files and reviewed product/test hashes are preserved in
both checkouts. Secrets/private-artifact and exact staged-diff review precede one
`feat(app): add safe event archiving` commit and non-force origin/main push.
This source report is frozen before that operation; actual SHA, push equality and
clean tracked/index outcome are supplied in the final response/local publication
record rather than inventing a self-referential commit hash. The attached worktree
and ignored evidence remain for review. Human Acceptance and later documentation-only
Stage 6 LOCK require the author's separate explicit Human PASS. Stage 7 is not started.

## 10. Limitations and competition-year boundary

Only Duplicate and Archive have durable command receipts. Existing Create/Edit
semantics remain. Closing/clearing tab storage can lose its recovery hint; the
server's key guarantees remain. There is no receipt directory, expiry/purge,
Unarchive or historical full-text/state reconstruction. Current actor profile
names and operational clock-derived signals retain existing semantics.
Other engines, physical devices and formal accessibility certification are not
claimed. The development connection does not prove production least privilege.
No production deployment, new email/auth provider, AI, Templates, Budget,
Calendar, Clear All Tasks or later roadmap stage is implemented.

The supplied NOIT **2025–2026** regulations are historical: eligibility, categories,
two-student limit, GPLv3/licensing/deliverables, deadlines/online period, documentation
format, rubric and submission/defence rules require actual-year verification.
The September 15, 2026 date is an internal historical deadline, not an official
competition deadline. This feature does not claim current-year or legal certification.

## 11. Human Acceptance — PENDING

1. Archive authority: owner and non-owner Organizer eligible; Member/foreign/revoked denied.
2. Exact confirmation: name, case/spaces, Cancel/Escape, stale version and intentional renewed review.
3. Transition: pending/rapid submission, success and Active-to-Archived listing; explicit next selection.
4. Read-only retention: Tasks, Team, Changes, History and links remain; authoring absent; archived Duplicate works.
5. Recovery/security: lost response, refresh, Back/Forward, same-key recovery and access/session changes fail safely.
6. Usability: BG/EN, System/Light/Dark, desktop/tablet/320px mobile, long names and keyboard/focus behavior.

```text
EVENT MANAGEMENT STAGES 1–5: LOCKED — PRESERVED
EVENT MANAGEMENT STAGE 6: TECHNICAL PASS
ARCHIVE AUTHORIZATION: VERIFIED
ARCHIVE DATA INTEGRITY: VERIFIED
ARCHIVE HISTORY PRESERVATION: VERIFIED
ARCHIVED READ-ONLY: VERIFIED
SECURITY: PASS
SHARED BACKEND INTEGRATION: PASS
COMMIT/PUSH: NOT PERFORMED — prepublication evidence freeze
HUMAN ACCEPTANCE: PENDING
STAGE 6 LOCKED: NO
STAGE 7: NOT STARTED
```

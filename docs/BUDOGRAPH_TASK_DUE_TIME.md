# Optional Task due time — 2026-10-08

Authorized extension of locked baseline `bfc405aafb955ddb9c50bf35bb40a9bb4cc3f9eb`
(`fix(app): refine operational visual hierarchy`). P1, P2, Auth, P3 and Visual
Refinement V1 remain the implementation boundary. P4A remains PARTIAL pending its
external human gate; no provider/domain setup is part of this feature.

## Domain and migration

The inspected model uses required `public.task.deadline DATE NOT NULL`. Events
already store a validated canonical timezone (for example `Europe/Sofia`).
Immutable additive `server/migrations/0006_task_deadline_time.sql` adds only
`deadline_time TIME(0) WITHOUT TIME ZONE NULL`, without a default or backfill.
A check constrains stored values to minute boundaries below `24:00`.
Historical migrations and existing dates are unchanged. Apply through the existing
reviewed migration runner (`pnpm.cmd db:migrate`); repeat runs verify checksums and
apply nothing. The migration has been applied to the configured development DB:
100 pre-existing Tasks retained identical dates, versions and update metadata,
all with NULL time. Production deployments must apply 0006 before starting this code.

`deadlineTime` is the time by which work should finish on its deadline day in that
Event's timezone. It is a local wall-clock value, never a UTC timestamp, duration,
appointment, reminder or notification schedule. Date remains required. This phase
retains calendar-day urgency/overdue/attention semantics even for timed Tasks;
precise time-of-day overdue detection is not implemented. No timezone conversion,
timezone picker, recurrence or calendar integration is added.

## API, atomicity and authorization

All Task responses and live Change affected-Task projections include
`deadlineTime: "HH:mm" | null`. POST omission means NULL; PATCH omission preserves
the current time; PATCH `null` removes it. No coercion or trimming: `8:00`, `24:00`,
`25:00`, `12:75`, seconds, whitespace, prose, numbers and empty strings are rejected.
Boundaries `00:00`, `00:01`, `08:00`, `12:30`, `23:59` are accepted. Server errors
retain `INVALID_TASK_COMMAND` with `fields.deadlineTime: "INVALID_TIME"`.
Frontend validation and strict canonical-response parsers enforce the same format.

Organizer authorization remains server-authoritative and Event-scoped;
OperationalRole is descriptive. Due-time edits cannot change assignment, status
or acceptance. Existing `expectedVersion` checks run before no-op handling. One
meaningful authored command increments Task version once and inserts one
`task.updated` activity with changed-field before/after values, including date+time
in the same atomic edit. Current-version no-ops preserve history and metadata.
Stale writes, including no-op retries, return 409. Existing form conflict recovery
replaces the draft with the latest canonical fields/version; network failures keep
the unsaved draft and confirmed data according to the existing recovery contract.

## UI and live impact

The existing date control remains required. Add time / Добавяне на час reveals a
labeled HH:mm text input; Remove time / Премахване на часа restores NULL.
Clearing the input also removes its time. Incomplete keyboard entry is
treated as an error, with focus and error association. No dependencies, time badge,
new card, clock decoration, animation or visual architecture changes are needed.

Task rows/details, Team deadlines, Dashboard Task metadata/timeline/checkpoints,
Change form affected work, affected-deadline summary and live Task detail append
24-hour time. Date-only formatting stays unchanged: `4 Oct 2026` /
`4.10.2026 г.`; timed formatting adds ` · 17:30`. The compact Dashboard timeline
retains its existing short date and appends time. Existing local demo snapshots
without the field normalize it to NULL; authenticated API responses require the
canonical field and never fall back to demo data.

Change impact reads current Task rows, including time, in the existing SQL snapshot.
Task edits do not edit a Change, increment its version, add Change history or
snapshot time into `change_task`. Decision/Response/Plan B and attention are unchanged.
The date-only `impact.deadlines` API summary remains compatible; its presentation
uses current affected-Task times. All existing list/attention ordering is retained;
no same-day time tie-break is introduced.

## Verification and limits

Focused frontend/backend tests cover strict boundaries, request/response mapping,
BG/EN formatting independent of timezone, no-op/stale behavior, atomic history,
acceptance, live Change projection and unchanged calendar urgency/order.
`server/tests/task-deadline-time.integration.test.ts` verifies an existing-row
migration fixture, actual PostgreSQL types/precision, NULL/valid persistence,
add/change/remove/date+time, authorization, isolation, conflict, acceptance and
unchanged Change version/history. Fixtures roll back; direct negative SQL cases
use savepoints. Shared-database integration tests never apply pending migrations.

`pnpm.cmd test:browser:task-deadline-time` uses real authenticated development
accounts, a real Event and PostgreSQL. It retains clearly synthetic Events/Tasks/
Changes, keeps credentials/cookies in memory, and stores screenshots/reports under
ignored `tmp/task-due-time-evidence`. It checks create/edit/remove/refresh, midnight,
23:59, accepted responsibility, current Change impact, two-tab 409, no-op, malformed
API values, permissions, network failure and the 1440/1080/768/390/320 × BG/EN ×
Light/Dark matrix. Transport failure injection is labeled. No physical-device test
or formal accessibility certification is claimed.

Final executed results are recorded in `docs/TEST_EVIDENCE.md`.
No new runtime/development dependency or asset requires a license-register entry.
GPLv3 source/distribution requirements remain. The supplied 2025–2026 competition
dates, category details, submission/account/availability rules and document format
must be checked against the applicable later-year regulations before participation.

## Changed files

- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/BUDOGRAPH_TASK_DUE_TIME.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TEST_EVIDENCE.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-change-dashboard-ui.mjs`
- `scripts/verify-changes-ui.mjs`
- `scripts/verify-task-authoring-ui.mjs`
- `scripts/verify-task-deadline-time-ui.mjs`
- `scripts/verify-workspace-ui.mjs`
- `server/migrations/0006_task_deadline_time.sql`
- `server/migrations/README.md`
- `server/src/changes/model.ts`
- `server/src/changes/service.ts`
- `server/src/tasks/model.ts`
- `server/src/tasks/service.ts`
- `server/tests/change-response.integration.test.ts`
- `server/tests/changes.integration.test.ts`
- `server/tests/changes.test.ts`
- `server/tests/schema.integration.test.ts`
- `server/tests/task-authoring.integration.test.ts`
- `server/tests/task-authoring.test.ts`
- `server/tests/task-deadline-time.integration.test.ts`
- `server/tests/tasks.test.ts`
- `src/components/TaskAuthoringForm.tsx`
- `src/components/TaskDrawer.tsx`
- `src/components/taskAuthoring.css`
- `src/data/demo.ts`
- `src/data/stress.ts`
- `src/domain/changeCoordination.test.ts`
- `src/domain/taskDeadlineTime.ts`
- `src/domain/taskSemantics.test.ts`
- `src/domain/types.ts`
- `src/domain/workspace.test.ts`
- `src/domain/workspace.ts`
- `src/i18n/createI18n.ts`
- `src/i18n/formatters.ts`
- `src/i18n/i18n.test.ts`
- `src/i18n/index.ts`
- `src/i18n/taskAuthoringMessages.ts`
- `src/pages/ChangesPage.tsx`
- `src/pages/TasksPage.tsx`
- `src/pages/TeamPage.tsx`
- `src/pages/dashboard/ChangeImpact.tsx`
- `src/pages/dashboard/OperationalFocus.tsx`
- `src/pages/dashboard/PreparationTimeline.tsx`
- `src/pages/dashboard/helpers.test.ts`
- `src/pages/tasks/helpers.test.ts`
- `src/pages/team/MemberDetail.tsx`
- `src/pages/team/helpers.test.ts`
- `src/services/RemoteWorkspaceService.ts`
- `src/services/changes.test.ts`
- `src/services/changes.ts`
- `src/services/eventActions.test.ts`
- `src/services/taskActions.test.ts`
- `src/services/taskAuthoring.test.ts`
- `src/services/taskAuthoring.ts`
- `src/services/taskReads.test.ts`
- `src/services/workspaceViews.test.ts`

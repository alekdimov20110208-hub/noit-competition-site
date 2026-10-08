# Task reminders and in-app notifications — 2026-10-08

Authorized extension of locked baseline `9adc7c387d32c144f74d89c32bec184d6f76cd33`
(`feat(app): add optional task due times`). The problem, core product, Task flows,
Fastify/PostgreSQL architecture, membership model and existing testing strategy
remain approved and locked. This request explicitly authorizes the narrow extension.
P4A stays PARTIAL pending domain/DNS/provider human setup, outside this phase.

## Implementation contract and completed stages

1. Inspect mandatory sources, baseline and existing Task contracts.
2. Add durable configuration, delivery/read state, scoped APIs and worker.
3. Extend the canonical Task form and existing header.
4. Verify deterministic clocks, PostgreSQL concurrency/isolation and browser flows.
5. Run full regressions, audit source/staged changes, commit and synchronize only
   after all required checks pass. Current execution results are in TEST_EVIDENCE.md.

## Models and migration

Immutable additive `server/migrations/0007_task_reminders_notifications.sql` adds
`public.task_reminder` and `public.notification`. Migrations 0001–0006 are unchanged.
Existing Tasks gain no reminder defaults or notification backfill. Apply the reviewed
migration runner before starting this version; repeated runs verify checksums.
Both new tables enable RLS with no browser policies. Access uses the trusted backend.

TaskReminder: UUID `id`, `task_id`, constrained `offset_minutes` (1440/60/15),
`created_at`, materialized TIMESTAMPTZ `due_at` and `trigger_at`. Unique Task/offset
makes the maximum three presets a database invariant. A narrow database trigger
requires a timed deadline and valid Event zone and computes indexed schedules.
Task date/time and Event timezone updates atomically recalculate schedules. Removing
time atomically deletes the Task's reminder rows. Offsets survive other date/time edits.
No custom durations, recurrence, Task state, deletion API or new infrastructure.

Notification: UUID `id`, `event_id`, `recipient_user_id`, two constrained `kind`
values, `task_id`, nullable `actor_user_id`, typed title/date/time/timezone snapshots,
nullable `reminder_offset_minutes`, `due_at` and assignment `task_version`,
`created_at`, nullable `read_at`. Composite foreign keys enforce Task/Event and
recipient/Event membership. Snapshots preserve the meaning of already generated
history after a Task title/deadline changes; they contain no translated prose,
email address, arbitrary JSON payload, token or credential.

Unique partial indexes encode reminder identity (Task + recipient + due instant +
offset) and assignment identity (Task + recipient + version). Recent/unread indexes
support recipient/Event queries. Reminder scanning starts with indexed trigger/due
instants within the last 1440 elapsed minutes (the maximum approved offset) and
filters only eligible undelivered candidates, bounded to 100 per pass. Old/expired
schedule history lies outside the indexed scan window.

## Commands and personal delivery

Canonical Task DTOs include `reminderOffsets: number[]`, descending by offset.
POST omission means []; PATCH omission preserves configuration. Server validation
rejects unsupported values, duplicates, over-three lists, forged authority and
configuration on a date-only Task. Explicit PATCH removal of `deadlineTime` clears
configuration even if the draft supplied old offsets. Organizer-only authoring and
existing expectedVersion checks precede no-op handling. A meaningful reminder edit
increments Task version once, produces one existing `task.updated` ActivityEntry
and commits configuration atomically. Current-version no-op edits preserve metadata
and history; stale no-ops conflict. Acceptance, assignee and status are unchanged.

TASK_ASSIGNED is inserted inside the canonical Task creation/assignment transaction
when the new assignee's user differs from the acting Organizer. Self-assignment,
unassignment and same-assignee no-ops create no assignment notification. Reassignment
still clears acceptance through the existing command. Failed transactions produce
neither assignment changes nor their notifications. Existing notifications remain
personal history after reassignment. No delivery/read ActivityEntry is created.

TASK_DUE_REMINDER uses the currently assigned active member and active user while
holding Event and Task locks. Completed (`completed`), deleted and archived-Event
Tasks do not deliver. An unassigned Task is skipped; later assignment can catch up
before the deadline. Each recipient can receive the same schedule once, including
reassignment after the trigger; returning to an already notified recipient does not
repeat that identity. No acceptance prerequisite is added. Changing a deadline
creates a new schedule identity; reverting to an already delivered instant does not
repeat it. Reopening a completed Task can catch up while still before its deadline.

## Time, DST and worker lifecycle

Event `timezone` is the existing PostgreSQL/runtime validated IANA contract.
PostgreSQL `(deadline + deadline_time) AT TIME ZONE event.timezone` supplies the due
instant; offsets subtract elapsed minutes from that instant. Browser/server machine
timezones never interpret Task wall-clock values. DATE-only Tasks gain no invented
clock time. This does not alter the existing calendar-day attention/overdue model.

PostgreSQL resolves nonexistent spring-forward wall times with the pre-transition
offset (the resulting local time can move forward), and ambiguous fall-back times
with the post-transition offset (usually the later occurrence). Actual database
tests cover America/New_York 2026-03-08 02:30 → 07:30Z and 2026-11-01 01:30 → 06:30Z.
See https://www.postgresql.org/docs/current/datetime-invalid-input.html . Deployment
tzdata should remain maintained; stored schedules recompute on relevant edits.

One server worker starts at Fastify readiness. It scans immediately, then schedules
its next pass 30 seconds after the preceding pass finishes. Passes never overlap
within one process. Timers are unref'd; graceful close cancels the next timer and
drains any current pass before database shutdown. Coarse failure logging omits
content and secrets; the next pass retries durable candidates. Database uniqueness,
Task locking and live-state rechecks protect multiple server processes. An injectable
clock enables deterministic verification without sleeping for minutes/hours; there
is no browser-accessible clock/worker endpoint.

Catch-up window: trigger <= now < deadline. Restart before the deadline catches up
undelivered schedules. Deadline equality and past deadlines suppress delivery;
a server unavailable throughout the remaining window cannot deliver that reminder.
Worker backlog can add latency, especially beyond 100 eligible reminders per pass.
An instance that skips a locked Task can retry on its following pass.

## API and UI

- GET `/api/events/:eventId/notifications`: most recent 50, ordered createdAt/id
  descending, plus total unread count (including older rows) in one SQL snapshot.
- POST `/api/events/:eventId/notifications/:notificationId/read`: confirmed row;
  readAt is idempotent and server-owned.
- POST `/api/events/:eventId/notifications/read-all`: all own Event rows read.

Every call authenticates and requires active Event membership/user identity.
Writes enforce existing trusted-origin/CSRF conventions and accept no authority
payload. Foreign notification/user/Event IDs yield the project's denied/not-found
responses. Responses are no-store. No arbitrary browser notification creation API.

The existing header gains a quiet bell/count (99+ cap) and a bounded native dialog.
It supports loading, empty/error/retry states, explicit refresh and mark-all.
Opening the panel leaves read state unchanged. Opening a notification waits for
successful server read confirmation, then uses existing Task navigation. Failed
read writes keep unread state. Task/read snapshots are typed and validated;
real failures never substitute demo data. Event/user changes remount and cancel
pending requests to prevent stale responses from appearing in another scope.
Workspace load, panel opening and successful canonical workspace changes refetch
notifications. No client polling, realtime, sockets, SSE, push, browser permission,
service worker or Task email delivery is added. Existing local calendar clock ticks
are unchanged and issue no network requests. BG/EN render from the current language.
Reminder labels name the configured preset, not a false live countdown after catch-up.

Task authoring uses labeled checkboxes, disabled without a valid date/time, explanatory
BG/EN copy and explicit notice that time removal clears configuration. Members retain
receipt/read/navigation only. Existing Task conflict recovery preserves canonical
confirmed state; ordinary save failure retains the draft. Native modal keyboard
handling, Escape, focus restoration, headings, visible read labels and 44px controls
support accessibility. Existing theme tokens and reduced-motion behavior apply;
no formal accessibility certification or physical-device test is claimed.

## Verification, limits and competition obligations

Dedicated frontend/backend tests cover preset/DTO validation, API errors, origin/session
boundaries, localization and lifecycle. PostgreSQL tests cover persistence, uniqueness,
time removal, version/no-op/stale behavior, assignment/self-noise, read state, Event and
recipient isolation, delivery/restart/current recipient, completion/unassignment,
rescheduling, DST and two actual concurrent workers. Browser suite uses controlled
real accounts/Event and injectable worker clocks, retaining clearly synthetic test
Tasks/history; credentials/cookies remain in memory. Evidence artifacts stay in ignored
tmp/reminders-evidence. Full regression and final result counts are recorded separately.

No new dependency or asset: the existing license register and GPLv3 distribution
requirements apply. P1/P2/P3, Optional Due Time and visual hierarchy stay the regression
boundary. Dashboard attention, Change/Decision/Response/Plan B, invitation/verification/
recovery mail and all P4A provider settings remain unchanged.

The supplied 2025–2026 regulations require a finished software product, full source,
documentation/user guide, security, licensed resources, GPLv3, test accounts for each
role and online access (pages 1–2, 5, 11, 26). Their competition dates, categories,
submission/account/availability rules, defense timing and PDF format must be checked
against the actual later-year regulations. The master prompt's 15 September 2026
internal target is historical, not an official deadline for this phase.

## Changed files

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/BUDOGRAPH_TASK_REMINDERS.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TEST_EVIDENCE.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-invitations-ui.mjs`
- `scripts/verify-task-reminders-ui.mjs`
- `server/migrations/0007_task_reminders_notifications.sql`
- `server/migrations/README.md`
- `server/src/app.ts`
- `server/src/main.ts`
- `server/src/notifications/service.ts`
- `server/src/notifications/worker.ts`
- `server/src/routes/notifications.ts`
- `server/src/tasks/model.ts`
- `server/src/tasks/service.ts`
- `server/tests/notifications.integration.test.ts`
- `server/tests/notifications.test.ts`
- `server/tests/schema.integration.test.ts`
- `server/tests/task-authoring.test.ts`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/NotificationCenter.tsx`
- `src/components/TaskAuthoringForm.tsx`
- `src/components/notifications.css`
- `src/domain/taskReminders.ts`
- `src/domain/types.ts`
- `src/i18n/messages.ts`
- `src/i18n/notificationMessages.ts`
- `src/services/RemoteWorkspaceService.ts`
- `src/services/eventActions.test.ts`
- `src/services/notifications.test.ts`
- `src/services/notifications.ts`
- `src/services/taskActions.test.ts`
- `src/services/taskAuthoring.test.ts`
- `src/services/taskAuthoring.ts`
- `src/services/taskReads.test.ts`
- `src/services/workspaceViews.test.ts`

# Event Templates V1 - T2 source implementation

Subsequent real PostgreSQL acceptance and development activation are recorded in
[T2 activation evidence](BUDOGRAPH_EVENT_TEMPLATES_T2_ACTIVATION.md), dated
2026-10-17. The NOT RUN statuses below describe the original source-only handoff.

**Current owner acceptance: T2 HUMAN PASS — 6/6**, confirmed in the accepted
TLS/T1/T2 Git checkpoint request on 2026-10-17. T1 HUMAN PASS 6/6 and B.1 HUMAN
PASS remain preserved. This records the owner's acceptance; Codex did not repeat
the personal acceptance or run a live Apply during the source-control checkpoint.

## Files created and modified

Modified existing files (13):

- `docs/BUDOGRAPH_EVENT_TEMPLATES_T1.md`
- `package.json`
- `scripts/verify-template-preview-ui.mjs`
- `server/src/app.ts`
- `server/src/events/history.ts`
- `server/src/main.ts`
- `server/src/tasks/service.ts`
- `src/App.tsx`
- `src/hooks/useRemoteTasks.ts`
- `src/i18n/messages.ts`
- `src/pages/EventHistoryPage.tsx`
- `src/pages/StarterTemplatesPage.tsx`
- `src/services/eventHistory.ts`

Created files (24):

- `docs/BUDOGRAPH_EVENT_TEMPLATES_T2.md`
- `scripts/verify-template-application-ui.mjs`
- `server/migrations/0011_template_application_receipts.sql`
- `server/src/routes/templates.ts`
- `server/src/tasks/creation.ts`
- `server/src/templates/catalog.ts`
- `server/src/templates/history.ts`
- `server/src/templates/model.ts`
- `server/src/templates/service.ts`
- `server/tests/helpers/template-fixture.ts`
- `server/tests/helpers/template-isolated-db.ts`
- `server/tests/helpers/template-isolated-replay.ts`
- `server/tests/template-applications.integration.test.ts`
- `server/tests/template-applications.test.ts`
- `server/tests/template-history.test.ts`
- `server/tests/template-isolation.test.ts`
- `server/tests/template-routes.test.ts`
- `src/i18n/templateApplicationMessages.ts`
- `src/pages/templates/TemplateApplicationPanel.tsx`
- `src/pages/templates/application.css`
- `src/services/templateApplicationState.ts`
- `src/services/templateApplications.test.ts`
- `src/services/templateApplications.ts`
- `src/services/templateBlueprintParity.test.ts`

Date: 2026-10-16. Baseline HEAD: `3ba8852cc3592873b32a63f15b6d640ceebdb039`.

**T1 HUMAN PASS - 6/6, October 16, 2026** is recorded in the T1 document from the
owner's explicit T2 request. T2 source and safe technical validation are complete.
At this original source handoff, T2 human acceptance, shared migration and live
backend activation were **NOT DONE**; the later report and acceptance above supersede that status.
There is no claim of real PostgreSQL integration verification in this phase.

## What is implemented

The accepted T1 catalog, stable IDs, version 1, selection and calendar calculations
remain. The Organizer can request an authoritative review, inspect every proposed
Task, explicitly confirm adding it, submit one apply command, receive a confirmed
result and open Event Tasks or an individual created Task. All items start
unassigned, unaccepted, not started, version 1, with empty reminder configuration.
No existing Task, Change, acceptance, assignment or demo record is modified.

The UI warns that application adds Tasks, never replaces/merges/deletes existing
ones. Server review counts active matching names in the selected content language.
An intentionally separate application needs a new review and confirmation.
Selection/language changes invalidate the visible confirmation. The authoritative
review's Event metadata is shown explicitly; final execution rechecks its revision.
Member and archived Event reviews are read-only. No Event means no server review.

Review/apply have real loading/error/success/recovery states. Creation is never
claimed from local state. A network error, lost response, malformed result, 5xx,
unknown conflict or temporary endpoint/access failure preserves the original key
and exact request. The user explicitly recovers that operation. A definite stale
review rejection clears the review and requires a fresh one; a reused-key conflict
blocks submission and never generates a replacement key automatically.

After a confirmed response, the established workspace controller refreshes the
Event/Tasks. A failed refresh is displayed separately from successful creation.
Late responses after navigation preserve the unseen operation's recovery hint.
BG/EN, themes, keyboard controls, responsive cards and focus handling are retained.

## API contract

Both endpoints use the existing Better Auth session boundary, current active User,
same-Event membership, trusted Origin and Fetch Metadata checks. Both responses
are `Cache-Control: no-store`. Both accept a maximum 4096-byte body and no query
parameters. Unknown/additional fields and malformed identifiers are rejected.

`POST /api/events/:eventId/templates/preview`

```json
{
  "templateId": "international-aikido-seminar",
  "templateVersion": 1,
  "itemIds": ["team-briefing", "hotel-check-in"],
  "language": "bg"
}
```

Returns the authorized Event DTO, canonical template/version/ordered item IDs,
language, `items`, `matchingTaskCount`, `canApply` and `reviewRevision`. Each item
contains canonical title/category/context/priority, deadline, nullable local time,
empty reminder offsets, null assignee, false acceptance and not-started status.
Any active Member can review; only an active Organizer in an active Event gets
`canApply: true`. Foreign/inaccessible Event references return non-disclosing 404.
Invalid or out-of-range calendar results fail explicitly.

`POST /api/events/:eventId/templates/apply`, header `Idempotency-Key: <client UUID>`:

```json
{
  "templateId": "international-aikido-seminar",
  "templateVersion": 1,
  "itemIds": ["team-briefing", "hotel-check-in"],
  "language": "bg",
  "expectedEventVersion": 1,
  "reviewRevision": "<64 lowercase hexadecimal characters from review>",
  "confirmed": true
}
```

Returns HTTP 201 for first acceptance and exact replay:
`{eventId, operationId, templateId, templateVersion, itemIds, language,
createdCount, taskIds}`. Only identifiers, selection, content language and review
metadata are submitted. Browser-supplied titles, dates, priority, assignment,
acceptance or actor fields cannot turn this into arbitrary bulk Task creation.

Error codes include `INVALID_TEMPLATE_COMMAND`, `UNKNOWN_TEMPLATE`,
`UNKNOWN_TEMPLATE_ITEM`, `TEMPLATE_VERSION_CONFLICT`, `INVALID_TEMPLATE_DATE`,
`INVALID_IDEMPOTENCY_KEY`, `NOT_FOUND`, `FORBIDDEN`, `EVENT_ARCHIVED`,
`EVENT_VERSION_CONFLICT`, `TEMPLATE_REVIEW_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`.
Unexpected database errors use the existing sanitized 500 response.

## Authority and data model

`server/src/templates/catalog.ts` is an authoritative v1 snapshot of the accepted
T1 blueprint. Runtime backend modules do not import frontend modules. A parity
test compares every ID, field, relative offset, optional time and BG/EN text with
T1. This is curated static content, not a database of user-owned templates.

The backend uses its existing strict Task field parser and Gregorian Event date
validator. UTC calendar fields calculate day offsets; no 24-hour durations or
Event-instant conversions are used. Time remains a separate nullable HH:mm value.
Parity tests protect agreement with T1 across month/year/leap/DST dates and the
0001-9999 bounds. Existing scheduling semantics and notification worker stay intact.

The server hashes actor identity/membership/version, canonical Event state,
template selection/version/language, resolved item fields and matching active
Task identities/versions. The revision is an optimistic snapshot fingerprint,
following the existing Clear review precedent, not a bearer permission token.
Current authorization is always checked independently.

## Atomicity and idempotency

The apply path uses the existing `inTransaction` helper exactly once:

1. Take an actor/operation advisory transaction lock, in a T2-specific namespace.
2. Lock the destination Event `FOR UPDATE`, then active membership and User
   `FOR SHARE`, in the existing Event/Task lock order.
3. Recheck active Organizer and non-archived Event before receipt lookup.
4. If a receipt exists, require the same Event and canonical request digest and
   return its original outcome. A changed payload/key binding returns 409.
5. Otherwise recheck Event version and recompute the exact reviewed snapshot.
6. Insert all selected Tasks through `insertAuthoredTaskRecord`, shared with
   ordinary single-Task authoring. This primitive never opens a transaction.
   Existing single-Task validation, authorization, audit and notifications remain
   in their existing caller; regression tests protect their behavior.
7. Write normal `task.created` entries with template/item/operation provenance,
   and one Event-level `TEMPLATE_APPLIED` ActivityEntry.
8. Insert the immutable committed-result receipt, then COMMIT.

Any Task/reminder/History/receipt error rolls back the complete transaction. There
are no pending receipt rows, multiple public Task-create calls or partial success
responses. Event-exclusive locking stabilizes matching Tasks against existing
Task commands, which hold an Event share lock. Same-key advisory serialization
plus the receipt primary key prevents double commit across connections/processes.
The receipt is stored in PostgreSQL, so it survives a backend restart.

Recovery uses current authority. A revoked/inactive Member/User or archived Event
cannot retrieve an accepted receipt through this command. Exact accepted replay
survives later Event metadata/version changes while current authority and active
Event status remain valid. It reports original creation facts; subsequently edited
or removed Tasks are not recreated by replay.

History projects only bounded known template provenance. The UI shows template,
version and operation ID alongside ordinary Task creation entries and the aggregate
application entry. Existing History payload sanitization and Event scoping remain.

## Migration

Added **`0011_template_application_receipts.sql`** only. Migrations 0001-0010 are
unchanged. The new backend-only table contains actor User, operation UUID, Event,
curated template/version, SHA-256 request digest, accepted JSON outcome and server
timestamp. Primary key: `(actor_user_id, operation_id)`. Scoped foreign keys,
bounded result constraints, RLS without browser policies and an immutable receipt
trigger follow the existing receipt design. It does not alter existing receipt
tables or add template ownership/custom-template persistence.

The migration file is READY for isolated SQL validation and a separately approved
activation. It has **not** been executed against shared Supabase or a real isolated
PostgreSQL database in this task.

## Verification and evidence

| Check                                                             | Result                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Default frontend suite                                            | PASS - 319/319                                                        |
| Backend suite with `RUN_DATABASE_INTEGRATION=0`                   | PASS - 171; 27 integration tests SKIPPED                              |
| Frontend/backend TypeScript                                       | PASS                                                                  |
| ESLint                                                            | PASS                                                                  |
| Frontend build                                                    | PASS; >500 kB main-chunk warning remains                              |
| Backend build                                                     | PASS                                                                  |
| Changed T2 TS/TSX/CSS/JS/JSON/Markdown formatting                 | PASS                                                                  |
| Full frontend formatting                                          | FAIL - unchanged baseline `EventArchiveDialog.tsx`                    |
| `git diff --check`                                                | PASS                                                                  |
| T2 browser flow                                                   | PASS - 29 synthetic cases                                             |
| T1 browser regression                                             | PASS - 34/34                                                          |
| LOCKED interior comparisons                                       | PASS - 112/112 pixel-identical; 2 deliberate-change controls detected |
| Real PostgreSQL T2 integration/concurrency/fresh-process recovery | NOT RUN                                                               |
| Shared migration/live backend activation/live T2 persistence      | NOT RUN                                                               |
| Human T2/browser acceptance                                       | PENDING                                                               |

Backend unit/HTTP tests cover strict selections, roles/archive/isolation, calendar
boundaries, stale review, normal initial Task semantics, ActivityEntries, forced
Task/History/receipt failures, same-key replay/concurrent unit requests, payload
conflicts and service recreation. They use an explicitly labeled transactional
SQL double; they do not prove PostgreSQL SQL syntax, real rollback or lock behavior.
Frontend tests cover canonical response checks, safe transport, uncertainty,
scoped hints, duplicate clicks, navigation/recreation, stale/permission errors,
refresh failures, and bounded History provenance.

The browser suite intercepts **every API request**, running actual Fastify T2
routes, template service, History projection and transaction helper against the
SQL double. All other context is synthetic. It covers BG/EN/light/dark at
320/390/768/1440 px, review, explicit checkbox/keyboard confirmation, repeated
clicks, success/Task navigation/refresh, Member/archive, zero selection, stale
review, revoked permission, offline review, lost response/reload recovery, definite
key conflict, refresh failure, separate application/duplicate warning and traceable
History links. No API requests reached shared state; no page errors/unexpected
requests were recorded. Screenshots were visually inspected; no horizontal overflow.
Physical devices, screen-reader audit and Firefox/Safari are NOT RUN.

Evidence under ignored `tmp/templates-t2/`:

- `frontend-tests.txt`, `backend-tests.txt`
- `browser/report.json`, `review-{width}-{language}-{theme}.png`,
  `success-{width}-{language}-{theme}.png`
- `t1-regression/report.json`
- `locked-protection/report.json` and original-baseline comparisons
- `preservation.json`

Safe reruns: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm server:typecheck`,
`pnpm build`, `pnpm server:build`. Run backend tests with
`RUN_DATABASE_INTEGRATION=0`. Browser scripts use the already installed bundled
Playwright/Chromium paths through `BUDOGRAPH_PLAYWRIGHT_MODULE` and
`BUDOGRAPH_BROWSER_EXECUTABLE`; no dependency installation is required.

### Isolated SQL test guard

`server/tests/template-applications.integration.test.ts` is skipped unless
`BUDOGRAPH_T2_ISOLATED_DATABASE_URL` is explicitly supplied. It never reads
`DATABASE_URL`, `.env`, Supabase configuration or the shared integration flag.
Before any write it requires a loopback URL, database name
`budograph_t2_isolated_<suffix>`, no URL query overrides, and
`BUDOGRAPH_T2_ISOLATED_DB_CONFIRM=<database-name>:DISPOSABLE`. A read-only identity
query then checks the actual database name and server address. Nonlocal, ambiguous
or unconfirmed targets fail before writes. No safe isolated database was available
here, so this test was NOT RUN.

For a separately provisioned disposable database only, it runs the migration
runner, creates owned fixtures, checks real concurrency/rollback/initial values/
History/receipt count, and replays through a fresh Node process. It leaves disposable
fixtures for inspection and never cleans shared state. Do not substitute shared
Supabase credentials to make this test pass.

## Preservation and concurrent work

At T2 start, 28 expected modified/untracked files were fingerprinted. Six have
intentional T2 extensions: App integration, message composition, test registration,
StarterTemplatesPage, T1 browser notice expectation and T1 acceptance record.
The remaining 22 are byte-identical, including all TLS work, T1 catalog/date engine/
selection helpers/styles, B.1 acceptance and pre-existing changelog/evidence/logs.
No competing edits were observed in T2-owned files; no reset/clean/reformat of
unrelated work occurred. Frontend/backend listener PIDs remained 27776/27372.

No shared database connection, migration, provisioning, cleanup, account change,
Task application or B.1 record edit was performed by T2 validation. Existing
Event Management Stages 1-7 LOCK records and Duplicate/Archive/Clear services are
unchanged. TLS configuration, auth behavior, reminder worker, Changes/Decision/
Response/Plan B and unrelated branding are preserved. No commits/push/deployment,
AI/n8n or T3 work occurred. Builds only produced ignored local output.

## Activation requirements - NOT EXECUTED

The currently running backend predates T2. Its process was not restarted; live
T2 preview/apply endpoints are not activated. Existing Vite can display source
changes through HMR, but that does not imply backend persistence is available.
Until activation, a live Review request may report the endpoint unavailable.

A future, separately authorized activation must:

1. First run the isolated PostgreSQL suite against a confirmed disposable database.
   Resolve any SQL/locking failures before shared activation.
2. Verify the intended shared target and existing verified TLS configuration, with
   migration authority, without printing credentials. Review the unchanged 0001-0010
   checksums and the new 0011 file.
3. Run the existing migration CLI with the same approved environment inputs. For
   the repository's existing development environment-file convention, the command is:

   ```powershell
   node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/scripts/migrate.ts
   ```

   Expected with migrations 0001-0010 already applied: **1 applied, 10 already applied**;
   an immediate repeat must report **0 applied, 11 already applied**. These are
   expected future results, not results observed in this task. Do not run this
   command without separate authorization for the intended database.

4. Build the backend (`pnpm server:build`) and perform one separately authorized
   backend replacement using its approved verified-TLS environment/launch setup.
   The compiled entry is `server/dist/src/main.js`. No Vite restart is required
   for the existing development HMR session. Production deployment is separate.
5. Verify read-only health/current identity, then use a newly owned synthetic T2
   Event for authorized application checks. Never use the accepted B.1 Event as
   an application fixture. Confirm History, same-key replay and absence of extra Tasks.

## Proposed T2 human acceptance checklist

After the above activation, using a new synthetic T2 Event:

1. Select two items, review exact Event/title/category/priority/date/time/empty
   reminders/unassigned/unaccepted state; zero selection cannot proceed.
2. Confirm explicitly and add once. Verify exactly two new Tasks, normal initial
   values, refreshed views and working created-Task links.
3. Verify normal Task creation entries plus the template application entry and
   matching template/version/operation in History.
4. Repeat/recover the same key after a controlled lost response: original result,
   no extra Tasks. A changed payload with that key must conflict.
5. Confirm Member/archive/revoked access denial and fresh review after Event change.
6. Check BG/EN, light/dark, keyboard and phone layout; separately starting another
   application must warn about matching names and require new confirmation.

At the original source handoff, T2 HUMAN PASS had not been recorded. The owner
subsequently confirmed all six checks as recorded at the top of this document.

## Limits and provenance

No private saved templates or persisted template catalog (T3). No assignment
mapping, reminders or template authoring. The current catalog/version is v1 only.
Matching-name warnings are language-specific, not semantic duplicate detection.
Recovery hints use sessionStorage with an in-tab memory fallback; closing the tab,
clearing storage or reloading with storage blocked can lose the client-side hint.
The server receipt remains durable; preserve the displayed operation ID for
investigation if the browser cannot retain it. No successful Tasks/outcomes/auth
credentials are stored as fake browser persistence.

Supplied NOIT 2025-2026 originality/licensing/source/documentation/test-account and
evaluation requirements remain historical references. Actual 2026-2027 categories,
deadlines, team/availability/documentation/evaluation rules still require verification.
T1/T2/T3 are internal product stages. No new dependencies or assets were added;
authored source/catalog/CSS remain within the project's GPL-3.0-only license.

AI assistance/change log: Codex implemented the owner-approved T2 source,
transaction-aware Task primitive, routes/receipt migration, review/recovery UI,
localized History provenance, tests and this report. Existing uncommitted
CHANGELOG/AI_ASSISTANCE_LOG/TEST_EVIDENCE TLS entries were preserved byte-for-byte;
this stage-local record contains the T2 change/test/limitation log. Owner review
and T2 human acceptance were pending at that handoff and are now recorded PASS above.

## Original source-handoff status snapshot — historical

| Required status             | Result                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| T1 HUMAN ACCEPTANCE         | PASS - PRESERVED                                                          |
| T2 SOURCE IMPLEMENTATION    | COMPLETE                                                                  |
| BACKEND PREVIEW             | PASS (unit/HTTP/browser double)                                           |
| ATOMIC APPLY                | PASS (transaction unit tests); PostgreSQL NOT RUN                         |
| IDEMPOTENCY                 | PASS (unit/browser recovery); real PostgreSQL concurrency/restart NOT RUN |
| DATABASE MIGRATION FILE     | READY                                                                     |
| SHARED DEV MIGRATION        | NOT RUN                                                                   |
| LIVE BACKEND T2 ACTIVATION  | NOT RUN                                                                   |
| BROWSER T2 ACCEPTANCE       | PENDING                                                                   |
| T2 HUMAN ACCEPTANCE         | PENDING                                                                   |
| EVENT MANAGEMENT STAGES 1-7 | PRESERVED                                                                 |

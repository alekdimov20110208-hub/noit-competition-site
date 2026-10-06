# BudoGraph P3A — Change records and impact mapping

Date: 2026-10-05. Authorized continuation from locked baseline
`3c28c20c36c8c69a75ebe6cbfa9bd3e0cd6abc15`. P1/P2A/P2B/P2C and Auth remain locked.
The user's detailed P3A request approves this problem, scope, model, flows,
architecture and verification strategy. This is the locked P3A contract;
[P3B](BUDOGRAPH_P3B.md) adds authored Decision, Response and Plan B without changing
P3A impact/authorization/Task semantics. Its additions supersede this document's
historical P3B-not-implemented statements.

[P3C](BUDOGRAPH_P3C.md) connects canonical Dashboard reads and clarifies the same
Change detail/list. It supersedes the historical disconnected-Dashboard boundary
below without changing this locked model, live impact or authorization contract.

## Inspection and established contracts

React/Vite/TypeScript, BG/EN, existing theme tokens and BudoSelect are preserved.
Fastify is a modular monolith with Better Auth database-backed HttpOnly sessions,
PostgreSQL, `pg`, immutable SQL migrations and no ORM. Event is the security
boundary; EventMember's ORGANIZER/MEMBER access role is authoritative, while
operational role is descriptive. ActivityEntry is append-only business history,
not event sourcing. Task assignment, acceptance and status remain independent.

Inspection found three details to preserve rather than replace:

- The shell already had a `/changes` placeholder labeled Plan B. P3A renames
  that one existing destination to Changes / Промени, reusing its existing icon.
  No navigation item, typography change or sidebar redesign is added.
- Task deadline is currently a required finite PostgreSQL DATE. P3A leaves that
  schema/authoring rule intact. The impact DTO tolerates null deadlines, but no
  current Task can be authored without a deadline.
- Existing Task/Event commands check version before no-op handling and preserve
  version/history for a current no-op. Change commands follow this contract.
  A meaningful successful edit increments once; a stale no-op still returns 409.

The historical local prototype's `EventChange` model includes future response
concepts. It is not reused for live Changes. The validated `RemoteChange` DTO
follows the existing separation between legacy Task views and remote Task data.
The locked Dashboard continues consuming its existing snapshot, without new P3
data or changed composition. Its historical unavailable-response copy is retained;
the dedicated Changes route is the current source of Change records. Templates
and legacy response prototype data remain outside the authenticated P3A flow.

## Domain and database

An Event-scoped Change records a real operational change: title, context, reporter,
optional response owner, current integer version and server timestamps. It has no
severity, priority, state/lifecycle, due date, comments, attachments or deletion.

Immutable migration `0004_event_changes.sql` adds:

| Table          | Fields and constraints                                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_change` | Server UUID; `event_id`; bounded nonempty title (200); context (5000); `created_by` EventMember; nullable `response_owner_member_id`; version >= 1; finite created/updated instants; unique `(event_id,id)`; composite same-Event creator/owner FKs. |
| `change_task`  | `(event_id,change_id,task_id)` primary key; composite FKs to Change and Task make duplicates and cross-Event links impossible in SQL. No operational snapshots.                                                                                      |

Event/time and inverse Task-link indexes support list/detail reads. Both new tables
enable RLS without browser policies, matching existing application conventions.
No unrelated Supabase/RLS advisor changes or previous migration edits are made.
Backend deployment privileges remain the existing documented hardening work.

## API, authorization and transactions

| Route                                          | Behavior                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events/:eventId/changes`             | Active same-Event Member or Organizer; newest recorded first; `{ changes }`.                                        |
| `GET /api/events/:eventId/changes/:changeId`   | Active same-Event membership; canonical `{ change }` with current Task impact.                                      |
| `POST /api/events/:eventId/changes`            | Active same-Event Organizer; `{ title, context?, responseOwnerMemberId?, affectedTaskIds? }`; 201 `{ change }`.     |
| `PATCH /api/events/:eventId/changes/:changeId` | Active same-Event Organizer; supported authored subset plus required `expectedVersion`; 200 canonical `{ change }`. |

No DELETE route. Omitted creation context is empty, owner is null, links are empty.
UUIDs normalize to lowercase; affected IDs deduplicate/sort into a canonical set.
Requests are bounded to 64 KiB / 1000 supplied Task IDs. Unknown fields, NUL and
malformed Unicode are rejected. Client actor, timestamp, scope and role properties
are never accepted. UUID SQL arguments and authored text are parameterized.

Authentication precedes protected handlers. Transactions use the existing
Event → active identity/membership → Change lock order; role/active checks remain
locked through commit. Owner selection checks an active same-Event membership
and identity. Selected Tasks must be current, nondeleted and same-Event, locked
in ID order. Inaccessible scope/resource is a non-disclosing 404; authenticated
Member writes and archived writes are 403. Invalid references produce fixed 400
field codes without exposing foreign records. Cookie writes require exact trusted
Origin and reject cross-site Fetch Metadata. Protected responses are no-store.

Create atomically stores Change, owner, links and `CHANGE_CREATED` history. Edit
locks the Change, checks expectedVersion before writes, atomically replaces authored
fields/owner/link set, increments once and appends `CHANGE_UPDATED`. Structured
history contains changed before/after fields and versions, with server actor/time.
Any write/validation/history failure rolls back the entire command. Stale writes
return `409 CHANGE_VERSION_CONFLICT` without partial fields, links or activity.
SQL errors never cross the existing sanitized error/log boundary.

## Current impact and responsibility

A single SQL statement projects each Change and its current nondeleted linked
Tasks, avoiding inconsistent multi-query Task/assignee snapshots. Each Task exposes
id, title, status, current assignee summary and unchanged `YYYY-MM-DD` deadline.
The server derives Task count, unique current assignee summaries sorted by ID,
and distinct ordered current dates. Unassigned Tasks contribute no person.
The response owner contributes no affected person unless also a Task assignee.
Historical inactive assignee names follow existing canonical Task behavior.

Response ownership never grants access, assigns/accepts a Task, or changes Task
status, version or deadline. Task changes never rewrite Change authorship/owner.
There is no response-owner acceptance lifecycle. Active owners are validated when
supplied; existing historical references remain readable, as with Tasks. If an
owner becomes unavailable, the form labels that state and requires an active
selection or clearing when saving the full authored draft.

Task reassignments and deadline/status edits appear on the next Change read.
Shared date formatting preserves Event-local DATE and locale-aware BG/EN output.
No realtime, polling, duplicated deadline cache or automatic impact inference.

## UI and flows

`/events/:eventId/changes` is a chronological operational list, not a card grid.
Rows show title, concise context, recorded time, response owner and Task count.
`/events/:eventId/changes/:changeId` shows what changed/reporter/time, independent
response ownership, derived people/dates and linked Tasks with current status,
assignee and deadline. Task links open the unchanged existing Task drawer.

Organizers record/edit in a focused inline form with labeled title/context,
BudoSelect owner and native checkbox Task selection including responsibility,
deadline and status context. Zero-Task Events support zero-impact Changes. Members
have read-only empty/detail/list states without create/edit controls. Pending
controls prevent duplicate submissions. Errors stay generic and drafts remain in
memory. A 409 focuses/announces a conflict, retains the draft and blocks save until
the user explicitly loads canonical state, reviews and saves again. A lost write
response is not automatically retried; verify latest state before retrying.

Durable routes support direct URLs, refresh, login return and back/forward.
Event switching keeps Changes but drops the previous Change ID. Requests abort
on route/identity teardown and scope remounts prevent former-Event rendering.
Explicit refresh and nonediting focus/online events refetch; no timers poll.

All new copy is localized. Existing theme tokens supply both themes. New CSS is
scoped to `.page--changes`, including names also used by Dashboard. Mobile reflows
detail/Task facts into full-width sequential content. Semantic headings/definition
lists, label/error association, native keyboard checkboxes, existing BudoSelect
keyboard handling, focus return, Escape cancellation and 44px controls are used.
No new modal/dialog focus trap is required. This is not formal certification.

## Work stages and verification

1. Inspect locked contracts and mandatory sources; record discrepancies.
2. Add migration, service/routes and model/API/real PostgreSQL checks.
3. Add validated remote adapter, routing/localization and list/detail/forms.
4. Verify real browser Organizer/Member/invitation/task interactions and responsive
   states; compare locked content and short-height sidebar.
5. Run standard formatting, lint, typecheck, tests/build, migration rerun,
   security/staged-secret audit; document executed results before commit/push.

Focused unit tests distinguish transport doubles from database evidence. Existing
serial integration suites remain enabled only for approved development/test
PostgreSQL (`RUN_DATABASE_INTEGRATION=1`). Constraint/atomicity fixtures use final
rollback. The independent-connection concurrency test commits and retains its
synthetic fixture so both editors can see it; it never edits existing records.
Browser-created development records/history are intentionally retained. Do not run
browser writes alongside integration suites that take table locks. Browser runtime
is external, following existing verifiers; no dependency/lockfile change is needed.
Exact executed counts/results and limitations are in [TEST_EVIDENCE](TEST_EVIDENCE.md).
After the complete `pnpm.cmd test:browser:changes` run has retained a real Change
with two affected Tasks, `pnpm.cmd test:browser:changes --read-checks` reuses
existing data to verify BG/EN Light/Dark text contrast and associated validation
focus. Its explicitly intercepted failed-save cases retain/announce the in-memory
draft without creating a Change or replaying a command. Neither mode saves auth
artifacts. Configure the same external browser runtime as the existing verifiers.

Security review covers Event/Change/Task/owner IDOR, active membership/identity,
Organizer-only authoring, expectedVersion, parameterized SQL, server actor/time,
no raw DB/log secrets and unchanged invitation/session protection. Formal external
security, screen-reader, physical-device, Firefox/Safari and usability audits remain
separate; production hosting/grants and backup rehearsal remain existing work.

## Competition-year boundary

The complete master prompt and supplied 30-page regulations were read. The supplied
2025–2026 framework requires a completed independent product, source, documentation,
user/setup guides, role test accounts, licensed assets/GPLv3 and online access.
Team size, categories, eligibility, schedule, availability period, PDF formatting
and 20/25/35/20 rubric must be checked against the actual participation year's
official rules. No 2026–2027 currency or legal compliance is claimed. The master
prompt's 15 September 2026 deadline is internal, not an official competition date.

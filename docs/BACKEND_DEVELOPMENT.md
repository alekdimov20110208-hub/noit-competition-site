# Backend P1, P2A, P2B, P2C, P3A, P3B and P3C Development

## Stage 7 Clear operation — LOCKED, 2026-10-15

The project author confirmed **HUMAN PASS — 6/6 on 2026-10-15** at implementation
`c83e4a3123e64ea95c9fc95f912c99472e46a09f`. Technical/shared integration PASS;
see the [FINAL LOCK RECORD](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_7.md#final-lock-record).
The following runtime/migration results are previously recorded evidence. This
documentation-only task makes no database connection, migration/code/test change,
new product verification or service restart. Stages 1–6 remain preserved; no later
stage is authorized.

Additive `0010_event_clear_receipts.sql` is applied to the configured development
PostgreSQL database (1 new / 9 existing). Old SQL/checksums stay immutable. No
startup migration, database reset or business DELETE is added. Shared main now
runs the reviewed implementation after exactly one authorized backend-only reload;
the final migration rerun reports 0 applied / 10 already applied. Backend 7156
runs without watch; shared Vite/PostgreSQL remained running. Live/ready are HTTP 200. Direct shared HTTP/browser and real registered reminder-worker checks pass.
All original business/history/accounts and fresh-baseline sessions are preserved;
the original 88/89 session discrepancy remains a documented author-approved
exception with cause unestablished. That security qualification remains binding
after Human Acceptance and LOCK.

Organizer-only `GET /api/events/:eventId/tasks/clear-preview` returns canonical
Event data, counts and a SHA-256 scope revision. `POST
/api/events/:eventId/tasks/clear` requires UUID `Idempotency-Key` and only
`{ expectedVersion, confirmationName, scopeRevision }`; bounded 200 outcome
includes the accepted Event, operation UUID and cleared/completed/Change/reminder
counts. Canonical exact name and current scope are server-enforced. Safe errors:
400 invalid, 401 session, 403 role/lifecycle/Origin, 404 inaccessible scope,
409 Event/Task-set/key/version-limit conflict. Responses use no-store.

Actor/key advisory serialization precedes exclusive Event lock, current identity/
membership SHARE locks and deterministic active Task locks. Nonempty soft
removal increments Event once and every affected Task once; all updates, removal
activities, Event summary and immutable receipt share one transaction/timestamp.
Exact accepted replay retains the original outcome and never clears later Tasks.
Current empty scope writes only a durable zero receipt. Worker Event-first locks
and current eligibility prevent later deliveries; configuration/notifications stay.
Changes retain removed links through subsequent editing, exposing bounded
historical references separately from live impact. Active members may use
`GET /api/events/:eventId/task-history/:taskId` for retained read-only Task context.
It grants no active editing or new access. Existing History availability rules stay.

New browser scripts use owned runtimes/controlled synthetic Events. Stage 7
regression host overrides only loopback configuration; writer catalogs are
confined to newly created fixtures. Credentials, sessions, environment files and
screenshots are never committed. See the Stage 7 report for actual gates.

## Stage 6 Archive Event — TECHNICAL PASS, 2026-10-14

Apply additive `0009_event_archive_receipts.sql` after 0008; never edit applied
SQL/checksums. It was applied once from the prepared checkout (1 new / 8 existing).
Shared main now contains the reviewed migration; main rerun is 0 applied / 9 existing.
The recorded authorized reload started backend PID 29068 without watch while
Vite 26668/PostgreSQL stayed running. These PIDs are historical observations;
this documentation task makes no current-runtime check. Another reload requires new approval.

`POST /api/events/:eventId/archive`, UUID `Idempotency-Key`, body
`{ expectedVersion, confirmationName }`, returns `200 { event }`. Active identity
and active same-Event Organizer membership are rechecked transactionally; non-owner
Organizers qualify. Exact case-sensitive name equality has no trimming/normalization.
Advisory actor/key lock precedes Event UPDATE and membership/identity SHARE locks.
Archive/version, one immutable ActivityEntry and receipt commit atomically. Exact
replay reauthorizes before receipt lookup and alone bypasses stale version. Fresh
current-version archived commands are no-ops; stale requests conflict. Personal
notification read state remains allowed; operational writes remain forbidden.

`node --run test:browser:event-archive` owns isolated factories/Vite at 5174 by
default. `BUDOGRAPH_ARCHIVE_DIRECT=1` targets shared 5173/3001; full direct run
passed 14 groups/28 layouts + one stress, plus six supplementary HTTP groups and
unmodified Stage 1–5 critical scripts. `BUDOGRAPH_ARCHIVE_SKIP_MATRIX=1` permits
focused repeats after complete matrix evidence. Do not run browser writes alongside
serial PostgreSQL tests; retain synthetic history and prefer rollback fixtures.
The full reviewed PostgreSQL suite passed 157 results. See [Stage 6 report](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_6.md)
for scope, evidence and limitations. The author confirmed HUMAN PASS — 6/6 on
2026-10-14; Stage 6 is LOCKED. Stage 7 is NOT STARTED; no Stage 7 API exists.

## Event Management Stages 4 + 5

Apply additive `0008_event_command_receipts.sql` explicitly with `pnpm db:migrate`
before starting this source. Prior migrations, dependencies and environment remain
unchanged. Existing Create/Edit APIs keep their approved semantics.

`POST /api/events/:eventId/duplicate` requires current active Better Auth identity,
active source Organizer (archives permitted), trusted Origin/Fetch Metadata and
`Idempotency-Key: <UUID>`. Strict body: `name`, `startDate`, `endDate`, `timezone`,
`expectedVersion` (source). Only reviewed target basics are inserted; requester
owns the fresh Event and its sole Organizer membership. No operational rows copy.

Actor/key serialization precedes source Event/membership/identity locks. Source
authorization always precedes receipt lookup; accepted replay additionally requires
current destination Organizer access. Initial/replay returns accepted `201 { event }`,
no-store, with no repeat effects. Different payload/scope: `409 IDEMPOTENCY_KEY_REUSED`;
fresh stale version: `409 EVENT_VERSION_CONFLICT`. Effects, creation provenance and
immutable receipt commit/rollback together. Receipt RLS has no browser policies;
raw requests/secrets are not stored and no expiry/purge is introduced. See
[the combined report](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_4_5.md).

`pnpm test:browser:event-duplication` verifies real PostgreSQL/session/factory
requests, forwarding only Duplicate POSTs to an owned loopback backend by default.
`BUDOGRAPH_DUPLICATE_DIRECT=1` uses shared backend/Vite after precisely authorized
reload; `BUDOGRAPH_DUPLICATE_SKIP_MATRIX=1` runs targeted direct integration after
the full matrix. `BUDOGRAPH_EVIDENCE_DIR` selects new ignored evidence. Stage 6/7
endpoints do not exist.

Final Stage 4 + 5 direct integration passed after exactly one owner-authorized
shared-backend reload: Duplicate 13 groups and History 8 groups, both without a
bridge or repeated matrices. Backend liveness/readiness and Better Auth pass;
Vite, configuration, original PostgreSQL records and sessions are preserved.

## Event Management Stages 2 + 3

No migration or environment/dependency change is required. Existing Event writes,
Task and Change commands remain canonical. `GET /api/events/:eventId/history`
requires a valid active Better Auth session and active same-Event membership,
including for archived Events. It returns minimized `{ eventId, entries,
nextCursor }`; reads are no-store and there is no history-write endpoint.

`before` is the last loaded ActivityEntry UUID, resolved only in the same Event.
Unknown/duplicate parameters, malformed IDs and missing/foreign cursors are rejected;
unauthorized Events return non-disclosing 404. One parameterized SQL statement
combines authorization and a 51-row bound, returns at most 50 records and orders
by exact PostgreSQL `(created_at DESC, id DESC)` using the existing index.
No timestamp is round-tripped through JavaScript for the cursor.

Actor identity, target ID, action and actual stored versions are preserved. DTOs
omit raw payloads, emails and coordination prose; they expose only recorded changed
field names, status and presence changes. Actor names and target titles are current
joins, explicitly identified in UI. Existing deleted/unavailable targets keep IDs
without offering broken workflow links. History and current-state tables are not
rewritten; ActivityEntry's existing append-only trigger remains unchanged.

`pnpm test:browser:event-history` uses real PostgreSQL/Auth/Fastify factories.
`BUDOGRAPH_HISTORY_DIRECT=1` verifies the normal shared backend through Vite;
the default narrow owned loopback bridge permits source verification while an
existing shared process is unchanged. `BUDOGRAPH_EVIDENCE_DIR` selects a new
ignored output directory. The existing original locked PNGs are never regenerated.
See [Stage 2 + 3](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_2_3.md) for actual results.

## Profile V1

No new migration or environment variable is required. `/api/auth/update-user`
permits only a validated display name; `/api/auth/change-password` requires the
current password and forces old-session revocation/new current cookie. Both
require an active authenticated user, explicit trusted mutation origin and safe
Fetch Metadata. Responses omit Better Auth's bearer token/full user. Existing
logger allowlists never include request bodies. The concurrent command guard
is per process. See [Profile V1](BUDOGRAPH_PROFILE_V1.md) for exact contracts.
Run `pnpm test:browser:profile` with the controlled ignored development inputs;
the browser suite restores name/password through supported API operations.

## Optional Task due time — 2026-10-08

Apply immutable additive `0006_task_deadline_time.sql` before starting this backend.
It preserves required deadline DATE values and adds nullable local `TIME(0)`;
there is no default/backfill. Canonical Task/Change affected-work reads return
`deadlineTime` as strict `HH:mm` or null. POST omission means null; PATCH omission
preserves time and explicit null removes it. Authoring validates on the server,
retains Organizer-only authority, expectedVersion/no-op/409, one atomic history row
and acceptance/status. Event timezone already exists; day-based urgency/order stay
unchanged. Task time changes derive into live Change impact without Change writes.
See [feature contract](BUDOGRAPH_TASK_DUE_TIME.md), rollback-only PostgreSQL coverage
in `task-deadline-time.integration.test.ts`, and real authenticated
`pnpm.cmd test:browser:task-deadline-time`. P4A external setup remains out of scope.

## P4A email and account safety — 2026-10-06

See [BUDOGRAPH_P4A.md](BUDOGRAPH_P4A.md) for environment names, human Resend/DNS setup,
trusted origins, retries, existing-user transition and rate limits. Production
requires Resend; deliberate mail-disabled development preserves controlled accounts.
No migration or dependency change is needed. `pnpm server:test:integration` with
the existing database opt-in verifies Better Auth/PostgreSQL using fake mail.
`pnpm test:browser:account-safety` verifies UI fixtures using externally supplied
Playwright. Automated tests must never send real mail or use real provider keys.

## Current P3C Dashboard reads — 2026-10-06

The client shared Event snapshot composes existing scoped Event, Task, member and
Change reads. There is no new Dashboard endpoint or migration. The validated
canonical Change DTO stays separate from Task/Team presentation adapters.
Authorization/session failures clear the protected snapshot; unavailable or invalid
Change reads leave Task/Team data usable with explicit P3 retry messaging, never
a fabricated empty list. Existing cancellation/revision guards reject late reads
from a previous Event. Dashboard reentry refreshes without polling.
It does not automatically replace confirmed Task data while a failed command
refresh requires the existing explicit recovery flow.

Deterministic personal attention uses current membership and P3 authored presence,
not authorization changes, Task mutation or stored lifecycle. See [P3C](BUDOGRAPH_P3C.md).

## Current P3B response state — 2026-10-05

Apply immutable `0005_change_response.sql` using `pnpm db:migrate`, then verify
an unchanged rerun. Six nullable Change columns preserve existing P3A data/links/
owners with safe empty response state. No new table or direct browser policy.
Restart a nonwatch backend after updating source. The existing POST/PATCH accepts
`decision` (text up to 2,000), `response` and `planB` (text up to 5,000), or null.
Omission on PATCH preserves each field; supplied text must be nonblank after trim.
Canonical responses include Decision author/server timestamps and Response/Plan B.

Active Organizer alone authors; response-owner Member remains read-only. One
required expectedVersion covers P3A and P3B together. State/version/history commit
atomically; current no-op retains all, stale writes return 409. P3B activity uses
presence before/after to describe add/change/clear without duplicating prose.
Task state remains live in impact and unaffected by authored response edits.
Two-connection concurrency and rollback tests are in `change-response.integration.test.ts`.
Run the existing Changes browser verifier separately from DB integration suites.
No AI, execution, email, polling or dependencies. See [P3B](BUDOGRAPH_P3B.md).

## Current P3A Changes — 2026-10-05

Apply immutable `0004_event_changes.sql` using `pnpm db:migrate`, then rerun to
verify metadata recognition. New `event_change` and `change_task` tables retain
existing composite Event FKs, indexes and RLS conventions. Never edit previous
migrations or reset development data. Restart the backend so its Changes module
is registered; Vite reload alone cannot update a backend started without watch.

The four Event-scoped Change list/detail/create/patch endpoints require active
membership for reads and ORGANIZER authoring. ExpectedVersion, owner/Task validation,
atomic activity and current-state impact follow [the P3A contract](BUDOGRAPH_P3A.md).
No ORM, auth/session/origin change or new dependency is introduced. P3B extends
the response boundary as described above. Subsequent descriptions retain their phase scope.

Run `pnpm test:browser:changes` with existing ignored development account inputs
and external Playwright/browser paths. Run it separately from enabled PostgreSQL
integration suites. Real development browser records/history are intentionally
retained; rollback-only database fixtures disappear. Current execution evidence
belongs in TEST_EVIDENCE, not inferred from a script's existence.

## P2C invitations and onboarding — 2026-10-04

Apply the new immutable `0003_event_invitations.sql` using `pnpm db:migrate`.
Existing applied migration files are unchanged. The table has Event/User foreign
keys, unique SHA-256 token hashes, pending Event/email indexing, finite timestamps,
paired acceptance fields, exclusive accepted/revoked states, an accepted-User
membership FK and RLS without browser policies. It contains no raw bearer token.

| Route                                                        | Boundary                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /api/events/:eventId/invitations`                      | Active same-Event Organizer; only `{ email }`; 201 with safe invitation and one-time development path.                 |
| `GET /api/events/:eventId/invitations`                       | Same-Event Organizer only; pending/expired safe DTOs; never tokens or hashes.                                          |
| `POST /api/events/:eventId/invitations/:invitationId/revoke` | Same-Event Organizer; empty body; pending only. Repeat revocation is idempotent.                                       |
| `GET /api/invitations/:token`                                | Minimized public bearer lookup; only valid context/email/expiry, otherwise terminal state or generic invalid response. |
| `POST /api/invitations/:token/register`                      | Valid pending invitation, trusted Origin, logged out; only `{ name, password }`. Email comes from the locked row.      |
| `POST /api/invitations/:token/accept`                        | Active authenticated matching canonical stored email; empty body; atomic membership/consumption/history.               |

Email uses trim/lowercase and the ASCII syntax compatible with pinned Better Auth
`z.email()`; provider aliases are preserved. Tokens use Node `randomBytes(32)` /
base64url and SHA-256. Server lifetime is seven days, checked using PostgreSQL time,
including again at consumption. Events lock before invitation rows; this serializes
duplicate creation, acceptance and revocation. Existing inactive membership is never
restored. Independent active membership is preserved, with no role changes. New rows
hardcode MEMBER and the existing neutral empty operational role. Repeat acceptance
by the same active identity returns the Event without duplicate membership/history.

`invitation.created`, `invitation.revoked` and `invitation.accepted` use server
actor/time and invitation IDs with empty payloads. Commands and activity commit or
roll back together. Better Auth registration is a **separate auth transaction**:
the private server API instance uses the same factory/schema, allows server-only
`signUpEmail`, disables auto-sign-in, and never exposes its HTTP handler. The ordinary
auth instance still disables signup; both instances block its HTTP path. Only the
valid-invitation service calls the private API. An account may remain after joining
fails, expires or is revoked; no false membership/acceptance is recorded. The user can
sign in and retry if the invitation remains valid. Better Auth alone owns credentials.
The registration response is generic and exposes no account-existence endpoint.

Cookie/Origin/Fetch Metadata protections are preserved. New endpoints use no-store
and no-referrer; HTML also suppresses referrers. Backend whitelist serializers and
Vite proxy-log redaction omit bearer URLs. Proxy/access logging in deployment must
likewise redact invitation paths. Rate limiting is bounded in memory (120 invitation
requests/minute/IP, five registrations/minute/IP); scaling needs shared storage.

`RemoteWorkspaceService.invitations` provides the domain transport. Transient Team
controllers cancel stale Event/identity requests and discard links on close/switch/
logout. Recipient routing bypasses the protected workspace and uses strictly
allowlisted, query-free invitation return paths. Acceptance mounts the existing
workspace at the joined Event, which reads accessible Events and the real roster.
There is no polling, auth/token persistence, sample-task creation or demo fallback.

Email delivery is not configured. `delivery: development_link` and the one-response
relative path are explicitly labelled; no email-sent claim exists. If a create response
is lost, refetch pending invitations; revoke/recreate if its link was lost. Links cannot
be retrieved from their hashes. Run `pnpm test:browser:invitations` with the documented
ignored auth inputs and Playwright/Edge paths. Database integration suites run serially
because their rollback-only constraint fixtures take table locks. Run database and
browser write verifiers separately. See [P2C evidence](BUDOGRAPH_P2C.md).

Run only one backend on port 3001. For a stable verification run, stop any existing
backend watch manager and use
`node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/src/main.ts`
without `--watch`; keep the Vite frontend running. Competing watch managers can
restart the backend between login/session checks. Normal development can use the
single `pnpm server:dev` watch process after verification.

## P2B Task authoring — 2026-10-04

`POST /api/events/:eventId/tasks` accepts `{ title, category?, context?, deadline,
priority, assignedMemberId? }`, returns 201 `{ task }`, and requires active same-Event
ORGANIZER membership. Omitted category/context default to empty text; omitted
assignee defaults to null. `PATCH /api/events/:eventId/tasks/:taskId` accepts any
subset of title/category/context/deadline/priority plus required `expectedVersion`,
returning canonical 200 `{ task }`. Unknown fields are rejected. Assignment,
acceptance, lifecycle, scope, actors, timestamps, IDs and raw version never become
generic edit inputs. Existing dedicated commands remain authoritative.

Text is trimmed, bounded (title 1–200/category 0–100/context 0–5000), and validated
for NUL/lone surrogates. Category is free text, not a new enum. Context remains
optional. Deadline is a strict real `YYYY-MM-DD` calendar string, years 0001–9999;
preparation tasks may precede Event start. Priority is normal/important/critical.
Invalid authoring fields or an unavailable/foreign/inactive initial assignee return
safe 400 field codes. Missing session returns 401, Member authoring/archived writes
403, foreign/missing scope 404, stale version 409. Cookie writes use the existing
exact trusted-origin/Fetch Metadata guard and parameterized SQL.

One existing transaction pins Event, active User/actor membership and initial
assignee through commit. Server UUID/actor fields and schema defaults produce
version 1, `not-started`, null acceptance and server instants. `task.created`
records title/category/deadline/priority/initial assignee/taskVersion once; no
duplicate assignment entry is added. Edits lock the Event-scoped Task, check
version before no-op handling, update only authored columns, increment exactly
once and append `task.updated` with changed-field before/after values and versions.
Task/history commit or roll back together. Detail edits preserve acceptance;
reassignment/unassignment alone retain the existing acceptance-clear semantics.

RemoteWorkspaceService and the shared controller own authoring, cancellation,
safe error mapping and canonical Event refresh. Form drafts retain their original
version across background reads. 409 recovery loads latest details and requires
explicit save; failed recovery blocks saving. A lost write response is refetched,
never replayed automatically. Failed refresh marks the snapshot as needing
explicit recovery. Confirmed response data may remain visible, marked for refresh.
Same-Event navigation that cancels a pending form also requires recovery; changing
Event/identity clears former data and cancels its requests. No demo fallback exists.

`pnpm test:browser:task-authoring` runs real controlled Organizer/Member flows;
`RUN_DATABASE_INTEGRATION=1` enables rollback-only PostgreSQL authoring fixtures.
No migration, ORM or runtime dependency was added. No Task deletion, invitations,
Event archive/delete, Changes/Plan B, dependencies, realtime, Templates/Budget/AI
or membership management is implemented by P2B.

## Current P2A Event commands and navigation — 2026-10-03

`POST /api/events` accepts exactly `{ name, startDate, endDate, timezone }` and
returns 201 `{ event }`. `PATCH /api/events/:eventId` accepts those four fields
plus a required `expectedVersion` and returns canonical 200 `{ event }`.
Only an active same-Event ORGANIZER may edit; any authenticated active User may
create. Owner, membership ID/access role, actors, IDs, timestamps and version
come from the server. There is no global Organizer account type.

Name is trimmed and bounded to 1–200 characters; NUL and malformed Unicode
surrogates are rejected safely while valid emoji are accepted. Dates are strict real calendar
strings `YYYY-MM-DD` (years 0001–9999), with end >= start, stored as PostgreSQL
DATE. Runtime IANA validation and the existing database timezone function must
both accept the timezone. Raw numeric offsets are rejected. Cookie commands use
the existing exact trusted-origin/Fetch Metadata guard; SQL is parameterized.

One pinned transaction locks the active creator and inserts Event, creator's
active ORGANIZER EventMember and EVENT_CREATED ActivityEntry. It inserts no
tasks and imports no development fixture. Editing locks Event and active actor
membership/User in the P1 lock order. A changed update and EVENT_UPDATED history
commit together; payload contains only changed before/after fields and versions.
Matching-version no-op edits preserve timestamp/version/history. Stale versions,
including stale no-ops, return 409 EVENT_VERSION_CONFLICT. Archive writes remain
denied. Foreign membership returns 404 and same-Event Member edits return 403.

`GET /api/events` still filters active memberships and Users. Safe DTOs now include
version and created/updated ISO instants alongside fields/archive/membership.
`RemoteWorkspaceService` adds focused list/get/create/update Event operations.
The existing controller owns selection and all scoped reads; canceled/revision
checks prevent prior Event work from publishing after a switch or identity change.
Event commands settle a pending workspace read/task refetch before writing; new
focus reads coalesce so prior metadata cannot overwrite a canonical successful edit.
No polling, browser auth storage, demo fallback or second data architecture exists.

Workspace paths are `/events/:eventId/dashboard`, `/events/:eventId/tasks` and
`/events/:eventId/team`; task details retain `?task=...`. `/events/new` and
`/events/:eventId/edit` provide the narrow forms. Login return paths are allowlisted.
The shell switcher preserves the page, discards task-detail IDs, and exposes create;
edit appears only for the current Event's real ORGANIZER membership. Zero Events
exposes create, one resolves directly, and multiple Events are explicitly switchable.
Fresh Event Tasks are empty and Team has only the creator; no bootstrap is needed.

409 recovery refetches canonical Event details and requires explicit save. A failed
conflict refetch disables saving until **Load latest details** succeeds. Field,
session, permission, missing-resource and connection errors remain safe/localized.

`pnpm test:browser:events` runs the controlled real-account P2A verifier.
Existing P1 browser verifiers preserve their checks with Event-scoped assertions.
See TEST_EVIDENCE.md for executed results and intentional development Events.
No migration or dependency was added in P2A. Task authoring is now P2B above.
Invitations are now implemented through P2C above.
**EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED;
CHANGES/PLAN B NOT YET IMPLEMENTED.** Later descriptions are historical P1 scope.

P1A establishes the TypeScript/Fastify runtime, typed configuration, PostgreSQL
pool, health checks, shutdown handling, and explicit SQL migration runner. P1B
adds Better Auth **1.7.7**, PostgreSQL-backed email/password sessions, controlled
development-account provisioning, the core relational schema, and server-side
authentication and Event authorization helpers under the approved
[Backend Foundation Contract](BUDOGRAPH_BACKEND_FOUNDATION_CONTRACT.md).

P1C adds explicit development Event bootstrap, task reads, Organizer assignment,
assignee acceptance/withdrawal, authorized status updates, optimistic concurrency
and atomic immutable activity history. P1D.1 connects browser authentication.
P1D.2A connects Tasks reads to PostgreSQL; P1D.2B connects task responsibility commands.
P1D.3 connects Dashboard and Team to the same real Event/member/task snapshot.
Verification results are in
[TEST_EVIDENCE.md](TEST_EVIDENCE.md); this guide is not a test report.

## Prerequisites and commands

Use Node.js **22.x from 22.18.0, or 24.0.0 and later**, and the repository-declared
**pnpm 11.9.0**. Git is needed by secret-ignore regression tests. Native Node.js
TypeScript stripping runs source commands; no `tsx`, `ts-node`, or `dotenv` is
added. Install dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

In Windows PowerShell, use `pnpm.cmd` if shell execution policy prevents `pnpm`.

| Command                             | Purpose                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm server:dev`                   | Watch the native TypeScript runtime.                                                                         |
| `pnpm server:start`                 | Start compiled runtime after `server:build`.                                                                 |
| `pnpm server:typecheck`             | Check backend source, scripts, and tests.                                                                    |
| `pnpm server:test`                  | Run focused tests without a real PostgreSQL database.                                                        |
| `pnpm server:build`                 | Compile runtime/scripts into ignored `server/dist/`.                                                         |
| `pnpm db:migrate`                   | Apply reviewed versioned SQL to the approved configured database.                                            |
| `pnpm server:auth-schema`           | Generate review SQL using the pinned official CLI into ignored `tmp/`; never apply it.                       |
| `pnpm server:provision`             | Explicitly provision two controlled accounts; development only.                                              |
| `pnpm server:verify-auth`           | Verify real sign-in, sessions, logout, and protected routes using configured controlled accounts.            |
| `pnpm server:bootstrap-event`       | Explicit development-only Event, two memberships and one task; repeatable, no passwords required.            |
| `pnpm server:verify-responsibility` | Real two-session HTTP responsibility loop, committed development history and rollback-only foreign fixtures. |
| `pnpm server:test:integration`      | Opt-in PostgreSQL schema and responsibility commands using rollback-only fixture transactions.               |

Root `typecheck`, `test`, and `build` retain frontend scope; `lint`, `format`, and
`format:check` also include backend files. Backend checks do not establish a
passing frontend regression run. Results belong in test evidence.

## Configuration and secret handling

For a new setup, copy the placeholder example once and edit locally:

```powershell
Copy-Item -LiteralPath server/.env.example -Destination server/.env
```

Do not overwrite an existing configured file. Replace placeholders using the
approved development database. Real `.env` and `.env.*` files are ignored;
`.env.example` is the only committed example exception. Never commit database
URLs, auth secrets, account passwords, cookies, or session tokens. Ignore rules
do not remove secrets already tracked in Git.

Commands load `server/.env` through Node.js `--env-file-if-exists=server/.env`;
existing process environment variables take precedence. Keep controlled-account
credentials in an ignored local environment file or process environment. Do not
put passwords in command-line arguments or shell history, screenshots, or test
evidence. CLI output identifies account labels and results without credentials.
This P1B development setup keeps generated auth/account values in ignored
`server/.env.p1b.local`, loaded by the provisioning and auth-verification commands.
`server:dev` and `server:auth-schema` also load that optional development file.
The existing `server/.env` remains the database setup boundary. `server:start`
does not automatically load the development credential file; configure auth
values in its environment or explicitly include the file for a local compiled
development run.

| Variable                                                                                | Contract                                                                                                                                                                         |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                              | `development`, `test`, or `production`; default `development`. Provisioning requires `development`.                                                                              |
| `HOST`                                                                                  | Listener IP/hostname; default local-only `127.0.0.1`.                                                                                                                            |
| `PORT`                                                                                  | Integer `1`–`65535`; default `3001`.                                                                                                                                             |
| `DATABASE_URL`                                                                          | Valid PostgreSQL URL with host/database and no placeholder. Required for runtime and real database commands.                                                                     |
| `BETTER_AUTH_SECRET`                                                                    | Required for auth runtime/provisioning/verification. Use a cryptographically generated high-entropy secret, at least 32 characters; no whitespace or placeholders. Never log it. |
| `BETTER_AUTH_URL`                                                                       | Explicit HTTP(S) origin, e.g. `http://127.0.0.1:3001` locally; no credentials, path, query, or fragment. Production requires HTTPS.                                              |
| `BUDOGRAPH_ORGANIZER_EMAIL`, `BUDOGRAPH_ORGANIZER_PASSWORD`, `BUDOGRAPH_ORGANIZER_NAME` | Provisioning/verification inputs only; not required for server startup.                                                                                                          |
| `BUDOGRAPH_MEMBER_EMAIL`, `BUDOGRAPH_MEMBER_PASSWORD`, `BUDOGRAPH_MEMBER_NAME`          | Separate controlled account inputs; emails must differ. Passwords must be 16–128 characters.                                                                                     |

Typed `readDatabaseEnv` serves migration/schema commands without requiring an
auth secret; `readServerEnv` adds validated auth configuration. Invalid values
fail with static messages naming fields without echoing their contents. Secret
validation cannot prove entropy; generation must use a cryptographically secure
source. Raw environment reads stay at configuration/provisioning boundaries.

Use a least-privilege runtime PostgreSQL role and separate migration/setup
credentials where practical. The Supabase auth/business tables enable RLS with
no public policies: direct API access by `anon`/`authenticated` is denied. The
trusted PostgreSQL backend connection currently needs owner/bypass access;
dedicated least-privilege role grants remain a deployment hardening task.
HTTPS, backups, and restore procedures require operational verification.

## Runtime and module boundaries

The backend remains a modular monolith in `server/`, independent of the Vite app.
`src/app.ts` is the Fastify factory; `src/main.ts` validates config, creates one
pool and auth instance, starts the listener, and handles signals. `shutdown.ts`
closes HTTP before PostgreSQL and shares an idempotent cleanup operation.

`src/auth/auth.ts` configures Better Auth; `src/auth/session.ts` extracts the small
application identity; `src/routes/auth.ts` forwards HTTP auth requests and serves
the protected diagnostic. Controlled account logic is in
`src/auth/development-accounts.ts`, invoked only by `scripts/provision.ts`.
`src/authorization/events.ts` owns membership lookup and Event authorization,
separate from generic authentication.
`src/db/migrations.ts` owns persistent schema changes.

The existing `pg.Pool` boundary has maximum 10 connections, a 5-second connection
timeout, and 30-second idle timeout. Readiness uses `SELECT 1` with a 5-second
query timeout. Business values are parameterized and membership queries include
Event scope. No application ORM, generic repository framework, or policy engine
is added. Better Auth internally uses its packaged relational adapter; that does
not make Kysely a direct BudoGraph dependency.

ESM source imports use `.ts`; TypeScript rewrites relative imports to `.js` for
compiled execution. Builds exclude tests. Node's WHATWG Request/Response/Headers
types require `DOM`/`DOM.Iterable` libraries in the backend TypeScript config.
`skipLibCheck` accommodates Better Auth's distributed declaration import of
`bun:sqlite`; application source remains strict, with no Bun dependency or fake
declaration shim. From the repository root:

```sh
node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/dist/src/main.js
```

Fastify logs whitelist safe request method/status fields and static error
messages. Better Auth diagnostics and telemetry are disabled. Never log raw
errors, request URLs/bodies, authorization headers, cookies, or DB connection
details. Clients receive sanitized errors rather than PostgreSQL errors or stacks.

## Authentication and HTTP boundary

The runtime enables Better Auth email/password authentication with database-backed
sessions, an explicit secret/base URL, and no social providers, MFA, Admin plugin,
custom hashing, or parallel credential/session system. The User `active` boolean
is a Better Auth additional field with `required: true`, `defaultValue: true`,
and `input: false`; public user input cannot establish activity or permission.
A supported session-creation hook checks the derived User ID against PostgreSQL
and denies new sessions for inactive/missing users. Existing sessions are denied
at the application identity boundary after User deactivation.

| Route                          | Boundary                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `GET /api/health/live`         | Public liveness, no database query.                                              |
| `GET /api/health/ready`        | Public PostgreSQL readiness; safe `503` on failure.                              |
| `GET`, `POST /api/auth/*`      | Better Auth login, session inspection, logout, and supported core auth requests. |
| `POST /api/auth/sign-up/email` | Disabled HTTP path; arbitrary public account creation is unavailable.            |
| `GET /api/me`                  | Valid session and active User required; safe identity only, `401` otherwise.     |

`/api/me` returns only `{ user: { id, name, email } }`. Generic helpers call
Better Auth `auth.api.getSession` using `fromNodeHeaders`; cookie caching is
disabled and the session query also requests a database lookup. No application
code manually parses authentication cookies. Session/account/password internals
are excluded from the application identity.

The Fastify adapter constructs a native `Request` using the configured origin
rather than a client-controlled Host, forwards headers/method/body, and preserves
response status/body/headers. `Set-Cookie` values are obtained with
`Headers.getSetCookie()` and forwarded as an array, preserving distinct cookies.

Cookies are HttpOnly and SameSite=Lax; Secure is enabled for configured HTTPS or
production. Production URL validation requires HTTPS. Better Auth origin/CSRF
checks remain enabled. Production trusted origins contain only the configured auth origin.
P1B did not connect a browser client on another origin, so it added neither
`CLIENT_ORIGIN` nor `@fastify/cors`. Separate-origin browser integration must
later configure one explicit origin consistently in CORS and Better Auth,
with credentials enabled and no wildcard origin.

Better Auth rate limiting is enabled with in-memory storage and its library
defaults. The adapter replaces `x-budograph-client-ip` with Fastify's direct peer
IP; client-supplied forwarding headers cannot set the rate-limit identity.
Proxy trust and distributed rate limiting need review before proxy/production
deployment. This is a focused security foundation, not a security certification.

## P1D.1 browser authentication path

Use the existing configured backend (`pnpm server:dev`) and Vite (`pnpm dev`) in
separate terminals. Browse `http://127.0.0.1:5173/login`. Vite dev and preview use
strict port 5173 and proxy `/api/*` to `http://127.0.0.1:3001`, retaining the browser
Origin. Better Auth adds exactly `http://127.0.0.1:5173` to trusted origins only in
development. No Origin rewrite, CORS package, wildcard, cookie parsing or CSRF
disablement is used. Custom backend ports/origins require an explicit matching
Vite configuration. Production must serve frontend and `/api` at the configured
HTTPS auth origin; a real reverse proxy/hosting setup is not delivered here.

The existing pinned official `better-auth/client` owns sign-in and sign-out
commands. API shapes were checked against the
[tagged 1.7.7 client documentation](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/concepts/client.mdx),
[tagged basic usage](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/basic-usage.mdx),
current [session documentation](https://better-auth.com/docs/concepts/session-management)
and [security guidance](https://better-auth.com/docs/reference/security), then
against the installed implementation. The React full-session hook retains a
session object, so the app instead obtains only `{ id, name, email }` from the
existing database-backed `/api/me`, with `Cache-Control: no-store`. No session token enters application React
state, localStorage, sessionStorage or URLs. Cookies remain server-controlled,
HttpOnly and SameSite=Lax, with Secure for HTTPS/production as before.

`AuthBoundary` mounts before `App`: loading shows a session-check state, `401`
shows Login, and a validated identity allows the existing shell. Protected
destinations use `/login?returnTo=...`; only existing workspace paths and one
canonical task query are accepted, preventing external redirects/Login loops.
Authenticated Login replaces history with that destination (default `/`).
Server-confirmed logout clears identity and replaces the route with `/login`.
Failed logout retains identity and shows a retryable, generic message.

Focus, visibility, online, link navigation and popstate trigger coalesced session
rechecks without polling. An invalid session clears identity and unmounts the
workspace, showing a session-ended notice. Transport/server/malformed identity
errors fail closed. Revision guards stop an older check from restoring identity
after logout. Login prevents duplicate submissions, supports normal autofill
semantics and keyboard submit, and never displays raw backend errors.

**Historical P1D.1 separation:** that stage connected identity only. P1D.2A,
described below, now connects Tasks reads. Dashboard/Team still use the local
fictional workspace implemented by `useWorkspace`.

Run `pnpm test:browser:auth` with the existing ignored controlled account inputs,
backend and Vite running. It uses Playwright from an existing verification
runtime; no application dependency is added. When it is not locally resolvable,
set `BUDOGRAPH_PLAYWRIGHT_MODULE` to the absolute Playwright `index.mjs` path and
`BUDOGRAPH_BROWSER_EXECUTABLE` to an installed browser executable. These are
tool paths, not secrets. Reports/screenshots go to ignored `tmp/p1d-evidence/`;
the script saves no trace, HAR, storageState, cookies or session dump and prints
only checks/account labels. It respects the real sign-in limiter.

For the actual unavailable-backend check, stop only the development backend,
leave Vite running, and run `pnpm test:browser:auth --backend-unavailable`, then
restart the backend. That mode uses synthetic invalid form inputs and saves a
separate report. PostgreSQL integration still requires explicit
`RUN_DATABASE_INTEGRATION=1`; its default command otherwise skips database suites.

## P1D.2A remote Tasks reads (historical stage)

The deliberate data-mode split is:

| Experience           | Current data path                                   |
| -------------------- | --------------------------------------------------- |
| Login/authentication | Real Better Auth / PostgreSQL                       |
| Tasks reads          | Real `RemoteWorkspaceService` / HTTP / PostgreSQL   |
| Dashboard            | Existing LocalDemoWorkspaceService (`useWorkspace`) |
| Team                 | Existing LocalDemoWorkspaceService (`useWorkspace`) |

No local data migration, whole-workspace replacement or demo fallback occurs.
The legacy local hook/reducer/storage remain unchanged. `useRemoteTasks` mounts
the independent read controller only on Tasks. It coalesces reads, aborts on
leave/logout/account change, rejects stale responses, and clears rows while
reloading or after a failure. Entry/refresh, focus/visibility, online and retry
refetch server data; there is no realtime or server polling. Minute clock updates
only update Event-calendar deadline timing.

New `GET /api/events` returns `{ events: [{ id, name, startDate, endDate,
timezone, membership: { id, accessRole } }] }`. Its parameterized query joins the
session-derived active User to active, non-deactivated EventMember rows. Dates
are formatted in SQL, and the response uses `Cache-Control: no-store`. No owner
credentials, emails, session data, Event authoring or switcher are added.
Zero Events is a valid empty result; one selects automatically. Multiple Events
temporarily select earliest `startDate`, then UUID, independent of response order.
Archived Events remain readable under the existing P1C policy. The chosen ID is
neither persisted nor an authorization mechanism.

Existing `GET /api/events/:eventId/tasks` additionally returns minimal `members`
summaries `{ id, name, role }` for live-task assignees in the same Event transaction.
Inactive historical assignees remain named. This is assignment display context,
not a Team API or permission source. Task DTOs now also expose existing
`blockedBy`/`blocks` text. Detail and mutation DTOs retain canonical metadata;
mutation routes and workflow semantics are unchanged. No migration/dependency
was added. Server authentication/active membership/task scope remains authoritative.

The adapter projects server rows into existing Task fields: `ownerId` from
`assignedMemberId` (empty display ID when null), `acknowledged` from `accepted`,
unchanged lifecycle/priority/date strings, and server `updatedAt`. Its remote
model also retains `assignedMemberId`, `acceptedByMemberId`, `acceptedAt` and
integer `version` for P1D.2B. Names and operational roles come only from the scoped
response; current access role comes only from authenticated Event membership.
Malformed DTOs fail closed. React does not interpret raw database rows.

Loading keeps the existing Tasks structure with unknown counts and no stale rows.
Empty Event/account messages never show fake tasks. Errors are sanitized and
retryable; 403/404 stay in the authenticated app. A 401 clears auth immediately
through the existing P1D.1 boundary, invalidating outstanding identity checks and
returning to Login with the session-ended notice. P1D.2A left drawer controls read only;
P1D.2B now connects them as described below.

Run `pnpm test:browser:tasks` using the same Playwright/browser configuration as
the auth verifier. It needs the ignored `server/.env` database configuration and
controlled credentials in `server/.env.p1b.local`, backend and Vite. It uses
independent browser contexts, read-only SQL comparison, and a deliberately
different local task sentinel. Loading/empty/500/403 are explicitly intercepted
test cases; expiry is an actual revoked backend session followed by a real 401.
No task workflow mutation is sent; cleanup signs out only its own sessions.
Ignored evidence is under `tmp/p1d2-evidence/`; no HAR/trace/storageState/cookie jar
or session dump is saved. The PostgreSQL suite remains opt-in and rollback-only.

## P1D.2B task responsibility UI (historical stage)

The existing drawer now uses the unchanged P1C assignment, acceptance and status
routes. `RemoteWorkspaceService` exposes `assignTask`, `acceptTask`,
`withdrawTaskAcceptance`, `updateTaskStatus`, the shared command transport and
scoped `refreshTasks`. Bodies contain only the command field plus `expectedVersion`.
No browser-derived actor/timestamp is sent. Canonical response projection retains
server assignment, acceptance, version, status and update time.

The read controller coalesces duplicate actions and suppresses overlapping focus
reads while a command/refetch is pending. Before response it preserves confirmed
content; after response it applies only canonical task data and refetches the same
Event's membership, tasks and assignment candidates. Navigation/logout abort and
revision guards reject late former-user responses. Refetch never selects a different
Event. Unavailable canonical reads mark stale state and block further writes until
explicit reload; inaccessible membership clears the workspace. Every error is safe
product copy. A 401 clears existing auth; 400/403/404 and server/network failure
never fall back to demo data. A 409 refetches and asks the user to review and act again;
commands are never automatically replayed.

`GET /api/events/:eventId/members` requires a session and active same-Event
membership. Its transaction reuses the P1C Event/identity authorization locks and
returns `{ members: [{ id, name, role }] }`, with inactive memberships/Users excluded.
It returns no emails, auth User IDs, accounts, credentials or sessions. Names/roles
are display fields; only member UUIDs identify assignment targets. Existing task
reads still include names for historical inactive assignees. This is assignment
context only, not Team integration. Event discovery adds safe `archived` state to
hide all writes to archived Events; current member ID/access role remain separate
from authentication identity. The backend rechecks every permission/version.

Task cookie mutations now share authentication's explicit trusted-origin helper:
the configured auth origin, plus exactly `http://127.0.0.1:5173` in development.
Missing/foreign Origin and cross-site Fetch Metadata remain denied. Production
never adds the development origin. No CORS wildcard or forwarded-header trust is
introduced. This is required for the existing same-origin Vite proxy browser flow.

Run `pnpm test:browser:task-actions` with the existing controlled account and
Playwright/browser environment. The verifier drives independent real sessions,
UI commands, a real stale 409 and read-only PostgreSQL/activity queries. Specific
validation/permission/resource/server/network/pending and failed-refetch transports
are explicitly identified test interceptions. A read-only synthetic second row
checks failed-refresh recovery across drawers; no command targets that row and no
database task is created. It retains append-only activity and
leaves the single controlled task assigned to Member, unaccepted, `not-started`.
Credentials come only from ignored configuration; no HAR, trace, storageState,
cookie jars or session dumps are saved. Ignored evidence is in `tmp/p1d2b-evidence/`.
There is no realtime/polling, activity UI, task authoring, migration or new dependency.
Dashboard and Team keep their original demo data and visual output.

## P1D.3 shared real Dashboard, Tasks and Team

Authenticated workspace data mode is **Dashboard REAL / Tasks REAL / Team REAL**.
`App` now mounts one existing `useRemoteTasks` controller for the authenticated
workspace lifetime, not separately per route. `RemoteWorkspaceService` reuses
`GET /api/events`, scoped tasks and scoped active members; the member endpoint is
read for both Organizer and Member. Each logical snapshot reads each endpoint once.
Core page navigation shares that snapshot; loading/refetch, cancellation, revision
guards, 401 auth clearing and safe errors remain explicit. No second data layer,
server endpoint, database table, migration or dependency was introduced.

The service retains `teamMembers` as merged task-assignee name context, including
historical inactive assignees, and adds `activeMembers` for Team/pressure/counts.
Organizer assignment candidates use the same active result. Members receive no
assignment affordance. Only ID/name/operational-role display fields are projected;
role descriptions never infer authority. `workspaceViews.ts` maps the safe Event
fields and real tasks to existing selectors; membership/access fields stay out of
Dashboard/Team presentation models. Task DTO parsing continues to fail closed.

The temporary initial selection is earliest accessible start date, then UUID.
All pages use that one current Event. Focus/online/retry and command refetch keep
its ID pinned and revalidate membership; if it disappears, the read fails rather
than switching. A full browser refresh resolves again. No stored Event UUID,
name/email inference, Event switcher or authoring was added. Archived Events remain
readable under existing policy, with task writes disabled.

Dashboard reuses task-completion, lifecycle counts, deterministic attention ordering
and Team pressure selectors. Event Overview uses stored name/DATE values/timezone.
Guest/location/status are unsupported in P1 and show restrained absence instead of
fabricated status or fictional identity. Timeline reuses date-first rendering,
real upcoming task deadlines and Event date boundaries (elapsed/current/future
classification from the Event-local calendar). DATE strings never pass through UTC
as instants. The minute clock only recalculates timing, not network reads.

**Changes/Plan B persistence: NOT YET IMPLEMENTED until P3.** `toWorkspaceView`
returns no Changes and marks their source unavailable. The existing ChangeImpact
region shows absence of recorded responses; no ActivityEntry-derived fake Changes
or activity-feed endpoint is added. The Plan B and Templates routes use truthful
unconnected states so they cannot reintroduce fictional task links. Navigation and
the locked core layouts remain intact. `useWorkspace`, demo factories, reducers and
legacy fixture pages remain available to explicit tests/development tooling, while
the normal authenticated application does not instantiate them or touch its old
workspace localStorage key. Preferences remain separately browser-local.

Dashboard/Team provide loading, no-Event, empty, safe retryable error and authorization
states. 401 clears the existing auth boundary. A failed task command refetch retains
confirmed content with an explicit stale-data warning on Dashboard/Team and the
existing Tasks recovery controls. Successful refetch updates the shared snapshot.
Generated cross-page links reference only loaded Event task IDs and retain existing
drawer, disclosure, history, scroll and focus restoration behavior.

Run `pnpm test:browser:workspace` with the same ignored controlled credentials,
Playwright module/browser paths, backend and Vite used by existing verifiers.
It compares real Organizer/Member reads and UI to safe read-only SQL, poisons the
old local fixture, checks shared requests, links/history/focus, refresh, real revoked
sessions, and explicitly labelled loading/empty/500/403 transports. No business
mutation requests, cookie dumps, HAR, trace, storageState or credentials are saved.
Ignored evidence is under `tmp/p1d3-evidence/`. Preserve the auth, Tasks read/action
and opt-in rollback-only PostgreSQL suites. **P1D.3 REAL WORKSPACE: PASS; P1 CORE
COMPLETE: YES.** All acceptance and preserved regressions passed; this does not
imply P2/P3 or production readiness.

## Controlled development accounts

After migrations, set the six controlled-account inputs locally and run:

```sh
pnpm server:provision
```

Only the development CLI creates a provisioning auth instance; it calls Better
Auth's supported `auth.api.signUpEmail` server API. The public runtime retains
`disableSignUp: true`; the HTTP sign-up path is disabled even on the provisioning
instance. `autoSignIn: false` avoids provisioning sessions. Better Auth owns
credential creation and password hashing. No public provisioning route exists.

The script reports `created` or `already-exists` for each label and does not
reset existing passwords. Rerunning with different passwords will not rotate
them; verification needs the actual credentials. Organizer/Member labels do not
grant global auth roles. Permissions come only from an EventMember's scoped
`access_role` after explicit Event setup.

Email verification, recovery, invitation UI, and real user onboarding are outside
P1B. These two accounts are controlled development identities, not a complete
competition jury-account package. The separate P1C bootstrap explicitly creates
permanent development memberships. Provisioning never imports the localStorage demo.

## Core relational schema

Auth IDs remain Better Auth-managed text identifiers. Business IDs are UUIDs
generated by server code with `node:crypto.randomUUID()`; migrations assume no
UUID extension or database generation function. UUIDs do not grant permission.

| Table                                                    | Stored boundary and invariants                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth `user`, `session`, `account`, `verification` | Library-generated core schema for 1.7.7, including configured `user.active`; persistent sessions and credentials remain library-owned.                                                          |
| `event`                                                  | Name, start/end DATE, IANA timezone string, owner User, nullable archive instant, version >= 1, server timestamps; end >= start and no global unique name.                                      |
| `event_member`                                           | Event/User, ORGANIZER or MEMBER access role, descriptive operational role, active/deactivation state, version/timestamps; unique Event/User and Event-scoped IDs.                               |
| `task`                                                   | Event-local deadline DATE; lifecycle/priority enums; descriptive category/context/blocker/consequence; nullable assignee/acceptance; scoped actor and soft-delete metadata; version/timestamps. |
| `activity_entry`                                         | Event, authenticated User/optional matching scoped member, action/target, JSONB payload, and server created instant; no mutable version or updated timestamp.                                   |

Task statuses are `not-started`, `in-progress`, `blocked`, and `completed`;
priorities are `normal`, `important`, and `critical`. Titles must be nonempty.
Composite foreign keys keep assignee, accepted member, and task actors in the
same Event. Acceptance fields are both null or both populated, current accepted
member equals current assignee, and unassigned tasks cannot retain acceptance.
Acceptance remains independent from lifecycle status.

Event and deadline DATE values represent calendar dates in the Event timezone,
never accidental UTC-midnight timestamps. Business audit/activity timestamps
use TIMESTAMPTZ real instants; generated auth column types follow Better Auth.
The frontend's fictional snapshot clock does not enter real database records.

No history-destroying cascades are introduced for business records. Activity
history is append-only: one narrow statement trigger rejects UPDATE, DELETE,
and TRUNCATE with SQLSTATE `55000`. There is no event sourcing. The schema does not
replace server authorization or all transactional invariants: P1C commands reject
inactive assignees, validate targets in Event scope and combine task/history/version
checks atomically. Future membership/ownership commands must keep the owner an
active ORGANIZER and resolve open work before deactivation. There is no activity-edit API.

## Authentication and Event authorization

`getAuthenticatedUser` returns a frozen safe identity or null;
`requireAuthenticatedUser` denies absent/invalid/inactive sessions with `401`.
Event authorization separately resolves membership from trusted User identity
and the requested Event using parameterized, Event-scoped SQL. Active User comes
first, then active EventMember, then explicit ORGANIZER/MEMBER access checks.

Operational-role descriptions never grant access. Foreign Event/member IDs,
client role fields, actor fields, and UUID knowledge cannot establish authority.
Missing/inactive/inaccessible membership returns a non-disclosing `404`; MEMBER
fails an organizer requirement with `403` within an authorized Event.
`createEventAuthorization` exposes `getEventMembership`,
`requireActiveEventMembership`, `requireOrganizerMembership`, and
`requireOwnAssignedTask`. The last scopes a live task and verifies its current
assignee, but does not implement a task mutation transaction or endpoint.

## P1C responsibility commands and development setup

Run `pnpm server:bootstrap-event` explicitly after P1B account provisioning and
migrations. It requires `NODE_ENV=development`, `DATABASE_URL` and only
`BUDOGRAPH_ORGANIZER_EMAIL` / `BUDOGRAPH_MEMBER_EMAIL`; no password or auth secret
is needed by setup itself. The CLI loads the existing optional ignored P1B
environment file for those emails. There is no setup route or startup hook.

One transaction creates **BudoGraph P1 development responsibility loop**, the
owner's active ORGANIZER membership, the second active MEMBER membership, and
one minimal backend verification task. Fixture dates are explicitly 3–4 October
2026 in `Europe/Sofia`; they are development data, not competition deadlines or
frontend demo dates. Server-generated UUID references are printed, with
`created` / `already-exists` per resource and no account data. An advisory
transaction lock serializes reruns; name plus owner identifies this separate
development Event. Ambiguous, archived or incompatible existing setup fails
without repairing/deleting it. Reruns preserve task assignment, acceptance,
status, version and history. No localStorage or frontend seed is imported.

All task endpoints require a database-backed session, active User and active
same-Event membership. Identifiers are UUIDs; all task SQL includes Event scope
and `deleted_at IS NULL`. Reads return `{ tasks: TaskDto[] }` or `{ task: TaskDto }`.
The list may be empty. Task DTO fields are `id`, `title`, `category`, `context`,
`deadline`, `status`, `priority`, `assignedMemberId`, `accepted`,
`acceptedByMemberId`, `acceptedAt`, `version`, `updatedAt`. Membership IDs are
references, not auth account records. Deadline is `YYYY-MM-DD`; instants are ISO
strings. SQL formats DATE explicitly and each transaction sets ISO DateStyle
locally for pg instant parsing. Responses use `Cache-Control: no-store`.

| Method / route suffix under `/api/events/:eventId/tasks` | Input / permission                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /`                                                  | Active Event member; authorized tasks only.                                     |
| `GET /:taskId`                                           | Active Event member; one scoped live task.                                      |
| `POST /:taskId/assignment`                               | `{ assignedMemberId: UUID \| null, expectedVersion: integer }`; ORGANIZER only. |
| `PUT /:taskId/acceptance`                                | `{ accepted: boolean, expectedVersion: integer }`; current assignee only.       |
| `PATCH /:taskId/status`                                  | `{ status, expectedVersion: integer }`; ORGANIZER or current assignee.          |

Command bodies allow exactly the two listed fields, without coercion. Reject
client actor, timestamp, role, Event and history fields. `expectedVersion` is a
positive integer below the PostgreSQL INTEGER maximum (room for increment).
Cookie mutations require `Origin` exactly equal to `BETTER_AUTH_URL`; absent or
foreign Origin and cross-site Fetch Metadata are denied. CLI callers must send
that Origin. No CORS allowlist or browser integration is introduced.

Assignment targets must be active same-Event memberships of active Users.
Changing assignment or unassigning clears both acceptance fields in the same
transaction. Assigning a former assignee again leaves acceptance empty. Only
the current assignee can accept or withdraw; Organizer has this authority only
on their own assigned task. Acceptance uses the locked member ID and database
`clock_timestamp()`. Status accepts the four existing lifecycle values without
a new state machine and neither accepts nor withdraws responsibility.

Every actual state change increments version once. Version mismatch returns
`409` with `{ "status": "error", "code": "TASK_VERSION_CONFLICT" }`; refetch
before deciding on a new command. No automatic overwrite/replay is performed.
With a matching version, an unchanged assignment/status/acceptance returns the
canonical task unchanged (200), without another version, activity or timestamp.
An unchanged assignment preserves existing acceptance. Stale repeats still fail
409; permission checks precede conflict disclosure.

`src/routes/tasks.ts` handles trusted session/Origin and HTTP transport;
`src/tasks/model.ts` validates commands and defines the safe DTO;
`src/tasks/service.ts` performs scoped authorization and explicit command logic;
`src/db/transaction.ts` pins pg clients and guarantees commit/rollback/resource
cleanup. Event, actor membership/User and target membership/User receive SHARE
locks; the task receives UPDATE lock plus a version-checked UPDATE. SHARE locks
prevent role/activity changes during command validation. Task and ActivityEntry
commit together. Statement/lock timeouts bound DB work; no transaction spans
external auth/network calls. No ORM, repository framework or policy engine.

History actions follow the existing dotted convention: `task.assigned`,
`task.reassigned`, `task.unassigned`, `task.accepted`,
`task.acceptance_withdrawn`, `task.status_changed`. Payload includes relevant
before/after member/status values and `taskVersion`; reassignment records prior
acceptance member/time and `acceptanceCleared`. This records invalidation in
the reassignment entry without creating a separate generic audit mechanism.
Actors come from the session and resolved membership; times come from the DB.
Existing append-only history remains unchanged. There is no history edit route.

HTTP semantics: missing/invalid session or inactive User → 401; prohibited action
inside authorized Event, origin denial or archived-Event write → 403;
inaccessible/missing Event membership, scoped task or assignee → non-disclosing
404; malformed IDs/body → 400; stale version → 409. Unexpected failures return
sanitized 500, never SQL/credential details. Archived Events remain readable to
active members; writes are conservatively denied because archive authoring is
outside P1C. Operational-role text never grants permissions.

Run `pnpm server:verify-responsibility` with the actual controlled credentials
in ignored environment files. It starts real loopback HTTP listeners and uses
distinct memory-only cookie jars, the real Better Auth configuration and
approved database. It verifies read/refetch, all commands, actor/time forgery
denial, stale retry, simultaneous two-session writes, foreign Event/task/member
denial and isolated logout. Successful commands intentionally retain history
on the development task. Foreign probes use unique rollback-only fixtures;
controlled users are never deleted. Run one verifier at a time. This is backend
HTTP verification, not browser UI integration or user acceptance testing.

The opt-in PostgreSQL suite includes P1B schema tests and P1C command tests.
P1C uses an outer fixture transaction and maps command transactions to real
savepoints; this proves sequential SQL behavior/rollback, while the real HTTP
verifier separately proves concurrent commands on independent pg clients.
Integration queries inspect canonical state/history and confirm fixture absence.
No new migrations or dependencies were needed. Applied 0001/0002 SQL is immutable.

## Explicit immutable migrations

Server startup never migrates. Review SQL and run only against the intended
approved development/test database:

```sh
pnpm db:migrate
```

P1B separates `0001_better_auth_core.sql` from `0002_budograph_core.sql`.
Auth schema comes from the installed Better Auth generation tooling, not manually
recreated tables. Generated SQL is reviewed and committed into this runner;
Better Auth `migrate` is not the authoritative database path.
Generation/source details are recorded in
[server/migrations/README.md](../server/migrations/README.md).

The runner discovers four-digit versions `0001`–`9999`, with lowercase snake_case
descriptions; it ignores non-SQL files and rejects invalid filenames/duplicate
versions. SQL is UTF-8/LF (`.gitattributes` enforces LF). One pinned PostgreSQL
client holds a session advisory lock and validates `public.schema_migrations`.
Metadata records filename/version, SHA-256 of exact bytes, and server applied time.
Changed, renamed, missing, or late versions are refused before pending work.

Each file and metadata insert run in one transaction. Failure rolls back that
file and stops; earlier committed migrations remain. Second unchanged execution
applies zero new migrations. Do not edit applied SQL, bypass checksums, reset
metadata, or delete conflicting tables. Unexpected existing auth/business tables
require investigation. Future changes use new migrations. There are no automatic
down migrations; destructive operations require separate human approval.

## Verification and remaining work

Focused offline tests include environment validation, auth configuration and
public sign-up closure, response/cookie forwarding, session identity/activity,
membership authorization, secret-safe logging, migration checksums/immutability,
and lifecycle/pool behavior. Injected boundaries are identified as test doubles;
they do not prove real PostgreSQL behavior.

Real database verification is separate: migration application and unchanged
second run; metadata/schema inspection; controlled provisioning and rerun;
distinct organizer/member sign-in sessions; database session presence; session
lookup, protected unauthenticated `401`, and logout invalidation. The auth check
uses the real library/database and its own sessions without printing credentials.

The opt-in integration suite requires `RUN_DATABASE_INTEGRATION=1` and refuses
production mode. After explicit migrations, enable it for the approved database:

```powershell
$env:RUN_DATABASE_INTEGRATION = '1'
pnpm.cmd server:test:integration
Remove-Item Env:RUN_DATABASE_INTEGRATION
```

Without the flag, the suite reports a skip; that is not a PostgreSQL verification
pass. Schema fixtures use new UUIDs and transactions with
savepoints for expected constraint errors and final rollback. It tests dates,
versions, enum checks, scoped uniqueness/FKs, acceptance consistency, cross-event
rejection, and activity persistence without dropping/resetting tables or importing
fictional demo state. Migration-runner protocol doubles remain separate evidence.
See test evidence for the exact executed results and limits.

Event/task authoring UI, production hosting,
recovery/verification workflows, distributed rate limiting, least-privilege grant
audit, and backup/restore remain unfinished. Keep the
[license register](THIRD_PARTY_NOTICES.md), [AI assistance log](AI_ASSISTANCE_LOG.md),
and test evidence current. Official Better Auth references consulted for 1.7.7:
[PostgreSQL](https://better-auth.com/docs/adapters/postgresql),
[Fastify](https://better-auth.com/docs/integrations/fastify),
[email/password](https://better-auth.com/docs/authentication/email-password),
[sessions](https://better-auth.com/docs/concepts/session-management),
[cookies](https://better-auth.com/docs/concepts/cookies), and
[schema tooling](https://better-auth.com/docs/concepts/cli).

The supplied NOIT regulation applies to **2025–2026**. Eligibility, GPLv3, complete
source/docs, role test accounts, the online-access period, PDF format, dates, and
scoring must all be verified for the actual participation year. Stack and phase
choices are internal project decisions, not official competition rules.

## Task reminder worker

Apply `0007_task_reminders_notifications.sql` with `pnpm.cmd db:migrate` before server startup. Fastify starts one in-process PostgreSQL-backed worker on readiness and drains it at close, with 30 seconds between completed passes and a 100-candidate bound. Run `pnpm.cmd test:browser:task-reminders` using the existing controlled-account/browser environment. No public deterministic-clock endpoint exists. See [Task reminders](BUDOGRAPH_TASK_REMINDERS.md) for API, atomicity, DST and dedupe contracts.

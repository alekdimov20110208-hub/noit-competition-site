# Backend P1A/P1B Development

P1A establishes the TypeScript/Fastify runtime, typed configuration, PostgreSQL
pool, health checks, shutdown handling, and explicit SQL migration runner. P1B
adds Better Auth **1.7.7**, PostgreSQL-backed email/password sessions, controlled
development-account provisioning, the core relational schema, and server-side
authentication and Event authorization helpers under the approved
[Backend Foundation Contract](BUDOGRAPH_BACKEND_FOUNDATION_CONTRACT.md).

Dashboard, Tasks, and Team remain locked and continue to use the fictional local
demo. P1B does not implement frontend authentication, a remote workspace service,
Event/task HTTP commands, or the P1 two-user responsibility loop. Assignment,
acceptance, lifecycle mutations, and permanent development Event creation belong
to P1C. Backend P1B verification results are recorded separately in
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

| Command                        | Purpose                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `pnpm server:dev`              | Watch the native TypeScript runtime.                                                              |
| `pnpm server:start`            | Start compiled runtime after `server:build`.                                                      |
| `pnpm server:typecheck`        | Check backend source, scripts, and tests.                                                         |
| `pnpm server:test`             | Run focused tests without a real PostgreSQL database.                                             |
| `pnpm server:build`            | Compile runtime/scripts into ignored `server/dist/`.                                              |
| `pnpm db:migrate`              | Apply reviewed versioned SQL to the approved configured database.                                 |
| `pnpm server:auth-schema`      | Generate review SQL using the pinned official CLI into ignored `tmp/`; never apply it.            |
| `pnpm server:provision`        | Explicitly provision two controlled accounts; development only.                                   |
| `pnpm server:verify-auth`      | Verify real sign-in, sessions, logout, and protected routes using configured controlled accounts. |
| `pnpm server:test:integration` | Opt-in PostgreSQL schema/constraint verification using rollback-only fixture transactions.        |

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
checks remain enabled. Trusted origins contain only the configured auth origin.
P1B does not connect a browser client on another origin, so it adds neither
`CLIENT_ORIGIN` nor `@fastify/cors`. Separate-origin browser integration must
later configure one explicit origin consistently in CORS and Better Auth,
with credentials enabled and no wildcard origin.

Better Auth rate limiting is enabled with in-memory storage and its library
defaults. The adapter replaces `x-budograph-client-ip` with Fastify's direct peer
IP; client-supplied forwarding headers cannot set the rate-limit identity.
Proxy trust and distributed rate limiting need review before proxy/production
deployment. This is a focused security foundation, not a security certification.

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
`access_role` after a later explicit Event setup.

Email verification, recovery, invitation UI, and real user onboarding are outside
P1B. These two accounts are controlled development identities, not a complete
competition jury-account package. Permanent Event creation and membership
bootstrap are deferred to P1C. Provisioning never imports the localStorage demo.

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
replace server authorization or all transactional invariants: future commands
must keep the owner an active ORGANIZER, reject inactive assignees, resolve open
work before deactivation, validate targets in Event scope, and combine business
updates/history/version checks atomically. P1B exposes no activity-edit API.

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

P1C task commands, Event setup, frontend auth/data integration, production hosting,
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

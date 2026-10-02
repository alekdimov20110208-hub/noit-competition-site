# Backend P1A Development

P1A establishes the infrastructure for the approved
[Backend Foundation Contract](BUDOGRAPH_BACKEND_FOUNDATION_CONTRACT.md).
It provides a TypeScript/Fastify app, typed configuration, a PostgreSQL pool,
health endpoints, runtime shutdown, and an explicit SQL migration runner.
The existing frontend remains a fictional local demo. P1A does not implement
Better Auth, users, sessions, authorization, Events, EventMembers, Tasks,
ActivityEntries, business persistence, task commands, or real collaboration.
Dashboard, Tasks, and Team remain locked.

## Prerequisites and commands

Use Node.js **22.x from 22.18.0, or 24.0.0 and later**, and the repository-declared **pnpm 11.9.0**.
Git must be available for the secret-ignore regression tests.
P1A was developed using Node.js 24.16.0. The backend source commands use native
Node.js TypeScript stripping, so no `tsx`, `ts-node`, or `dotenv` package is needed.
pnpm 11.9.0 itself requires Node.js 22.13.0 or later; the backend requirement is
stricter. Install the locked dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

In Windows PowerShell, use `pnpm.cmd` for the commands below if shell script
execution policy prevents invoking `pnpm`.

| Command                 | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm server:dev`       | Watch the TypeScript runtime entrypoint using native Node.js.          |
| `pnpm server:start`     | Start the compiled backend after `server:build`.                       |
| `pnpm server:typecheck` | Check backend source, scripts, and tests without emitting files.       |
| `pnpm server:test`      | Run focused backend tests without a PostgreSQL server or TCP listener. |
| `pnpm server:build`     | Compile backend runtime/scripts into the ignored `server/dist/`.       |
| `pnpm db:migrate`       | Explicitly apply SQL migrations using the configured database.         |

Existing frontend commands remain separate. Backend-only test results do not
establish a passing frontend build or test run; verified results belong in
[TEST_EVIDENCE.md](TEST_EVIDENCE.md).
Root `typecheck`, `test`, and `build` retain their frontend scope; `lint`, `format`,
and `format:check` also include backend files.

## Local configuration and secret safety

Create the local environment file from the placeholder example:

```powershell
Copy-Item -LiteralPath server/.env.example -Destination server/.env
```

Edit `server/.env` locally. Use only an approved database and replace every
`REPLACE_` placeholder before startup or database operations. The example is not
a usable credential set. Real `.env` and `.env.*` files are ignored throughout
the repository; `.env.example` is the only permitted example-file exception.
Do not commit database URLs, passwords, future auth secrets, or test-user
credentials. Review staged files before committing; ignore rules do not remove
secrets that were already tracked.

The runtime and migration command load `server/.env` through Node.js
`--env-file-if-exists=server/.env`. An already-set process environment variable
takes precedence. If no local file exists, supply the required values through
the process environment. Configuration is parsed once into a typed object;
unrelated application modules do not read raw `process.env`.

| Variable       | Contract                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`     | `development`, `test`, or `production`; defaults to `development`.                                                             |
| `HOST`         | Listener address; defaults to local-only `127.0.0.1`. Configure explicitly when another interface is required.                 |
| `PORT`         | Integer from `1` through `65535`; defaults to `3001`.                                                                          |
| `DATABASE_URL` | Required by real runtime startup and database commands; a valid `postgres:` or `postgresql:` URL with no example placeholders. |

Invalid configuration fails before startup with static, non-sensitive messages.
Errors do not include the raw environment, connection URL, username, or password.
Tests may construct the app with an injected database-health function without
loading a database URL.
Use a least-privilege database role for runtime health checks. Explicit migration
commands need metadata/schema privileges; use separate setup credentials where
practical and keep both credential sets outside Git. Actual database permissions
have not been independently audited; successful readiness and empty migration
runs establish only the access needed for those operations.

## App, runtime, and PostgreSQL boundaries

The `server/` directory keeps backend code and output separate from the Vite app:

```text
server/
  .env.example
  tsconfig.json          backend-only strict typechecking
  tsconfig.build.json    runtime/script compilation
  src/
    app.ts               Fastify factory and safe request logging/errors
    main.ts              runtime startup and signal handling
    shutdown.ts          shared, idempotent resource cleanup
    config/
      env.ts             typed environment validation
    db/
      pool.ts            single PostgreSQL pool boundary
      migrations.ts      migration discovery, checksums, and execution
    routes/
      health.ts          liveness/readiness routes
  scripts/
    migrate.ts           explicit migration CLI
  migrations/
    README.md            SQL naming/authoring contract; no business SQL yet
  tests/                 configuration, health, pool, shutdown, secrets, migrations
  dist/                  ignored compiled backend output
```

The app factory creates Fastify and registers infrastructure routes independently
of startup. Tests use Fastify injection without opening a network port or adding
process signal handlers. The runtime entrypoint validates configuration, creates
the pool and app, starts the listener, and owns `SIGINT`/`SIGTERM` handling.
Shutdown closes Fastify before ending the pool and guards repeated shutdown
signals. Startup failure also closes acquired resources.

One `pg.Pool` creation boundary receives validated configuration. Its connection
timeout is 5 seconds, idle timeout 30 seconds, and maximum pool size 10.
Readiness performs the lightweight `SELECT 1` check through an injected boundary
with a 5-second query timeout in the runtime.
There is no ORM, generic repository framework, or business repository in P1A.
Database and request errors use sanitized messages; clients never receive raw
PostgreSQL errors, stack traces, or connection details. Logs must not contain
authorization headers, cookies, passwords, tokens, or the database URL.

Backend ESM source imports use explicit `.ts` extensions. TypeScript 5.7 rewrites
relative import extensions to `.js` during compilation. Runtime/script builds
exclude tests; the separate backend typecheck includes them. After building,
the compiled server can be run from the repository root:

```sh
node --env-file-if-exists=server/.env server/dist/src/main.js
```

## Health endpoints

With default configuration, use these routes on `http://127.0.0.1:3001`:

| Route                   | Result                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/health/live`  | `200` with a small stable status; does not query PostgreSQL.                            |
| `GET /api/health/ready` | `200` when `SELECT 1` succeeds; `503` with a safe status when the database check fails. |

These public infrastructure routes do not authenticate users or establish
authorization. Liveness means the app responds; readiness means its configured
PostgreSQL dependency can answer the health query. Neither establishes working
business functionality. P1A adds no wildcard CORS or pretend authentication.

## Explicit versioned SQL migrations

Server startup does not run migrations. Run the CLI only against the intended,
approved local/test database:

```sh
pnpm db:migrate
```

The runner reads `server/migrations/` in source and compiled execution. SQL names
use four-digit versions from `0001` through `9999` followed by a lowercase
snake_case description, for example `0001_initial_schema.sql`. Non-SQL files such
as the README are ignored; invalid `.sql` names and duplicate versions fail.
Discovery sorts by version deterministically.
The repository's `.gitattributes` fixes migration SQL checkouts to LF line endings
so Windows and Linux checkouts hash the same bytes. Author new files as UTF-8/LF
and review them before applying; line-ending edits change an applied checksum.

A dedicated PostgreSQL client holds a fixed session advisory lock through
metadata validation and application. The infrastructure table
`public.schema_migrations` records `version`, `name`, SHA-256 `checksum` of the
exact SQL file bytes, and server-generated `applied_at` timestamp. The runner
checks previously applied files before pending application and refuses modified,
renamed, missing, or late versions. Metadata values use parameterized inserts.

Each pending migration's SQL and metadata insert execute in one transaction.
Failure rolls back that migration and stops the run; previously committed
migrations remain applied. The client releases its lock and connection on exit.
A second unchanged run reports nothing new to apply. Future changes require new
migrations; automatic rollback/down migrations are outside P1A. Authors must
use SQL that PostgreSQL permits inside a transaction.
Migration files are reviewed repository code; do not add transaction-control
statements, lock changes, or direct metadata writes. See the
[migration authoring contract](../server/migrations/README.md).

P1A includes **no SQL business migration** and creates no auth or business tables.
Running `db:migrate` with the empty SQL directory may create only the migration
metadata table. The first business schema will be defined together with the
later Better Auth integration. The human manually ran the empty migration runner
twice against the approved Supabase-hosted PostgreSQL development database; both
runs reported `Migrations complete: 0 applied, 0 already applied.`

## Verification boundary and later work

Focused tests cover configuration validation and safe failures, injection-based
liveness/readiness, migration discovery/order/checksums, immutability, and
transaction/locking behavior through test doubles. These checks do not depend
on installing PostgreSQL, Docker, Testcontainers, or a cloud service.

REAL POSTGRESQL INTEGRATION VERIFIED: **YES - human manual verification.**
REAL MIGRATION RUNNER VERIFIED: **YES - two successful empty runs.**

Injected database checks and protocol test doubles are unit/application tests,
not PostgreSQL integration tests. The subsequent human verification established
real readiness, safe unavailable responses, and safe repeated execution of the
empty migration runner. See [test evidence](TEST_EVIDENCE.md). Applying pending
SQL files, inspecting metadata contents, checksum-change rejection, concurrent
locking, and transactional rollback still require real-database verification.

P1B, auth integration, the business schema, real frontend data services, account
provisioning, deployment, and backup/restore remain later work. This document is
a development guide and does not establish a deployed production service.
Maintain the [license register](THIRD_PARTY_NOTICES.md),
[AI assistance log](AI_ASSISTANCE_LOG.md), and test evidence as implementation
progresses. The supplied NOIT regulation applies to **2025-2026**; verify all
year-specific rules, dates, deliverables, and online-access periods for the actual
participation year. Backend stack and phase choices are internal project
decisions, not official competition rules.

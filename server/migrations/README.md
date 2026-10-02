# SQL migrations

Backend P1A intentionally contains no business migrations. The runner can create
only its infrastructure metadata table, `public.schema_migrations`. Auth and
business tables belong to later approved phases with Better Auth integration.

Run `pnpm db:migrate` from the repository root after configuring the untracked
`server/.env` using `server/.env.example`. The source and compiled CLI both read
this directory; the build does not copy SQL into its output.

Future migrations use names such as `0001_description.sql`, with four digits
from `0001` through `9999` and lowercase snake_case descriptions. Regular UTF-8
SQL files only; invalid SQL filenames, symlinks and duplicate versions fail the
run. Non-SQL files such as this README are ignored. Versions sort numerically
because all versions have four digits; new versions must follow applied history.

The runner uses one checked-out PostgreSQL client and holds a fixed session
advisory lock across history validation and all migrations. Concurrent runners
wait for this same lock. It records version, full filename, SHA-256 checksum of
the exact file bytes and a database-generated `applied_at` timestamp. Every
previously applied file must still exist with the same filename and checksum
before any pending migration starts. Editing even whitespace or line endings
changes the checksum. Fix schema changes with a new migration; do not edit or
delete applied files or reset metadata to bypass validation.
Keep SQL files with LF line endings, including on Windows; the repository's
`.gitattributes` enforces LF for these files so deployment checkouts retain the
same checksum.

Each file and its parameterized metadata insert run in a separate transaction.
A failure rolls back that file and stops the run; earlier committed migrations
remain applied. SQL must support a PostgreSQL transaction. Migration files are
reviewed repository code: do not include `BEGIN`, `COMMIT`, `ROLLBACK`, advisory
lock changes or writes to `schema_migrations`. Operations such as `CREATE INDEX
CONCURRENTLY` are not supported by this transaction runner. There are no
automatic down migrations or SQL parsing/rewrite features. Destructive database
changes require separate user approval before execution.

The current tests use local temporary files and an explicitly mocked client.
They verify discovery, checksums, history validation, transaction failure and
client cleanup without connecting to PostgreSQL. They are not PostgreSQL
integration tests. A real database run requires an approved test database and
is reported separately in the project test evidence.

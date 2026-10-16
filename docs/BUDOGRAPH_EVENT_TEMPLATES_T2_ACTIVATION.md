# Event Templates T2 — real PostgreSQL and development activation

Owner-authorized continuation, 2026-10-17 (Europe/Kyiv). HEAD remains
`3ba8852cc3592873b32a63f15b6d640ceebdb039`. This report supersedes the earlier
T2 report's NOT RUN activation statuses. T1 HUMAN PASS and B.1 HUMAN PASS remain
preserved. T2 HUMAN ACCEPTANCE was pending at the activation handoff.

## Subsequent owner acceptance — 2026-10-17

**T2 HUMAN ACCEPTANCE: PASS — 6/6.** The owner explicitly confirms this in the
accepted TLS/T1/T2 Git checkpoint request. T1 HUMAN PASS 6/6 and B.1 HUMAN PASS
remain preserved. This is owner-attested acceptance, not a new Codex live Apply
or a replay of personal tests during the source-control checkpoint.

Before personal acceptance, the owner separately authorized canonical creation of
exactly one new Event, `DEMO — Templates T2 Acceptance — 20261017-A`, for November
27–29, 2026, Europe/Sofia. Read-back confirmed initially zero Tasks/Changes/invites,
one active creator Organizer membership and only its normal EVENT_CREATED history.
Its Templates route and review action were left ready for the owner; setup did not
execute Apply. Those zero counts describe setup, not a claim about its state after
the owner's acceptance. No existing B.1 or LOCKED data was modified by setup.

The remaining sections preserve the earlier technical activation observations.

## Local PostgreSQL and isolation

Windows x64; 62.28 GiB free before setup. Used the portable PostgreSQL **17.11**
Windows x64 archive from EDB, reached through the
[official PostgreSQL Windows distribution page](https://www.postgresql.org/download/windows/)
and [EDB binary downloads](https://www.enterprisedb.com/download-postgresql-binaries).
No installer, pgAdmin, StackBuilder, Windows service, PATH modification, Docker,
Podman or WSL installation was used.

The authenticated HTTPS download's multipart ETag was independently recomputed
and matched `6cb314b462a4f8976abec7c421c3f01e-46`. Download SHA-256:
`80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
The PostgreSQL executables are **not Authenticode signed**; no signature or
independently published SHA-256 verification is claimed. HTTPS distributor
provenance and the supplied ETag were verified. Only server/client binaries,
libraries, share files and accompanying license notices were extracted.

Owned external directory:
`C:\Users\Lenovo\AppData\Local\BudoGraph-T2-PostgreSQL17-eb975bcf9737`.
Inheritance was disabled; filesystem access is restricted to the current Windows
owner and SYSTEM. A new cluster used random separate temporary passwords,
SCRAM-SHA-256 authentication, checksums and **127.0.0.1:55432 only**. Port
availability was checked before startup. Application environment files and
development credentials were not copied or changed.

Independent read-only identity checks before fixture writes proved:

- PostgreSQL `server_version_num=170011`, dedicated data directory and cluster
  system identifier `7697374354312044444`.
- Only fresh default databases and the owned bootstrap administrator existed.
- Test database `budograph_t2_isolated_20261017_eb975bcf9737` was empty.
- Its owner/login was `budograph_t2_runner`, without superuser, createdb or
  createrole privileges.
- Actual SQL server host/port matched loopback/55432; the target was distinct
  from the remote development Supabase identity.

No application server, email service or external integration ran against this
cluster. Tests invoked the actual repository T2 service and transaction helper.

## Real database acceptance

The complete migration sequence 0001–0011 was executed. All 11 recorded names and
SHA-256 checksums matched the repository. A second run applied zero migrations.
No original migration was edited.

Executed with process-scoped isolated URL and explicit disposable confirmation,
without loading application environment files:

```powershell
node --test --test-concurrency=1 server/tests/template-applications.integration.test.ts server/tests/template-acceptance.integration.test.ts
```

**PASS: 27/27 Node test results, 0 failures, 0 skips.** This includes 25 acceptance
subtests, their enclosing test and the existing real integration test. The
existing integration test also passed independently before the expanded run.

Verified with real SQL and committed rows:

- Exact reviewed subset, canonical fields, unassigned/unaccepted/not-started
  initial Tasks, version 1 and zero reminder rows.
- Normal Task History entries, one aggregate entry and exactly one matching
  immutable operation receipt committed together.
- Member 403; foreign Event non-disclosing 404; revoked membership, inactive
  identity, downgraded Organizer and archived Event rejection, including replay.
- Stale Event version, changed start date and changed matching Task rejection.
- Controlled PostgreSQL `23514` failures at Task, reminder, aggregate History
  and receipt writes rolled back all effects. Full pre/post row snapshots matched;
  retrying the same key after removing each owned test trigger committed normally.
- Eight concurrent same-key commands returned the same outcome and committed
  only four Tasks, five History entries and one receipt. Changed payloads conflicted.
- Discarded-response recovery survived closing/recreating the pool and changing
  Event version. The existing test recovered the receipt from a fresh Node process.
- Receipt UPDATE/DELETE failed with immutable-trigger code `55000`.
- Real DATE/TIME storage preserved year rollover, leap/non-leap centuries,
  spring/autumn DST calendar dates, years 0099/0100 and nullable local times.
  Calendar underflow failed without writes.

Source changes in this continuation:

- `server/tests/helpers/template-isolated-db.ts`: use
  `pg_catalog.host(inet_server_addr())` for the strict loopback identity check.
  PostgreSQL's `inet::text` includes `/32`; host extraction fixes representation
  without weakening the allowed-address check.
- `server/tests/template-acceptance.integration.test.ts`: expanded real database
  acceptance coverage. Test-created failure triggers/functions exist only in the
  owned isolated database and are removed after each case.
- This report and a short cross-reference in the original T2 report.

No runtime T2 source or migration 0011 fix was needed.

Regressions: frontend **319/319 PASS**; backend with
`RUN_DATABASE_INTEGRATION=0` **171 PASS, 28 SKIP, 0 FAIL**. The skips are explicit
database opt-ins, including the two separately executed isolated T2 test files.
Frontend/backend TypeScript, ESLint, backend build and `git diff --check`: PASS.
Original full frontend formatting issue in unchanged `EventArchiveDialog.tsx`
remains; it was not repaired or relabeled as PASS. Earlier synthetic browser and
112 locked-interior pixel checks were not rerun because UI/runtime source did
not change in this continuation; their earlier evidence remains historical.

Evidence: `tmp/t2-unblock-{frontend,backend}-tests.txt`; external owned directory's
`isolation-proof.json`, `initial-integration.txt`, `acceptance-integration.txt`.

## Development preflight and recovery safeguard

Confirmed development fingerprints:
connection target **734663449f0e944e**, project reference **a90a1035b104d054**.
The connection fingerprint is the first 16 SHA-256 hex characters of
`host|port|database|user`; no connection value or password is reported.

Read-only checks through the actual application pool factory confirmed PostgreSQL
17.11, TLS 1.3, authorized certificate chain, hostname verification and
`rejectUnauthorized=true`. Live pool observation of both old and new backend
processes independently confirmed the same facts. Temporary loopback inspectors
were closed after observation. This covers Node to Supabase pooler only, not the
pooler-to-PostgreSQL transport segment.

Existing 0001–0010 names/checksums matched. Only reviewed additive migration 0011
was pending: one new receipt table, indexes/constraints/immutable trigger and RLS;
no backfill or modification of existing business rows or authorization policies.
Development email remained disabled. Active environment files were byte-preserved.

A recent complete application `public` schema/data backup was created by
`pg_dump 17.11` over verified TLS, using a consistent read-only snapshot. It
contains the application's Better Auth tables and migration history; unrelated
Supabase-managed schemas and role/ACL definitions are outside its scope.
The 876,953-byte archive had 129 TOC entries. Listing and full decompression
through `pg_restore` to the Windows null device succeeded. No restore SQL ran.

Backup directory:
`C:\Users\Lenovo\.budograph\backups\t2-pre0011-20261017-0678756e5a8e`.
The archive is encrypted with Windows DPAPI CurrentUser under restricted ACLs.
Decryption checksum round-trip passed and the plaintext archive was removed.
`RECOVERY.txt` documents an empty recovery-target verification before any separately
authorized restoration of development. **Restore rehearsal: NOT RUN.** Retain the
same Windows account/profile to decrypt this backup; it is not a portable backup
for another user or machine.

## Migration and one backend activation

Executed the established verified-TLS CLI with existing environment inputs:

```powershell
node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/scripts/migrate.ts
```

First result: **1 applied, 10 already applied**. Safe second execution:
**0 applied, 11 already applied**. Recorded 0011 checksum matched:
`1dfe28462fed8f05c356c2ca0efa07e8f0602cd2e1bb83651799bf1764232594`.

Before/after snapshots of existing Event, Member, Task, Change, link, History and
duplicate-command receipt tables matched. B.1's Event, member, four Tasks, Change,
three links and seven History entries matched its saved acceptance record.
Existing session count stayed **89**; no login, account or credential change ran.
The historical Stage 7 88/89 discrepancy remains pre-existing and unexplained.

Fastify **27372** exited gracefully through its existing SIGTERM handler.
Exactly one new backend start created PID **22316**, using the same Node executable,
working directory, two environment-file inputs and non-watch `server/src/main.ts`
entry. Vite stayed PID **27776**. No Supabase/PostgreSQL restart or duplicate backend
worker was started. Normal reminder-worker activity remains enabled and permitted.
Liveness/readiness returned `ok`; the new actual pool's TLS connections verified.

Runtime evidence:
`C:\Users\Lenovo\.budograph\runtime\t2-activation-20261017-917e97fbdde5`.
Ignored evidence also includes `tmp/t2-unblock-migration-{first,second}.txt`,
`tmp/t2-unblock-shared-{preflight,post}.json` and backend TLS observations.

## Live read-only verification and remaining acceptance

Existing authenticated browser session verified Dashboard (four Tasks), Tasks,
Change (three affected Tasks), seven History entries, accepted T1 selection/date
behavior and the real T2 preview. BG selection of two items resolved November 13
and November 19 at 15:00 for the November 20 Europe/Sofia Event. The confirmation
stayed unchecked and Apply disabled. EN preview and an existing archived Event's
server review were also checked; archive review exposed no confirmation control.
No active Member-only Event was available in this same session, so live Member
verification was NOT RUN; the isolated PostgreSQL Member case passed.

**LIVE APPLY: NOT RUN.** No live Event, Task or second demo scenario was created.
T1 and B.1 human acceptance remain PASS. Event Management Stages 1–7 source and
LOCK records, original migrations, TLS configuration and unrelated uncommitted
work remain preserved. No commits, pushes, deployment, T3 or authentication edits.
UI/read evidence is under `tmp/t2-unblock-live/`.

Browser console capture contained nine identical message-channel errors timestamped
before backend activation (21:13:48 UTC). No later console error was captured in
these checks. Their source was not independently established; no unrelated browser
extension or application change was made. Request URLs are intentionally omitted
by the backend logger, so no URL-specific HTTP log evidence is claimed.

At activation handoff, the remaining owner HUMAN ACCEPTANCE was: use a **new synthetic T2 Event**, review a selected
subset, explicitly confirm Apply once, inspect exact new Tasks/History and verify
recovery/permissions with the T2 checklist. Do not use B.1 as the application fixture.

## Local resource retention and cleanup limitation

The owned isolated cluster was stopped successfully; port 55432 is free. No
persistent service exists. Portable binaries, evidence, stopped test data and its
private temporary credential file remain in the restricted external directory.
Automatic approval review rejected deletion of the owned disposable cluster with
the stated reason **"blocked by policy"**, including a narrower fixed-path attempt.
No alternate deletion mechanism was used. `cleanup.json` records this accurately.
The independent encrypted development backup remains intentionally retained.

Supplied NOIT requirements are historical **2025–2026** references. Actual
2026–2027 rules still require verification; T1/T2 are internal product stages.
PostgreSQL and bundled third-party license notices remain with the external tools;
no repository dependency or distributed asset was added. Codex assistance was
limited to owned test setup, the test guard/coverage, authorized activation and
this evidence report. Human T2 review was pending at activation and subsequently
confirmed PASS 6/6 by the owner as recorded above.

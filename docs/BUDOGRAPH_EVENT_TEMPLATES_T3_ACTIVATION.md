# T3 — owner clarification and controlled development activation

## Final owner Human Acceptance — 2026-10-17

**T3 HUMAN PASS — 8/8, owner-confirmed.** The owner's subsequent Git checkpoint
request is the authoritative acceptance, separate from the earlier automated tests
and development activation. The owner personally verified:

1. The correct two source Tasks were selected.
2. Reusable contents and descriptions were reviewed.
3. Live personal-template Save succeeded.
4. The same template persisted after browser refresh.
5. It was available in another authorized Event.
6. The destination preview showed the correct dates and time.
7. One Apply created exactly two new destination Tasks.
8. Expected History was present and existing data remained intact.

The owner performed the live Save and Apply; Codex did not perform these actions
on the owner's behalf. Exact destination Event/Task/History IDs and operation
timestamps were not captured in this attestation and are not inferred here.
T1 HUMAN PASS 6/6, T2 HUMAN PASS 6/6, B.1 and Event Management Stages 1–7 LOCKED
remain preserved. Real isolated PostgreSQL T3 tests passed before activation;
migration 0012 was successfully applied and development T3 activated before this
later Human Acceptance. Earlier empty-library, NOT RUN and PENDING observations
describe those earlier stages, not the accepted current status.

2026-10-17, Europe/Kyiv. Baseline remains
`ff9edd97d06d86543dd5597b1136fae8659033f0`, `main`.
**T3 development activation: COMPLETE. T3 HUMAN ACCEPTANCE: PASS 8/8.**

The activation evidence below is retained as recorded before the later owner
acceptance. PID 24392 identifies that activation, not a promise of a permanent PID.
No runtime source changed in this continuation. No commit, push or deployment.
T1 HUMAN PASS 6/6, T2 HUMAN PASS 6/6, B.1 HUMAN PASS and Stages 1–7 are preserved.
The earlier [T3 source handoff](BUDOGRAPH_EVENT_TEMPLATES_T3.md) stopped correctly
before activation; the owner's clarification and results below supersede that
handoff's historical NOT APPLIED / NOT ACTIVATED states.

## Owner clarification and read-only verification

The owner explicitly explained two intentional T2 applications: first two items,
then a separate one-item operation. The original **T2 HUMAN PASS 6/6 remains
unchanged**. The later one-item Apply is additional owner testing, recorded here
separately rather than rewriting the original acceptance.

Event: `84ab5c6f-0ed8-44fb-85f0-b38b030d8694`,
`DEMO — Templates T2 Acceptance — 20261017-A`, November 27–29, Europe/Sofia.

| Operation                              | Items                           | UTC receipt time         | Task-created History | Aggregate History |
| -------------------------------------- | ------------------------------- | ------------------------ | -------------------- | ----------------- |
| `577f6bd6-0165-40e6-ba0a-6c504ccd97aa` | Airport pickup + hotel check-in | 2026-10-16 21:53:07.254Z | 2                    | 1                 |
| `0df64db1-b07e-49c4-a12f-2ffbfdec2e18` | First training preparation      | 2026-10-16 21:54:22.585Z | 1                    | 1                 |

Verified with a read-only repeatable-read transaction: exactly **3 active Tasks,
2 distinct receipts and 6 History entries**, including original EVENT_CREATED.
Both operations belong to the Event's owner. Every receipt Task ID, template item,
canonical authored field/date/time and normal/aggregate provenance matches. The
three Task IDs are distinct and account for every active Task in this Event.
No additional unexplained operation was found. This resolves the specific gate.

The two original Tasks remain:

- `fea1055b-6cc4-4415-a810-72430146b94a`: **Посрещане на инструктора на летището**,
  2026-11-26, date only;
- `4dd7ecb4-27ce-4f16-a86e-ab4840dda2b7`: **Координиране на настаняването в хотела**,
  2026-11-26 at 15:00.

Additional owner-tested Task, also preserved:
`9d2e7a56-94c3-49e7-b59a-022f59719719`, **Подготовка на първата тренировка**,
2026-11-27 at 08:30. No Task, receipt or History record was rewritten or removed.

## Identity, source and recovery gates

Confirmed development fingerprints: connection target **734663449f0e944e**;
project reference **a90a1035b104d054**. No connection values or credentials are
included in this report. PostgreSQL is 17.11. The application pool factory and
actual old/new backend pools independently verified encrypted TLS 1.3, authorized
certificate chain, hostname matching and `rejectUnauthorized=true`. This proves
Node-to-Supabase-pooler TLS, not the separate pooler-to-database transport segment.

All 0001–0011 names/checksums match both the Git baseline bytes and development
migration history. Exactly 0012 was pending. Reviewed 0012 is additive: new private
tables and an extension of existing receipt constraints; no business-row update,
backfill or removal. Source/configuration/CA manifest (372 files) matches before
and after activation. Other repository tasks were idle. Existing secrets, TLS CA,
email-disabled mode, auth and trusted-Origin settings remain unchanged.

A new consistent read-only `pg_dump 17.11` backup of application `public` schema
and data was created over libpq `verify-full` using the existing CA. It includes
application auth tables, migration history, all three T2 Tasks and both receipts.
It excludes Supabase-managed schemas and global role/ACL definitions.

- Archive: **883,891 bytes**, **136 TOC entries**.
- SHA-256: `570a7d3c367344bf2db3f4b36dd163a4e21b7ce4408e27e859cd32f78b74aada`.
- `pg_restore --list` and complete decompression to Windows NUL: PASS; no restore
  SQL ran.
- Windows DPAPI CurrentUser encryption and decrypt/checksum round trip: PASS.
- Directory/file ACL: current Windows owner and SYSTEM only; plaintext removed.
- **Restore rehearsal: NOT RUN.** Keep this Windows account/profile to decrypt.

Recovery directory:
`C:\Users\Lenovo\.budograph\backups\t3-pre0012-20261017-85a5f3c28bae`.
It contains the encrypted archive, archive/encryption proofs, owner marker and
`RECOVERY.txt`. A restore requires a separately authorized, verified recovery
target; no rollback or destructive restore was attempted. The existing T2 backup
and stopped isolated cluster files remain intact.

## Migration and exactly one backend restart

Used the existing migration CLI and unchanged environment-file inputs:

```powershell
node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/scripts/migrate.ts
```

First execution: **1 applied / 11 already applied**. Safe repeat:
**0 applied / 12 already applied**. Recorded 0012 checksum:
`3a401ca6be72f60ec6698f05ecc582cb63fa40e30d3e46beb1c6d8a3bace76e1`.
No old migration changed; no migrations remain pending.

All four new tables have RLS enabled, zero browser policies, their immutable
trigger enabled and no effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges
for either `anon` or `authenticated`. All four contain **zero rows** after
verification; no personal template was created live.

Old backend **22316** received its existing graceful SIGTERM handler through the
established temporary loopback inspector procedure. The inspector closed, the
process exited and port 3001 became free. Exactly one non-watch replacement was
started with the same Node executable, working directory and two environment-file
inputs: **new PID 24392**. Readiness returned `ok`; the actual new pool's TLS and
both target fingerprints verified. Temporary inspection closed cleanly.

**Vite remains PID 27776.** No Vite or Supabase restart, database server restart,
environment edit, worker disable or repeated backend-start loop occurred. The
normal reminder worker registration/behavior remains unchanged.

Runtime directory:
`C:\Users\Lenovo\.budograph\runtime\t3-activation-20261017-ad5e09c59934`.

## Preservation and authenticated read verification

Before/after hash snapshots of **14 existing tables** match, including Events,
members, Tasks, reminders, Changes/links, ActivityEntries, existing operation
receipts and application auth tables. Sessions remain **89**. Normal notification
worker tables were explicitly excluded from the static business snapshot; normal
reminder-worker activity remains permitted.

B.1 still matches its saved acceptance record: Event, member, 4 Tasks, Change,
3 links and 7 History entries. T2 remains 3 Tasks / 2 receipts / 6 History entries.
All four new private tables remain empty. Source/environment/CA hashes match.
No LOCK record or original screenshot was changed or rebaselined.

The existing signed-in browser session verified:

- **My Templates list:** successful authenticated load and honest empty state;
- **Source read:** all three existing Tasks, correct titles, zero selected;
- **T1:** accepted curated blueprint, selection controls and Event-relative dates;
- **T2 server preview:** four proposed items, three existing-name matches, correct
  dates/times, confirmation unchecked; no Apply;
- **History:** six entries, with distinct two-item and one-item provenance.

The normal UI consumes the real authenticated list/source endpoints; failures
would show its unavailable/permission states. Direct JSON-tab navigation was
blocked by the browser client, so no successful standalone JSON-tab/header
inspection is claimed. Positive live saved-template DETAIL cannot be exercised
before the owner's first Save; its real isolated PostgreSQL coverage already
passed. Live Member-only checks, formal screen-reader/device/browser matrix and
restore rehearsal were not repeated in this activation continuation.

No login/account/credential change, live personal-template Save or live personal
Apply was performed. My Templates is left open for the owner. Evidence:
`tmp/t3-activation-live/my-templates-ready.png` and `read-verification.json`.
Read-only SQL evidence and migration/runtime proofs are under `tmp/t3-activation-*`,
`tmp/t3-{before,new}-runtime-tls.txt`, `tmp/t3-development-migration-*`,
`tmp/t3-post-schema.json` and `tmp/t3-final-preservation.txt`.

The prior technical results remain: real PostgreSQL T2/T3 **40 PASS**, real Event
Management **77 PASS**, frontend **322 PASS**, backend **174 PASS / 29 SKIP**,
T3/T1/T2 browser **7/34/29 PASS**, and **112** identical frozen comparisons.
They were not rerun unnecessarily: runtime source is unchanged in this activation
continuation. New checks are actual development migration, TLS, preservation and
authenticated UI read/preview smoke tests. Documentation formatting and diff
whitespace checks are run separately. Existing chunk/LOCKED-format limitations
remain; no new dependency or external asset was added.

## Exact owner T3 Human Acceptance

Retained procedure. The owner has subsequently confirmed all eight acceptance
checks above; the suggested destination name/date below is an example, not a
record of which destination the owner actually used.

Open this URL in the existing signed-in browser, then click **Моите шаблони /
My Templates** (the tab selection is not encoded in the URL):

`http://127.0.0.1:5173/events/84ab5c6f-0ed8-44fb-85f0-b38b030d8694/templates`

1. Click **Запазване на задачи от това събитие като шаблон**. Select only
   **Посрещане на инструктора на летището** and **Координиране на настаняването в
   хотела**. Leave **Подготовка на първата тренировка** unselected; it remains an
   intentional separate T2 test Task.
2. Review the two reusable titles/categories/priorities. Both offsets should be
   **−1 calendar day**, with no local time for airport pickup and **15:00** for the
   hotel. Descriptions start empty. Include only explicitly reviewed/edited generic
   text and its review checkbox. Give the template a name and optional description,
   approve the full reviewed selection, then personally click Save once.
3. Wait for the separate backend Save confirmation. Open the saved version and
   inspect its stored fields. Refresh, return to My Templates and confirm the same
   private template persists. Source Event must still have all **3 original Tasks**
   and its **6 History entries**.
4. Use another authorized active **test** Event with zero Tasks. If necessary,
   personally create a new Event from `http://127.0.0.1:5173/events`, for example
   `DEMO — Templates T3 Reuse`, **2026-12-11–13**, **Europe/Sofia**. Do not use B.1
   or a LOCKED regression fixture as an Apply target. This activation created no
   destination Event on your behalf.
5. In the destination's Templates → My Templates, open the saved version, select
   its two items and request the authoritative review. For the suggested December
   11 start, both Tasks must resolve to **2026-12-10**: airport date-only, hotel at
   **15:00**. Inspect null assignees/acceptance and no reminders.
6. Personally confirm Apply once. Wait for its separate success. Verify **exactly
   2 newly created Tasks**, correct dates and initial state, two Task-created History
   entries and one private-template application entry. The original source's three
   Tasks and both T2 receipts remain untouched. Check refresh, BG/EN, theme and
   keyboard/mobile usability, then report **T3 HUMAN PASS / FAIL**.

For an uncertain Save/Apply response, recover the held original operation rather
than starting a new one. A separate confirmed Apply intentionally adds more Tasks.
No step above was automatically completed against live development.

## Status

| Status                        | Result                                            |
| ----------------------------- | ------------------------------------------------- |
| T1 HUMAN ACCEPTANCE           | PASS — PRESERVED                                  |
| T2 HUMAN ACCEPTANCE           | PASS — PRESERVED                                  |
| T3 SOURCE IMPLEMENTATION      | COMPLETE                                          |
| T3 PRIVATE STORAGE            | PASS — isolated SQL and owner-confirmed live Save |
| T3 OWNERSHIP ISOLATION        | PASS — real isolated PostgreSQL                   |
| T3 REAL POSTGRESQL TESTS      | PASS                                              |
| SAVED TEMPLATE APPLY          | PASS — isolated PostgreSQL/browser                |
| MIGRATION 0012 ON DEVELOPMENT | APPLIED                                           |
| LIVE T3 BACKEND               | ACTIVATED — PID 24392                             |
| LIVE PERSONAL TEMPLATE SAVE   | PASS — personally performed by owner              |
| LIVE PERSONAL TEMPLATE APPLY  | PASS — personally performed by owner              |
| T3 HUMAN ACCEPTANCE           | PASS 8/8 — owner-confirmed                        |
| EVENT MANAGEMENT STAGES 1–7   | PRESERVED                                         |

NOIT 2025–2026 remains a historical reference. Any 2026–2027 categories, deadlines,
formatting, assessment or availability rules need separate verification. This
activation makes no new competition-rule or legal-compliance claim.

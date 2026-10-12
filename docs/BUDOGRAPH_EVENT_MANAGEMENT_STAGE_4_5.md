# Event Management Stages 4 + 5 — 2026-10-12

## Final LOCK record

The project author explicitly confirmed **HUMAN PASS** for Stage 4 and Stage 5,
with **combined Human Acceptance — 6/6 PASS**, on **2026-10-13**, and authorized
this documentation-only final LOCK. Accepted implementation:
`d2b4340a079ebaf7d3ad9149624e0cdca544b762`
(`feat(app): add safe event duplication`), committed and pushed to `origin/main`.
The documentation preflight verified that exact local/remote `main`, a clean
tracked tree/index and the unchanged unrelated shortcut.

| Accepted feature           | Technical gate  | Human gate | Final status       |
| -------------------------- | --------------- | ---------- | ------------------ |
| Stages 1–3                 | PASS, preserved | Preserved  | LOCKED — PRESERVED |
| Stage 4 — Operation Safety | TECHNICAL PASS  | HUMAN PASS | LOCKED             |
| Stage 5 — Duplicate Event  | TECHNICAL PASS  | HUMAN PASS | LOCKED             |
| Combined Stage 4 + 5       | PASS            | 6/6 PASS   | LOCKED             |

This records the author's checks; Codex did not rerun human or product tests.
No product/test code, migration, schema, dependency, configuration, infrastructure,
password, session or database data is changed by this LOCK task. No service restart,
browser/PostgreSQL matrix or visual-reference regeneration occurs. The LOCK record
is finalized by the successful dedicated documentation commit; its actual SHA and
push outcome are reported separately, without self-referencing the commit.

### Locked Stage 4 scope

Durable PostgreSQL receipts apply only to `EVENT_DUPLICATE`, identified by the
trusted actor and UUID Idempotency-Key with a canonical SHA-256 payload digest.
Event, sole Organizer membership, creation ActivityEntry and receipt commit or
roll back together. Concurrent identical requests, same-key retries after lost
responses and independent backend-process replay return one accepted result
without duplicate business or history writes. Different canonical content or
scope returns `409 IDEMPOTENCY_KEY_REUSED`.

Current active source Organizer authorization precedes receipt lookup; accepted
replay also requires current destination Organizer access. Initial acceptance and
exact replay return the creation-time `201 { event }`, with `no-store`; current
Dashboard reads obtain current data. A fresh stale source version returns
`409 EVENT_VERSION_CONFLICT`. Failures and explicit same-key recovery retain the
implemented transactional boundaries. Additive
[`0008_event_command_receipts.sql`](../server/migrations/0008_event_command_receipts.sql)
is accepted; the previous seven migrations/checksums remain preserved. Existing
Create/Edit/Task/Change/Profile commands are not made generally idempotent.

### Locked Stage 5 scope

An active Organizer of an accessible active or archived source can create a new
independent active Event. A source Member without Organizer authority cannot
duplicate it. The new Event has fresh Event/membership identities, version 1,
fresh timestamps and the requesting identity as its owner and sole Organizer.
Duplication leaves the source unchanged.

The reviewed target fields are **name, start date, end date and timezone**. The
form suggests a localized bounded copy name and source timezone, leaves both dates
empty, and permits explicit editing of all four fields. Localized validation,
safe submission, same-key uncertain-response recovery and successful new-Event
Dashboard navigation are accepted.

Excluded: source identity/lifecycle/timestamps/version, source member roster,
Tasks and assignment/acceptance, invitations, Changes and links,
Decision/Response/Plan B, old ActivityEntries, notifications and reminders.
Only one fresh creation/provenance ActivityEntry is written per accepted duplicate
command; operational relationships do not point to source records.

### Author-confirmed human acceptance

Acceptance date: **2026-10-13**. Combined result: **6/6 PASS**.

| Human check group                                                          | Author-confirmed result |
| -------------------------------------------------------------------------- | ----------------------- |
| Organizer/Member permissions, including active/archived source eligibility | PASS                    |
| Reviewed metadata, suggested defaults, empty dates and clear copy boundary | PASS                    |
| Independent Event, sole Organizer, excluded records and unchanged source   | PASS                    |
| Repeated submission, retry/recovery, refresh and Back/Forward              | PASS                    |
| Validation, authorization and preserved Create/Edit/History workflows      | PASS                    |
| Desktop/mobile usability, BG/EN, Light/Dark, keyboard/focus and design     | PASS                    |

These are explicit project-author confirmations, separate from automated evidence.
They do not claim formal accessibility certification, cross-engine certification
or newly performed physical-device testing.

### Preserved evidence, previous locks and limits

The [preserved technical results](TEST_EVIDENCE.md#event-management-stages-4--5--2026-10-12-technical-pass)
and report below remain authoritative: frontend **286 PASS**; backend **141 PASS /
19 expected opt-in skips**; real PostgreSQL **138/138**; focused PostgreSQL
**12/12**; principal browser **111 groups / 256 cases**; final direct shared backend
Duplicate **13** and History **8** groups; original visual matches **112/112** with
two negative controls; security PASS, zero secret/artifact findings; idempotency
and duplicate integrity VERIFIED. Original **2395** ActivityEntries and all **2518**
pre-reload history records were preserved, together with original data in **14**
tables, credentials, sessions and migration history. Exactly one authorized backend
reload occurred during implementation; Vite and PostgreSQL remained running.
These results are preserved records, not new executions in this LOCK task.

Implementation publication is recorded in Git and the
[committed acceptance/evidence record](TEST_EVIDENCE.md#event-management-stages-4--5--author-acceptance-and-lock-2026-10-13).
The [local implementation publication receipt](../tmp/event-management-stage45/publication.json)
and all `tmp/event-management-stage45/` logs/JSON/screenshots referenced below are
**ignored, uncommitted local evidence**, available in the original workspace only;
they are not portable artifacts included in a repository clone. The local original
contract copy has the same boundary. The committed report and TEST_EVIDENCE retain
the accepted results, implementation SHA and evidence inventory.

[Stage 1 LOCK](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_1.md#stage-1-lock-record) and
[Stage 2 + 3 LOCK](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_2_3.md#final-lock-record) remain
byte-for-byte unchanged, including their dates and implementation SHAs. Their
listing, filters/search, Manage navigation, Create/Edit, History, auth/permissions,
workspace behavior and original locked designs remain preserved.

Only Duplicate has durable receipts. Unsubmitted drafts remain in memory;
uncertain submitted recovery requires the retained identity/key and existing
session/tab storage, with its documented memory fallback. There is no general
unsaved-form guard, receipt directory, expiry or purge. The **579.82 kB** build
advisory remains. Formal device/engine/accessibility certification and verification
of NOIT **2025–2026** requirements for the actual later competition year remain
separate. [Known limitations](KNOWN_LIMITATIONS.md#event-management-stages-4--5--2026-10-12)
continue to apply.

Stage 6 **Archive Event** and Stage 7 **Clear All Tasks** remain **NOT STARTED**.
The existing Archived listing filter is not an Archive operation; no Archive Event
button is claimed. Templates, Budget, Calendar, AI, PWA and Web Push are excluded.

## Preserved technical report — 2026-10-12

The implementation-time record below is retained unchanged, including its
pre-human-acceptance PENDING/NOT LOCKED status and failed-run explanations.
The final author-confirmed LOCK above supersedes those historical status labels.

Stage 4, Stage 5 and combined verification are **TECHNICAL PASS**, including
direct shared-runtime Organizer/Member integration after the owner-authorized
single backend reload. Human Acceptance is **PENDING**, Stage 4 + 5
are **NOT LOCKED**, and Stages 6–7 are **NOT STARTED**. This report does not alter
the accepted Stage 1 or Stage 2 + 3 LOCK records.

## 1. Authorization and baseline

The owner authorized one coordinated Stage 4 Operation Safety + Stage 5 Duplicate
Event implementation, focused checkpoints, real PostgreSQL/browser/security
verification, documentation and conditional publication only after Technical PASS.
Starting `main`, local and fetched `origin/main` matched
`4167af65cc919d4d77962d1bd9847e70f45e8b26`; tracked worktree/index were clean.
`docs/market-research/docs - Shortcut.lnk` remains unrelated and excluded.

The original approved contract was recovered from **Review Event Management
contract**, chat `01a11d79-8140-7ca1-8d65-f700d7fe45ea`, by read-only retrieval.
The Stage 1 authorization explicitly records that the owner approved that contract.
An unmodified local evidence copy is retained at
`tmp/event-management-stage45/original-contract.md`. Exact original decisions:
Organizer-only Duplicate including archived sources; reviewed four-field target;
prefilled localized name/timezone, empty dates; requester owns the new Event;
source version, UUID Idempotency-Key, actor/key receipt uniqueness and atomicity.
Existing Create/Edit semantics remain unchanged.

## 2. Stage 4 implementation

`server/src/events/operations.ts` is a narrow Event command boundary, currently
supporting only `EVENT_DUPLICATE`. It does not wrap unrelated Task/Change/Profile
commands or expose future Archive/Clear endpoints. The trusted session supplies
the actor. Source UUID and required `Idempotency-Key: <UUID>` are normalized;
strict existing Event validation rejects unknown fields.

Canonical SHA-256 content includes command type, source ID, expected source
version, trimmed target name, start/end calendar strings and timezone in fixed
order. Property order and name padding cannot create different canonical content.
Different target content, command or authorized Event scope with the same
actor/key produces `409 IDEMPOTENCY_KEY_REUSED`.

The additive PostgreSQL receipt contains actor, key/type, source/result Event IDs,
digest, accepted Event DTO and server timestamp. It stores no raw request, cookies,
passwords, bearer tokens or general audit snapshots. Receipt rows are immutable,
have restrictive foreign keys, and use RLS with no browser policies. The accepted
DTO is a creation-time result; later metadata edits do not rewrite it. Normal
Dashboard reads obtain current canonical data.

## 3. Transactions, concurrency and recovery

Within the existing transaction helper:

1. Acquire a transaction-scoped advisory serialization lock derived from actor/key.
2. Lock source Event `FOR SHARE`, then active membership and identity `FOR SHARE`.
3. Require current same-Event Organizer authority before receipt lookup.
4. If a committed receipt matches content/scope, require current Organizer access
   to its destination and return the accepted result. Replays bypass stale source
   version checks but never current authorization.
5. For a new command, require the reviewed source version, then create destination,
   membership and creation ActivityEntry and insert its receipt.
6. Commit all effects together; any failure rolls everything back.

Advisory hash collisions can only serialize unrelated requests; exact actor/key
primary key and digest determine identity. Independent connections and Node
processes use PostgreSQL, with no in-memory correctness registry. There are no
pending receipt rows, expiry, purge, automatic repair or automatic conflict replay.
Existing 3s lock / 10s statement limits remain. Transient failures return a small
safe error and permit explicit same-key retry.

Stage 4 checkpoint preceded Duplicate implementation: **5/5 unit** and **7/7 real
PostgreSQL** tests passed, including four concurrent requests, canonical retry,
conflicting payload, access denial, business/receipt rollback, lost-response retry
and a fresh independent Node process that could only replay a durable receipt.
Duplicate accepts a terminal source INTEGER version because it does not increment
the source; existing Edit retains its previous increment-safe bound.

## 4. Stage 5 product and exact copy boundary

`POST /api/events/:eventId/duplicate` requires authenticated trusted-Origin writes,
bounded JSON, UUID Idempotency-Key and these five body fields only:

| Field             | Meaning                                                         |
| ----------------- | --------------------------------------------------------------- |
| `name`            | Reviewed target name, trimmed, 1–200 UTF-16 units               |
| `startDate`       | Explicit target calendar date; never silently prefilled         |
| `endDate`         | Explicit target calendar date, on/after start                   |
| `timezone`        | Reviewed target IANA timezone, runtime and PostgreSQL validated |
| `expectedVersion` | Reviewed source Event version                                   |

Initial form name is source name plus ` (copy)` / ` (копие)`, truncated without
splitting a surrogate pair. Timezone is prefilled; dates are empty. All four target
basics remain editable before submitting. Explicitly choosing source-equivalent
dates is allowed; the application does not silently copy them.

Destination defaults: fresh random Event/membership IDs, requester ownership,
one active Organizer with empty operational role, version 1, fresh timestamps and
`archived_at = NULL`. Exactly one fresh `EVENT_CREATED` entry records target basics,
version and source ID/version/operation provenance. Source activity is untouched.

Excluded entirely: source identity/lifecycle/timestamps/version, Tasks,
assignment/acceptance, team roster, invitations, Changes and links,
Decision/Response/Plan B, old ActivityEntries, notifications and reminders.
Only the requesting identity receives destination membership.

Both initial acceptance and exact accepted replay return `201 { event }` and
`Cache-Control: no-store`. Source version conflicts return
`409 EVENT_VERSION_CONFLICT`; invalid fields/IDs/key return 400, accessible Member
403, foreign/revoked membership 404, and unavailable session 401 at HTTP boundary.
Active Organizers may read an archived source to create an independent active Event.

## 5. Migration

`0008_event_command_receipts.sql` was reviewed and applied explicitly through
`pnpm db:migrate`: **1 applied, 7 already applied**. No preceding SQL file or
checksum changed. The complete real integration run confirmed an unchanged
migration rerun twice: **0 applied, 8 already applied**. No destructive migration,
historical rewrite, dependency or environment change is introduced.

## 6. Automated gates

Evidence root: `tmp/event-management-stage45/` (ignored).

| Gate                                                 | Executed result                                          | Evidence                               |
| ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Frontend suite                                       | 286 PASS, no failures/skips                              | `verified-frontend-tests.log`          |
| Backend default suite                                | 141 PASS + 19 expected opt-in skips, 160 total           | `final-backend-tests.log`              |
| Stage 4 focused unit                                 | 5 PASS                                                   | command output / full default suite    |
| Stage 4 focused PostgreSQL                           | 7 PASS                                                   | `stage4-postgres.log`                  |
| Stage 5 focused PostgreSQL                           | 12 final PASS; initial 11 retained                       | `stage5-final-focused.log`             |
| Full serial real PostgreSQL                          | 138 final PASS, no failures/skips; initial 137 retained  | `postgres-final.log`                   |
| Frontend/backend typecheck, lint, formatting, builds | All PASS on final source                                 | `verified-*.log`, `final-server-*.log` |
| Strict original interiors                            | 112 exact matches; deliberate negative controls retained | `locked-screens/report.json`           |

Default integration skips are not counted as PostgreSQL proof. The enabled serial
run includes all integration suites, Better Auth rollback-only Profile/account
fixtures, independent connection races, schema/history and existing commands.

## 7. Real PostgreSQL safety proof

The production Duplicate service was tested against a source with Tasks,
assignment/acceptance, multiple memberships, invitation, linked Change with
Decision/Response/Plan B, history, reminder configuration and delivered notification.
Independent row assertions prove the exact target basics, sole requesting
Organizer, empty excluded tables, single new creation history and byte-equivalent
source row snapshots. Non-owner source Organizers correctly own their copies.

Rollback-only tests prove no Event/member/activity/receipt survives an injected
receipt failure, followed by a safe same-key retry. Independent service instances
share one accepted result. Source edit serialization rejects a fresh stale command
with no receipt; deactivation while authorization waits prevents effects. Old
accepted receipts remain inaccessible after source/destination revocation.
Receipt UPDATE protection is exercised only on owned rollback fixtures; DELETE
and TRUNCATE trigger coverage is inspected without destructive statements.

## 8. Browser workflow

Initial real verification at `http://127.0.0.1:5173` forwards only Duplicate POSTs
to an owned ephemeral Fastify/Auth/Event production-factory backend. Existing
authentication and workspace APIs use the unchanged shared backend. The owned
bridge, browser, contexts and pool close normally; no credentials or auth traces
are saved. The owner subsequently authorized exactly one shared-backend reload;
the direct final runs use no temporary backend bridge.

Verified initial run: **11 functional groups / 28 layouts**; Organizer discovery,
blank-date validation, rapid submission, exact independent result, refresh and
Back/Forward, committed lost-response/refresh/same-UUID recovery, concurrent HTTP
replay, Member/foreign denial, archived source, and Organizer/Member history.
The extended run additionally checks real source-version conflict and labelled
server validation recovery. The nine principal suites completed **111 groups /
256 layout and labelled stress cases**: Duplicate, Event Management, Auth,
Workspace, Task actions/authoring, Changes, Event authoring and direct History.
The initial History source had fewer than 50 records; an additional **8-group**
read-only run against the established controlled fixture proves older-page append,
both Task/Change links and preserved history. An additional **13-group** current-source
recovery run proves committed network loss and malformed HTTP409 acknowledgement
both hold the same UUID/fields across refresh. These targeted runs reuse the
completed 28-layout matrices; their records are separate, not extra layout cases.
All recorded application errors are zero. `verification-summary.json` reconciles
the exact counts and cleanup assertions.

Final direct integration: **13 Duplicate groups** and **8 History groups**, both
at `127.0.0.1:5173` against shared backend `3001`, with no matrix repetition.
Real Better Auth Organizer/Member sessions exercise initial acceptance, rapid
submit, concurrent same-key replay, changed-payload rejection, source isolation,
Member/foreign denial, archived-source duplication and single creation history.
Labelled network and unreadable-409 acknowledgement fixtures commit on that shared
backend and recover the same UUID/result after refresh. Direct History proves
deterministic older-page append, Task/Change links, revoked-session recovery and
unchanged records. Both runs have zero application errors and successful owned
session/resource cleanup (`duplicate-direct/report.json`, `history-direct/report.json`).

## 9. Authorization and security

No UI, body role, ownership label, operation key or tab storage grants authority.
Current active identity/source Organizer is locked before receipt lookup; an
accepted destination must still be Organizer-accessible. Malformed/forged fields,
untrusted Origin/Fetch Metadata, cross-Event key reuse, revoked membership,
inactive identity and foreign sources are covered. HTTP errors are minimized.
Final direct shared-runtime authorization and replay checks pass. The final
secret/private-artifact scan finds zero actual secrets or forbidden artifacts.
The development DB's existing broad privileges/RLS bypass are not represented as
production least privilege. Receipt RLS is not a substitute for server checks.

## 10. Existing history and LOCK preservation

Stage 1 and Stage 2 + 3 report blobs remain identical to starting HEAD. Existing
ActivityEntry append-only protection is untouched. The original **2395** history
IDs/hashes and seven original migration checksums were captured before writes;
the final preservation comparison passes for every original record. All **23**
account rows also match the accepted Stage 2 + 3 fingerprint, including credentials
and account metadata. Only controlled new fixture history
is permitted. Original locked PNG references are read-only and never regenerated.
Immediately before/after the reload, all **14** captured table counts/content
fingerprints match, including sessions, all **2518** then-existing history rows,
eight migrations and 39 receipts. After both direct browser runs, the same original
14-table fingerprints match again when excluding only the eight declared new
fixture Events and their rows. Those are one owned source plus seven successful
logical copies; no original business/auth/history row changed
(`runtime-integrity.json`, `post-browser-integrity.json`).
History DTO/order/pagination and existing Task/Change/Profile/Auth commands are
unchanged. Create reuses the same transactional inserts, with provenance added
only for Duplicate.

## 11. Visual verification

The strict established runner passes **112/112 exact original interiors** across
seven widths, BG/EN and both themes. Two deliberate interior-change controls prove
the comparison detects regressions. New Duplicate has **28** layouts with long
source names, no horizontal overflow, reachable 44px controls and short-viewport /
125% text checks. Selected 320px BG Dark and desktop EN Light captures were viewed.
The sole management-row addition is its permission-scoped Duplicate link; existing
filters, search, Open/Edit/History and five navigation items are retained.

## 12. Fixture/resource cleanup

Constraint/business tests use owned rollback-only fixtures wherever possible.
Independent connections/processes require committed visibility; these explicitly
synthetic concurrency fixtures and intentional browser-created Events are retained
under the established append-only history policy. No business/history purge or
cleanup deletion occurs. Browser-owned sessions sign out; pre-existing sessions
are preserved. Established account passwords, configuration and Vite stay intact.
Aggregate resource/session/preservation checks pass. Shared backend PID **28236**
became **34372** in exactly **one** owner-authorized reload attempt. Ownership and
absence of active tests/cleanup were checked immediately before stopping it.
The identical executable, entry point, environment files and working directory
were used. Vite PID **26668** remains unchanged; PostgreSQL and other services
were not restarted. Liveness/readiness are 200; anonymous Duplicate/History
requests return 401. Existing sessions and credentials survive the reload.

## 13. Documentation and executed failures

Update this report, backend setup/API notes, test evidence, limitations, AI log,
user guide, README and changelog. Previous LOCK records and historical evidence
remain unchanged. Initial new test typing errors were harness-only and fixed;
the first browser run incorrectly used Playwright `isDisabled()` on a fieldset.
The corrected test checks its native disabled property and every actual input;
the lost-response workflow passed. Failed runs remain recorded, not relabelled.
Final review fixed Duplicate's unreadable/unknown HTTP409 classification: only a
known `EVENT_VERSION_CONFLICT` can release the held identity. Unknown conflict
responses stay uncertain and retain the UUID; a real committed malformed-409
transport fixture proves refresh recovery without a second Event/history write.
A preservation helper's text-version/integer comparison failed read-only before
migration, then passed after using the schema's actual version type.

## 14. Limits and deferred work

Only new Duplicate uses durable receipts. Existing Create/Edit retain their
approved behavior; Create uncertainty still requires checking management.
Unsubmitted drafts remain in memory. A submitted uncertain Duplicate stores its
reviewed fields/key per identity/source in tab sessionStorage for refresh recovery;
the backend receipt is the correctness boundary. If tab storage is unavailable,
in-tab memory supports recovery, but clearing/closing the tab cannot recover its
key. No general unsaved-form guard or receipt directory is introduced.

Other engines, physical devices and human accessibility acceptance remain separate.
The existing Vite size advisory remains: current build **579.82 kB** JS, no new
dependencies or chunk-policy change. Archive, Clear All Tasks, Templates, AI,
deployment and PWA/Web Push are excluded. Supplied NOIT **2025–2026** requirements
remain a historical framework requiring verification for a later participation year.

## 15. Publication

Final source quality/diff review passes. Secret/private-artifact review finds zero
real secret matches or forbidden artifacts. Every required Technical PASS gate,
including final direct shared-runtime Duplicate and History integration, is closed.
The owner authorized publication after those gates. The authorized publication
uses an authorized-file-only `feat(app): add safe event duplication`
commit to `origin/main`; matching local/remote HEAD and a clean tracked tree/index
are required post-publication checks. The exact final SHA and actual push outcome
are recorded in the final response and local publication evidence, not
self-referenced inside its own commit. The unrelated shortcut is excluded.

## 16. Human Acceptance checklist — PENDING

1. Organizer duplicates active and archived sources; Member controls remain absent.
2. Source and copy boundaries are understandable; name/timezone defaults and
   explicit new dates behave correctly in BG/EN.
3. New Event has independent basics, one requesting Organizer and no inherited
   Tasks/Team/Changes/history; source remains unchanged by duplication.
4. Pending/rapid-submit and uncertain-response recovery return one logical result;
   refresh/Back/Forward open the correct Event.
5. Validation/version recovery is understandable and permission/session changes
   fail safely; Create/Edit/History remain usable.
6. Desktop/tablet/narrow mobile, Light/Dark, keyboard focus and locked visual
   language meet the owner's expectations.

No human PASS or Stage 4 + 5 LOCK is inferred from automated tests. Stop after this
package; Stages 6–7 remain NOT STARTED.

## Final technical closure

The exact reload authorization was granted and used once. All required technical
gates pass, including the direct shared backend Organizer/Member flows. Source,
configuration, original business/history data, credentials, sessions, Vite and
Stages 1–3 LOCK remain preserved. Final publication outcome/SHA is reported after
the actual commit/push verification. Human approval remains a separate pending gate.

```text
EVENT MANAGEMENT STAGE 4: TECHNICAL PASS
EVENT MANAGEMENT STAGE 5: TECHNICAL PASS
COMBINED VERIFICATION: PASS
STAGES 1–3 LOCK: PRESERVED
IDEMPOTENCY: VERIFIED
DUPLICATE EVENT INTEGRITY: VERIFIED
SECURITY: PASS
COMMIT/PUSH: actual verified outcome in the final response and publication evidence
HUMAN ACCEPTANCE: PENDING
STAGE 4 + 5 LOCKED: NO
STAGES 6–7: NOT STARTED

STOP.
```

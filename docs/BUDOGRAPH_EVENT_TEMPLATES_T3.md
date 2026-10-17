# BudoGraph — Event Templates V1 / T3

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

The subsequent Git checkpoint reruns **322 frontend PASS**, **174 backend PASS /
29 explicit DB skips**, both TypeScript checks/builds, lint, scoped formatting and
whitespace checks. It audits 39 T3 paths and secrets, verifies unchanged 0001–0011
and the exact 0012 checksum, and excludes the unrelated shortcut. Earlier real SQL
and browser suites are preserved, not rerun against development. The checkpoint
does not alter the database or restart services; its inspected backend PID is
33596 and Vite PID is 27776. PID 24392 below is historical activation evidence.
[Fresh checkpoint evidence](TEST_EVIDENCE.md#t3-source-control-checkpoint-verification--2026-10-17).

Implementation and verification: 2026-10-17. Source baseline:
`ff9edd97d06d86543dd5597b1136fae8659033f0`, `main`.

**T1 HUMAN PASS — 6/6; T2 HUMAN PASS — 6/6; B.1 HUMAN PASS: preserved.**
These are prior owner acceptances, not new automated human tests.
**T3 HUMAN ACCEPTANCE: PASS 8/8 — owner-confirmed and documented above.**

**Development update:** Owner clarification resolved the additional T2 operation.
Migration 0012 is **APPLIED** and T3 backend **ACTIVATED**, PID **24392**, with
one graceful restart. All three source Tasks, both receipts, B.1 and Stages 1–7
are preserved. [Backup, migration, TLS, live reads and exact owner acceptance](BUDOGRAPH_EVENT_TEMPLATES_T3_ACTIVATION.md).
The original source handoff's stopped-activation observations below are historical.

## Files modified and created

Modified existing files:

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/PRESENTATION_OUTLINE.md`
- `docs/TEST_EVIDENCE.md`
- `docs/THIRD_PARTY_NOTICES.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `server/migrations/README.md`
- `server/src/app.ts`
- `server/src/main.ts`
- `server/src/templates/history.ts`
- `server/src/templates/model.ts`
- `server/src/templates/service.ts`
- `server/tests/template-acceptance.integration.test.ts`
- `src/i18n/messages.ts`
- `src/pages/StarterTemplatesPage.tsx`
- `src/pages/templates/TemplateApplicationPanel.tsx`
- `src/services/eventHistory.ts`
- `src/services/templateApplications.ts`

Created files:

- `docs/BUDOGRAPH_EVENT_TEMPLATES_T3.md`
- `scripts/verify-personal-templates-ui.mjs`
- `server/migrations/0012_personal_templates.sql`
- `server/src/routes/personalTemplates.ts`
- `server/src/templates/context.ts`
- `server/src/templates/library.ts`
- `server/tests/helpers/personal-template-replay.ts`
- `server/tests/personal-templates.integration.test.ts`
- `server/tests/personal-templates.test.ts`
- `src/i18n/personalTemplateMessages.ts`
- `src/pages/templates/MyTemplates.tsx`
- `src/pages/templates/personal.css`
- `src/services/personalTemplates.test.ts`
- `src/services/personalTemplates.ts`

The unrelated `docs/market-research/docs - Shortcut.lnk` was never modified,
staged, removed or overwritten. Generated evidence/builds remain ignored. The activation continuation additionally
adds `docs/BUDOGRAPH_EVENT_TEMPLATES_T3_ACTIVATION.md` and extends the T2 activation
record with the separate owner clarification; no runtime source changes.

## Implemented scope and design

The authenticated Templates page has separate Built-in and My Templates sections.
The accepted curated Aikido blueprint remains the default. My Templates supports
CREATE, owner-only paginated LIST, DETAIL and REUSE. It is PostgreSQL storage,
not localStorage persistence or a mock library.

In an active Organizer Event, load existing Tasks, select 1–50, and review their
reusable fields. Give the template a name and optional description. Titles,
categories and priorities are editable. Every Task description starts **empty**.
The original description can be opened separately, copied for editing, edited
or removed. Nonempty context needs its own explicit review checkbox, as well as
the final approval of the complete template. There is no automatic personal-data
detection. Template names/descriptions and Task titles also need human review.

Save and Apply have separate confirmations and success messages. Save creates
one private immutable version and generated item UUIDs. It never changes source
Tasks or writes source Event History. Refresh, navigation, new connections and
new backend processes can retrieve committed versions independently of source
Task changes. Source archive/revocation prevents a new Save or Save receipt replay;
it does not remove an already owned library blueprint.

Open a saved template, select items, and inspect calendar dates relative to the
current destination Event. Request the authoritative server review and explicitly
confirm Apply. The same accepted T2 service performs curated and saved Apply:
destination authorization, date resolution, stale-review validation, Task creation,
History, durable receipts and replay handling. There is no second bulk Task API.

BG/EN, existing themes, native keyboard controls, focus feedback and responsive
styles are included. The private Apply panel stays mounted during workspace refresh
so a backend-confirmed result is not lost while current Event data reloads.

## Privacy and permission boundary

- Session identity supplies the owner. Owner/actor/browser Task-state fields are
  rejected by strict request allowlists.
- Library list/detail require a current active account. Every private blueprint
  lookup filters by template ID, owner and immutable version **before** reading
  items or looking up an Apply receipt.
- Unknown, foreign and inaccessible private identities return the same 404.
  An Organizer in the same Event still cannot inspect or use another user's template.
- Save rechecks the source Event, current active Organizer membership, active
  identity, Event version, selected Task ownership/deletion/version and final fields.
- Apply rechecks destination Organizer access and rejects archived destinations,
  including receipt retries. Template ownership never supplies Event access.
- New Tasks have new IDs, not-started status, null assignee/acceptance, version 1
  and no reminders. No operational state, contacts, notifications, Changes,
  invitations, decisions, source Task IDs or old ActivityEntries enter the blueprint.
- Event History shows `private-template`, version and operation for private
  provenance. It exposes no private library ID, name, description or item IDs.
  Normal newly created Task content is visible to authorized destination members.
- Existing Better Auth, trusted-Origin and Fetch Metadata boundaries remain.
  Private routes use `Cache-Control: no-store`, bounded bodies, parameterized SQL
  and existing sanitized error handling. There are no new secrets or dependencies.

Save retry metadata includes the **reviewed final request**, keyed to the user,
in sessionStorage for this browser tab, with an in-memory fallback. It excludes
unselected original descriptions and authentication data and is removed after a
confirmed Save. It can contain reviewed text; this is explicitly temporary recovery
data, not a canonical library/cache. Closing the tab may lose that recovery hint;
the committed blueprint and receipt remain in PostgreSQL. Apply retains the
existing T2 metadata-only recovery mechanism. Neither operation silently changes
its key after an uncertain result or reuses a key with an edited payload.

## Atomic Save and calendar rules

One transaction takes an actor/operation advisory lock, then the established
Event → member → identity locks. Current permission precedes receipt lookup.
An exact receipt retry returns the original template identity. Same key with a
different canonical payload or source Event gives 409. A fresh command locks and
rechecks every selected Task version, inserts template/version/items/receipt, and
commits all together. Any SQL error rolls everything back. The primary key and
advisory lock prevent concurrent duplicate Saves.

The backend derives offsets from strict source DATE values, as differences of
Gregorian calendar ordinals. It never measures elapsed local instants or adds
24-hour durations across DST. Offsets are integers in **−3660…3660**. Source rows
outside that range are labeled unavailable for selection; attempted Saves fail.
The accepted T1/T2 resolver translates offsets to destination DATE values within
0001–9999. Optional local `HH:mm` remains separate and unchanged. Date-only stays
null. T3 does not resolve DST gaps/repetitions into UTC instants or schedule reminders.

## API contract

All routes require the existing authenticated session; no owner parameter exists.
List/source pages use up to 50 rows and an optional UUID `after` cursor.

| Method | Route                                    | Behavior                                                                              |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/api/templates/mine`                    | Owner's cards, item counts, timestamps and `nextCursor`                               |
| GET    | `/api/templates/mine/:templateId`        | Owner's immutable v1 metadata/items                                                   |
| GET    | `/api/events/:eventId/templates/source`  | Organizer-only reviewed source fields/versions; original context is only review input |
| POST   | `/api/events/:eventId/templates/save`    | Atomic Save; `Idempotency-Key` UUID; maximum 1,100,000 bytes                          |
| POST   | `/api/events/:eventId/templates/preview` | Existing T2 endpoint; curated slug or private UUID/version/items                      |
| POST   | `/api/events/:eventId/templates/apply`   | Existing T2 atomic/idempotent command and receipt shape                               |

Save body:

```json
{
  "name": "Reviewed logistics",
  "description": "Optional reusable description",
  "expectedEventVersion": 1,
  "items": [
    {
      "sourceTaskId": "<source Task UUID>",
      "expectedTaskVersion": 1,
      "title": "Reviewed title",
      "category": "Logistics",
      "priority": "normal",
      "context": "",
      "contextReviewed": false
    }
  ],
  "confirmed": true
}
```

First acceptance and exact replay return 201:
`{operationId, templateId, templateVersion: 1, itemCount}`.
Metadata limits: name/title 200, template description 2000, category 100,
Task context 5000 characters. Final Task fields reuse existing authoring validation.
Source IDs/versions are review inputs only; they are not stored in blueprint items.

Saved Preview/Apply use the unchanged T2 selection shape:
`{templateId: "<private UUID>", templateVersion: 1, itemIds: ["<item UUID>"], language}`.
Private text is reused as authored; BG/EN switches the UI and review language
metadata, and does not automatically translate user-authored content.
Apply adds `expectedEventVersion`, `reviewRevision`, `confirmed: true` and the
existing `Idempotency-Key` header. Its revision includes resolved private content,
identity/version, selection, Event, actor and matching active Tasks.

Errors include existing T2 errors and `SOURCE_TASK_VERSION_CONFLICT`.
Stale reviews require reloading source/review. An uncertain result retains the
original operation for recovery; key/payload conflicts do not generate a new key.

## Migration 0012

`server/migrations/0012_personal_templates.sql` adds four explicit tables:

- `personal_template`: generated UUID, owner FK, timestamp, owner/cursor index;
- `personal_template_version`: composite identity/version, bounded metadata,
  timestamp; T3 creates version 1 only;
- `personal_template_item`: composite version FK, stable generated UUID,
  unique bounded position, reusable allowlisted fields and DATE offset/local TIME;
- `personal_template_save_receipt`: actor/operation PK, source Event/template FKs,
  request digest and timestamp; no copied source Task records or description cache.

All four have RLS enabled without browser policies, PUBLIC/anon/authenticated
privileges revoked, restrictive FKs and immutable mutation triggers. The existing
backend database role accesses them with explicit session-owner filtering.
0012 extends existing application-receipt validation to private UUIDs and 1–50
items. The curated slug/version retains its 1–4 bound. Existing receipt rows and
immutable triggers stay intact. Migrations 0001–0011 are byte-preserved.

0012 SHA-256: `3a401ca6be72f60ec6698f05ecc582cb63fa40e30d3e46beb1c6d8a3bace76e1`.

## Verification evidence

The existing restricted external PostgreSQL 17.11 cluster was independently
checked: current Windows owner/SYSTEM ACL, owner marker, SCRAM, loopback-only
127.0.0.1:55432, expected data directory and system ID `7697374354312044444`.
Its runner has no superuser/createdb/createrole rights. A fresh dedicated database
`budograph_t2_isolated_t3_20261017_eb975bcf9737` was created. No application env
file or development DB URL was used for isolated tests.

| Check                                                                 | Result                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Real PostgreSQL T2 + T3 suites                                        | **40/40 PASS**, zero skips/failures                                      |
| Real Event Management contract suites                                 | **77/77 PASS**, zero skips/failures                                      |
| Frontend unit/service tests                                           | **322/322 PASS**                                                         |
| Backend default tests, DB opt-ins disabled                            | **174 PASS / 29 SKIP / 0 FAIL**                                          |
| Frontend/backend TypeScript and builds                                | **PASS**                                                                 |
| ESLint                                                                | **PASS**                                                                 |
| Changed-file formatting and `git diff --check`                        | **PASS**                                                                 |
| Full frontend formatting                                              | Pre-existing FAIL: unchanged LOCKED `EventArchiveDialog.tsx`             |
| T3 Chromium with real isolated services/SQL, synthetic authentication | **7/7 PASS**                                                             |
| T1 synthetic browser regression                                       | **34/34 PASS**                                                           |
| T2 synthetic browser regression with SQL double                       | **29/29 PASS**                                                           |
| Original LOCKED screenshots                                           | **112/112 pixel-identical**, 2 negative controls detected; no rebaseline |

Real SQL evidence covers owner-only storage/retrieval, cross-user non-disclosure
including another Organizer, Member/revoked/inactive restrictions, source versions,
context opt-in, zero source mutation, immutable tables, all four Save write rollback
points, eight concurrent same-key Saves, changed payload conflicts and recovery in
a new Node process. Saved Apply has actual SQL rollback, concurrency/replay,
destination membership/archive checks, DATE/TIME storage, initial state and History.
Existing curated T2 tests retain their rollback, race, fresh-process and leap/DST
coverage. The T2 acceptance migration-count assertion advances from 11 to 12;
its behavioral assertions remain.

T3 browser cases use actual Fastify routes/services and PostgreSQL, but synthetic
identity and fully intercepted HTTP. They are **not live owner acceptance**.
They cover desktop/tablet/320–390px, BG/EN, themes, keyboard, description exclusion/
editing, refresh/navigation persistence, lost Save and Apply responses with reload,
exactly two new Tasks, three History entries, and disabled Member/archive Save.
No request reached the shared database; no unexpected requests or page errors.

Ignored local evidence: `tmp/t3-real-postgres.txt`, `tmp/t3-real-event-contracts.txt`,
`tmp/t3-{frontend,backend}-tests.txt`, typecheck/build/lint/format logs,
`tmp/templates-t3/{browser,t1-regression,t2-regression,locked-regression}/`.
Test target/credentials stay in the existing restricted external directory;
they are never added to the repository. The isolated cluster files are retained;
the earlier cleanup policy block is not bypassed. The isolated cluster was stopped
successfully after verification (pg_ctl exit 0); port 55432 is free.

## Initial source handoff — activation stopped (superseded)

Verified target fingerprints: **734663449f0e944e / a90a1035b104d054**.
Read-only preflight used the application's pool factory in a separate verification
process with authorized TLS 1.3,
hostname validation and `rejectUnauthorized=true`; email remains disabled.
0001–0011 names/checksums match, only 0012 is pending. B.1 acceptance records match.

The T2 demo Event `84ab5c6f-0ed8-44fb-85f0-b38b030d8694` currently has **3 active
Tasks and 2 T2 receipts**, rather than only the described two-Task operation.
The original two-Task receipt `577f6bd6-0165-40e6-ba0a-6c504ccd97aa` and its two
Tasks are present. A separate one-Task receipt is also present. T3 did not create
or modify these records. Owner clarification of this additional operation is
pending under the requested **no unexpected drift** activation gate.

**Migration 0012: NOT APPLIED to development. T3 backend: NOT ACTIVATED.**
No backend restart, Vite restart, Supabase change, live personal Save/Apply or
development database write has occurred. Existing T2 backend PID is **22316**;
Vite PID **27776** is unchanged. Because activation is stopped, the additional
pre-0012 backup, migration/no-op execution, controlled restart and live T3
authenticated endpoint verification are **NOT RUN**. Existing T2 recovery backup
is retained; no new restore or rollback is authorized or attempted.

Do not run shared migration/fixture commands merely to make a gate pass. After
the owner resolves the drift, recheck all gates, secure a current recovery backup,
apply only pending 0012, verify its checksum/no-op, restart only the backend once,
and inspect readiness/actual TLS plus authenticated read/preview routes.

## Retained personal acceptance procedure — completed by owner

Use the [exact source URL, selected Task titles and destination-date example](BUDOGRAPH_EVENT_TEMPLATES_T3_ACTIVATION.md#exact-owner-t3-human-acceptance).

1. Open the accepted T2 demo Event's Templates → **My Templates**. Select exactly
   the **two Tasks belonging to the original two-Task operation**; leave the third
   Task unselected; the owner has confirmed it is intentional additional testing.
2. Review title/category/priority, offsets and local times. Confirm descriptions
   start empty. Include only explicitly reviewed/edited generic text. Set a
   template name, approve the complete selection and Save once.
3. Wait for the backend Save confirmation, open the result, inspect stored fields,
   refresh and confirm that the same private template remains.
4. Open another authorized active test Event through the Event switcher or its
   scoped Templates route. Choose My Templates, open the saved version, select its
   two items, and request the authoritative review. Check dates against that
   destination's own start date and timezone; verify no reminders/assignees.
5. Explicitly confirm Apply once. Wait for the separate Apply success. Verify
   exactly two additional Tasks, correct dates and initial state, two normal
   Task-created History entries and one private-template application entry.
6. Check BG/EN, theme, keyboard and phone layout. Record personal PASS/FAIL.
   Do not use B.1 as an Apply target. A separate new Apply intentionally adds more
   Tasks; retry/recovery of the same operation must return its existing result.

No human acceptance step above was automated against live development.

## Limitations and provenance

No archive/restore, edit-new-version UI, deletion, sharing, collaboration, marketplace,
AI or n8n integration. Library pages hold 50 cards/source Tasks at a time with
explicit Load more; a version contains 1–50 items. User-authored text is not
translated automatically. Templates do not carry reminders or infer personal data.
Formal accessibility/screen-reader audit, physical devices, Firefox/Safari and
backup restore rehearsal are **NOT RUN**. Build retains Vite's >500 kB chunk warning.

The complete master prompt, AGENTS.md and historical 2025–2026 regulation were
reviewed. GPLv3, licensed resources, source/docs/test accounts and honest test
evidence guide this implementation. Team limits, categories, dates, availability
windows, documentation format and assessment rules require verification against
the actual **2026–2027** regulation; none is presented as newly confirmed here.
T1/T2/T3 are internal product stages.

No dependency or external asset was added. Authored code/CSS/tests use the existing
GPL-3.0-only project license. Existing third-party register remains applicable.
Codex assisted implementation and technical verification. The owner subsequently
confirmed all eight T3 product acceptance checks; this is not a separate claim of
line-by-line human source audit or competition certification. The current checkpoint
authorizes one reviewed commit and normal push; no deployment or T4 is included.

## Mandatory handoff statuses

| Status                        | Result                               |
| ----------------------------- | ------------------------------------ |
| T1 HUMAN ACCEPTANCE           | PASS — PRESERVED                     |
| T2 HUMAN ACCEPTANCE           | PASS — PRESERVED                     |
| T3 SOURCE IMPLEMENTATION      | COMPLETE                             |
| T3 PRIVATE STORAGE            | PASS — isolated PostgreSQL           |
| T3 OWNERSHIP ISOLATION        | PASS — isolated PostgreSQL           |
| T3 REAL POSTGRESQL TESTS      | PASS                                 |
| SAVED TEMPLATE APPLY          | PASS — isolated PostgreSQL/browser   |
| MIGRATION 0012 ON DEVELOPMENT | APPLIED                              |
| LIVE T3 BACKEND               | ACTIVATED — PID 24392                |
| LIVE PERSONAL TEMPLATE SAVE   | PASS — personally performed by owner |
| LIVE PERSONAL TEMPLATE APPLY  | PASS — personally performed by owner |
| T3 HUMAN ACCEPTANCE           | PASS 8/8 — owner-confirmed           |
| EVENT MANAGEMENT STAGES 1–7   | PRESERVED                            |

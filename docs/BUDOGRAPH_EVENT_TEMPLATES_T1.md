# Event Templates V1 - Stage T1

Implementation date: 2026-10-16. **T1 HUMAN ACCEPTANCE: PASS - 6/6.**
This is a completed technical T1 slice, not the completion of Templates V1.

Owner acceptance recorded on October 16, 2026: **T1 HUMAN PASS - 6/6. Proceed
with Event Templates T2.** All six personal acceptance checks were confirmed by
the owner in the T2 implementation request. The implementation/evidence below
records the T1 handoff; its preview-only boundary describes T1 before T2 adds a
separate server review/application flow. T1 catalog, selection and date semantics
remain accepted. T2 HUMAN ACCEPTANCE is separate and remains PENDING.

## Baseline and authorized boundary

HEAD: `3ba8852cc3592873b32a63f15b6d640ceebdb039`.
The owner's request explicitly approved implementation after B.1 HUMAN PASS.
Before changes, AGENTS.md, the complete NOIT master prompt, applicable sections
of the 2025-2026 regulation, existing route/legacy page, Task/Event DTOs,
deadline/reminder validation, localization and design conventions were reviewed.

All 14 pre-existing modified/untracked files were fingerprinted and preserved
byte-for-byte, including TLS source/tests, server configuration examples,
the four already modified documentation files, and the unrelated shortcut.
No reset, commit, push, deployment, backend configuration change, service restart,
migration, database command, Task creation or demo edit was performed.
Frontend and backend listener PIDs remained 27776 and 27372 respectively.

The legacy `TemplatesPage.tsx` remains unused. Its demo/reset/localStorage
behavior was not reactivated. Existing Event Management Stages 1-7 and their
LOCK records were not edited. B.1 acceptance is recorded separately in
[BUDOGRAPH_B1_ACCEPTANCE.md](BUDOGRAPH_B1_ACCEPTANCE.md).

## Product behavior

Authenticated `/templates` and `/events/:id/templates` show one curated static
starter, `international-aikido-seminar`, version 1. It has four organizational
items with stable item IDs:

| Item                       | Category             | Priority  | Calendar offset | Suggested local time |
| -------------------------- | -------------------- | --------- | --------------- | -------------------- |
| Coordinate organizing team | Team coordination    | Important | -7              | None                 |
| Airport pickup             | Transport            | Important | -1              | None                 |
| Hotel check-in             | Accommodation        | Normal    | -1              | 15:00                |
| First training preparation | Training preparation | Important | 0               | 08:30                |

All reminder presets are empty. Titles, categories, descriptions and notices
have BG and EN text. Times/dates are starting suggestions, not confirmed travel
or venue facts. The content tells the organizer to adapt them to actual plans.
There are no assignments, invented personal saved templates, template records,
multi-Task API calls or functional Apply controls.

Users can select each item, select all or deselect all. The count updates in an
accessible status region; a zero selection has an explicit empty message.
Selection is transient React state. It resets on page departure/Event or identity
change; changing language preserves the current selection.

Authorized ready Event context supplies its stored `startDate` and timezone.
The shared Event switcher preserves the scoped Templates route. Without an
Event, the catalog remains visible with relative offsets and suggested times,
but actual dates are hidden. Loading, forbidden/missing Event and failed reads
never use stale dates. Failed reads offer Retry; Event Management is reachable.
Member and archived Event contexts are labeled explicitly as preview-only.
No role can apply or create Tasks in T1.

## Model and calendar algorithm

`eventTemplates.ts` separates the typed catalog from presentation. Each item
contains its stable ID, localized title/category/context keys, Task priority,
integer day offset, nullable wall-clock time and reminder offsets.
It does not extend or modify the legacy persisted demo-template model.

`templateDates.ts` reuses `getCalendarDayNumber` for strict Gregorian date
validation and `isTaskDeadlineTime` for optional time validation. It rejects year
0000, malformed/impossible dates, fractional/unsafe offsets and results outside
0001-01-01 through 9999-12-31. The ordinal bounds are checked before conversion.
UTC calendar fields perform day-field arithmetic; the algorithm never adds
24-hour timestamp durations to an Event instant. The Event start date is already
an Event-local DATE, so timezone conversion is neither needed nor performed.

Local time is returned separately, unchanged. Date-only remains `null`; DST gap
or repeated local times are not resolved into instants. Existing Task due-time
and reminder scheduling behavior remains unchanged. Any future scheduling belongs
to an explicitly reviewed apply/backend stage.

`preview.ts` keeps selection and scope-checking logic testable separately from
the component. Only the matching, ready, authorized current Event yields dates.
An invalid or out-of-range item gets an explicit error instead of a shifted date.

## Owner quick-start and acceptance

1. Keep the current frontend/backend running. Open
   `http://127.0.0.1:5173/events/62d5f3a7-cb0a-495b-bb9e-4169c68790b5/templates`
   in the existing signed-in BudoGraph browser, or choose the B.1 Event and
   click **Шаблони / Templates**. No restart or migration is needed.
2. Confirm starter version 1 and four selected items. For the November 20 start,
   expect November 13, November 19 (airport), November 19 at 15:00 (hotel), and
   November 20 at 08:30 (training), all in `Europe/Sofia` calendar context.
3. Tab to a checkbox and press Space; check that the count changes. Deselect all,
   inspect the empty selection notice, then select all. No save is performed.
4. Switch BG/EN and light/dark; check readability and unchanged selection. At
   phone width check the stacked cards, labels and absence of horizontal scroll.
5. Optionally select another accessible Event using the existing switcher. Check
   the route, reset selection, Event date/timezone and recalculated deadlines.
   Return to the B.1 Event without editing any records.
6. Confirm that applying is described as Stage T2 and that there is no Task-create
   or template-save action. Record a separate HUMAN PASS/FAIL for T1.

For an account with no Events, `/templates` remains an explorable catalog without
actual dates. Member/archived/loading/error cases were tested synthetically;
changing real memberships, accounts or Event archive status is unnecessary.

## Technical evidence

Automated browser fixtures are explicitly synthetic. Every `/api/**` request is
intercepted; non-GET requests abort and fail the run. No credentials or real
sessions are created. Chromium uses the already installed executable and bundled
Playwright; no package installation was needed.

- `pnpm test`: **PASS - 306/306**, including **9/9** new date/preview tests.
- `pnpm typecheck`: **PASS**.
- `pnpm lint`: **PASS**.
- Changed-source/package Prettier check: **PASS**.
- Full frontend-source Prettier check: **FAIL (pre-existing)** - unchanged,
  LOCKED `src/components/EventArchiveDialog.tsx` has formatting differences.
  It was not reformatted as part of T1.
- `git diff --check`: **PASS**.
- `pnpm build`: **PASS**, with Vite's >500 kB chunk warning; main JS 634.25 kB
  (171.55 kB gzip). Bundle splitting was outside this scoped stage.
- `scripts/verify-template-preview-ui.mjs`: **PASS - 34 synthetic cases**;
  24 BG/EN/light/dark responsive cases at 320, 360, 390, 768, 1024 and 1440 px,
  plus Member/archived, no Event, forbidden/missing context, retry, loading,
  scoped routing, language retention, Event switching/reset and unauthenticated
  boundary cases. Zero write attempts, unexpected API requests or page errors.
- Direct existing signed-in browser: **PASS** for visible BG starter, real
  authorized B.1 date preview and keyboard selection count 4 to 3. This was a
  UI read/selection check; no existing business data or account was changed.
- Existing locked-screen comparison: **PASS - 112/112 pixel-identical** original
  Dashboard, Tasks, Team and Changes interiors across seven widths, both languages
  and themes. Two deliberate-change controls were detected. Zero browser/console
  errors; original PNG references were not regenerated. Evidence:
  `tmp/templates-t1/locked-protection/report.json`.
- Shared-database integration suites, real Member verification, timed rehearsals,
  screen-reader audit, physical-device and Firefox/Safari checks: **NOT RUN**.

Local browser evidence: `tmp/templates-t1/browser/report.json` and
`templates-{width}-{language}-{theme}.png`. These screenshots are synthetic,
not evidence of real account/data creation. The direct live browser remains
available for owner acceptance.

Preservation evidence: `tmp/templates-t1/preservation.json` records the 14 unchanged
pre-existing files and unchanged frontend/backend listener PIDs.

## Files in this stage

Modified: `src/App.tsx` (Templates integration and absent-context exceptions only),
`src/i18n/messages.ts` (new catalog composition), `package.json` (register two new
test files in the default frontend suite).

Created:

- `src/domain/eventTemplates.ts`
- `src/domain/templateDates.ts`
- `src/domain/templateDates.test.ts`
- `src/i18n/templateMessages.ts`
- `src/pages/StarterTemplatesPage.tsx`
- `src/pages/templates/preview.ts`
- `src/pages/templates/preview.test.ts`
- `src/pages/templates/templates.css`
- `scripts/verify-template-preview-ui.mjs`
- `docs/BUDOGRAPH_B1_ACCEPTANCE.md`
- `docs/BUDOGRAPH_EVENT_TEMPLATES_T1.md`

Generated screenshots/reports are under ignored `tmp/templates-t1/`. Existing
uncommitted files are not T1 modifications and remain exactly as found.

Re-run only the safe frontend tests. For the browser script, set
`BUDOGRAPH_PLAYWRIGHT_MODULE` to the bundled `playwright/index.mjs` and
`BUDOGRAPH_BROWSER_EXECUTABLE` to the installed Chromium `chrome.exe`, then run
`node scripts/verify-template-preview-ui.mjs`. Optional `BUDOGRAPH_BASE_URL` and
`BUDOGRAPH_EVIDENCE_DIR` override localhost and the ignored evidence directory.

## Accessibility and visual scope

Existing BudoGraph semantic colors, typography, buttons, header, localization,
focus-reveal behavior and navigation are reused. Styles are Templates-specific;
global styles and LOCKED interiors are unchanged. Native labeled checkboxes,
fieldset/legend, associated descriptions, visible focus, a live count, 44px choice
labels, semantic headings and explicit notices support keyboard/accessibility.
Responsive browser checks found no horizontal overflow. This is not a formal
accessibility certification. BG singular/plural day labels are localized.

## Limitations and the next boundary

T1 is one curated catalog blueprint with transient selection and a date preview.
No persistent selections, date editing, personal catalog or apply operation.
The existing workspace read may fetch Tasks/Team/Changes along with Event
context; T1 uses that authorized context without adding a backend endpoint.

Recommended T2 boundary, not started: one backend atomic apply command with
server-side active-Organizer authorization, strict item/version/date validation,
idempotency and one database transaction for all selected Tasks. Recheck Event
version/state and membership at execution; never implement a frontend multi-POST
loop. Review duplicate-apply handling, history, timezone/reminder semantics and
rollback tests before enabling Apply. Backend template persistence remains T3.

| Status                       | Result               |
| ---------------------------- | -------------------- |
| TEMPLATE CATALOG             | IMPLEMENTED          |
| ITEM SELECTION               | PASS                 |
| RELATIVE DATE PREVIEW        | PASS                 |
| BACKEND TEMPLATE PERSISTENCE | NOT IMPLEMENTED (T3) |
| ATOMIC APPLY                 | NOT IMPLEMENTED (T2) |
| DATABASE WRITES              | NONE                 |
| HUMAN ACCEPTANCE             | PASS - 6/6           |
| LOCKED STAGES                | PRESERVED            |

## NOIT and provenance

Confirmed in the supplied 2025-2026 reference: original standalone software,
licensed resources, GPLv3 source, documentation, online access, role test accounts,
and the 20/25/35/20 evaluation structure. These support a small, testable slice
with honest limitations. Team limit, category/age rules, availability period,
deadlines, documentation formatting and assessment rules must be checked against
the actual 2026-2027 regulations; this task did not verify new-year rules.
T1/T2/T3 are internal product stages, not official NOIT requirements.

No dependencies/assets were added. The authored catalog, code and CSS are part of
the existing GPL-3.0-only project; existing React/Lucide licenses remain in the
project's license register. No invented research or user-test results.

AI assistance entry: Codex implemented the owner-approved T1 catalog, calendar
utility, UI, localization, tests and this documentation, then ran the recorded
technical checks. At technical handoff, owner review and acceptance were pending;
the owner subsequently confirmed all six acceptance checks as recorded above.
This stage-local change/evidence log avoids overwriting the pre-existing
uncommitted CHANGELOG, AI_ASSISTANCE_LOG and TEST_EVIDENCE changes.

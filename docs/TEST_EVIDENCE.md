# BudoGraph Test Evidence

## Phase 1 baseline — 2026-08-04

Verified on 2026-08-04 in the local Windows workspace using Node.js
`v24.16.0` and pnpm `11.9.0`.

### Automated checks

The following commands were run from the repository root after the Phase 1
implementation was assembled:

| Command             | Result                                                          |
| ------------------- | --------------------------------------------------------------- |
| `pnpm format:check` | Passed; all scoped files matched Prettier formatting.           |
| `pnpm typecheck`    | Passed; the strict TypeScript project build reported no errors. |
| `pnpm lint`         | Passed; ESLint reported no errors or warnings.                  |
| `pnpm test`         | Passed; 8 tests passed with 0 failures.                         |
| `pnpm build`        | Passed; Vite produced the production bundle in `dist/`.         |

The focused tests cover readiness and task counts, overdue calculation,
upcoming and attention queues, team workload, immutable state transitions,
change-to-task relationships, saved-state validation and fallback, and the
fictional seed scenarios.

### Browser verification

The Vite development build was exercised in the Codex in-app Chromium browser
at a `1440 x 900` desktop viewport, an intermediate `1080 x 900` viewport, and
a `390 x 844` mobile viewport.

Verified behavior:

- Dashboard, Tasks, Team, Changes & Plan B, and Templates rendered at desktop
  and mobile breakpoints.
- The desktop sidebar changed to the compact mobile header and fixed bottom
  navigation at the mobile breakpoint.
- No horizontal document overflow was detected on the checked desktop or
  mobile views.
- At 1080 px, task rows used the intended three-column reflow, placed status and
  acknowledgement controls on the second line, and clipped no controls.
- Targeted edge checks at 1260 px and 1130 px confirmed the five-column and
  three-column task layouts respectively, with no clipped controls or overflow.
- Task status and owner filters reduced the visible list correctly; owner
  grouping produced five team sections.
- A task status update and acknowledgement were reflected in its row and detail
  drawer.
- The task drawer opened at desktop and mobile sizes, focused its close control,
  trapped forward and reverse `Tab` movement, retained select focus after a
  status update, closed with `Escape`, and restored focus to its task trigger.
- The task status and acknowledgement survived a browser reload, exercising the
  `localStorage` adapter.
- Selecting a team member updated the assigned-task detail area.
- Before resolution, the change showed affected work and the direct-contact
  escalation. Its response then advanced to resolved and could be acknowledged.
- Resolving the only active change produced a meaningful dashboard empty state
  rather than a blank panel.
- The template reset used a confirmation step, restored the fictional seed,
  and displayed a success status. The reset returned the task and change state
  to its original demonstration values.
- The checked browser console contained no warning or error entries.

### Demonstration-data check

A scoped source scan found no known interview-associated names or identifiers,
private-call references, `mailto:` or `tel:` links, or email-address-like
strings under `src/`. The visible seed identities and venue are fictional and
the interface labels the workspace as fictional demonstration data.

### Evidence boundary

These results verify the listed local checks only. They are not production,
security, usability, formal accessibility, device-coverage, or product-market
validation. The demonstration data is synthetic, and no interview respondent
or real participant data was used in the browser checks.

## Phase 2A verification — 2026-08-06

Verified in the local Windows workspace with Node.js `v24.16.0`, pnpm `11.9.0`,
Vite `6.4.3`, and the Codex in-app Chromium browser.

### Automated checks

The following commands were run from the repository root after the Phase 2A
source and documentation changes:

| Command             | Result                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm format`       | Passed; Prettier applied the repository formatting configuration.    |
| `pnpm format:check` | Passed; every scoped source and documentation file matched Prettier. |
| `pnpm lint`         | Passed; ESLint reported no errors or warnings.                       |
| `pnpm typecheck`    | Passed; the strict TypeScript project build reported no errors.      |
| `pnpm test`         | Passed; 31 tests passed with 0 failures, skips, or cancellations.    |
| `pnpm build`        | Passed; Vite transformed 1,622 modules and produced `dist/`.         |

The production output reported a 338.72 kB JavaScript bundle (95.35 kB gzip),
a 46.44 kB CSS bundle (9.17 kB gzip), and a 2.04 kB HTML document (0.86 kB
gzip).

The focused tests cover the existing workspace calculations and persistence
validation plus:

- Bulgarian-only primary-locale detection and English fallback;
- versioned, independently valid language/theme preference parsing;
- explicit preference persistence and storage-failure fallback;
- Light/Dark/System resolution and live System `matchMedia` change handling;
- typed English/Bulgarian catalog parity, interpolation, plural rules, and
  `Intl` date, range, number, percent, and relative-date formatting;
- non-mutating localization of every known fictional demo field;
- canonical task-link creation/parsing, typed History-state marker recognition,
  malformed or duplicate query handling, valid/unknown/wrong-event task
  resolution, and rejection of ambiguous duplicate saved task IDs;
- readiness, mutually exclusive status totals, overdue overlap, workload, and
  explicit workload signals, plus the 44-task/18-milestone synthetic stress
  fixture.

### Browser and long-content verification

The Phase 2A Vite development source was exercised at viewport widths of 320,
390, 768, 1080, and 1440 pixels. Standard and synthetic stress workspaces were
used; the stress workspace contains 44 tasks, 18 milestones, long Bulgarian
copy, a long event name, long fictional member names, multiple badges, and long
task details.

Verified behavior:

- The application document had no content-caused horizontal overflow at any of
  the five required widths after two discovered mobile defects were corrected:
  a legacy document minimum width and the owner filter's intrinsic minimum.
- The desktop sidebar remained available at 1080 and 1440 pixels. The sticky
  compact header and five-item bottom navigation were in bounds and usable at
  320, 390, and 768 pixels.
- Language and theme controls remained visible at every checked width.
- The long stress-event heading wrapped without escaping its hero at 320, 390,
  768, and 1440 pixels. Long task titles, descriptions, Bulgarian copy, member
  names, status badges, and affected-work content also remained bounded.
- The 44-task stress list rendered all rows at 320, 390, and 768 pixels. The
  owner filter and first task status control remained in bounds, and task dates
  did not reserve a crushing fixed column on mobile.
- A long task detail opened at 320 pixels in a 320-pixel drawer; its content had
  no horizontal overflow and its description stayed inside the content area.
- The stress milestone section initially showed six chronological entries. Its
  disclosure opened the remaining 12 entries inside a 420-pixel capped scroll
  region rather than extending the page without limit.
- The Changes view at 390 pixels wrapped its long synthetic change title,
  showed the scenario-specific escalation instruction, and did not show the
  removed generic `Direct contact recommended` Dashboard instruction.
- The Team view at 320 pixels wrapped the long fictional member names without
  overflow.

### Localization, theme, and URL interaction checks

- Selecting Bulgarian changed `document.documentElement.lang` to `bg`,
  localized the current view and accessible preference names, and remained
  selected after refresh. Selecting English restored `en` and English UI copy.
- Selecting Light applied `data-theme="light"` and survived refresh. Selecting
  Dark applied `data-theme="dark"`. Selecting System remained pressed and
  resolved to the checked device's dark preference. Live device-preference
  change handling was verified by the automated `matchMedia` listener test; the
  operating-system preference itself was not changed during this browser pass.
- A Dashboard attention item had exactly one canonical
  `/tasks?task=task-guest-itinerary` target and opened that task's dialog.
- Refresh preserved the valid task URL and reopened the same task. Browser Back
  returned to the Dashboard with no dialog, and Forward restored the exact task
  and dialog.
- `/tasks?task=missing-task` opened no dialog, displayed the localized
  task-not-found notice, and kept the full task list available.

After this interactive browser pass, the final reviewer hardening split the
Dashboard into domain-specific section components, added bounded change and
workload continuations and explicit workload signals, strengthened task-return
focus restoration, and rejected duplicate saved task IDs. Those changes passed
the recorded formatter, lint, strict typecheck, 31-test suite, production build,
and read-only code review; a second interactive browser session was not
recorded, so the browser evidence above applies to the checked revision rather
than every final reviewer adjustment.

### Demonstration-data and privacy check

A scoped source scan covered interview identifiers, named interview references,
contact-link schemes, email-like strings, passwords, secrets, and API-key-like
text. The only `interview` match in application source was the stress fixture's
explicit statement that it contains no interview details. No private interview
content or real contact information was found. The standard and stress
workspaces label their people, venues, events, and incidents as fictional or
synthetic.

### Evidence boundary

This evidence covers the listed commands and one in-app Chromium session. It is
not a formal accessibility or contrast certification, clean-console audit,
real-device test, cross-browser matrix, security assessment, production-hosting
test, offline-package test, or product/usability validation. System-theme live
response was simulated in an automated unit test rather than by changing the
host operating-system setting. The historical NOIT regulation in this
repository applies to the 2025–2026 competition year and must be reverified for
any later year.

## Phase 2A.1 responsive stabilization — 2026-08-06

The final Phase 2A.1 application source was tested after its last component and
CSS change and before documentation-only evidence edits. Its exact source
identity is the Phase 2A parent commit
`f9f1ffece3a529f188bb9b8f3f6fa744087e4217` plus the application patch whose
Git object hash is `19b7e9d8b0c15d5e18659484889e50088b3122f4` (`index.html`,
`package.json`, and `src/`). The final commit hash is retained in Git history
and the completion report rather than embedded here, which would make this
document self-referential.

Verified locally on Windows with Node.js `v24.16.0`, pnpm `11.9.0`, Vite
`6.4.3`, and the Codex in-app Chromium browser.

### Root-cause and automated protection

The browser screenshots were traced to layout rules rather than data or routing
defects:

- status badges inherited aggressive word-breaking and allowed normal wrapping;
- mobile affected-task and deadline rows retained desktop horizontal
  competition between long titles and status metadata;
- the workload identity retained a `170px` flex basis after its parent switched
  to a column, turning a desktop width basis into vertical empty space;
- the five summary metrics used an undifferentiated two-column flow, leaving an
  orphaned fifth item;
- the document reserved a fixed bottom amount that did not share the fixed
  navigation's safe-area calculation;
- header controls had desktop gaps and sizing at the narrowest breakpoint; and
- the full Changes & Plan B navigation label was too long for the desktop
  sidebar measure.

Three CSS-contract tests were added. They assert indivisible status labels,
deliberate mobile summary/deadline/workload/affected-task compositions, and
safe-area-aware navigation and page spacing. The complete suite now contains 34
tests.

### Final browser matrix

The Dashboard was checked in the following explicit combinations:

| Viewport | Language  | Theme preference | Workspace |
| -------- | --------- | ---------------- | --------- |
| 320 px   | Bulgarian | Dark             | Stress    |
| 327 px   | English   | System           | Stress    |
| 360 px   | English   | Light            | Standard  |
| 390 px   | Bulgarian | Light            | Stress    |
| 768 px   | English   | Dark             | Stress    |
| 1080 px  | Bulgarian | System           | Standard  |
| 1440 px  | English   | Light            | Standard  |

The checked device resolved System to Dark. Live System preference changes are
covered by the existing `matchMedia` listener test. In addition, Dashboard,
Tasks, Team, Changes & Plan B, and Templates were each checked with the stress
workspace at 320 px in Bulgarian/Dark and at 390 px in English/Light.

Results from the final source:

- No tested page produced application-content horizontal overflow or a clipped
  interactive control. No visible status badge clipped or wrapped internally.
- At 320 and 390 px, every page's final content item could be scrolled 39–41 px
  clear of the fixed navigation. The page and navigation use the same
  `safe-area-inset-bottom` basis.
- The 320–390 px task summary used an intentional full-width total followed by
  a balanced two-by-two status grid.
- Affected tasks stacked title before status; deadlines stacked date, content,
  and status; workload identities used natural heights of 31–63 px instead of a
  170 px vertical basis. No large unexplained workload gap remained.
- The 320 px header kept the wordmark plus all five language/theme buttons in
  bounds with no overlap or clipped controls. Touch controls remained 32 px
  square inside the compact grouped control.
- The stress Tasks page rendered all 44 rows at 320 and 390 px. The stress
  Dashboard rendered all 18 milestone nodes; its disclosure opened the 12-item
  continuation in the existing 420 px capped scroll region.
- A 143-character mixed English/Bulgarian task title opened in a full-width
  320 px drawer. Its 273 px title area had equal client and scroll widths, its
  badges remained intact, and the document had no horizontal overflow.
- The drawer initially focused its close control, retained focus inside on
  `Tab`, closed with `Escape`, and restored focus to the originating task link.
- A Dashboard attention link opened exactly
  `/tasks?task=task-guest-itinerary`; refresh reopened the same task, Back
  returned to the Dashboard and restored its trigger focus, and Forward
  reopened the drawer. An unknown task ID displayed the localized warning and
  opened no dialog.
- The Bulgarian desktop sidebar uses the concise `План Б` label in a single
  44 px row while the full page heading remains unchanged.

### Console audit

The final interactive session accumulated zero application warnings and zero
application errors. The screenshot's `/favicon.ico` 404 was application-owned;
an explicit blank data favicon now prevents that implicit request without
introducing a permanent logo. The screenshot's asynchronous message-channel
entries were not reproduced in the controlled app console, and a source scan
found no browser-extension/runtime messaging API use. They are therefore
reported as browser-extension or DevTools-runtime noise, not silently counted
as application success.

### Verification boundary

This is controlled Chromium emulation, not physical-device, Safari, Firefox,
screen-reader, zoom, or formal performance/accessibility certification. The
browser pass verifies the listed source identity and interactions only. The
2025–2026 NOIT regulation remains historical and requires re-verification for a
later competition year.

## Phase 2B.1 visual identity and Dashboard refinement — 2026-08-12

Phase 2B.1 was verified in the local Windows workspace with Node.js
`v24.16.0`, pnpm `11.9.0`, Vite `6.4.3`, and the Codex in-app Chromium
browser. The final browser pass began after the last application-source change;
the remaining evidence edits were documentation-only.

### Baseline and automated checks

Before editing, the synchronized clean `main` baseline at `ff5d2f5` passed
format checking, lint, strict typechecking, all 34 tests, the production build,
and `git diff --check`.

After implementation, the repository checks passed as follows:

| Command                 | Result                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `pnpm.cmd format`       | Passed; Prettier applied the repository formatting configuration. |
| `pnpm.cmd format:check` | Passed; every scoped file matched Prettier.                       |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.                    |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.               |
| `pnpm.cmd test`         | Passed; 38 tests, 0 failures, skips, or cancellations.            |
| `pnpm.cmd build`        | Passed; Vite transformed 1,620 modules.                           |
| `git diff --check`      | Passed; no whitespace errors.                                     |

The production output contained a 340.86 kB JavaScript bundle (96.23 kB
gzip), a 48.77 kB CSS bundle (9.57 kB gzip), and a 2.16 kB HTML document
(0.93 kB gzip). New focused tests cover preparation-window boundaries,
local-calendar behavior around midnight in a non-UTC timezone, the combined
task/milestone sequence, resolved-change filtering, team-pressure partitioning,
and the distinction between task acceptance and change acknowledgement.

### Final Dashboard matrix

The final application source was checked in these exact combinations:

| Viewport | Language  | Theme preference       | Workspace |
| -------- | --------- | ---------------------- | --------- |
| 320 px   | Bulgarian | Dark                   | Stress    |
| 327 px   | English   | System (resolved Dark) | Stress    |
| 390 px   | Bulgarian | Light                  | Stress    |
| 768 px   | English   | Dark                   | Stress    |
| 1080 px  | Bulgarian | System (resolved Dark) | Standard  |
| 1440 px  | English   | Light                  | Standard  |

For every Dashboard case, the document had no application-content horizontal
overflow, no out-of-bounds checked control, no clipped status badge, and no
noncanonical task target. The first Operational Focus item was visible before
the bottom navigation or viewport edge. At 320, 327, and 390 px, the compact
event overview measured 500, 449, and 451 px respectively; it left the start of
actionable work in the first viewport even with the long stress event. The
stress Dashboard exposed 33 canonical task links across its different
question-specific contexts without copying a task table into Change Impact.

### Primary-page and interaction checks

Dashboard, Tasks, Team, Changes & Plan B, and Templates were each checked at:

- 320 px in Bulgarian/Dark with the stress workspace;
- 390 px in English/Light with the stress workspace; and
- 1440 px in English with the standard workspace in both Light and Dark.

All 20 page/theme combinations rendered meaningful content without horizontal
overflow, clipped checked status labels, out-of-bounds checked controls, or an
unexplained section gap. The stress Tasks page still rendered all 44 canonical
task rows at both mobile widths. The fixed mobile navigation retained a 66 px
height while the main content retained 106 px bottom space on the checked
emulation.

Interaction checks verified:

- explicit Bulgarian/English and Light/Dark choices survived reload;
- System remained selected and resolved to the checked host's Dark preference;
- a Dashboard focus item opened the canonical
  `/tasks?task=task-guest-itinerary` target;
- reload reopened that task; Back closed it and restored the exact
  `focus:task-guest-itinerary` trigger; Forward reopened it;
- an unknown task ID opened no dialog, showed the localized warning, and kept
  all 16 standard task links available;
- the 390 px task drawer was exactly viewport-width with no document overflow,
  focused its close control, kept forward and reverse `Tab` inside the dialog,
  closed with `Escape`, and restored the originating Dashboard link;
- task acceptance displayed `Accepted` and the clarified description, survived
  reload through the unchanged saved boolean, and returned to `Not accepted`
  after the verified demo reset; and
- the reset restored the fictional workspace and the template's updated
  `Task acceptance` wording.

### Console and production-preview check

The final development session accumulated zero application warnings and zero
application errors. A production preview at `127.0.0.1:4174` rendered the
standard Dashboard at 1440 px and 320 px without overflow or out-of-bounds
checked controls, exposed all 16 canonical standard task links, contained no
legacy Dashboard section nodes, and produced zero application warnings or
errors. This is a local rendering and bundle-size sanity check, not a formal
performance benchmark.

### Independent review

A separate read-only review found and prompted correction of one local-calendar
edge case: preparation grouping now derives the user's local calendar date and
compares DST-safe day ordinals, so a Europe/Kyiv midnight cannot place dated
work in the previous UTC bucket. It also caught stale evidence figures before
commit. After those corrections, the independent reviewer reran formatting,
lint, typechecking, all 38 tests, the production build, and whitespace checks;
spot-checked the Dashboard at 320 px and 1440 px; and reported no remaining
confirmed findings.

### Evidence boundary

This phase verifies a visual-system and information-hierarchy refinement. It is
not product-market validation, proof of usability, a formal accessibility or
contrast audit, physical-device testing, cross-browser certification,
screen-reader testing, or production-hosting validation. The historical
competition regulation in this repository applies to 2025–2026; its dates,
category wording and limits, submission format, online-availability window,
test duration, defence duration, and scoring split require re-verification for
any later competition year.

## Phase 2B.1.1 visual hierarchy polish — 2026-08-12

Phase 2B.1.1 was a focused visual refinement of the existing Dashboard, not a
redesign or a new product phase. The clean synchronized baseline was
`546d5da2b3e17ce4c0c78c6fc88859741a561028`. Pre-edit browser inspection covered
Light and Dark at desktop and mobile widths. The five existing Dashboard
components, their order, calculations, storage versions, routes, deep links,
localization, preference behavior, and task-drawer contracts were retained. No
schema, dependency, or Phase 2B.2 feature was added.

### Measured hierarchy changes

The measurements below compare equivalent Phase 2B.1 and Phase 2B.1.1 browser
states. Values are rounded to the nearest CSS pixel.

| Measurement                                      | Phase 2B.1 | Phase 2B.1.1 | Change                   |
| ------------------------------------------------ | ---------: | -----------: | ------------------------ |
| 1440 px EN standard Event Overview height        |     411 px |       300 px | 111 px / 27.0% shorter   |
| 320 px BG/Dark stress Event Overview height      |     500 px |       392 px | 108 px / 21.6% shorter   |
| 320 px stress first Operational Focus row top    |     691 px |       581 px | 110 px earlier           |
| 1440 px standard Change Impact section height    |     466 px |       388 px | 78 px / 16.7% shorter    |
| 320 px stress Change Impact section height       |     956 px |       854 px | 102 px / 10.7% shorter   |
| 320 px stress uppercase leaf-level text elements |         67 |            5 | 62 internal labels fewer |

The visible task-count formula and the persistent overdue explanation were
removed from the overview; their calculations were not changed and remain
covered by the workspace tests. Task progress remains explicitly named as task
progress, exposes completed/total detail in the progressbar accessible name,
and is not presented as readiness, safety, or a go/no-go decision. The compact
planning-state line retains an explicit fictional-demo label in both languages.

Full critical fills were replaced with scoped low-intensity risk mixes plus
risk edges and textual priority labels. Team-pressure rows use neutral
operational surfaces with risk or time edges, and the critical change uses a
quieter tint than the immediate decision queue. Internal action, priority,
timeline-window, timeline-kind, change-detail, and checkpoint labels use normal
casing; the five retained uppercase elements are high-level section eyebrows.

At 320 px, event fact text increased from 10.24 px to 11.2 px, task-count labels
from 8.8 px to 10.4 px, focus action text from 10.4 px to 11.2 px, focus
reason/owner/deadline text to 11.52 px, and timeline date/owner/state text to
11.52 px. The density reduction came primarily from removing redundant copy
and tightening spacing rather than shrinking essential text. A scoped computed
contrast spot-check across decision, risk, time, metadata, change, and workload
text measured a lowest pair of 4.61:1 in both application themes. This was not a
formal accessibility audit.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier reported the scoped files unchanged.  |
| `pnpm.cmd format:check` | Passed; every scoped file matched Prettier.            |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 38 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,620 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 340.44 kB JavaScript bundle (96.19 kB gzip), a
48.59 kB CSS bundle (9.53 kB gzip), and a 2.16 kB HTML document (0.93 kB gzip).
No new CSS-string test was added because this phase introduced no behavior that
benefited from brittle styling assertions.

### Final Dashboard browser matrix

The final application source was checked in these exact combinations:

| Viewport | Language  | Theme | Workspace |
| -------- | --------- | ----- | --------- |
| 320 px   | Bulgarian | Dark  | Stress    |
| 390 px   | Bulgarian | Light | Stress    |
| 768 px   | English   | Dark  | Stress    |
| 1440 px  | Bulgarian | Light | Standard  |
| 1440 px  | English   | Dark  | Standard  |

The respective Event Overview heights were 392, 345, 477, 350, and 300 px. In
every case there was no document horizontal overflow, out-of-bounds checked
control, clipped priority/timeline/workload status, duplicate task-focus key, or
noncanonical task target. Stress data exposed 33 canonical task links and
standard data exposed 16. Mobile main content retained 106 px bottom space for
the fixed navigation; desktop retained 70 px. Visual inspection confirmed
neutral breathing room between risk signals, no unexplained large blank region,
and meaningful first-item action/title content in the initial 320 and 390 px
viewports.

### Other-page regression matrix

Tasks, Team, Changes & Plan B, and Templates were each checked at:

- 320 px in Bulgarian/Dark with stress data;
- 390 px in English/Light with stress data; and
- 1440 px in English/Light with stress data.

All 12 combinations rendered their localized heading and meaningful content
with no horizontal overflow, out-of-bounds checked control, or clipped checked
interactive control. This was regression verification only; none of those page
layouts was redesigned.

### Interaction, console, and production checks

A Dashboard focus item retained the exact canonical target
`/tasks?task=task-guest-itinerary`. It opened the localized task drawer with the
close control focused; reverse and forward `Tab` wrapped between the last and
first drawer controls; `Escape` closed the drawer, cleared its URL state, and
restored `focus:task-guest-itinerary`. Direct navigation to the same deep link
reopened the drawer. The checked English/Light preferences survived that direct
navigation. The unchanged routing/storage test suite additionally covers
encoded links, invalid parameters, workspace matching, and versioned
preferences.

The final development browser session recorded zero application warnings and
zero application errors. A built production preview at `127.0.0.1:4174`
rendered the standard Dashboard at 320 px Bulgarian/Dark and 1440 px
English/Light with all 16 canonical task links, no horizontal overflow or
out-of-bounds checked control, and zero application warnings or errors. Its
Tasks navigation reached `/tasks` and the localized Tasks heading. This was a
local rendering and bundle sanity check, not a formal performance benchmark.

### Independent review

A separate read-only diff review found three concrete issues during the final
polish: Light-theme `Important` priority text initially measured about 2.85:1;
the interim 320 px composition could split `23%` and let the longest Bulgarian
count label exceed its cell; and the evidence still contained measurements from
before that interim correction. The final scoped fixes use the darker existing
warning text on a neutral gold-edged row (measured at 5.09:1), keep the progress
value on one line, and give all four Bulgarian count labels 60 px client and
scroll widths without shrinking the text. The evidence now records the final
392 px overview and 581 px first-row position.

After those fixes, the reviewer reran formatting checks, lint, strict
typechecking, all 38 tests, and whitespace checks; spot-checked 320 px
Bulgarian/Dark stress and 1440 px English Light/Dark standard; and reported no
remaining confirmed functional, information-loss, five-component,
fictional-boundary, semantic-color, Phase 2B.2, or other-page-scope finding. The
reviewer's spot-check was narrower than the primary matrix and does not expand
the evidence boundary below.

### Evidence boundary

This evidence demonstrates the listed implementation checks and controlled
Chromium viewport observations. It is not proof of usability, accessibility,
organizer effectiveness, product-market fit, physical-device compatibility, or
cross-browser behavior. `docs/NOIT_REGULATIONS_2025_2026.pdf` remains a
historical, year-specific source; its dates, categories and limits, submission
and documentation rules, online-availability and test-account requirements,
GPLv3/licensing conditions, test and defence timing, scoring, and privacy forms
must be reverified for the actual competition year.

## Phase 2B.2 Tasks workspace redesign — 2026-08-15

Phase 2B.2 was implemented from the clean synchronized baseline
`3b274bad3efb995b3087e0307ef3d3410c7d937c`. The approved Phase 2B.1 Dashboard
remained locked. The scope changed only the existing Tasks workspace and its
drawer, localized copy, focused pure helpers and tests, responsive contracts,
and supporting documentation. It did not add a dependency, asset, route,
backend, account, database, schema version, or product module. Stable task IDs,
canonical `/tasks?task=<task-id>` URLs, and `budograph.workspace.v1` were
retained.

### Implemented Tasks contract

- The page header now exposes a compact total/active/blocked/overdue summary.
  Overdue remains an overlapping timing flag rather than a status.
- Search covers localized title, category, context, and owner. Status, owner,
  and category filters combine, provide a zero-result/clear path, and can be
  grouped by owner without dropping tasks whose owner is unknown.
- Desktop rows form a flat operational register with Task, Responsibility,
  Deadline, and Status columns. Accepted/Not accepted is a quieter
  responsibility signal and never replaces task status.
- A real canonical title link provides the full-row hit target. Inline status
  and acceptance editors were removed; the grouped drawer is the primary
  editing surface for those two independent values.
- Tablet and mobile rows use a purpose-built summary rather than stacking the
  desktop cells. The drawer separates identity, responsibility and acceptance,
  progress and timing, operational relationships, and metadata.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier formatted the scoped source and docs. |
| `pnpm.cmd format:check` | Passed; every configured file matched Prettier.        |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 47 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,621 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 348.66 kB JavaScript bundle (97.73 kB gzip), a
54.31 kB CSS bundle (10.56 kB gzip), and a 2.16 kB HTML document (0.93 kB
gzip). The suite added pure filtering/ordering coverage, explicit
status-versus-Accepted reducer invariants, localized Tasks copy assertions, and
mobile-summary, drawer, and filter-focus CSS contracts. No DOM test framework
was added solely for this phase.

### Search, filter, register, and drawer interactions

The standard workspace rendered 16 rows and the development stress fixture
rendered 44. English search for `driver` returned 1 of 16 tasks. Bulgarian
case-insensitive search for `ШОФЬОР` returned the localized airport/backup-driver
task. A combined status, Anton Ravin owner, and Travel category filter returned
1 of 16; all three filter controls exposed their active treatment. An unmatched
query returned 0 of 16 with the empty state, and both clear paths restored all
16 rows. Owner grouping produced five groups, five registers, and all 16 rows.

Selecting whitespace in the final status area of the first row opened the exact
canonical target `/tasks?task=task-guest-itinerary`, proving that the stretched
real link covers the row. The row contains no inline status or Accepted control
that can conflict with that target; editing is confined to the drawer. Direct
load and refresh of `/tasks?task=task-hotel-rooming` both reopened the same
drawer, and closing a direct-load drawer returned safely to `/tasks`. A separate
Back/Forward check opened `task-airport-transfer`, returned to the list, and
reopened the exact detail. An encoded unknown ID displayed the localized notice
while retaining the usable task list and did not open a substitute drawer.

The drawer initially focused its close button. Reverse `Tab` wrapped to the
last status control, forward `Tab` wrapped back to close, and `Escape` closed
the drawer, removed the task query, and restored focus to
`task-list:task-guest-itinerary`. The close button and the backdrop also closed
to the list. Browser testing caught and corrected an interim mouse-down
click-through: the final backdrop closes on its completed click, after which the
URL is `/tasks`, no drawer remains, and focus returns to the originating row.

In the production preview, changing the guest-itinerary status from Blocked to
In progress left its separate state label at Not accepted. Accepting it then left
the In progress status unchanged. Refreshing the canonical detail preserved
both values on that preview origin. The reducer tests separately assert the two
state-preservation invariants and serialization of both fields under the exact
`budograph.workspace.v1` key.

### Final Tasks browser matrix

The latest development source was checked in controlled in-app Chromium
emulation at all seven requested widths. `clientWidth` reflects the viewport
after the browser scrollbar. `Tail space` is the document space below the final
row; the mobile navigation measured 66 px high in each mobile/tablet case.

| Viewport | Language  | Theme | Workspace | Rows | Filter height | First row | Tail space |
| -------: | --------- | ----- | --------- | ---: | ------------: | --------: | ---------: |
|   320 px | Bulgarian | Dark  | Stress    |   44 |        257 px |    274 px |     107 px |
|   327 px | English   | Light | Standard  |   16 |        257 px |    193 px |     106 px |
|   360 px | Bulgarian | Light | Stress    |   44 |        257 px |    252 px |     107 px |
|   390 px | English   | Dark  | Stress    |   44 |        148 px |    237 px |     107 px |
|   768 px | Bulgarian | Dark  | Stress    |   44 |        105 px |    157 px |     107 px |
|  1080 px | English   | Light | Standard  |   16 |        105 px |     76 px |      71 px |
|  1440 px | Bulgarian | Light | Standard  |   16 |         60 px |     94 px |      71 px |

Every case had equal document client and scroll widths, zero out-of-bounds
visible controls, zero measured overflow in the summary, filters, rows, badges,
and register, and a reachable final row above the fixed mobile navigation. The
long stress title explains the taller narrow rows; the title, owner, deadline,
status, priority, and acceptance remained available rather than being silently
discarded. At widths up to 600 px, rendered priority, acceptance, deadline-meta,
and status text measured 11.2 px after final review; this was raised from the
smaller interim treatment without introducing overflow.

At 320 px Bulgarian/Dark with stress data, the open drawer measured 305 px
client and scroll widths, 900 px client height, and 1,755 px scroll height. Its
three controls had no measured overflow; the current Blocked status and separate
overdue warning were both present. Scrolling reached the exact 855 px maximum,
placed the final metadata section at 872 px within the 900 px viewport, and
retained 28 px bottom padding. The drawer intentionally covered the bottom
navigation while open so the two interaction layers did not compete.

A scoped computed-color spot-check sampled 192 visible Tasks and drawer text
pairs in Light and 168 in Dark. The lowest sampled pair was Important text at
4.62:1 in both themes. This is a focused rendered-color check, not a formal
accessibility or contrast audit.

### Locked-page, console, and production checks

Dashboard, Team, Changes & Plan B, and Templates were each checked at 320 px
Bulgarian/Dark with stress data and at 1440 px English/Light with standard data.
All eight combinations rendered their localized heading and meaningful content
with equal document client/scroll widths and zero out-of-bounds visible
controls. This was regression inspection only; none of those page layouts was
redesigned.

The final development browser session recorded zero application warnings and
zero application errors. The rebuilt production preview at
`127.0.0.1:4173` rendered all 16 standard task rows and repeated the search,
combined-filter, empty-state, grouping, full-row, drawer, direct-load, refresh,
invalid-ID, focus, independent-edit, persistence, and corrected-backdrop checks
with zero application warnings or errors. This was a local rendering and bundle
sanity check, not hosting or performance validation.

### Independent review

Three read-only reviewers separately audited source behavior, visual hierarchy,
tests, and documentation. The source review found that the three filter selects
temporarily suppressed the global keyboard outline without supplying a wrapper
focus treatment, and that the drawer acceptance action combined a changing
action name with toggle-button state. The final code adds a visible
`:focus-within` ring with a focused contract test and presents acceptance as a
normal action button while its state remains labelled above it. A production
browser recheck computed the focused wrapper's border and 2 px ring and found
no `aria-pressed` on that action.

The visual review independently verified the corrected backdrop, canonical URL,
desktop register, and drawer, then identified mobile row metadata at roughly
10.2–10.6 px. The final mobile override raises essential priority, acceptance,
deadline-meta, and status text to 11.2 px. The 320, 327, 360, and 390 px rows
were remeasured afterward with zero horizontal overflow and zero application
warnings or errors. The documentation/test reviewer found no unsupported claim
or missing requested document. These independent checks were narrower than the
primary matrix and do not expand the evidence boundary below.

### Evidence boundary

These results are controlled in-app Chromium observations, not proof of
usability, accessibility, organizer effectiveness, physical-device behavior,
cross-browser compatibility, screen-reader support, production security,
product-market fit, or completed offline rehearsal. The workspace remains an
unauthenticated local prototype with fictional data. The available regulation
is the historical 2025–2026 document; its dates, exact category/group wording,
online-availability window, documentation format, test and defence timing and
weighting, declarations, and registration procedure must be reverified for the
actual competition year.

## Phase 2B.2.1 BudoGraph dropdown system and final Tasks polish — 2026-08-15

Phase 2B.2.1 started from the synchronized baseline
`dc17285340850f84e6e52d8e5ad88798a4882fb8`. It replaced only the Phase 2B.2
Tasks Status, Owner, and Category filter selects and the drawer Current status
select. The approved task register, drawer information architecture, Dashboard,
Team, Changes & Plan B, Templates, routes, task schema, 16-task seed, 44-task
development stress fixture, `budograph.workspace.v1`, and
`budograph.preferences.v1` remained in place. No dependency, asset, backend, or
product module was added.

### Implemented selection-control contract

`BudoSelect` is a controlled, dependency-free generic component. Its real
`button` trigger exposes `aria-haspopup="listbox"`, `aria-expanded`, stable
`aria-controls`, and a label/value relationship. The popup is a
`role="listbox"` containing uniquely identified `role="option"` elements with
`aria-selected`; roving DOM focus leaves exactly one option at `tabIndex=0`.
There is no invented `aria-activedescendant` state because focus is placed on
the active option itself.

Pure helpers resolve selection by value rather than array index, bound Arrow
and Home/End movement, reject invalid commits, preserve the old value on
cancel, and calculate collision-aware popup geometry. Placement prefers a side
that fits the ideal height and otherwise uses the roomier side. Width is
clamped to 12 px viewport gutters, height never exceeds the available side,
and tall lists scroll internally.

### Automated checks

| Command                 | Result                                                 |
| ----------------------- | ------------------------------------------------------ |
| `pnpm.cmd format`       | Passed; Prettier formatted the scoped source and docs. |
| `pnpm.cmd format:check` | Passed; every configured file matched Prettier.        |
| `pnpm.cmd lint`         | Passed; ESLint reported no errors or warnings.         |
| `pnpm.cmd typecheck`    | Passed; strict TypeScript build reported no errors.    |
| `pnpm.cmd test`         | Passed; 54 tests, 0 failures, skips, or cancellations. |
| `pnpm.cmd build`        | Passed; Vite 6.4.3 transformed 1,623 modules.          |
| `git diff --check`      | Passed; no whitespace errors.                          |

The final build contained a 353.49 kB JavaScript bundle (99.65 kB gzip), a
56.81 kB CSS bundle (11.04 kB gzip), and a 2.16 kB HTML document (0.93 kB
gzip). The added pure tests cover reordered and unknown selected values,
bounded Arrow/Home/End navigation, valid commit versus cancellation, horizontal
clamping, above/below collision, roomier-side selection, and a tiny-space height
bound. Existing tests continue to cover combined filters, localized labels,
Status-versus-Accepted independence, storage keys, routes, and responsive
contracts. No DOM test framework was introduced.

### Controlled development-browser matrix

The final development source was inspected in controlled in-app Chromium. Page
`clientWidth` is 15 px below the requested emulation width when the vertical
scrollbar is present; drawer-open measurements use the full requested width.

| Requested state                                    | Rendered result                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 px, English, Light, closed                    | 16 rows; document 1,425/1,425 px client/scroll width; compact controls and count retained.                                                                                      |
| 1440 px, English, Light, three open states         | Status 190 x 199.6 px, Owner 220 x 237.6 px, and Category 260 x 260 px; all below the trigger and inside the viewport. Category client/scroll height was 258/464 px.            |
| 1440 px, English, Dark, three open states          | Same bounded geometry; selected/focused text used light ink on the dark authored surface, with burgundy selection and blue focus rather than system blue.                       |
| 390 px, Bulgarian, Light, three open states        | 375/375 px document width, two-column controls, result count on its own quiet line below Search, and no out-of-bounds trigger or option.                                        |
| 320 px, Bulgarian, Dark, stress, three open states | 44 rows, 305/305 px document width, one-column 276.8 px controls, and no popup/mobile-navigation overlap. The 14-option Category list measured 258/540 px client/scroll height. |
| 1440 px, English, Light/Dark drawer                | Current status measured 225.2 x 161.6 px, stayed inside the drawer, and retained one selected/focused option.                                                                   |
| 390 px, Bulgarian, Light drawer                    | The 343.2 x 161.6 px popup fit below in normal use. With the trigger deliberately placed at y=721.6–765.6, it opened above at y=554.0–715.6.                                    |
| 320 px, Bulgarian, Dark drawer                     | Drawer and document widths were both 320 px; the 272.8 x 161.6 px popup stayed usable with no horizontal overflow or blocked bottom-navigation interaction.                     |

Every recorded popup had one selected option, one active option, one tabbable
option, zero clipped option text, and equal document client/scroll widths. At
320 px stress, `End` reached the last fictional Category option with the active
row fully inside the listbox and above the mobile navigation. Mobile owner,
deadline, status, priority, category, deadline metadata, and acceptance text
all computed to the approved 11.2 px floor. The 390 px and 320 px result counts
sat between Search and the filter controls without adding a card.

The focused/selected text samples were `rgb(23, 33, 45)` on
`rgb(248, 233, 237)` in Light and `rgb(237, 242, 247)` on
`rgb(58, 32, 42)` in Dark. These scoped rendered-color observations confirmed
the intended warm/dark surfaces and readable state treatment; they are not a
formal contrast or accessibility audit.

### Interaction, focus, and persistence observations

- ArrowDown on a closed trigger opened the listbox at the selected value.
  ArrowDown and ArrowUp moved option focus while selection remained unchanged;
  Home, End, and a bounded ArrowUp reached the expected first/last positions.
- Escape cancelled and returned focus to the trigger. Space committed Not
  started and reduced the visible standard rows to 9; Enter restored All
  statuses and all 16 rows. Mouse selection of Mira Velin returned 3 rows and
  trigger focus; clicking Search outside an open Owner list closed it without
  changing the value.
- A second pointer click on the already-open Status trigger collapsed it to
  `aria-expanded="false"`, removed the listbox, and kept trigger focus. Moving
  directly from an open Status control to Owner still closed Status and opened
  Owner at its selected option.
- Four rendered controls (the three filters and drawer status) were real
  buttons with unique trigger IDs. The open drawer listbox had stable IDs
  across reopen, four unique option IDs, one `aria-selected="true"`, one
  `tabIndex=0`, and focus on that same option.
- In the drawer, the first Escape closed only the listbox and focused its
  trigger. The second Escape closed the drawer, restored the prior canonical
  URL including its development fixture state, and restored focus to the
  originating real task link. Forward Tab from the final focused option invoked
  the existing drawer trap, closed the popup through blur, and focused the
  drawer close button.
- The controlled browser's synthetic Tab transport did not perform Chromium's
  native page-level focus traversal even on the ordinary Search input. No
  physical Tab/Shift+Tab claim is made from that transport. DOM inspection
  showed the expected Search → Status trigger → active option → Owner
  trigger → Category trigger order, and moving focus to the next trigger
  closed the prior popup without trapping it. Physical-keyboard and
  assistive-technology repetition remains required.
- Changing the first task from Blocked to In progress preserved Not accepted
  through refresh. Accepting it preserved In progress through another refresh.
  Both values were then restored to Blocked and Not accepted and verified after
  refresh.

### Locked pages, console, production preview, and independent review

Dashboard, Team, Changes & Plan B, and Templates were spot-checked at 1440 px
English/Dark. Each retained its expected heading and meaningful content with
equal 1,425 px document client/scroll widths and no horizontal overflow. The
development browser session recorded zero application warnings and zero
application errors.

The final bundle was served locally from `127.0.0.1:4173`. Its 1440 px
English/Light standard Tasks page rendered 16 rows and the bounded 258/464 px
Category list. Its 320 px Bulgarian/Dark standard Tasks page and drawer had
equal document client/scroll widths, 11.2 px mobile metadata, internally
scrollable Category options, and a bounded Current status popup. The production
origin's pre-existing first-task state was restored to Blocked/Not accepted and
verified after refresh. The production session recorded zero application
warnings and errors. The stress fixture remains a development-only diagnostic;
the production build correctly retained the 16-task fictional demonstration.

Separate read-only reviews found and drove six confirmed corrections: the
initial Dark filtered-trigger accent text measured about 4.43:1 and now uses
the existing light ink while burgundy remains on the icon/border; the Light
popup now uses the established warm neutral surface; placement now chooses a
fully fitting or roomier side instead of a fixed 160 px threshold; and the
initial zero-delay Tab close could leave focus on `body`, so popup lifetime now
follows focus leaving the popup or returning to the trigger. Later live checks found that
synthetic Enter/Space did not invoke the native button click in the controlled
browser and that clicking an already-open trigger could close on blur and then
reopen on click. The trigger now handles Enter/Space explicitly and uses a
short-lived pointer-origin marker so a pointer click closes exactly once while
Shift+Tab-to-trigger still closes through blur. Final read-only source/test
review found no remaining confirmed ARIA, state, routing, schema, style-scope,
or unnecessary-dependency defect.

### Evidence boundary

These are controlled in-app Chromium checks, not physical-device, Safari,
Firefox, screen-reader, or formal accessibility certification. In particular,
the automation limitation above leaves physical page-level Tab/Shift+Tab for
human repetition. Visual polish is not proof of usability or organizer
effectiveness. The workspace remains an unauthenticated local prototype with
fictional data. The available regulation is the historical 2025–2026 source;
its dates, exact category/group wording, online-availability window,
documentation format, test and defence timing and weighting, declarations, and
registration procedure must be reverified for the actual competition year.

## Phase 2B.2.2 — task attention and deadline semantics (2026-09-28)

This entry records the focused correction from baseline
`24795ec6c5551f2091a6bbdb9224279de0693a9f`. Historical entries above describe
previous behavior and checks; this entry supersedes their task-attention score
and UTC deadline semantics. It does not start Team 2B.3.

### Final semantic contract

- **Status = lifecycle:** `not-started`, `in-progress`, `blocked`, `completed`.
- **Priority = impact:** Normal, Important, Critical. It is not an urgency score.
- **Timing = derived local calendar relationship:** yesterday or earlier is
  overdue for open tasks; Today is local today; Near is days 1–7 inclusive;
  Later is day 8 onward. Upcoming deadlines include Today/Near/Later for open
  tasks and never become a persisted or editable task status.
- **Needs attention = derived operational signal:** an open task qualifies for
  any of blocked, overdue, not accepted, or Critical with a Today/Near deadline.
  Important alone and far-future Critical alone do not qualify. Completed tasks
  are excluded even when unaccepted or Critical.
- **Accepted = separate responsibility acknowledgement:** the stored field
  remains `Task.acknowledged`; changing status never accepts responsibility.
- **At risk remains narrower:** blocked and/or overdue, counted once per task.
  Unaccepted and near Critical work alone do not increase Team at-risk counts.
- **Dependency prose remains independent:** `blockedBy` does not imply blocked
  lifecycle status. Milestone `upcoming` remains unchanged.

`taskTiming.ts` validates date-only values and compares calendar ordinals to the
reference clock's local year/month/day. UTC arithmetic is used only for day
ordinals, avoiding DST day-length errors; no deadline becomes a UTC end-of-day
instant. The shared calculations feed overdue/upcoming, attention, Dashboard
preparation windows and next checkpoints, Tasks ordering and counts, and Team
workload/timing. Core calculations accept explicit reference times.

Attention uses a documented lexicographic order, with no additive score:

1. Blocked **or** overdue share the strongest operational-failure class;
   remaining eligible tasks form the second class. Neither condition receives
   a blanket preference over the other.
2. Within each class, the earliest deadline comes first; invalid dates sort last.
3. Equal deadlines use more simultaneous reasons, then unaccepted responsibility,
   then impact (Critical/Important/Normal), then stable ID.

For example, an Aug 1 overdue task comes before an Aug 2 blocked/overdue task,
which comes before an Aug 3 overdue task. A later Critical task cannot leapfrog
these failures because of its priority. Tasks retains its distinct established
ordering: overdue, then blocked, then deadline and stable ID.

The domain exposes every applicable attention reason. Operational Focus joins
localized reasons in one text line/flow, labels priority explicitly, retains
canonical task links, shows five items initially, and reveals all remaining
items inline using a real localized Show more/Show less button. The button
exposes `aria-expanded` and `aria-controls` and retains keyboard focus. No CSS,
BudoSelect implementation, route, navigation, other disclosure pattern, Task
schema, storage key, demo date or milestone lifecycle was changed. Team now
keeps the actual lifecycle badge and appends Overdue separately to deadline text.

### Midnight refresh and independent review

A small local-calendar hook publishes the current date on subscription and
uses one timeout for the next local midnight. Each callback samples the real
clock again and rearms the timeout. Window focus and visible-tab events refresh
and rearm after suspension; unmount removes listeners and cancels the timer.
Dashboard, Tasks (including memoized counts/filter ordering and the drawer) and
Team receive the same reference date within their page. This does not write any
new persisted state.

The independent read-only review found one confirmed startup race: if initial
render preceded midnight but effect subscription followed it, the initial
implementation scheduled tomorrow's update while retaining yesterday's sample.
Initialization now uses the same immediate refresh path as subsequent updates.
A deterministic render-before/effect-after regression test was added. The
reviewer independently reran all nine focused tests, confirmed the fix, and
reported no further confirmed findings. Browser/layout verification below was
performed separately by the implementing agent; no human review is claimed.

### Automated evidence

All required commands passed on the final implementation:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 63 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed; Vite production build        |
| `git diff --check`      | Passed                               |

Nine new tests in `taskSemantics.test.ts` and `localCalendarClock.test.ts`
cover the eligibility matrix, combined reasons and EN/BG reason text,
explainable ordering/ties, dependency prose, independent acceptance, unchanged
four status values, rejection of persisted task Upcoming, Team at-risk scope,
invalid dates, and clock initialization/rearm/cleanup. Boundary cases cover
yesterday/today/tomorrow/day 7/day 8 and 1 ms before/at local midnight in
Europe/Kyiv, America/Los_Angeles and UTC. They assert agreement between domain
selectors, Dashboard timeline/checkpoints, Tasks ordering and Team counts.
Clock tests also cover Kyiv's 23-hour and 25-hour DST days. The prior selector
test now expects earlier overdue work before later Critical work; unrelated
existing assertions were retained.

### Production-browser evidence

Controlled Playwright checks used installed Edge/Chromium **154.0.4258.37**,
headless, against the production preview at local port 4173, with a 900 px
viewport height and Europe/Kyiv timezone. No browser or project dependency was
installed. Synthetic semantic fixtures used an explicit **2026-08-12** clock;
unchanged-seed screenshots used an explicit **2026-09-28** clock. Seed source
files were not edited. Test storage was confined to isolated browser contexts.

| Surface                       | Viewports / language / theme                           | Result                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard semantic fixture    | 1440 EN Light; 1440 EN Dark; 390 BG Light; 320 BG Dark | Correct five-item preview, eight eligible expanded items and deterministic order; excluded far Critical/Important/completed/dependency-only tasks; all simultaneous reasons visible                                    |
| Dashboard unchanged demo seed | Same four configurations                               | Existing layout inspected; stale scenario remains visible; bounded focus list                                                                                                                                          |
| Tasks                         | 1440 EN Dark; 320 BG Dark                              | Operational row order; status/search/owner/category filters; mouse and keyboard BudoSelect; exactly four localized drawer statuses; no Upcoming option; separate overdue and lifecycle labels                          |
| Team                          | 1440 EN Dark; 320 BG Dark                              | Regression spot-check; actual lifecycle and overdue text both visible                                                                                                                                                  |
| Local midnight                | Dashboard, Tasks and Team at 1440 EN Light             | Controlled clock crossed 23:59:59.500 to 00:00:00.500 without reload; due-today task became overdue, Dashboard removed it from future timeline and admitted day-8 Critical work into Near; workspace storage unchanged |

All **15 browser cases passed**. Dashboard disclosure was exercised with Enter
and Space; the same button retained focus, had visible focus styling and
updated both its label and `aria-expanded`. Its `aria-controls` matched the
list. Canonical focus links opened the correct Tasks drawer and Escape returned
to Dashboard. Tasks status edits persisted after reload without accepting the
task or adding/changing its stored fields; listbox Escape followed by drawer
Escape worked. Screenshots of the required configurations, expanded mobile
focus, Tasks register/drawer, and Team were visually inspected. No unexpected
layout regression or horizontal page overflow was observed. Application
console warnings, errors and uncaught page errors: **0**.

Local reproducibility/evidence artifacts are retained in ignored
`tmp/phase-2b-2-2-browser.mjs` and `tmp/phase-2b-2-2-evidence/` (JSON report and
screenshots). They are local audit artifacts, not new runtime dependencies or
committed product fixtures. This is controlled Chromium evidence, not
physical-device, Firefox, Safari, screen-reader or formal accessibility testing.

### Changed files and unresolved follow-up

- Domain: `src/domain/taskTiming.ts`, `src/domain/taskAttention.ts`,
  `src/domain/workspace.ts`, `src/domain/taskSemantics.test.ts`,
  `src/domain/workspace.test.ts`.
- Calendar refresh: `src/hooks/localCalendarClock.ts`,
  `src/hooks/localCalendarClock.test.ts`, `src/hooks/useLocalCalendarNow.ts`.
- Consumers: `src/pages/DashboardPage.tsx`,
  `src/pages/dashboard/OperationalFocus.tsx`, `src/pages/dashboard/helpers.ts`,
  `src/pages/TasksPage.tsx`, `src/pages/tasks/helpers.ts`,
  `src/components/TaskDrawer.tsx`, `src/pages/TeamPage.tsx`.
- Catalog/test registration/evidence: `src/i18n/messages.ts`, `package.json`,
  `docs/TEST_EVIDENCE.md`, `docs/AI_ASSISTANCE_LOG.md`.

**Confirmed unresolved follow-up — Demo Freshness / Critique Verification:**
the fictional seminar still runs **18–20 September 2026**. At the explicit
28 September reference date all 13 open seed tasks are overdue, and historical
milestones still carry their existing Current/Upcoming narrative. Corrected
calendar semantics intentionally expose this stale scenario. Refreshing seed
dates and reviewing milestone narrative are separate work; neither was done
here. Team 2B.3 and the deferred visual critique items remain out of scope.

The product remains a fictional, unauthenticated browser-local prototype.
The mandatory regulation read for this project is the historical **2025–2026**
NOIT source; dates, category/group details, submission requirements and defence
rules must be reverified for the actual later competition year.

## 2026-09-28 — Phase 2B.2.3B deterministic demo scenario

Implemented from accepted baseline `c87fb9a90ac75494b1d00df09497950ebd1a0639`
under the explicit Phase 2B.2.3B request. Earlier evidence above describes its
historical source and clocks; it has not been rewritten.

### Demo-time boundary and unchanged real-calendar semantics

`src/data/demoTime.ts` defines the reference date **2026-09-07**, a fictional
edit timestamp **2026-09-07T09:00:00.000Z** (noon in Varna), and timestamp display
zone **Europe/Sofia**. App samples a fresh local-noon Date once and passes it to
Dashboard, Tasks (including drawer), and Team. Date-only calculations therefore
read 7 September in every host timezone. Reported and updated timestamp labels
use the same explicit Varna zone through the existing typed i18n adapter.
Every page includes a quiet, localized demo-snapshot paragraph; it is 18 px
high in the checked configurations and adds 12 px bottom space. The BG date
renders as `7.09.2026 г.` in the checked Edge runtime. Screen-reader text explains
the fictional reference and Varna timestamp convention.

The pure timing and attention functions have no demo special case. They still
accept arbitrary reference dates; their existing real local-calendar, midnight,
DST, invalid-date and multi-reason tests pass unchanged. The live-clock hook
and scheduler are retained unchanged but are not subscribed by this fixed demo.
No `Date.now()` date shifting, schema change, storage migration, dependency,
backend or authentication was introduced. Task edits deliberately use the
fictional snapshot timestamp, not a real-world audit timestamp.

### Verified fixture and operational results

The event remains **18–20 September 2026**, eleven days after the snapshot.
People, ownership, task statuses, priorities, acceptance flags and stable IDs
are preserved. Open-task deadlines and their update timestamps were refreshed
around plausible preparation order; completed July work remains historical.

| Measure                                         | Result                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| All tasks                                       | 16                                                                                                         |
| Completed / in progress / not started / blocked | 3 / 3 / 9 / 1                                                                                              |
| Active (in progress + not started)              | 12                                                                                                         |
| Completed progress                              | 19% (3/16), not event-day readiness                                                                        |
| Open timing: overdue / Today / Near / Later     | 1 / 1 / 7 / 4                                                                                              |
| Accepted / not accepted, all tasks              | 11 / 5                                                                                                     |
| Critical / Important / Normal                   | 5 / 8 / 3                                                                                                  |
| Operational Focus                               | 7 eligible; 5 initially displayed                                                                          |
| Preparation Timeline                            | 12 Today/Near/Later task entries + 3 active milestones, with existing bounded previews                     |
| Team Pressure                                   | Lina: 1 overdue, 0 blocked; Anton: 1 blocked, 0 overdue; other 3 have no pressure flag but still have work |

The overdue accessibility check (5 September) demonstrates overdue plus not
accepted. Arrival confirmation (7 September) demonstrates blocked plus not
accepted plus Critical Today. Airport transfer (8 September) and first-aid
coverage (10 September) demonstrate Critical Near. The rota, check-in kit and
sound check also require acceptance. The accepted Critical final walk-through
on 17 September does not qualify on priority alone because it is Later.
Ranking, attention eligibility, five-item behavior and Team at-risk semantics
are unchanged.

Milestones remain separately persisted/manual: venue confirmed on 10 July is
Completed; travel plan on 9 September is Current/In focus; participant brief
on 14 September and final walk-through on 17 September are Upcoming. No past
milestone is presented as Upcoming, and no automatic milestone lifecycle was
invented.

The change is reported on 7 September at 10:30 Varna time. The fictional flight
moves the instructor's Friday 18 September arrival from 14:00 to 18:30. Mira
owns the in-progress response affecting itinerary, pickup, hotel and programme.
All four tasks' updated timestamps follow the report and precede snapshot noon.
Dashboard ChangeImpact's Next checkpoint is the arrival confirmation due Today.
The historical date-like suffix in the change ID stays an opaque stable ID,
maintaining existing localization/storage compatibility; no ID-based clock
behavior was added. BG and EN describe the same new arrival scenario.

### Persistence and reset

Production-browser checks loaded the actual old fixture from accepted commit
`c87fb9a`, with an additional saved acceptance edit. Initial load and reload
preserved every serialized workspace value, including old dates. Opening and
cancelling reset preserved it too. Explicit confirmation restored exactly the
new seed, kept `budograph.preferences.v1`, and survived reload. Accepting the
arrival task afterwards changed acceptance independently of its blocked status,
used the fixed snapshot update timestamp, and persisted on reload.
`budograph.workspace.v1` and its shape are unchanged. Existing old workspaces
are intentionally shown against the disclosed reference until explicitly reset;
opening the app or changing the real clock never replaces their data.

### Automated evidence

Environment: Windows, Node **24.16.0**, pnpm **11.9.0**, Vite **6.4.3**.
All required commands were executed successfully:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 70 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed, production bundle            |
| `git diff --check`      | Passed                               |

Seven new tests in `src/data/demo.test.ts` cover stable reference under mocked
real dates, timezone-equivalent output, meaningful status/timing/acceptance and
attention coverage, future preparation and milestone order, owned change and
checkpoint chronology, risk versus responsibility, and preservation/reset of
saved v1 state. Timestamp and calendar comparisons cover Europe/Sofia, UTC,
America/Los_Angeles, Pacific/Kiritimati and Pacific/Pago_Pago. Existing independent
Phase 2B.2.2 calendar/attention/clock tests remain unchanged.

The first run had 69 passes and one failure: an old seed test specifically
required the blocked task to be overdue at an August reference. The updated
scenario intentionally makes it due Today. That fixture-coupled assertion was
corrected to verify a critical blocker and separate overdue coverage against
the explicit demo reference; generic domain-test dates were not replaced.
The subsequent complete suite passed all 70 tests.

### Production browser and visual verification

Installed Edge/Chromium **154.0.4258.37**, headless Playwright, production preview
on local port 4173; 900 px viewport height. No dependencies were installed.
Fresh-state matrix used a simulated real date in **2035** to prove the reference
does not accidentally follow today's clock. Storage was isolated per case.

| Page             | Required configurations                                | Result                                                                                                                                   |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard        | 1440 EN Light; 1440 EN Dark; 390 BG Light; 320 BG Dark | Passed: disclosure, event dates, five/seven Focus behavior, multiple reasons, future timeline, differentiated pressure, Today checkpoint |
| Tasks            | 1440 EN Dark; 390 BG Light                             | Passed: one overdue row/count, independent blocked status, new deadlines and snapshot update metadata                                    |
| Team             | 1440 EN Light; 390 BG Light                            | Passed: two distinct at-risk people, three without pressure flags, existing layout retained                                              |
| Changes / Plan B | 1440 EN Light; 390 BG Light                            | Passed: localized travel narrative, 10:30 Varna report time, four affected tasks and Mira's response                                     |
| Templates        | 1440 EN Light                                          | Passed: template and explicit reset entry retained                                                                                       |

Additional browser cases compared complete rendered Dashboard, Tasks, Team,
Changes and arrival drawer text in UTC/2024, Los Angeles/2035 and
Kiritimati/2040: identical in all three. Advancing the real clock to 2050,
raising focus and reloading preserved both text and workspace values. A fourth
case checked old-fixture preservation, reset cancellation/confirmation,
preferences, task acceptance, fixed edit timestamp and reload.

All **15 browser cases passed** (11 layout cases + 3 clock/timezone cases +
1 persistence/reset case). Application console warnings/errors and uncaught
page errors: **0**. No horizontal page overflow or snapshot-text overflow was
observed. Screenshots were visually inspected across the required matrix,
including lower Dashboard content, BG reset confirmation and the settled drawer.
The first drawer capture caught its entrance animation; the evidence harness
was corrected to await animation completion and the matrix rerun successfully.
That intermediate capture was not an application defect.

Reproducibility artifacts are retained locally in ignored
`tmp/phase-2b-2-3b-browser.mjs` and `tmp/phase-2b-2-3b-evidence/` (JSON report and
screenshots). They are not committed product files. Browser emulation does not
constitute physical-device, Firefox/Safari, screen-reader or formal accessibility
certification, and no real-user outcomes are claimed.

### Independent review, file scope and deferred work

A separate read-only agent reviewed the implementation against `c87fb9a` for
clock dependence, clock consistency, timezone behavior, persistence mutation,
fictional chronology/milestones, localization overlay compatibility, current
documentation and locked layout scope. It independently ran **18 focused tests,
18 passed**, and reported **no confirmed defects**. Production-browser evidence
was produced and visually inspected by the implementing agent; no human review
is claimed.

Changed areas:

- Demo boundary/fixture/tests: `src/data/demoTime.ts`, `src/data/demo.ts`,
  `src/data/demo.test.ts`, `src/domain/workspace.test.ts`, `package.json`.
- Shared reference and snapshot edits: `src/App.tsx`, `src/hooks/useWorkspace.ts`,
  `src/pages/DashboardPage.tsx`, `src/pages/TasksPage.tsx`, `src/pages/TeamPage.tsx`.
- Disclosure and timestamp/localized copy: `src/components/AppShell.tsx`,
  `src/styles.css`, `src/i18n/createI18n.ts`, `src/i18n/formatters.ts`,
  `src/i18n/useI18n.ts`, `src/i18n/messages.ts`, `src/i18n/demoMessages.ts`.
- Current documentation/evidence: `README.md`, `docs/USER_GUIDE.md`,
  `docs/PRESENTATION_OUTLINE.md`, `docs/DEPLOYMENT_AND_DEMO_PLAN.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/TEST_EVIDENCE.md`, `docs/AI_ASSISTANCE_LOG.md`.

The only visual addition is the quiet global disclosure paragraph. Dashboard
and Tasks design, sidebar, 961–980 px Tasks compression, drawer/mobile-nav
transparency, Timeline/Team Pressure disclosure wording, Focus return-context
behavior and Team layout were deliberately not changed. Team 2B.3 was not
started. Historical NOIT **2025–2026** requirements still need verification for
any later competition year.

## 2026-09-28 — Phase 2B.2.3C narrow desktop and sticky surfaces

Baseline: `5c6dfc8609c8afc90fb528f0d5813ab73c1691e8`, clean `main`, equal to
`origin/main`, ahead/behind 0/0 before implementation. This explicitly authorized
phase changes only responsive task-result layout and the two confirmed sticky
surfaces. Mandatory project sources were already read completely during this
project session and were unchanged; the NOIT regulation is the historical
**2025–2026** source and needs verification for a later competition year.

### Reproduced cause and implemented contract

At 961 px BG, the old four-column row had only 651 px client width. Its minimum
tracks (230 + 140 + 108 + 112 px), three 11 px gaps and 60 px horizontal padding
required 683 px. The status text crossed the arrow by **9.4375 px** for Not started
and **1.109375 px** for Completed in the browser. The compact row previously
waited until the viewport was 800 px, ignoring the 252 px sidebar above 960 px.

`#task-results` now provides a named inline-size container. At **50rem or less**
of available results width, the existing two-level compact row is reused
unchanged: task/title/context above responsibility, deadline and status. The
query encloses grouped results too; filters and the drawer remain outside it.
The existing four-column register remains the default and the existing mobile
summary rules at 600 px and below remain unchanged. No font reduction,
operational-text truncation, new cards or information-hiding workaround was
introduced. Sidebar collapse was deliberately **not implemented**; the fix is
responsive content behavior.

Measured transitions with the default 16 px root font:

| Viewport width    | Results layout                      | Reason                                                    |
| ----------------- | ----------------------------------- | --------------------------------------------------------- |
| 1109 px and wider | Four-column register                | Results exceed 800 px                                     |
| 961–1108 px       | Two-level compact row               | Sidebar remains; results are at most 800 px               |
| 841–960 px        | Four-column register                | Sidebar disappears and the recovered width exceeds 800 px |
| 601–840 px        | Two-level compact row               | Results are at most 800 px                                |
| 600 px and below  | Existing three-level mobile summary | Existing mobile override                                  |

The browser checked BG and EN immediately around 1108/1109, 960/961, 840/841 and
600/601 px, plus the existing padding change at 800 px. No uncovered width band
or collision was observed. These viewport values describe the current shell;
the actual task adaptation is based on content width and a rem threshold.

Only `.task-drawer__topbar` and `.mobile-nav` changed from
`var(--surface-translucent)` to the existing opaque `var(--surface)`:
white in Light and `#111a25` in Dark. Normal application header, global tokens,
borders, shadows, navigation destinations and drawer structure were preserved.

### Automated evidence

Windows, Node 24.16.0, pnpm 11.9.0, Vite 6.4.3. The following commands passed:

| Command                 | Result                               |
| ----------------------- | ------------------------------------ |
| `pnpm.cmd format`       | Passed                               |
| `pnpm.cmd format:check` | Passed                               |
| `pnpm.cmd lint`         | Passed                               |
| `pnpm.cmd typecheck`    | Passed                               |
| `pnpm.cmd test`         | 73 passed; 0 failed, skipped or todo |
| `pnpm.cmd build`        | Passed; production bundle            |
| `git diff --check`      | Passed                               |

Three focused CSS-contract tests were added in `src/responsive-layout.test.ts`:
available-width compact layout with all operational cells retained; four-column
wide default; and solid sticky header/navigation surfaces. The six existing
responsive tests, including mobile summary, safe-area, focus and bounded
selection rules, were retained unchanged. These source-contract tests are
supplemented by actual browser geometry and interactions below; they do not
alone establish rendered correctness.

### Production-browser evidence

Installed Edge/Chromium 154.0.4258.37, headless Playwright, production preview
on port 4173, 900 px viewport height, Europe/Sofia and isolated local storage.
No dependency was installed. The normal fixture and its fixed demo reference
were unchanged. Separate synthetic long-BG fixtures were injected only into
isolated browser storage.

**47 normal Tasks configurations passed**:

- 1440 EN Light and Dark.
- BG and EN at 1100, 1024, 1000, 980, 970, 961, 960, 900 and 768 px.
  BG used Dark at 1024, 970 and 960; the other cases used Light.
- 390 BG Light, 360 EN Dark and 320 BG Dark.
- BG and EN Light at 1109, 1108, 1107, 841, 840, 839, 801, 800, 799, 601,
  600 and 599 px.

All requested width/language/theme combinations are included. Measurements
checked page scroll width, computed row mode, operational cell intersections,
actual text-range bounds and visible arrow intersections across all rows.
No column collision, badge/arrow overlap or horizontal page overflow was found.
Screenshots were visually inspected across the required matrix and representative
transition pairs, stress cases and regression pages.

**11 synthetic stress configurations passed**, each checked both ungrouped and
grouped: 1109, 1108, 1024, 980, 961, 960, 841, 840, 768, 390 and 320 px BG Dark.
All 44 fictional tasks remained present, including long Bulgarian titles and
owner names, status, priority, Accepted and deadline text. Wrapping preserved
meaning without collision or clipping of those operational fields.

**Four interaction/reflow configurations passed**:

- 1109 EN Light, 961 BG Dark and 390 BG Light: search; status filtering; owner
  grouping; bounded owner/category BudoSelect popups with Home/End/Escape and
  restored trigger focus; visible task-link focus; Enter and full-row pointer
  activation of canonical task links; initial drawer close focus; Tab/Shift+Tab
  trap; four status choices; first Escape closing the popup, second closing the
  drawer; close-button action and task-link focus restoration.
- 720 CSS px BG Dark with reduced-motion preference: row reflow passed and
  drawer animation duration was 0.00001 s. This is a layout-width equivalent
  of a 1440 px viewport at 200% zoom, **not a native browser-zoom or text-only
  zoom certification**.

**Six scrolling-surface configurations passed**:

- Drawer header at 961 BG Light and Dark, before and after 210 px drawer scroll.
- Bottom navigation at 390 and 320 BG, both Light and Dark, compared at page
  scroll offsets 160 and 620 px.

Decoded pixels of each header/navigation region were identical before and
after underlying content scrolled: no bleed-through. Screenshots were also
visually inspected. Computed opaque backgrounds were `rgb(255, 255, 255)` and
`rgb(17, 26, 37)`. Muted foreground contrast against these surfaces measured
**6.03:1 Light / 8.43:1 Dark**. All five navigation routes and their selected
states worked; each target was at least 44 by 44 px. At page end, content cleared
the navigation on every route. Existing safe-area CSS was retained; a physical
device with nonzero safe-area insets was not tested.

**Six locked-page regression spot checks passed**: Dashboard 1440 EN Light and
390 BG Dark; Team 1440 EN Light and 390 BG Light; Changes 390 BG Dark;
Templates 320 BG Light. Screenshots showed the existing design and no horizontal
page overflow. No polish was applied to these pages.

Application console warnings/errors: **0**. Uncaught page errors: **0**.
Local reproducibility artifacts are ignored product-external evidence:
`tmp/phase-2b-2-3c-browser.mjs` and `tmp/phase-2b-2-3c-evidence/` (JSON report,
full-page/fold screenshots and scrolled-surface captures). This controlled
browser evidence does not claim physical-device, Firefox/Safari, screen-reader,
formal accessibility certification or human usability results.

### Independent review and scope

A separate read-only agent reviewed the CSS/test diff against the accepted
baseline for width gaps, BG fit, clipped information, overflow, sticky opacity,
contrast, safe areas, keyboard/focus risks and locked-design scope. It
independently ran **9 responsive tests, 9 passed**, and found **no confirmed
defects**. It verified that the compact block was moved unchanged, all rules
from the 600 px breakpoint onward were unchanged, and the named container
excluded filters and the drawer. No review-driven source fix was necessary.
Production-browser verification was performed by the implementing agent;
no independent human review is claimed.

Only four tracked files changed: `src/styles.css`,
`src/responsive-layout.test.ts`, `docs/TEST_EVIDENCE.md` and
`docs/AI_ASSISTANCE_LOG.md`. Demo timing/data, task semantics, typography,
252 px desktop sidebar, Lucide, the top application header and locked
Dashboard/Tasks design remain unchanged outside the specified responsive fix.
Timeline/Team Pressure disclosure wording, Operational Focus return-context
and Team layout critique remain deferred. Team 2B.3 and backend/authentication
were not started. Historical evidence above is retained.

## 2026-09-29 — Phase 2B.2.3D Dashboard disclosure and return context

Accepted baseline: `729ab3e2a8dd92870fa19a235b84e7e959319ad6`, clean `main`.
Work began on 28 September and verification finished after local midnight.
This authorized interaction correction preserves the approved Dashboard/Tasks
appearance, CSS, Phase 2B.2.3C layout/surfaces, task semantics and demo reference.
Mandatory master/regulation sources were previously read completely in this
project session and remain unchanged. The NOIT **2025–2026** regulation remains
historical and must be checked for the actual later competition year.

### Final interaction contract

- Operational Focus initially shows five tasks. Its controlled expansion state
  belongs to the current Dashboard browser-history entry, represented in App
  through `dashboardNavigation.ts`. Toggling replaces that entry; it does not
  push another entry or write browser-local workspace/preferences storage.
- Opening a task records its task/focus key and current scroll offset in that
  Dashboard entry, then pushes the existing canonical task route. Back restores
  expansion before focus restoration. Forward reopens the task; Back again
  returns to the same origin. Drawer close/Escape uses the existing history-back
  behavior for app-opened details. Direct task deep links still close by replacing
  the route with `/tasks`, without navigating outside the app.
- Reload retains context for that same history entry. A new Dashboard navigation
  starts collapsed, including explicit navigation to the current Dashboard URL.
  No URL parameters, persistence schema or global state library were added.
- Return focus prefers the connected/visible original link, then its remounted
  exact counterpart. A closed Timeline/Change Impact disclosure uses its visible
  originating summary rather than attempting to focus a hidden descendant.
  A visible same-task link or Focus disclosure provides a fallback when editing
  removes the original row from the current attention list.
- Saved page scroll is restored without animation. Additional movement happens
  only when the focus target needs clearing of the fixed header or bottom nav.
  Focus Show more/less retains focus on its semantic button, keeps it visible,
  preserves `aria-expanded`/`aria-controls`, and allows Shift+Tab to reach the
  last newly revealed task. Expansion is not permanently forced.
- All four Timeline window disclosures and both Team Pressure disclosures now
  use the actual native `details.open` state for their visible labels through
  `DashboardDisclosure`. Native summary keyboard/expanded semantics are retained;
  redundant ARIA was not added. Change Impact source/behavior is unchanged.
- EN uses “Show less” for Timeline and “Show fewer people” for Team Pressure;
  BG uses “Покажи по-малко” and “Показване на по-малко хора”. Existing localized
  count/people wording remains in collapsed controls. Quiet people continue to
  mean people without pressure flags, not available capacity.

Read-only priority spot-check: the current demo shows **Lina first** (one overdue,
one at risk) and **Anton second** (one blocked, one at risk). Both appear in the
pressure preview. No weak tie-breaker hides Anton and no ranking change was made.

### Automated and browser evidence

Windows, Node 24.16.0, pnpm 11.9.0, Vite 6.4.3; installed Edge/Chromium
154.0.4258.37 via headless Playwright, production preview on port 4173,
900 px viewport height, isolated storage and Europe/Sofia browser timezone.

Required checks passed: `pnpm.cmd format`, `pnpm.cmd format:check`,
`pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test` (**78 passed, zero failed,
skipped or todo**), `pnpm.cmd build`, and `git diff --check`.
Five unit tests were added: four route-history context tests covering initial
state, serialization, collapse/reset and malformed context; one bilingual
disclosure-label test. Existing tests were retained. The browser regression
script is committed as `tests/dashboard-disclosure.browser.mjs` and formatted
with Prettier; it complements the pure unit suite with actual UI behavior.

| Dashboard configuration | Result |
| ----------------------- | ------ |
| 1440 EN Light           | Passed |
| 1440 EN Dark            | Passed |
| 1024 EN Light           | Passed |
| 390 BG Light            | Passed |
| 360 EN Dark             | Passed |
| 320 BG Dark             | Passed |

Every matrix case checked the initial five rows, Show more/less with Enter/Space,
button focus/visibility and control relationship, access to revealed rows,
task six, canonical route, Back/Forward/Back, close/Escape, Dashboard reload,
fresh Dashboard navigation and history length. Task six returned with a visible
solid focus outline and **zero difference from its saved scroll offset** in all
six cases. Centered disclosure expand/collapse also required zero scroll change;
the separate lower-viewport-edge case verifies the reveal fallback.

Every matrix case also checked Timeline and quiet-team expand/collapse labels,
native expanded accessibility properties through the Chromium accessibility
tree, keyboard focus after collapse, hidden Timeline origin fallback, unchanged
snapshot disclosure, no page horizontal overflow, and Lina/Anton visibility.
Mobile nav retained its opaque theme surface and all five targets of at least
44 by 44 px. Returned rows and fallback controls cleared the header/nav.
Screenshots of the restored row were visually inspected in all six configurations.

Seven additional browser cases passed:

1. EN synthetic overflow: all four Timeline windows, Team Pressure overflow and
   unchanged Change Impact expanded/collapsed labels, keyboard and native state.
2. The same synthetic disclosure coverage in BG at 320 px.
3. Direct valid task load/reload and Escape replacement without an extra entry.
4. Direct invalid task load/reload: localized warning, no drawer and 16 task rows.
5. Task seven, detail-page reload, Escape return and reduced motion at 320 BG Dark.
6. Completing task six removes it from attention; return focuses the visible
   Focus section control rather than removed content.
7. Focus disclosure aligned near mobile bottom navigation; expand/collapse keeps
   the focused control visible at 320 BG Light.

**13 implementing-agent browser cases passed** (six matrix + seven additional).
Application console warnings/errors and uncaught page errors: **0**.
The new synthetic fixture exists only in the browser regression script; product
demo data/time are unchanged. Encoded canonical links remain covered by route
unit tests. These checks are controlled emulation, not real-user results,
physical-device, screen-reader or Firefox/Safari certification.

Re-run after `pnpm.cmd build` with a production preview running. The script uses
an existing external Playwright installation: optionally set
`PLAYWRIGHT_MODULE_PATH` to its absolute `index.mjs` path and
`BROWSER_EXECUTABLE_PATH` to an installed Chromium/Edge executable, then run
`node tests/dashboard-disclosure.browser.mjs`. Without those overrides it uses
resolvable `playwright` and its default Chromium. `BUDOGRAPH_BASE_URL` optionally
overrides `http://127.0.0.1:4173`. No dependency was installed or added to the app.
Raw report/screenshots are in ignored `tmp/phase-2b-2-3d-evidence/`.

### Findings corrected and independent review

The first browser run exposed a focused disclosure button outside the viewport
after a toggle; the scoped reveal helper fixes this. A build initially rejected
a new test's access to an unknown preserved history property; explicit type
narrowing corrected the assertion. A browser-harness locator initially matched
two summaries; it was corrected to select the intended first summary. Verification
also waits for native smooth focus scrolling to settle before measuring geometry.
These intermediate failures are not described as passes.

A separate read-only agent confirmed that closed native `details` descendants
can retain client rectangles but reject focus, leaving BODY active after a
Timeline task return. The visibility guard and originating-summary fallback
were added. The reviewer independently re-tested this path at **1440, 390 and
320 px**, found the summary visible and focused with zero console/page warnings
or errors, and passed **31 route/i18n/Dashboard-helper/demo tests**. It reported
no remaining confirmed defects. No independent human review is claimed.

Files changed: `src/App.tsx`, `src/dashboardNavigation.ts`,
`src/navigationFocus.ts`, `src/pages/DashboardPage.tsx`,
`src/pages/dashboard/OperationalFocus.tsx`,
`src/pages/dashboard/PreparationTimeline.tsx`,
`src/pages/dashboard/TeamPressure.tsx`,
`src/pages/dashboard/DashboardDisclosure.tsx`, `src/routes.test.ts`,
`src/i18n/messages.ts`, `src/i18n/i18n.test.ts`,
`tests/dashboard-disclosure.browser.mjs` and the two evidence logs.
CSS/typography, sidebar, Tasks layouts, deterministic data/time, attention and
workload ranking were not changed. Team 2B.3, backend/authentication, Plan B
redesign and Templates redesign remain deferred. Historical entries are intact.

## Phase 2B.3 — Team Responsibility Workspace — 2026-09-30

Implemented after explicit human approval of the design contract at baseline
`82102f3003ae1cead099aead5930568797d1d559`. The contract remains unchanged as the
approved pre-implementation specification. This entry records implementation
verification; it does not rewrite earlier entries where Team was deferred.

### Scope and behavior

Team now uses an operational roster and one shared member detail body, inline
on desktop or in a fullscreen portal sheet at constrained widths. The roster
uses canonical attention representatives: blocked/overdue failures, other
attention, open work without attention, then no open work. Ties follow canonical
ordering and stable source order. A fresh entry selects Lina in the fictional
seed; valid manual/history selection takes precedence thereafter.

Counts are factual open/attention totals with subordinate overlapping reasons.
There are no capacity, productivity or performance scores. Status, priority,
timing and Accepted remain independent. Attention and upcoming partition tasks
without duplication; the initial five-row budget is allocated 3/2 with unused
slots reassigned to attention first. Each section can show all its rows.
Completed history starts collapsed; defensive invalid-date open work has a
separate disclosure. No canonical domain helper, demo clock/data or schema changed.

Real task anchors use `/tasks?task=<encoded-id>`. The existing Tasks drawer owns
editing. Team history stores selected member, disclosures, sheet state, focus
origin and scroll only in `history.state.budographTeam`. Desktop selection
replaces context; a compact roster selection pushes one same-route sheet entry.
Back/Close/Escape return to Team; Forward reopens the task. Removed/changed
origins use a visible fallback. Open Tasks goes to the full unfiltered `/tasks`
register, with no unsupported owner-filter promise.

### Automated checks

Windows, Node `v24.16.0`, pnpm `11.9.0`:

| Command                                             | Result                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| `pnpm.cmd format`                                   | Passed; final source formatting was already stable. |
| `pnpm.cmd format:check`                             | Passed.                                             |
| `pnpm.cmd lint`                                     | Passed, no errors or warnings.                      |
| `pnpm.cmd typecheck`                                | Passed.                                             |
| `pnpm.cmd test`                                     | **94 passed, 0 failed**; 16 new focused Team tests. |
| `pnpm.cmd build`                                    | Passed; production Vite bundle generated.           |
| `git diff --check`                                  | Passed.                                             |
| Explicit Prettier check of both new browser scripts | Passed.                                             |

New unit coverage includes canonical attention, representative selection,
blocked/overdue union counts, separate acceptance, stable roster grouping,
current-event ownership, zero-task members, mutually exclusive task sections,
five-row budget allocation, 100-task completed-heavy data, encoded links,
selected-member fallback, history serialization/malformed context, sheet state,
and matching interpolated BG/EN catalogs. Existing tests were not weakened.

### Browser matrix and interactions

Production preview on `http://127.0.0.1:4173`, isolated headless Microsoft Edge
`154.0.4258.37` contexts, Europe/Sofia timezone, **900 CSS px height**:

- Full matrix: **1440, 1024, 768, 390 and 320** × **EN/BG** × **Light/Dark**
  (20 cases).
- Additional primary cases: **1280 BG Light, 960 EN Light, 961 BG Dark,
  900 EN Light, 430 EN Light, 360 EN Dark** (6 cases).
- **23 additional cases**, including four dense fixtures at 1440 EN Light,
  1024 BG Dark, 390 BG Light and 320 BG Dark; direct valid/invalid Tasks URLs;
  completed/accepted task edits; resize and available-width fallback; full
  register navigation; reduced motion; default-detail engagement/reload;
  stale task/member/event data; empty roster; malformed history; and native
  accessibility-tree/contrast checks in both themes.

**49 Team browser cases passed.** Every primary matrix case checked initial
selection, keyboard selection, canonical task href, Back/Forward/Back, Task
Escape/Close, restored member/focus, and unchanged localStorage. Compact cases
also checked the sheet, focus trap, inert shell, close/back/forward/reopen and
44 px close control. Desktop cases checked the 38/62 roster/detail ratio,
selection focus and skip-to-detail control. No horizontal document or Team
region overflow was measured; no sampled Team text was below 12 px.

Measured available width explains the transition: 961 px remains compact;
967 px gives **659 px** of Team width and is compact; 968 px gives **660 px**
and uses the split. 1024 px uses the split. A forced 650 px content container at
1440 px also switches to compact. Resizing preserves selection and does not
push history. An interacted-with default detail becomes a sheet; inactive
roster mode stays closed. 1440→720 CSS px reflow (equivalent layout width to
200% zoom at 1440) preserves the open disclosure and has no clipping. This is
viewport emulation, not a claim of testing browser zoom controls.

Dense fixtures are created only in the browser script, never in product seed
or persistent developer data. They exercise **24 members**, a person with
**100 tasks: 20 attention, 10 upcoming, 70 completed**, overlapping blocked/
overdue/not-accepted reasons, long Bulgarian names/roles/titles and unbroken
strings, zero tasks, completed-only work, and accepted work without attention.
Show more/less exposes the complete relevant sets. Returning from a task reload
preserved a deep expanded-row origin and scroll; completed task returns also
restored their expanded disclosure. All completed history starts collapsed.

The existing `tests/dashboard-disclosure.browser.mjs` also passed unchanged:
**13 cases** (6 matrix + 7 extra), including Dashboard focus/disclosures,
Task Back/Forward/Close/Escape, direct URLs, reduced motion and edited origins.
Across both suites: **62 browser cases**, **0 application console warnings,
0 application console errors and 0 uncaught page errors**. Screenshots were
visually inspected for desktop, constrained BG detail, mobile roster/sheet,
and 320 px long-content stress.

### Accessibility and limits

Native accessibility-tree checks confirmed selected buttons, expanded native
summaries, a modal named by the member heading, and exclusion of inert shell
navigation. Keyboard checks covered Enter/Space, heading→Close, Tab/Shift+Tab
wrap, Escape, visible return targets and disclosure focus. The sheet uses one
scrolling body, opaque topbar, `100dvh`, safe-area padding and body scroll lock;
only one member detail tree is interactive. Reduced motion adds no animation.

Measured 58 rendered text/background pairs per theme on the default Team
workspace. Minimum contrast was **5.10:1 Light** and **4.98:1 Dark**; each sample
met its WCAG AA text-size threshold. These are scoped measurements, not a full
accessibility certification. No physical-device safe-area/rotation test,
Safari/Firefox test or human screen-reader session is claimed. Native AX-tree
inspection does not substitute for a screen-reader user review. No real-user
usability, productivity or organizer-effectiveness results are claimed.

### Independent review and corrected findings

A separate read-only agent reviewed product semantics, ordering/selection,
navigation, accessibility source, responsive design, localization and adherence
to the approved contract. It found two P2 issues: interacting with the default
inline detail did not mark it viewed for resize; and the summary gave all five
counts equal large-number emphasis. Both were corrected with engagement-aware
history state and compact primary/subordinate text. The reviewer re-read both
fixes and reported no remaining confirmed source findings. It did not run the
browser suite; browser evidence above belongs to the implementing agent.

Intermediate verification also corrected a test's shortened seed member ID,
a TypeScript narrowing assertion, an incorrect expected Anton task count, and
a harness assumption that 961 px always had enough content width for a split.
Those failures are not counted as passes. Final source and production bundle
were stable before the successful browser run and final automated checks.

### Files and reproduction

Team implementation: `src/pages/TeamPage.tsx`, `src/pages/team/MemberDetail.tsx`,
`MemberSheet.tsx`, `helpers.ts`, `helpers.test.ts`, `team.css`,
`src/teamNavigation.ts`, `src/teamNavigation.test.ts`, and
`src/i18n/teamMessages.ts`. Minimal shared integration: `src/App.tsx` remounts
Team on history entry changes and lets Team restore its own focus;
`src/i18n/messages.ts` registers new Team strings; `package.json` adds the two
unit-test files to the existing test command. Dependencies and lockfile did
not change. `docs/USER_GUIDE.md` describes the implemented interaction.
Dashboard, Tasks, TaskDrawer, BudoSelect, shared CSS/shell/navigation, Plan B,
Templates, domain semantics, storage and seed/time files remain unchanged.

After `pnpm.cmd build`, run a production preview on port 4173, then
`node tests/team-workspace.browser.mjs`. It imports the focused boundary checks
in `tests/team-workspace-edges.mjs`. As with the existing Dashboard script,
`PLAYWRIGHT_MODULE_PATH` can point to an already installed Playwright
`index.mjs`, `BROWSER_EXECUTABLE_PATH` to Edge/Chromium, and
`BUDOGRAPH_BASE_URL` to another preview origin. No app dependency was added.
Raw report/screenshots are ignored under `tmp/phase-2b-3-evidence/`; existing
Dashboard regression output is under `tmp/phase-2b-2-3d-evidence/`.

Backend/auth, invitations/permissions, real collaboration, Plan B/Templates
redesign and Change Consequence Path are not implemented by this phase. The
2025–2026 competition requirements are historical and require verification for
a later competition year.

## Phase 2B.4B — cross-page design-language alignment — 2026-10-01

Implemented the approved narrow alignment from baseline
`7c585a1e3fec84ae1ffeba426f332f417d803b5e`. This is not a global redesign.
Dashboard retains its five sections and operational ordering/limits; Tasks
retains its four-column register, content-width compact treatment, mobile
summary, filters and grouping. Team source, layout and content remain locked.

### Scope and measured typography

Dashboard focus, timeline and checkpoint titles and pressure names now use
14 px/700; Tasks titles use 14 px/700 instead of 13.12 px/770. Operational
metadata, owner/acceptance/deadline text and scoped status/priority labels use
12 px. Register and compact summary labels remain subordinate at 11 px.
Existing font families, semantic palette, surfaces, radius and shadows remain.
Comparable dates/counts use tabular numerals in these scoped elements.

EventOverview Overdue now uses `--risk-on-structure`, like Blocked; progress
and preparation timing retain gold. Removed only Dashboard's “What changed”
and “Team view”, Tasks' “Preparation work”, and TaskDrawer's “Ownership”,
“Current state” and “Record” kickers. All h1/h2/h3 headings and section
`aria-labelledby` relationships remain. “Task relationships” remains because
it identifies the relationship context above “Operational context”. Other
PageHeader callers still render their supplied eyebrow.

Controlled before/after measurements use the same installed headless Edge,
fresh isolated storage, language/theme and viewport. The before bundle was
built from a Git archive of the exact baseline under ignored `tmp/`, using
existing dependencies; it was served separately on port 5195. Its asset hashes
match the audited baseline (`index-C2XmWAmA.css`, `index-CYNGnRfi.js`). The final
bundle was served on port 5194 (`index-B8adJ7rs.css`, `index-CDEcCUEB.js`). These
measurements supersede approximate cross-browser positions from Phase 2B.4A.

| Representative measure, CSS px            |       Before |       After |
| ----------------------------------------- | -----------: | ----------: |
| Dashboard focus title, desktop            |        13.12 |          14 |
| Dashboard focus metadata, desktop         |        10.88 |          12 |
| Dashboard timeline title                  |        12.16 |          14 |
| Dashboard pressure name                   |           12 |          14 |
| Tasks title                               |        13.12 |          14 |
| Tasks acceptance, desktop                 |        10.56 |          12 |
| Tasks deadline / updated text             | 11.2 / 10.24 |     12 / 12 |
| Dashboard text-button height, desktop     |           28 |          44 |
| Dashboard disclosures, audit baseline     |     about 34 | at least 44 |
| Tasks filter / grouping control height    |           36 | at least 44 |
| Tasks search outer height                 |           38 |          44 |
| TaskDrawer close control                  |      38 × 38 |     44 × 44 |
| First Tasks row height, 1440 EN           |           76 |          76 |
| First Dashboard focus row height, 1440 EN |        111.3 |       117.2 |

The search input occupies 42 px inside its 44 px bordered wrapper. The 390 BG
group button grows to fit its two-line label. Existing BudoSelect truncation
in constrained triggers and complete option labels remain intact.

### Browser matrix and vertical rhythm

`tests/interface-alignment.browser.mjs` adds 21 cross-page cases and 18 Tasks
boundary cases. Each primary row below covers Dashboard, Tasks and Team;
positions are the document Y of the first operational row, before → after.

| Viewport / language / theme |   Dashboard Y |       Tasks Y |        Team Y |
| --------------------------- | ------------: | ------------: | ------------: |
| 1440 × 1000 EN Light        | 542.1 → 542.1 | 337.2 → 320.2 | 242.3 → 242.3 |
| 1440 × 1000 EN Dark         | 542.1 → 542.1 | 337.2 → 320.2 | 242.3 → 242.3 |
| 1280 × 900 BG Light         | 621.6 → 621.6 | 380.8 → 371.8 | 237.9 → 237.9 |
| 1024 × 900 EN Light         | 613.9 → 613.9 | 364.1 → 355.1 | 232.7 → 232.7 |
| 390 × 844 BG Light          | 505.0 → 505.0 | 489.7 → 494.6 | 264.2 → 264.2 |
| 360 × 800 EN Dark           | 476.6 → 476.6 | 621.2 → 639.0 | 241.7 → 241.7 |
| 320 × 740 BG Dark           | 505.0 → 505.0 | 621.2 → 639.0 | 264.2 → 264.2 |

Larger mobile controls cost 4.9 px at 390 and 17.8 px at 360/320 above the first
Tasks row after removing the kicker. No new section or spacing system was
added. Dashboard starts at the same Y; text wrapping makes the first focus
row 20.9 px taller at 390, 23.2 px at 360 and 6.6 px at 320. This is the bounded
readability tradeoff, not a claim that all row heights are unchanged.

Tasks boundaries **1100, 1024, 1000, 980, 970, 961, 960, 900, 768** passed in
both EN and BG. The existing available-width query produces compact rows at
1100–961, four columns at 960 and 900 after the sidebar disappears, and compact
rows again at 768. Grouped and ungrouped registers passed cell overflow,
cell collision and badge/arrow checks. Every primary and boundary case had
document scroll width equal to viewport width. Filter popups stayed within
both viewport axes; Enter/Space, Home/End, Escape and restored trigger focus
passed. Grouping and zero-result search/reset passed across the primary matrix.

The unchanged Team suite passed **49 cases** and the unchanged Dashboard suite
passed **13 cases**: a total of **101 browser cases** including the new 39.
Existing suites cover disclosures, task routes, Back/Forward/Close/Escape,
return focus/scroll, direct URLs, edits, responsive transitions, stress fixtures
and reduced motion. The Dashboard suite was rerun after the checkpoint-title
review correction; the final new suite also covers TaskDrawer and Team.
All seven Team baseline/final initial screenshots are byte-for-byte identical,
and Team source/navigation have an empty Git diff.

### Accessibility, visual review and checks

New drawer checks preserve responsibility/progress/metadata h3 headings,
conditional relationships, Tab/Shift+Tab wrapping, Escape ordering for the
status listbox versus drawer, and return focus to the original task link.
The close control measures 44 × 44 px. The existing focus-ring and reduced-
motion CSS and behavior were retained. Scoped rendered text/background
sampling (including composited translucent backgrounds) passed AA thresholds:
Dashboard 78 samples per matrix case, minimum **4.61:1 Light / 4.98:1 Dark**;
Tasks 93 desktop or 78 mobile samples, minimum **4.62:1 Light / 5.92:1 Dark**.
Drawer text was sampled as well. This is not a full accessibility certification.

Screenshots were inspected for the desktop Dashboard/register/Team comparison,
1024 compact register, 390 BG mobile register, 320 BG Dashboard/pressure and
drawer, and desktop operational changes. The final runs reported **zero
application console warnings/errors and zero uncaught page errors**.

Passed: `pnpm.cmd format`, `pnpm.cmd format:check`, `pnpm.cmd lint`,
`pnpm.cmd typecheck`, `pnpm.cmd test` (**94/94**), `pnpm.cmd build`,
`git diff --check`, plus explicit Prettier checking for the new browser script.
The existing responsive unit contract now expects the aligned 12 px mobile
utility labels; architecture and breakpoint assertions remain in place.

### Focused read-only review and limits

A separate read-only diff/render review pass used the requested independent-
review checklist: scope, typography hierarchy, wrapping/density, touch targets,
risk color, retained headings, breakpoint behavior, Team preservation and
semantic preservation. This was performed by the implementing agent; no second
agent or human reviewer is claimed. It found a checkpoint title still smaller
than its updated utility text and a tabular-number selector targeting a `time`
element absent from drawer metadata. Both were corrected locally and affected
browser checks rerun. No remaining confirmed source/render finding was found
in this scoped pass.

Two intermediate harness failures were corrected: focus restoration needed to
wait for the existing animation-frame callback; animated geometry needed a
subpixel tolerance rather than exact floating-point equality. They were test
synchronization issues, not product behavior changes, and are not counted as
passing runs.

Intentional visual differences remain: Team has 15 px task links and 16 px
person names; Dashboard and Tasks retain denser 14 px operational titles.
Page titles, surfaces, structural kickers, badges/icons and information
architecture retain their page-specific purposes. No physical-device,
Safari/Firefox, browser zoom control, human screen-reader or real-user study is
claimed. The historical 2025–2026 NOIT requirements require verification for a
later competition year.

Changed implementation files: `src/styles.css`, `src/components/PageHeader.tsx`,
`src/components/TaskDrawer.tsx`, `src/pages/TasksPage.tsx`,
`src/pages/dashboard/ChangeImpact.tsx`, `src/pages/dashboard/TeamPressure.tsx`.
Changed/added tests: `src/responsive-layout.test.ts`,
`tests/interface-alignment.browser.mjs`. Evidence is appended to this file and
`docs/AI_ASSISTANCE_LOG.md`. No dependency, lockfile, domain, demo/time, routing,
BudoSelect implementation, shell/navigation, backend or data changes were made.
The unrelated untracked `docs/market-research/docs - Shortcut.lnk` was not read,
edited, deleted or staged.

Reproduction: build, start a production preview and run
`node tests/interface-alignment.browser.mjs` with the same optional
`PLAYWRIGHT_MODULE_PATH`, `BROWSER_EXECUTABLE_PATH` and `BUDOGRAPH_BASE_URL`
variables documented for the existing suites. Final screenshots/report are
ignored under `tmp/phase-2b-4b-evidence/`; the controlled baseline comparison
is under `tmp/phase-2b-4b-before/`. No runtime package was installed.

## Phase 2B.4C — Dashboard + Tasks human-led de-SaaS refinement — 2026-10-02

### Scope and controlled baseline

Implemented the approved `BUDOGRAPH_2B4C_DESAAS_DESIGN_CONTRACT.md` from
`6386bd2a95e0342aadf9f44f160e621cc21c49ac`. The four human-provided screenshots
and the approved contract drove the work. A controlled browser baseline was
captured before code changes: 24 page cases, Dashboard factual snapshots, and
16 Team images (initial and second-member selection at eight configurations).
These are synthetic demo observations, not real-user feedback.

Group 1 removed the Event Overview hero shell, decorative metadata icons and
KPI layout; retained all event facts/counts and the exact accessible progress;
made queue titles precede plain action guidance, reasons and metadata; and
made the preparation sequence date-led without rails/dots. Group 2 flattened
change records into change/impact/owner/response relationships with an adjacent
checkpoint, separated severity from response status, and joined pressure
signals/counts after removing Dashboard-only initials and tinted person rows.
Both groups passed focused tests and their own 16-case Dashboard/Team browser
review before the next group began.

Group 3 added the approved event-specific Tasks context, a single wrapping
textual totals summary, and a common controls/results region. Priority is
plain semantic text next to category. Register columns, lifecycle badges,
acceptance, initials, chevrons, links, row sizing and responsive modes remain.
All four contract guardrails are implemented without replacement pills or
stat tiles. No architecture or data semantics were redesigned.

### Verification

All required checks passed: `pnpm.cmd format`, `pnpm.cmd format:check`,
`pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd test` (**94/94**),
`pnpm.cmd build`, and `git diff --check`. The new browser script also passed
an explicit Prettier check. Group 1 and Group 2 focused runs each passed
30 tests; the Tasks focused run passed 21 tests.

The final production build was served with Vite preview at
`http://127.0.0.1:5190`, using the existing Playwright runtime and installed
headless Microsoft Edge. No dependencies were installed.

| Width × height | Language | Theme | Pages                  |
| -------------- | -------- | ----- | ---------------------- |
| 1440 × 1000    | EN       | Light | Dashboard, Tasks, Team |
| 1440 × 1000    | EN       | Dark  | Dashboard, Tasks, Team |
| 1280 × 900     | BG       | Light | Dashboard, Tasks, Team |
| 1024 × 900     | EN       | Light | Dashboard, Tasks, Team |
| 768 × 1024     | EN       | Light | Dashboard, Tasks, Team |
| 390 × 844      | BG       | Light | Dashboard, Tasks, Team |
| 360 × 800      | EN       | Dark  | Dashboard, Tasks, Team |
| 320 × 740      | BG       | Dark  | Dashboard, Tasks, Team |

`tests/desaas-composition.browser.mjs`: **24 page cases + 34 boundary cases**.
Tasks was checked in EN and BG at **1280, 1100, 1024, 1000, 980, 970, 961,
960, 900, 800, 768, 600, 430, 420, 390, 360 and 320 px**. Every boundary checks
ungrouped/grouped row geometry, popup bounds, keyboard operation, heading
alignment and document overflow. No existing breakpoint was moved.

The harness compares Dashboard facts to the controlled baseline when present
and independently verifies demo facts/counts/progress, canonical attention
order/reasons/owners, timeline windows/order/previews/kinds/lifecycle, change
fields/checkpoint, and pressure membership/order/roles/counts. Tasks checks
all four cell roles, category/priority, ownership/acceptance, deadlines and
lifecycle; event-wide totals remain unchanged by search and each filter.
It exercises empty search/clear, grouping, invalid links, task opening,
Back/Forward, reload with a task open, Escape and focus restoration.
Keyboard listbox navigation/cancellation, drawer focus trap, nested Escape,
44 px controls, sampled text contrast and native disclosures are checked.
The existing Dashboard suite also covers dense disclosures and reduced motion.

Existing unmodified suites passed: `tests/dashboard-disclosure.browser.mjs`
(**13 cases**) and `tests/team-workspace.browser.mjs` including its imported
edge suite (**49 cases**). Final runs reported **zero application console
warnings/errors, zero uncaught page errors and no document-level horizontal
overflow**.

All 16 final Team images match the baseline byte-for-byte. Team source,
styles and navigation remain unchanged. Direct comparisons also confirmed
unchanged palette/font/shell/shared pre-Dashboard CSS, Drawer and Changes CSS
blocks, components, domain, data, routes, App and package/lock files.

### Fresh read-only review and fixes

A separate read-only pass reviewed the complete diff and rendered screenshots
against the requested checklist. It was performed by the implementing agent;
no second agent or human acceptance of the finished interface is claimed.
Screenshots were inspected in both themes/languages across the matrix, with
additional Tasks inspection at 961/960, 600 and 420 px, and Dashboard lower
sections at desktop and 390/320 px.

Confirmed findings were fixed within scope: plain Important text on the
selected row had 4.42:1 contrast, so that state now uses the existing ink token;
the Tasks header inherited centered alignment at 768 px after totals moved,
so Tasks alone now aligns its header with the working region; a redundant
phone padding override suppressed the milestone spacing, so it was removed.
Regression assertions cover these cases and affected browser checks were rerun.
No further confirmed information loss, behavior change, clipping, weak
checkpoint affordance, replacement KPI/pill pattern or Team regression remained
in this pass.

Intermediate non-passing runs are not counted as evidence. The harness was
corrected to use DOM text for closed timeline disclosures and normalize
Node/browser Intl date-range whitespace. One Team run overlapped a production
rebuild and encountered a transient preview HTTP failure; its complete rerun
against the stable build passed all 49 cases.

Intentional differences remain: Dashboard is a flat operational readout;
Tasks retains its useful table surface and lifecycle badges; Team retains its
locked roster/detail layout and larger person/task type. The existing phone
Event Overview still hides guest text and Review all tasks, with Tasks
available through existing navigation. Queue/timeline heights remain natural,
not artificially equal. Other-browser, physical-device, human screen-reader
and real-user testing are not claimed. Competition-year-specific 2025–2026
NOIT requirements require verification for later years.

Changed files: the five Dashboard components, `src/pages/TasksPage.tsx`,
`src/i18n/messages.ts`, `src/styles.css`, `src/responsive-layout.test.ts`,
`tests/desaas-composition.browser.mjs`, and appended entries in this evidence
file and `docs/AI_ASSISTANCE_LOG.md`. No backend, authentication, database,
dependency, asset, demo clock/storage, Plan B/Templates redesign or Change
Consequence Path work occurred. The unrelated untracked shortcut was not
read, modified, deleted, staged or committed.

Reproduce after building and starting a production preview:
`node tests/desaas-composition.browser.mjs`, with optional
`PLAYWRIGHT_MODULE_PATH`, `BROWSER_EXECUTABLE_PATH` and `BUDOGRAPH_BASE_URL`.
`BUDOGRAPH_REVIEW_STAGE` defaults to `final`; `baseline`, `group1` and `group2`
are available for staged comparison. Ignored screenshots/factual snapshots
and JSON reports are under `tmp/phase-2b-4c-evidence/`. Baseline comparison is
additional to the fixture-derived assertions and requires the saved baseline.

## Backend P1A foundation - 2026-10-03

Implemented under the explicit P1A request and approved Backend Foundation
Contract v1.0. Preflight: branch `main`, HEAD and freshly fetched `origin/main`
`c19c2c04743f041d9216b6328501ed13498d3633`, ahead/behind `0/0`, no tracked or
staged changes. The known untracked shortcut remained outside scope.
The entire master prompt, approved contract, and supplied 30-page 2025-2026
regulations were read before implementation.

### Executed checks

Verified locally on Windows using Node.js `v24.16.0`, pnpm `11.9.0`, and the
existing Git/TypeScript/ESLint/Prettier tools. No PostgreSQL, Docker, Testcontainers,
or cloud database was installed or provisioned.

| Command                     | Result                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| `pnpm.cmd format`           | PASS; locked frontend files stayed unchanged.                               |
| `pnpm.cmd format:check`     | PASS; includes backend source/tests/config and development guide.           |
| `pnpm.cmd lint`             | PASS; Node globals for server and existing frontend/Vite coverage retained. |
| `pnpm.cmd typecheck`        | PASS; existing frontend configurations unchanged.                           |
| `pnpm.cmd test`             | PASS; 94/94 frontend tests, zero failures/skips.                            |
| `pnpm.cmd build`            | PASS; frontend production build completed.                                  |
| `pnpm.cmd server:typecheck` | PASS; strict NodeNext source, scripts, and tests; no skipLibCheck addition. |
| `pnpm.cmd server:test`      | PASS; 35/35 backend tests, zero failures/skips.                             |
| `pnpm.cmd server:build`     | PASS; dedicated ignored output in `server/dist/`; tests not emitted.        |
| `git diff --check`          | PASS.                                                                       |

The 35 backend tests comprise configuration validation/safe errors (4), Fastify
injection and request-log safety (6), migration file/history logic and explicitly
mocked client behavior (17), lazy pool/error boundary (1), Git ignore probes (2),
and shutdown/startup failure behavior (5). Real PostgreSQL is not exercised by
these tests. The migration concurrency test uses an explicitly simulated lock;
it does not prove PostgreSQL advisory-lock behavior.

Additional runtime checks executed: source and compiled server/migration entrypoints
exit with status 1 and a safe field-specific message when DATABASE_URL is absent.
The compiled HTTP runtime bound an ephemeral loopback port; liveness returned 200
and the real pool's connection attempt to deliberately refused loopback port 1
produced a safe readiness 503. Synthetic connection details did not appear in logs.
SIGTERM and SIGINT handlers were driven with `process.emit`; cleanup exited with
status 0. This does not claim actual Windows OS signal delivery was verified.
No readiness-success check against a live database was performed.

REAL POSTGRESQL INTEGRATION CHECK:
**NOT RUN - no approved test database configured.**

### Security, lifecycle, and scope review

The first code change hardened `.gitignore`; `git check-ignore` and automated
probes verify root/nested `.env` and `.env.*` protection, explicit `.env.example`
allowance, and ignored compiled server output. No temporary environment files
were created. `server/.env.example` contains unmistakable placeholders only.
Changed-file searches reviewed key prefixes, private-key markers and credential
URLs; URL matches were only reviewed synthetic/invalid test inputs or placeholders.
No real database credentials, passwords, tokens, environment files, auth code,
wildcard CORS or generated backend JavaScript were added to the intended source.

Confirmed findings fixed during review:

- Fastify's malformed-URL fallback echoed raw URL components outside the normal
  error handler. A safe framework error handler and regression test now cover it.
- Checked-out pg clients lose pg-pool's idle error listener. The migration runner
  now handles client connection error events safely, stops further work, destroys
  failed sessions and retains its listener through release. EventEmitter mocks
  cover active-query errors, errors between queries and listener handoff.
- Runtime validation now preserves safe EnvironmentError field diagnostics without
  exposing raw startup/pg errors; shutdown cleanup survives failed reporting.
- Existing Vite lint coverage was retained when server Node globals were separated.
- Migration SQL checkout line endings are pinned to LF in `.gitattributes` so exact
  byte checksums can remain reproducible across Windows and Linux.

Migration metadata is fixed `public.schema_migrations`; inserts parameterize
version/name/checksum and timestamps originate in PostgreSQL. One checked-out
client owns the advisory lock and per-file transactions. History changes,
renames, missing files, duplicate versions, and late versions fail; failed SQL or
metadata writes are not marked applied. Failed rollback/unlock destroys the client.
Migration files are trusted reviewed repository SQL, must be transaction-compatible,
and must not control transactions/locks/metadata themselves. No down runner exists.

No business SQL migration files were added. No real database was migrated, so no
real metadata or business tables were created by this task. No Better Auth, users,
sessions, Event/EventMember/Task/ActivityEntry tables, task commands, permissions,
remote frontend services, Plan B/Templates work or deployment was implemented.

`git diff` confirms the entire tracked frontend `src/`, browser tests, HTML,
Vite configuration, frontend tsconfigs and workspace setup are unchanged. Demo
state/date/storage, routes/history/focus, selectors and locked Dashboard/Tasks/Team
remain unchanged. No new browser visual run is claimed for this infrastructure-only
phase. All 227 previously locked package versions remain present; only the required
backend dependency tree was added (plus refreshed ESLint deprecation metadata).

Documentation: backend development guide and migration authoring guide added;
README, known limitations, direct-dependency/license register and AI assistance
log updated. Full installed MIT license texts for fastify, pg and @types/pg were
reviewed; no legal certification or full transitive redistribution audit is claimed.
The historical 2025-2026 NOIT rules still require verification for a later year.

### Final independent read-only review and staged audit

A separate regulation/documentation agent performed a fresh read-only review of
all 29 staged files after the fixes, including the complete migration tests,
client error-event handling, runtime/configuration, dependency/config diff and
final documentation. Review result: PASS, no remaining confirmed issues. This is
an independent agent review of the implementation, not human acceptance or an
external security assessment. The primary agent also reviewed the complete scope.

The final staged audit found only the intended 29 files: six root infrastructure/
README files, five documentation files, and 18 files under server/. No real
secret files or credentials, generated server output, frontend changes, business
SQL files, or unrelated shortcut were staged. `git diff --cached --check` passed.
`pnpm.cmd install --frozen-lockfile` also passed with the resolved lockfile.
The unrelated shortcut remained untracked and untouched.

## Backend P1A - subsequent human PostgreSQL verification - 2026-10-03

Implementation baseline: `75e76c2192322015ce815581b74672726411aec8`
(`feat(server): establish backend foundation`). The human supplied the following
manual results from the approved Supabase-hosted PostgreSQL development database.
Codex recorded these results without accessing secrets or rerunning database
operations. Earlier implementation evidence above remains historical; its
NOT RUN status describes the earlier verification boundary.

### Secret protection and real health checks

The human ran `git check-ignore -v server/.env` and reported:

```text
.gitignore:79:**/.env   server/.env
```

The human's Git status confirmed `server/.env` was not tracked. Only the known
unrelated untracked `docs/market-research/docs - Shortcut.lnk` remained.
The human configured the local secret DATABASE_URL; its value was not shared
with AI or committed.

| Manual request                                                                 | Result                               | Evidence                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `GET http://127.0.0.1:3001/api/health/live`                                    | HTTP 200, `{"status":"ok"}`          | Fastify liveness succeeded.                                                                                  |
| Initial `GET http://127.0.0.1:3001/api/health/ready`                           | HTTP 503, `{"status":"unavailable"}` | Before credentials were corrected, database-unavailable behavior was safe and exposed no connection details. |
| Readiness after the human corrected local credentials and restarted the server | HTTP 200, `{"status":"ok"}`          | Successful real PostgreSQL connectivity.                                                                     |
| Final readiness after migration verification                                   | HTTP 200, `{"status":"ok"}`          | PostgreSQL readiness remained successful.                                                                    |

### Real migration-runner verification

The human manually executed `pnpm.cmd db:migrate` twice:

```text
Run 1: Migrations complete: 0 applied, 0 already applied.
Run 2: Migrations complete: 0 applied, 0 already applied.
```

Both successful runs connected to real PostgreSQL and executed migration
infrastructure. Repeating the empty run was safe/idempotent. Zero applied
migrations is expected for P1A because no business SQL migration files exist.
No business migrations, business tables, or auth tables were created. This
does not claim application of pending SQL files, direct metadata inspection,
live checksum-change rejection, concurrent locking, or transactional rollback.

REAL POSTGRESQL INTEGRATION VERIFIED: **YES**
REAL MIGRATION RUNNER VERIFIED: **YES**
BUSINESS TABLES CREATED: **NO**
AUTH IMPLEMENTED: **NO**
BACKEND P1B STARTED: **NO**

## Backend P1B — authentication, relational schema and authorization — 2026-10-03

Implemented under the explicit P1B request and approved Backend Foundation
Contract v1.0. Preflight: `main`, HEAD and freshly fetched `origin/main`
`96621f5da8fdd64bb4bf50d0962b8070441b8427`, ahead/behind `0/0`, no tracked/staged
changes. The unrelated `docs/market-research/docs - Shortcut.lnk` remained
untracked and untouched. Mandatory master prompt, 30-page regulations and
complete approved contract/P1A implementation were read. The 2025–2026 rules
remain historical and require verification for the actual participation year.

### Auth/schema provenance and implementation boundary

Only `better-auth` **1.7.7** (MIT) was added as a direct dependency, pinned in
`package.json` and `pnpm-lock.yaml`. Official current PostgreSQL/Fastify/options/
CLI documentation and installed 1.7.7 behavior were checked. The matching
official generator is **`auth@1.7.7`**, invoked through pinned `pnpm dlx`, using
the locally installed runtime configuration and existing `pg.Pool`.
`@better-auth/cli@latest`, unmanaged auth migrations, application ORMs and an
Admin plugin were not used.

`0001_better_auth_core.sql` contains reviewed generated SQL, including the
server-controlled `user.active` field. Auth instants are generated as
`TIMESTAMPTZ` natively, without a hand-written table reconstruction or type
rewrite. Raw generated SQL SHA-256:
`1ff812a96bd306d7124d1d5a3e74b20d7ae5c04e2948bab0d8614e768641d670`.
The migration adds provenance comments only, with LF checkout normalization.
The generator was rerun before migration and matched the runtime schema.
Temporary generator output is ignored and is not committed.

`0002_budograph_core.sql` adds Event, EventMember, Task and ActivityEntry with
UUID business IDs, finite `DATE` calendar values, named timezone validation,
version constraints, scoped membership/actor foreign keys, current acceptance
consistency, soft-delete metadata and JSONB history. One narrow database trigger
rejects history UPDATE/DELETE/TRUNCATE. Auth and business tables have RLS enabled
with no browser policies. Backend Event authorization still runs separately;
the current trusted database identity bypasses owner RLS, and production
least-privilege runtime/migration-role separation remains deployment work.

Runtime authentication disables public email/password signup and also disables
its HTTP path. The isolated DEVELOPMENT-only CLI instance uses supported
`auth.api.signUpEmail`, with automatic signup login disabled. Better Auth owns
password hashing, account creation and database sessions. Active User state is
checked at session issuance and protected reads. `/api/me` returns only user
id/name/email; authorization helpers derive identity from that trusted boundary.
Event membership, access role and task lookup are persisted, parameterized and
Event-scoped; descriptive operational role grants no authority.

`BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required for auth-capable runtime;
database-only migration commands retain the separate typed DB environment.
Cookies are HttpOnly/SameSite=Lax and Secure for HTTPS/production. Trusted origins
contain exactly the configured auth origin, with default CSRF checks retained.
No separate frontend auth origin/CORS is configured. Auth memory rate limiting
uses the direct peer IP supplied by the server, ignoring forged client IP headers.
Fastify forwards distinct Set-Cookie headers, status, headers and body; library
diagnostics are disabled and application logs omit credentials/cookies/raw errors.

### Executed real PostgreSQL/auth verification

The approved Supabase development database was accessed through native Node
environment loading. `server/.env` was never read or printed by the agents.
The read-only preflight reported PostgreSQL **17.11** and only
`public.schema_migrations`; there were no conflicting auth/business tables.
The human confirmed creation of synthetic development credentials and a random
auth secret in the separate Git-ignored `server/.env.p1b.local`. Values were
generated locally with Node crypto, never printed or placed in command arguments,
source, evidence, screenshots or Git. The normal server does not require
provisioning credentials. The development-only commands load that optional
file; compiled `server:start` does not automatically load development credentials.

| Verification                          | Observed result                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First explicit `pnpm.cmd db:migrate`  | `2 applied, 0 already applied`                                                                                                                                           |
| Second explicit `pnpm.cmd db:migrate` | `0 applied, 2 already applied`                                                                                                                                           |
| Migration metadata                    | Both immutable filenames/checksums match repository bytes                                                                                                                |
| Auth schema                           | `user`, `session`, `account`, `verification` present                                                                                                                     |
| Business schema                       | `event`, `event_member`, `task`, `activity_entry` present                                                                                                                |
| First `pnpm.cmd server:provision`     | Organizer and Member: `created`                                                                                                                                          |
| Repeated provisioning                 | Both: `already-exists`; no password reset or duplication                                                                                                                 |
| Real auth verifier                    | PASS: actual loopback listener/live/readiness, HTTP signup 404, direct runtime signup disabled, rejected signup creates no user                                          |
| Organizer and Member                  | Both sign in with separate cookies; `/api/me` safe identity and Better Auth session lookup succeed                                                                       |
| Session persistence/logout            | Each login adds a real session row; logging out Organizer leaves Member authenticated; each logout invalidates lookup/protected access and returns row count to baseline |
| Negative auth/origin checks           | Missing/malformed session → 401; wrong password → 401; untrusted cookie-auth origin → 403; no wildcard CORS                                                              |
| Response/log safety                   | Safe application identity; passwords, auth/database secrets and cookie/session values absent from captured logs                                                          |
| Compiled runtime smoke                | Actual compiled main: live 200, real readiness 200, protected `/api/me` 401, safe logs                                                                                   |
| Final persistent counts               | 2 users, 2 credential accounts, 0 sessions; 0 Events/Members/Tasks/ActivityEntries                                                                                       |

Applied migration checksums:

- `0001`: `3eea6d946b15cfc651e83f32d454c3f5b4bae28062421f9fa2ba2eeea14c3d91`
- `0002`: `f6bba034c1f709cb4f6768c5350823aae7c01f384ab5ce9dd652a23deb5b9785`

The opt-in `RUN_DATABASE_INTEGRATION=1 pnpm.cmd server:test:integration` run
passed **17/17 tests**, zero failures/skips (parent plus 16 subtests). It proves
real migration idempotence/checksums; all eight tables/RLS/no public policies;
actual `anon` and `authenticated` SQL-role read denial across all eight tables;
Event date/name/timezone/version constraints; membership uniqueness/role/active
consistency; valid/invalid lifecycle and priority; whitespace-only title rejection;
cross-Event assignee and creator/updater/deleter FKs; paired/scoped acceptance;
date-only values under Pacific/Honolulu; JSONB/server-time history and matching
actor User/member/Event; append-only behavior and restrictive history references;
real scoped authorization with inactive User/member and operational-role denial.
All generated schema fixtures were rolled back and their absence checked.
No database/schema reset, unrelated-row deletion or TRUNCATE was executed.
Role denial was exercised through SQL, not the external Supabase REST API.

### Automated/regression checks and review

Executed on Windows with Node.js `v24.16.0` and pnpm `11.9.0`:

| Command                                                 | Result                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm.cmd format` / `format:check`                      | PASS; locked frontend files unchanged                                     |
| `pnpm.cmd lint`                                         | PASS                                                                      |
| `pnpm.cmd typecheck` / `build`                          | PASS; frontend production output unchanged                                |
| `pnpm.cmd test`                                         | PASS: 94/94 frontend tests, no failures/skips                             |
| `pnpm.cmd server:typecheck` / `server:build`            | PASS                                                                      |
| `pnpm.cmd server:test`                                  | PASS: 57 passed, 1 intentional opt-in database suite skipped, no failures |
| `pnpm.cmd server:test:integration` with explicit opt-in | PASS: 17/17 against approved PostgreSQL, no skips                         |
| `pnpm.cmd server:verify-auth`                           | PASS against real PostgreSQL after final script fixes                     |
| `pnpm.cmd server:auth-schema` after migrations          | PASS: schema up to date, no new SQL file, no migrations applied           |
| `pnpm.cmd install --frozen-lockfile`                    | PASS                                                                      |
| `git diff --check`                                      | PASS                                                                      |

Offline tests retain P1A coverage and add real-library signup/malformed-cookie/
origin probes, supported active-user session hook, cookie/configuration safety,
safe identity/log errors, nine authorization tests and two provisioning-input
tests. Their injected session/database cases are explicitly unit tests; the
separate real verification establishes database-backed auth behavior.
Backend DOM type libraries are needed for Better Auth's WHATWG signatures;
`skipLibCheck` avoids its unused unconditional `bun:sqlite` declaration.
Project code retains strict checking; no Bun dependency or false declaration shim
was added. This limitation is documented, not hidden.

Confirmed findings fixed before final verification:

- PostgreSQL `btrim` alone did not reject tab/newline-only required text; reviewed
  checks use whitespace-aware regex and real negative tests before SQL application.
- Verification failure cleanup needed a trusted Origin for cookie-auth logout;
  it now revokes only its pending sessions and checks cleanup responses.
- CLI cleanup failures could escape safe error handling or skip pool closure;
  cleanup now uses static failures and the existing ordered shutdown boundary.
- Official CLI generation returns exit 0 with no output for an up-to-date DB;
  each invocation now has a unique ignored output path and reports actual output
  presence, preventing stale SQL from being called newly generated.
- The initial auth verifier exceeded the library's 3-per-10-second sign-in limit
  with its negative probes (429). Origin verification now uses cookie-auth logout;
  the runtime rate limit was retained. Intermediate failures are not passing evidence.

Fresh read-only agent reviews covered current official API/library behavior,
provenance, auth/session/cookies, public signup, SQL constraints/history/RLS,
provisioning, migration safety, query scope, tests and scope exclusions. Findings
above were fixed and affected verification rerun. This is agent review, not formal
security certification or human product acceptance.

Dashboard/Tasks/Team and all tracked frontend source, routes, localStorage demo
behavior, selectors and appearance are unchanged. No frontend login/integration,
remote workspace service, Event bootstrap, task mutation endpoints, Plan B,
Templates, Budget, AI or notification backend was added. The two-user task
responsibility loop and transactional ownership/deactivation/lifecycle commands
remain P1C. No real Event or demo migration is implied by controlled account
provisioning. Production deployment, restore verification, browser auth E2E and
separate runtime DB privileges remain limitations.

Final staged audit: **PASS** — 31 intended backend/tooling/documentation files,
no locked frontend changes, secret files, actual loaded credential values,
private keys, credential-bearing Supabase URLs, generated build output or
shortcut. Environment-name matches were configuration references/placeholders;
test passwords were explicit synthetic sentinels. Both applied SQL checksums
remained unchanged. `git diff --cached --check` passed. Fresh independent reviews
reported no remaining confirmed actionable findings after fixes.

## Backend P1C — two-user responsibility loop — 2026-10-03

Authorized baseline: `221031b7d5cb04cb56c24e208e04d305009825b2` on `main`,
freshly fetched `origin/main` equal, ahead/behind 0/0, tracked worktree clean.
Only `docs/market-research/docs - Shortcut.lnk` was untracked; it was untouched.
The complete master prompt, supplied 30-page 2025–2026 regulation, approved
backend contract and P1B implementation were read before implementation.
The earlier contract documentation-only restriction does not override this
explicit human authorization to implement P1C. Historical competition rules
still require verification for the actual participation year.

### Preflight and implemented scope

P1B preflight passed: backend typecheck, 57 offline tests (one intentional DB
skip), 17/17 real PostgreSQL schema tests and the real two-account auth verifier.
P1C adds five task routes, strict command DTO validation, transactional scoped
authorization, responsibility/status commands, canonical task DTOs, explicit
development Event bootstrap and a reproducible real HTTP verification script.
No frontend source, migration SQL, dependency or lockfile was changed.

### Real approved PostgreSQL and HTTP evidence

| Verification                      | Observed result                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit `server:bootstrap-event` | First run created one Event, two memberships and one minimal task; repeated run reported all already-exists with identical UUIDs.                                                                    |
| Organizer session                 | Actual loopback HTTP login, safe identity, Better Auth lookup and additional database session row passed.                                                                                            |
| Member session                    | Separate memory-only cookie jar independently resolved Member; distinct from Organizer, with its own database session row.                                                                           |
| Both reads                        | Both active memberships read the same live Event task; deadline stayed `2026-10-04`.                                                                                                                 |
| Assignment                        | Organizer assigned the task to Member; Member refetch and SQL state confirmed the membership reference. Member assignment returned 403.                                                              |
| Acceptance                        | Organizer impersonation returned 403. Member acceptance persisted its resolved member ID and database instant; Organizer refetch saw it. Forged actor/time/role/history fields returned 400.         |
| Current-version acceptance repeat | Returned canonical unchanged state; version and original acceptance instant remained unchanged.                                                                                                      |
| Status                            | Current Member changed status to in-progress; current acceptance remained unchanged. Organizer status authority also passed.                                                                         |
| Stale request                     | Old expectedVersion returned 409 with `TASK_VERSION_CONFLICT`; no stale overwrite/history.                                                                                                           |
| Withdrawal                        | Organizer impersonation returned 403; Member withdrawal cleared both acceptance fields and recorded history; explicit Member reacceptance succeeded.                                                 |
| Reassignment                      | Organizer reassigned to their own active membership; SQL showed new assignee and both acceptance fields null together. Activity recorded prior accepted member/time and clearing.                    |
| Old assignee                      | Member acceptance and status writes after reassignment returned 403.                                                                                                                                 |
| Unassignment / assign-back        | Organizer accepted their own task, then unassigned; SQL showed assignment/acceptance null. Assigning back to Member left acceptance empty.                                                           |
| History                           | Previous Member acceptance remained stored with server actor/instant; all six dotted command action types were present.                                                                              |
| Actual concurrent writes          | Simultaneous Organizer/Member HTTP status commands with the same version used independent pg transactions: exactly one 200 and one 409, one version increment and one additional activity.           |
| Event boundary                    | Both real sessions denied foreign Event/task IDs with 404; Organizer could not mutate a foreign task using Event A's path; foreign membership assignment returned 404. SQL version stayed unchanged. |
| Operational role                  | A persisted MEMBER with operational text `Organizer` still received assignment 403.                                                                                                                  |
| Missing auth                      | Task read without a session and reads after logout returned 401.                                                                                                                                     |
| Session isolation / cleanup       | Organizer logout left Member authenticated; both verifier-created sessions were revoked and session counts returned to baseline.                                                                     |
| Foreign fixtures                  | Unique synthetic identity/Events/members/tasks existed only in a fixture transaction; rollback and absence queries passed. Controlled auth users were not deleted.                                   |
| Log safety                        | Captured logs contained none of the loaded database/auth secrets, account passwords/emails, cookie strings or encoded/decoded cookie values.                                                         |

The real workflow intentionally persists changes/history on the separate
development task; it does not reset or delete history. Both the initial run and
post-review rerun of `pnpm.cmd server:verify-responsibility` passed. This is actual
backend HTTP verification with the real auth library/database, not browser UI E2E.

Final read-only database inventory: **2 Users, 2 credential Accounts, 0 Sessions,
1 development Event, 2 EventMembers, 1 Task, 22 ActivityEntries**. All six action
types are present. No P1B/P1C disposable identity remains. These counts reflect
the two intentional verifier runs, not imported demo data or user activity.

### Automated checks

| Check                                                | Result                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Frontend `pnpm.cmd test`                             | 94/94 passed; locked UI source unchanged.                                        |
| Backend `pnpm.cmd server:test`                       | 74 passed, zero failed, two intentional opt-in DB suites skipped.                |
| PostgreSQL explicit opt-in `server:test:integration` | 27/27 passed, zero failed/skipped: P1B 17 plus P1C 10 including parent/subtests. |
| `pnpm.cmd format` / `format:check`                   | Passed.                                                                          |
| `pnpm.cmd lint`                                      | Passed.                                                                          |
| Frontend and backend typechecks/builds               | Passed.                                                                          |
| `git diff --check`                                   | Passed.                                                                          |

Seventeen new offline tests cover strict input/version validation, assignment,
reassignment, unassignment, acceptance/withdrawal and impersonation, independent
status, permissions/operationalRole, version increments, stale no-op rejection,
idempotent current-state results, missing/foreign/inactive lookup results,
history construction, mutation/activity failure rollback and failed-rollback
client destruction, DTO/query scope, HTTP origin/forged fields/conflict/log safety,
and development bootstrap configuration without passwords. Injected pg/session
cases are test doubles and are not represented as real SQL evidence.

The P1C real SQL suite verifies command/state/history behavior, stale writes,
withdrawal/reacceptance, reassignment/unassignment/assign-back, permissions,
foreign/inactive users/members, actual constraint-failure rollback of task/history,
soft-deleted reads/mutations, archive write denial and repeatable bootstrap.
Outer fixture transactions and command savepoints are explicitly test-only;
all disposable rows are rolled back and absence verified. Concurrent real pg
transactions are covered separately by the two-session HTTP verifier.

### Fresh review, confirmed correction and boundaries

A fresh read-only review checked route/service separation, persisted roles,
Event-scoped SQL and FKs, locked User/membership/assignment state, acceptance
impersonation/clearing, version checks before no-op handling, atomic history,
rollback/disconnection cleanup, safe HTTP failures/logs, strict fields/origin,
bootstrap reruns, test evidence and scope exclusions. No subagents were used.
This is a focused code/security review, not formal certification or human acceptance.

A non-ISO PostgreSQL `DateStyle` probe exposed pg TIMESTAMPTZ parsing returning
null during DTO serialization. That intermediate run failed and is not passing
evidence. Commands now set ISO DateStyle locally and format DATE explicitly as
YYYY-MM-DD. The real suite retains SQL/DMY + Pacific/Honolulu session setup as
a regression probe; all 27 tests and the real HTTP verifier passed after correction.
Applied migration checksums are unchanged from P1B: 0001 `3eea6d946b15cfc651e83f32d454c3f5b4bae28062421f9fa2ba2eeea14c3d91`,
0002 `f6bba034c1f709cb4f6768c5350823aae7c01f384ab5ce9dd652a23deb5b9785`.

Dashboard/Tasks/Team, all frontend source/demo behavior and styles remain locked.
No frontend auth, RemoteWorkspaceService, Event/task authoring UI, invitation,
Plan B/Templates/Budget/AI/notifications/chat/realtime or generic policy/audit
framework was implemented. Production hosting, separate least-privilege DB
grants, restore verification and browser integration remain unfinished.

Final staged audit passed for 18 intended runtime/script/test/documentation files.
No environment, credentials, cookie jars, shortcut, locked frontend or applied
migration files were staged. Exact loaded database/auth/account credential values
were absent from the staged diff; password/session/cookie word matches were
configuration, verification code or synthetic tests, not usable credentials.
Staged diff whitespace validation passed and freshly fetched main remained
synchronized before the implementation commit.

## P1D.1 authentication UI — 2026-10-03

Baseline: `a189a33119766c285cb21e284e191eb8d22bb91f`, main == origin/main,
tracked worktree clean. Only the known unrelated shortcut was untracked and
was not changed/staged. Before implementation, frontend 94/94 and backend
74 passing offline tests passed. The default backend command skipped its two
opt-in PostgreSQL suites; explicit `RUN_DATABASE_INTEGRATION=1` subsequently
passed all 27 real database tests. The real P1C two-user HTTP verifier passed
assignment, acceptance, withdrawal, clearing, conflicts, authorization, history,
rollback fixtures and isolated logout. Its intentional development history is
preserved; no migrations/reset/destructive operation occurred.

### Browser and UI evidence

Real browser script: `scripts/verify-auth-ui.mjs`, run through the existing
Playwright runtime with desktop Microsoft Edge **154.0.4258.53** against Vite
`http://127.0.0.1:5173` and real Fastify/PostgreSQL on port 3001. Controlled
account values came from ignored local configuration, never this document.
Reports/screenshots are local ignored evidence under `tmp/p1d-evidence/`.
No HAR, trace, cookies, storageState or session dump is saved.

| Scenario                              | Observed result                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated load/direct Tasks URL | Session loading hides App, then Login with canonical intended task destination.                                                                                                                                       |
| Login semantics                       | Explicit labels, email/password types, username/current-password autofill, keyboard submit, no signup/recovery/social controls.                                                                                       |
| Invalid credentials                   | Generic email-or-password message; password cleared; accessible alert focused.                                                                                                                                        |
| Duplicate submit                      | Delayed real command plus two form submissions issued one POST; disabled/aria-busy submitting state.                                                                                                                  |
| Organizer                             | Real UI login, intended task route, safe `/api/me` identity matching configured Organizer and same identity after refresh.                                                                                            |
| Authenticated Login                   | Replaced with workspace, no loop.                                                                                                                                                                                     |
| Organizer logout                      | Real server sign-out; `/api/me` 401; direct Team and history navigation remain logged out with no protected content.                                                                                                  |
| Member                                | Independent real login/identity, distinct from Organizer, refresh persistence and real logout/401.                                                                                                                    |
| Invalidated open session              | Actual server sign-out outside React followed by focus recheck removes identity/shell and shows session-ended Login. This verifies invalid-session handling, not waiting through the natural multi-day expiry period. |
| Server/malformed response             | Explicitly injected 500 and malformed identity show safe text and fail closed; raw details never displayed.                                                                                                           |
| Backend unavailable                   | Backend actually stopped, Vite still running: direct protected bootstrap and Login submission show understandable safe errors. Backend restarted afterward.                                                           |
| Redirect safety                       | External returnTo rejected; allowlist and canonical task-query unit cases pass.                                                                                                                                       |
| Cookie/storage safety                 | Real session cookie HttpOnly/SameSite=Lax; no session token in document.cookie, localStorage or sessionStorage. React state contains only safe identity by code review.                                               |
| Public signup                         | Real POST through proxy remains 404.                                                                                                                                                                                  |
| Mobile account access                 | Real Member session, wordmark menu via keyboard at 768/390/320; logout passes with no shell overflow.                                                                                                                 |

Login matrix: **20/20** cases — widths 1440, 1024, 768, 390 and 320 × BG/EN ×
light/dark, at 900px viewport height. No horizontal overflow; authentication
controls at least 44px, inputs/submit 48px; visible focus and Email → Password →
Sign in Tab order pass. Desktop and narrow BG/dark screenshots were visually
inspected. No auth animation was introduced. No application page errors or
unexpected console errors occurred; expected failing HTTP requests are not
classified as application-console failures. Screen-reader/real-device/other
browser/password-manager product certification is not claimed.

### Locked frontend regression

Captured current baseline and authenticated after screenshots for Dashboard,
Tasks and Team: **60 comparisons**, same five widths × BG/EN × light/dark.
36 main-capture images are pixel-identical. The 24 narrow captures differ by
121–152 pixels solely at rows 25–35 of the overlapping sticky mobile header;
the wordmark is now the minimal account menu trigger. The workspace region
below that header is pixel-identical in every comparison, with matching image
dimensions and zero overflow. This is the necessary minimal shell account
surface; no locked page composition, data or behavior was redesigned.

Existing ignored browser harnesses were rerun with only the origin updated and
real session cookies supplied in memory (then server logout), retaining their
original assertions. Tasks 2B.2.3C: **47 layouts, 11 stress, 6 surfaces, 4
interactions, 6 regressions**, no console/application errors. Dashboard 2B.2.3D:
**6 matrix, 5 extra** cases including disclosures, Back/Forward/Close/Escape,
focus/scroll return, blocked storage and reduced motion, no errors. Team source,
styles, selectors/history and its 16 existing domain/navigation tests are
unchanged and pass; the 20 Team screenshots are included above.

### Automated checks and review

| Command                                                  | Result                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm.cmd test`                                          | 106/106 pass: original 94 plus 12 auth state/routing cases.                   |
| `pnpm.cmd server:test`                                   | 75 pass, zero failures; two opt-in DB suites skipped in this default command. |
| `RUN_DATABASE_INTEGRATION=1` + `server:test:integration` | 27/27 pass, zero skipped.                                                     |
| `server:verify-auth` / `server:verify-responsibility`    | Real backend checks pass.                                                     |
| `test:browser:auth`                                      | Real browser checks and 20 responsive cases pass.                             |
| Stopped-backend mode                                     | Pass against the actually stopped backend.                                    |
| `format` / `format:check` / `lint`                       | Pass.                                                                         |
| Frontend/backend `typecheck` and `build`                 | Pass.                                                                         |
| `git diff --check`                                       | Pass.                                                                         |

An intermediate Login target-size check failed because the later shared button
rule overrode the initial height. The scoped Login rule was corrected to 48px
and the full browser matrix rerun passed. The initial delayed-request harness
held the request beyond the client's timeout; its synchronization was fixed.
The first origin-boundary test used schema validation against a deliberately
unavailable test database and omitted a cookie; the test now explicitly isolates
the origin boundary with an invalid synthetic cookie, while real browser runs
keep full production-library/schema behavior. None of these failed runs is
presented as final passing evidence.

One intermediate backend auth verifier ran alongside the browser suite; their
shared account sessions interfered with the verifier's database session-count
assertion. Its final run was isolated after browser completion and passed.

Fresh read-only review covered the official client API, safe-user-only state,
cookie/token/password handling, non-disclosing errors, closed signup, exact
origins, allowlisted redirects/no loops, stale-session races, keyboard/mobile
layout and scope. `/api/me` lacked an explicit cache policy; `Cache-Control:
no-store` was added for both authenticated and 401 responses and verified by the
focused test. No subagents/human acceptance/security certification is claimed.

Documentation updated: README, backend development, known limitations, user
guide, deployment/offline demo plan, AI assistance log, this evidence and dependency-use notice. No dependency
or lockfile change; no remote workspace, Event/task authoring, assignment UI,
onboarding, Plan B/Templates/Budget/AI implementation. LocalDemoWorkspaceService
remains intentional; P1D.2 has not begun. Production HTTPS/proxy/hosting,
least-privilege DB grants, restore drills and actual-year NOIT rule verification
remain limitations. Idle foreground expiry recognition waits for the next
focus/visibility/online/navigation recheck; there is no aggressive polling.

Final staged security audit passed for **27 intended files**, including the
deployment/offline demo note. Environment/credential/session files and the
unrelated shortcut are absent. Exact loaded database/auth secrets and controlled
account email/password values are absent from the staged diff and built bundle.
Auth source has no browser-storage writes or console logging. Keyword matches
for password/session variables are only implementation/test/documentation text,
not real credentials. Locked page/service/history sources, lockfile and applied
migration checksums are unchanged. Staged whitespace checks passed.

## P1D.2A remote Tasks reads — 2026-10-03

Implemented the explicitly requested read-only Tasks slice from
`dca54ab5050ba956c4920ff78216b6e44c797145` on `main`. Fresh origin fetch matched
the expected baseline, ahead/behind 0/0, with no tracked changes. The known
untracked `docs/market-research/docs - Shortcut.lnk` remains excluded/untouched.
The complete master prompt, supplied 30-page 2025–2026 regulations, approved
backend contract, current Tasks/service/auth/semantic contracts and locked
responsive tests were read before implementation. The request authorizes this
stage; no new concept, MVP, schema, core workflow or visual redesign was added.

The supplied rules confirm the 2025–2026 source/docs/user-guide/security/license/
role-account obligations. Categories, dates, online availability, PDF format,
GPLv3/eligibility and rubric remain year-specific and require official actual-year
verification. The 15 September 2026 date is an internal project target.

### Architecture and authorization evidence

`RemoteWorkspaceService` owns authenticated, no-store GETs and DTO projection.
`TaskReadController` owns coalescing, cancellation/revision checks and deliberate
loading/ready/error state. `useRemoteTasks` enables that path only on Tasks and
clears on leaving, logout or account change. React consumes application-facing
models. The existing LocalDemoWorkspaceService boundary (`useWorkspace`, reducer,
localStorage seed/persistence) remains unchanged for Dashboard and Team.

New `GET /api/events` lists only the current session User's active,
non-deactivated Event memberships and rechecks active User. It projects minimal
Event calendar/timezone/current membership data, with no-store. Zero is valid
empty, one auto-selects; multiple sort by earliest `startDate`, then UUID. This is
a documented temporary policy without an Event switcher or persisted privileged
ID. Archived Events stay readable under existing policy. Every subsequent task
request still rechecks active membership and Event scope.

Existing task-list reads now include scoped assignee IDs/names/operational-role
text and existing `blockedBy`/`blocks` text. Summaries use assignee IDs captured in
the authorized task result, preserving that snapshot's names if a later
assignment changes. Historical inactive assignees remain named. Operational-role
text is never authorization; access role comes from authenticated membership.
No Team API, migration, new dependency or task-command behavior was added.

Mapping preserves lifecycle/priority, DATE strings, assignment, acceptance
boolean/actor/instant, server update instant and version. Only the nullable owner
display field adapts to the old selector shape. Malformed/inconsistent responses
fail closed. Real task clocks use the selected Event's calendar/timezone, with
minute clock ticks and focus refresh; demo pages retain the fixed reference day.

### Automated checks

| Check                                        | Observed result                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Baseline `pnpm.cmd test`                     | PASS: 106/106                                                                |
| Baseline `pnpm.cmd server:test`              | PASS: 75; two opt-in database suite skips                                    |
| `pnpm.cmd format` / `format:check`           | PASS                                                                         |
| `pnpm.cmd lint` / `typecheck`                | PASS                                                                         |
| `pnpm.cmd test`                              | PASS: 128/128; all prior tests retained                                      |
| `pnpm.cmd build`                             | PASS                                                                         |
| `pnpm.cmd server:test`                       | PASS: 78; three explicitly opt-in database suite skips                       |
| `pnpm.cmd server:typecheck` / `server:build` | PASS                                                                         |
| Opt-in `pnpm.cmd server:test:integration`    | PASS: 33/33, zero skips, real approved PostgreSQL                            |
| `pnpm.cmd test:browser:tasks`                | PASS: real Organizer/Member sessions plus explicitly intercepted state tests |
| `git diff --check`                           | PASS                                                                         |

Frontend coverage includes DTO mapping, zero/one/multiple Event selection,
Organizer/Member reads, cookie options, loading/coalescing, empty account/Event,
500/network/malformed responses, retry, 401 vs 403/404, real Event-calendar date
handling in positive/negative host offsets, no hardcoded development UUID,
no storage/token/demo fallback, StrictMode cancellation and late-response
rejection. Auth tests prove a task 401 clears identity and invalidates an older
pending `/api/me` result. Backend tests prove parameterization, safe/no-store
Event HTTP responses and captured-assignee scope.

The new PostgreSQL read suite uses disposable fixtures inside a rollback-only
transaction. It proves persisted Organizer/Member roles/shared Event, foreign and
inactive denial, identical scoped tasks/assignee names, DATE and relationships
under Honolulu timezone plus SQL/DMY DateStyle, historical assignee display,
soft-deleted task/summary absence, and final fixture absence. Existing P1B/P1C
constraint/transaction/concurrency tests still pass. No development workflow
state was changed by browser verification or direct SQL evidence queries.

### Real browser evidence and data distinction

Executed with installed Edge/Chromium **154.0.4258.53**, Playwright from the
existing verification runtime, real Better Auth and the approved PostgreSQL
backend. Credentials were read only from ignored configuration. Sessions were
independent, memory-only browser contexts; no cookie/session dumps, HAR, trace or
storageState were saved. Reports/screenshots are ignored under
`tmp/p1d2-evidence/`.

Organizer signed in, discovered the real development Event, displayed its
`Verify the two-user responsibility loop` task and retained it after refresh.
The verifier directly queried PostgreSQL read-only and matched live row title,
category, context, DATE, status, priority, assignment and version to HTTP DTOs,
then matched rendered task titles. Browser-local demo tasks were deliberately
renamed `P1D2_LOCAL_ONLY_SENTINEL`; that sentinel never appeared in remote Tasks.
This is controlled fixture/data-source evidence, not a claim of user validation.

Member independently signed in and received the same Event and identical task
DTOs; authenticated membership supplied MEMBER rather than an email/name guess.
Refresh passed. Real deep links opened the expected read-only drawer; acceptance
and status controls were disabled. No task mutation request was issued, and the
before/after remote task state was identical. Fictional Dashboard/Team task links
show the safe invalid-task notice rather than opening any local demo drawer.

An explicitly held real request showed loading with the existing header,
register headings and toolbar, unknown counts and zero stale rows. Under
StrictMode only one Event and one task request reached the transport. Empty
Event and empty account, sanitized 500 plus explicit retry and 403 authorization
denial were deliberately intercepted responses, clearly separate from live-data
proof. 403 retained a valid `/api/me` identity. No fallback occurred.

For expiry the verifier held a real task request, revoked only the Organizer's
actual server session, then let the backend return real 401. Login displayed the
session-ended state; shell/task data disappeared. Member's independent session
remained valid. HttpOnly/SameSite=Lax cookie checks and browser storage checks
passed; Member logout removed real task content. Zero application errors.

### Visual regression and fresh review

Before and after captures covered 1440/1024/768/390/320 px × BG/EN × light/dark,
60 page cases per run. All 40 Dashboard/Team `.app-main` crops matched pixels
exactly. Tasks' real-data captures were reviewed at desktop and narrow widths:
same typography, summary, toolbar, register/four cells, compact reflow, and drawer
composition; real task text, counts and dates differ as expected. No shared CSS,
Dashboard, Team, local service/reducer/data or history contract changed.

A separate **explicitly mocked** equivalent-content/time Tasks run remapped the
old local fixture to valid remote IDs/DTOs solely for visual comparison. All 20
image sizes matched; differences were confined to the top 60 px shell overlay
containing the replaced data-mode notice. Below that overlay all 20 Tasks crops
matched pixels exactly. These fixture screenshots prove composition, not real
PostgreSQL reads. The real 20-case Tasks matrix and five-width browser layout
checks had zero horizontal overflow. Drawer changes are limited to read-only
label/disabled controls; no extra section, card or typography hierarchy was added.

Intermediate browser attempts failed and are not counted as PASS evidence.
The real browser exposed an incorrectly bound native fetch receiver; the adapter
now calls the detached transport, with a regression test and passing reruns.
The first equivalent-content visual fixture used randomized task ordering; its
final comparator preserves original ID tie ordering so content is equivalent.

A fresh read-only self-review covered the adapter, Event resolution, real/demo
separation, date/clock semantics, auth/cancellation, UI lock and scope. It found
the assignment-summary consistency issue and fixed only that confirmed issue;
the focused test, PostgreSQL suite and real browser rerun passed. Filter
validation waits for ready data so loading does not clear valid category filters;
removed owner filters reset safely. Security review confirms parameterized Event
and task scope, server-derived membership, cookie auth, no browser tokens, no
hardcoded development IDs, no fallback/raw errors and clearing stale data.
This is agent review, not human acceptance or security certification.

Documentation updated: README, backend development, known limitations, user
guide, this evidence and AI assistance log. Final commit and remote-sync results
are reported after Git completion. Remaining limits:
read-only task commands, demo Dashboard/Team and their fictional deep links,
temporary multi-Event selection, full-list reads, no realtime/offline Task cache,
production hosting/grants/recovery/restore work and actual-year NOIT verification.
P1D.2B was not begun.

### Final staged scope audit

The staged audit passed for **33 intended files**. No environment/credential
file, cookie jar, session dump, generated evidence or unrelated shortcut is
staged. Exact loaded database/auth secrets and controlled account email/password
values are absent from the full staged content/diff and built frontend bundle.
The remote boundary contains no browser auth storage, logging, demo fallback or
hardcoded development UUID. Locked CSS, Dashboard/Team source, local service/data,
semantic/history contracts, dependency lockfile and schema/migrations are
unchanged. Staged whitespace checks pass. Final checks separately captured each
command's zero exit code, rather than relying on a chained shell's last result.

Audited changed paths:

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-reads-ui.mjs
server/src/app.ts
server/src/events/service.ts
server/src/main.ts
server/src/routes/events.ts
server/src/routes/tasks.ts
server/src/tasks/model.ts
server/src/tasks/service.ts
server/tests/events.test.ts
server/tests/task-reads.integration.test.ts
server/tests/tasks.test.ts
src/App.tsx
src/auth/state.test.ts
src/auth/state.ts
src/components/AppShell.tsx
src/components/BudoSelect.tsx
src/components/TaskDrawer.tsx
src/hooks/useRemoteTasks.ts
src/i18n/messages.ts
src/i18n/taskReadMessages.ts
src/i18n/useI18n.ts
src/pages/TasksPage.tsx
src/pages/tasks/helpers.ts
src/services/RemoteWorkspaceService.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
```

## P1D.2B — Real task responsibility UI — 2026-10-03

Authorized baseline: `407c3627c1d7e620e70d92d9ab49931b574d4044`, `main`, freshly
fetched origin sync `0/0`, tracked worktree clean. The unrelated shortcut was excluded.
Mandatory master prompt, all 30 pages of the supplied NOIT regulations, approved
backend contract, task semantics, drawer/register and locked design guidance were
read before implementation. Supplied rules are **2025–2026**; actual-year dates,
eligibility, categories, licensing, online availability and document format still
need official verification.

### Automated verification

| Check                                                     | Observed result                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Baseline frontend / offline backend                       | PASS: 128 frontend; 78 backend, 3 opt-in skips                     |
| Baseline real PostgreSQL / Tasks browser                  | PASS: 33 database checks; existing browser read/auth behavior      |
| `pnpm.cmd format` / `format:check` / `lint` / `typecheck` | PASS                                                               |
| `pnpm.cmd test` / `build`                                 | PASS: 155 tests, including 27 new action tests; build passes       |
| Backend `typecheck` / `test` / `build`                    | PASS: 80 offline tests, 3 explicitly opt-in skips                  |
| Opt-in `pnpm.cmd server:test:integration`                 | PASS: 34/34, zero skips, real approved PostgreSQL                  |
| `pnpm.cmd test:browser:task-actions`                      | PASS: 14 workflow checks, 40 drawer cases, zero application errors |
| Final `pnpm.cmd test:browser:tasks`                       | PASS: prior read/auth/error/empty behavior, zero task writes       |

Service/controller tests cover exact bodies, expectedVersion, all commands,
canonical projection, safe 400/401/403/404/409/500 mapping, abort/late responses,
role/member/archive affordances, minimum candidate fields, same-Event refresh,
duplicate coalescing, no pre-confirmation writes, conflict/refetch, blocked writes
after failed refresh, retained confirmed response and revoked membership clearing.
The PostgreSQL extension proves active same-Event candidates, inactive membership
and User exclusion, safe fields and historical assignee display. All prior
P1B/P1C/read/auth checks remain. Applied migrations are unchanged.

### Real two-session UI and activity evidence

Independent memory-only Edge/Chromium **154.0.4258.53** contexts use real Better Auth,
backend HTTP and PostgreSQL. Credentials come only from ignored configuration.
No cookie jar, session dump, HAR, trace, storageState or credential screenshot is
saved. Ignored report/screenshots: `tmp/p1d2b-evidence/browser/`.

- Organizer assigns using real active member IDs and human-readable names; refreshed
  Member sees assignment and Accept. Organizer has no acceptance/withdrawal control;
  other/unassigned Members have no acceptance/status control; Member cannot assign.
- Real Member acceptance/withdrawal is server-confirmed. SQL verifies member/time,
  cleared acceptance and preserved assignment; Organizer refresh shows acceptance.
- Member sends all four statuses independently of acceptance. Organizer refresh
  sees canonical status. Backend still authorizes every command.
- Organizer changes status while Member holds an older version. Member's actual
  stale command returns **409**; the drawer shows refreshed Blocked state and a short
  conflict message. No overwrite or automatic replay occurs.
- Reassignment/unassignment clear acceptance in both UIs. Assigning back retains
  empty acceptance and Member must explicitly accept again.
- A held response from a real acceptance command preserves Not accepted before
  delivery, disables related controls and produces exactly one request.
- A second real 409 plus an explicitly intercepted failed GET marks the display
  stale and disables actions; explicit Refresh recovers. The failed GET is a double.
- Actual revoked Member session produces mutation **401**, clears its app and returns
  to Login, while the independent Organizer session remains valid.

Explicit 400/403/404/500/network transport doubles separately prove accessible,
sanitized feedback, retained safe content, refetch and no command retry. These
do not claim real permission/resource/outage conditions; actual authorization and
transaction failures remain covered by P1C unit/PostgreSQL checks.

Read-only SQL found **21 ActivityEntry records for 21 confirmed UI changes** in the
passing run. All six types (`task.assigned`, `task.reassigned`, `task.unassigned`,
`task.accepted`, `task.acceptance_withdrawn`, `task.status_changed`) matched response
versions and authenticated scoped actors. Reassignment records `acceptanceCleared`.
No activity UI was added. The single controlled task ends assigned to Member,
unaccepted, `not-started`, version **157** in the final passing run. Intermediate-run history is preserved;
no controlled account/task/membership/history was deleted or reset via SQL.

### Accessibility, review and limits

Both roles × BG/EN × light/dark × 1440, 1024, 768, 390 and 320 CSS px: **40/40**,
no horizontal overflow, action targets at least 44px. Keyboard status mutation uses
Enter/End/Enter; native assignment has a real label and keyboard focus. Existing
drawer focus/Escape/return behavior remains. Pending/error/conflict feedback uses
status/alert semantics. Representative desktop/narrow BG-dark screenshots were
visually inspected. This is Chromium evidence, not formal screen-reader/real-device
coverage, accessibility certification or user validation.

A fresh read-only self-review covered mutation correctness, authorization boundary,
version handling, stale state/refetch, identity/role resolution, cancellation,
duplicate submissions, accessibility, locked design and scope. It found missing
archive affordance data; safe backend `archived` state and guards corrected it.
It also found a failed-refresh recovery action could disappear after closing or
switching drawers; shared recovery feedback and a list-level refresh action fix it.
Affected tests and real-browser verification were rerun. No external reviewer,
subagent or human acceptance is claimed.

Task Origin checks now share auth's explicit helper: configured origin plus exactly
the Vite origin in development, with no production expansion. Tests reject missing,
spoofed/foreign Origin and cross-site Fetch Metadata. Backend validation/scoped
membership/task/assignment/version checks remain authoritative. No client actor,
timestamp, role, email/name or localStorage data grants permission. Browser storage
was checked for credentials/tokens. No dependencies, schema, authoring, activity UI,
Team/Dashboard integration, realtime or server polling were added.

Intermediate failures are not PASS evidence: an initial browser run did not complete;
Edge could not expose a 409 body to Playwright although UI recovery worked, so the
verifier now checks status/DOM/canonical reads. Another verifier step used a stale
Organizer version after Member acceptance; its legitimate 409 required adding an
explicit refresh before unassignment. Request-count and format assertions were
updated for the member endpoint and formatting. Only the completed passing run
is counted. Additional recovery-verifier runs stopped on a missing second real task
and an overly broad selector; neither is counted as a pass. A clearly marked
read-only transport row now tests drawer switching without creating a database
task, and the selector targets the status button. Final completion evidence follows.

### Completion evidence

- Final responsibility rerun: **14 checks / 40 drawer cases**, zero application
  errors. Failed-refresh recovery passes after closing/switching drawers; the second
  row is an explicit read-only transport fixture. Real commands/history remain on
  the existing controlled task. SQL confirms **21 changes / 21 ActivityEntry records**,
  all six types, and the final Member-assigned/unaccepted/`not-started` state at
  version **157**. Actual mutation 401 and isolated session clearing pass afterward.
- Final auth regression: **15 checks / 20 Login layout cases**, plus the actual mobile
  account menu; zero application errors. Real login/session/logout/revocation remain
  covered; injected failure/malformed identity cases remain labelled doubles.
- Final read regression: **13 checks / 5 viewport cases**, zero application errors,
  **zero task commands**. Prior empty/loading/error, deep-link, poisoned demo and
  real expired-session behavior remains covered.
- Locked visuals: **20/20 Dashboard and 20/20 Team** `.app-main` comparisons are
  pixel-identical to preimplementation snapshots. **20/20 Tasks** equivalent-content
  register comparisons are also pixel-identical using explicitly intercepted,
  fixed-clock visual fixtures. Widths are 1440/1024/768/390/320, BG/EN, light/dark.
  All 60 after snapshots have zero horizontal overflow. The 40 real role/drawer
  captures cover only the expected contextual controls and acceptance state.
- The recovery fix reran frontend typecheck/lint, **155/155 tests**, build and format
  checks. Backend source was unchanged after its **80-test / 34-database-test** pass.
- Staged safety review found exactly **29 intended files**, no excluded environment,
  shortcut, temporary output, cookies, session dumps, HAR, traces or auth artifacts.
  Actual configured credentials/secrets were checked privately against the staged
  diff, complete staged file contents and frontend bundle: none found. The remote
  boundary contains no browser storage, demo fallback, console output or hardcoded
  development UUID. Locked Dashboard/Team/demo/navigation files, dependencies and
  migrations are unchanged; existing CSS rules are unchanged. Staged whitespace is clean.

### Changed files (29)

```text
README.md
docs/AI_ASSISTANCE_LOG.md
docs/BACKEND_DEVELOPMENT.md
docs/KNOWN_LIMITATIONS.md
docs/TEST_EVIDENCE.md
docs/USER_GUIDE.md
package.json
scripts/verify-task-actions-ui.mjs
scripts/verify-task-reads-ui.mjs
server/src/auth/auth.ts
server/src/events/service.ts
server/src/main.ts
server/src/routes/auth.ts
server/src/routes/tasks.ts
server/src/tasks/service.ts
server/tests/events.test.ts
server/tests/task-reads.integration.test.ts
server/tests/tasks.test.ts
src/App.tsx
src/components/TaskDrawer.tsx
src/hooks/useRemoteTasks.ts
src/i18n/taskReadMessages.ts
src/pages/TasksPage.tsx
src/services/RemoteWorkspaceService.ts
src/services/taskActions.test.ts
src/services/taskAffordances.ts
src/services/taskReadState.ts
src/services/taskReads.test.ts
src/styles.css
```

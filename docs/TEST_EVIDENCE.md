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

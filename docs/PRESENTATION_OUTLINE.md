# BudoGraph Phase 2B.2 Presentation Outline

Phase 2A built on, and did not rewrite, the Phase 1 competition MVP. Phase 2B.1
refined the same prototype's visual identity and Dashboard hierarchy. Phase
2B.2 applies that approved visual system to the existing Tasks workspace as a
focused operational-register redesign without changing the product model. This
outline is year-neutral. Presentation length,
required sections, submission format, online availability, and demonstration
rules must be aligned with the official regulation for the actual competition
year.

## 1. Problem, evidence, and boundary

- Organizers can hold the complete event context while work is distributed
  across helpers, calls, messages, documents, and memory.
- BudoGraph provides one current operational view and explicitly preserves
  direct human communication.
- Phase 1 established the fictional, local vertical slice. Phase 2A added the
  localization, theme, responsive, and task-navigation foundation while
  preserving the workspace data model. Phase 2B.1 clarified visual roles,
  surface purpose, Dashboard order, and task-facing terminology. Phase 2B.2
  makes the existing task register easier to scan, filter, and open while
  retaining canonical task links and browser-local state.
- This remains a competition prototype, not proof of product-market fit,
  commercial demand, adoption, production security, usability, or operational
  readiness.

## 2. Phase 2B.1 visual identity foundation

- Explain the semantic roles shared by both themes: navy for structure;
  burgundy for human decisions, selected action, and primary action; gold for
  time and event stages; red only for genuine blockers or serious risk; green
  for confirmed completion; and blue for active process or neutral information.
- Show the three surface concepts: operational surfaces are dense and
  actionable, context surfaces are quiet and explanatory, and critical surfaces
  are rare and reserved for serious risk.
- Point out that these roles use labels, icons, and structure as well as color,
  and that different information types no longer repeat one generic card
  treatment.
- Explain that BudoGraph keeps its text-only wordmark without a generated
  permanent logo or decorative martial-arts imagery.
- Use long fictional content and narrow viewports to explain how primary task
  content is prioritized over metadata.

## 3. Phase 2B.2 Tasks operational register

- Show the compact task summary and the search, status, owner, and category
  filters. Explain that overdue is an overlapping timing flag, not a task
  status, and that Accepted/Not accepted is a separate responsibility signal.
- On desktop, point out the flat operational rows: task identity,
  responsibility, deadline, and current status remain aligned for comparison.
- Select a task from anywhere on its row. The canonical title link stretches
  across the row without turning nested controls into fake links; the URL is
  still `/tasks?task=<task-id>`.
- In the drawer, distinguish read-only identity, relationships, and metadata
  from the two editable fields: task status and Accepted/Not accepted.
- At a narrow viewport, show the purpose-built task summary. It retains status,
  timing, title, owner, and acceptance without shrinking the desktop table.

## 4. Demonstration story

Before this sequence, explicitly reset from Templates if an older saved
workspace is present. Say: “We are viewing fictional preparation as it stood on
7 September 2026, for the seminar on 18–20 September.” Point to the demo-snapshot
notice. The reference stays fixed on another presentation day; reported times
use Varna time. These are synthetic data, not a recording of a real event.

1. Open the Dashboard and follow its order: `EventOverview`,
   `OperationalFocus`, `PreparationTimeline`, `ChangeImpact`, and
   `TeamPressure`.
2. In EventOverview, explain that progress means completed tasks divided by
   total event tasks. It is not a safety or go/no-go assessment. Overdue is an
   overlapping risk flag, not another status added to the total.
3. In OperationalFocus, contrast the overdue accessibility check with today's
   blocked, unaccepted arrival confirmation and Critical Near work. Critical
   Later work does not qualify on priority alone. In PreparationTimeline, show
   Today, Near and Later preparation, then select the arrival confirmation. Show that
   `/tasks?task=<task-id>` opens that exact detail, then demonstrate browser
   Back, Forward, and refresh.
4. Enter an unknown task ID and show the localized warning and safe return to the
   Tasks list; do not imply that a different task was found.
5. Switch between Bulgarian and English, refresh, and show that the manual
   preference persists while fictional names and BudoGraph remain unchanged.
6. Switch among System, Light, and Dark. In System, change the device appearance
   if the presentation environment allows it and show the live response.
7. Open Tasks and search by task or owner, then combine the status, owner, and
   category filters. Clear the filters and open a task from the row into its
   grouped detail drawer. Change its status and Accepted value separately;
   explain that Accepted means the assigned person has seen and accepted the
   task, not that it is complete or approved. Refresh to show compatible
   browser-local persistence.
8. In Dashboard ChangeImpact, open **Next checkpoint**: arrival confirmation
   due Today, 7 September. Then open Changes & Plan B: the fictional airline
   notice received that morning moves the Friday 18 September arrival from
   14:00 to 18:30, affecting itinerary, pickup, hotel and the opening programme.
   Show Mira's owned response and direct-contact instruction. Acknowledging
   the change is distinct from accepting a task. Communication happens outside
   BudoGraph; there is no dependency engine or real notification.
9. Review TeamPressure and a fictional team member's assigned work, preview the
   seminar template, and restore the fictional baseline.
10. Refresh once before reset to demonstrate browser-local workspace
    persistence; explain that resetting workspace data does not reset language
    or theme.

## 5. Technical explanation

- **Deterministic demo snapshot:** `src/data/demoTime.ts` supplies an explicit
  7 September local-calendar reference, a fixed edit timestamp and Varna display
  timezone. App passes that date to every timing consumer. It does not rewrite
  saved dates or shift seed data with the real clock. Reset is explicit and
  preserves language/theme. Stable IDs, including the change ID's historical
  date-like suffix, remain opaque identifiers rather than timing inputs.
- **Real clock semantics:** pure calendar helpers still accept any `now` and
  retain independent midnight, timezone and DST tests. The existing live-clock
  hook is not used by this fixed demo. Milestone lifecycle remains persisted;
  `upcoming` is still valid in that model, independently of task timing.

- React 19, strict TypeScript, Vite, pnpm, plain CSS, and Lucide icons.
- Typed `Event`, `TeamMember`, `Task`, `EventChange`, and `EventTemplate` records
  with stable IDs; pure domain calculations and reducer transitions remain
  separate from page components.
- A central typed translation catalog provides `bg` and `en` strings; shared
  `Intl` formatters localize dates, ranges, relative dates, numbers, and
  percentages instead of scattering locale checks through components.
- `budograph.preferences.v1` safely validates and stores manual language/theme
  choices. With no saved language, a primary locale beginning with `bg` selects
  Bulgarian; otherwise English is used.
- The three-state theme preference resolves System against
  `prefers-color-scheme`, observes live System changes, and applies semantic CSS
  tokens. A small pre-render bootstrap applies the initial language and resolved
  theme where possible to reduce a mismatched-theme flash.
- The existing History API navigation parses pathname and query state. Stable
  `/tasks?task=<task-id>` links support initial load, Back/Forward, refresh, and
  explicit invalid-ID handling without adding a routing library.
- Validated `budograph.workspace.v1` loading preserves the Phase 1 localStorage
  shape and falls back to the fictional seed when saved data is unusable. The
  task boolean remains `acknowledged` for compatibility while task-facing copy
  interprets it as Accepted/Not accepted; change acknowledgement remains a
  separate interaction.
- There is no backend, authentication, account system, authorization layer,
  external API, AI service, secret, or real personal data.

## 6. Verification evidence

Show only results that were actually run and recorded. The Phase 2A evidence in
`docs/TEST_EVIDENCE.md` currently includes:

- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm test`;
- `pnpm build`;
- desktop and mobile browser checks at 320, 390, 768, 1080, and 1440 pixels;
- device-language, saved-language, System/Light/Dark, saved-theme, and live
  System-theme checks;
- exact-task, invalid-task, Back/Forward, refresh, and persistence checks;
- long Bulgarian/content stress checks and the scoped privacy scan.

Do not present those historical Phase 2A or Phase 2B.1 results as Phase 2B.2
verification. The final Phase 2B.2 command, seven-width Tasks matrix,
search/filter, row/drawer, theme, focus, deep-link, persistence, and console
evidence may be presented only after it has actually run and been added to
`docs/TEST_EVIDENCE.md`.

Before the actual presentation, separately complete and record the remaining
screen-reader/assistive-technology pass, a clean-console inspection after the
final commit, a live operating-system theme switch where possible, and the
offline/backup rehearsal on the intended machine. Do not convert this outline
or an unperformed checklist into a passing claim.

## 7. Licensing, fictional data, and offline boundary

- The demonstration event, people, venues, tasks, and changes are clearly
  fictional; no private interview or real participant information belongs in
  the application.
- BudoGraph source is licensed under GNU GPL version 3 only
  (`GPL-3.0-only`). Preserve the license, corresponding source, and notices when
  distribution triggers those obligations; third-party dependencies retain
  their recorded licenses.
- Browser `localStorage` is local to one profile and origin. It is not encrypted,
  synchronized, backed up, or appropriate for sensitive information.
- The offline and backup plan is a plan until it has been executed and recorded
  on the actual presentation setup.

## 8. Limitations and Phase 2B.2 boundary

- Phase 2A, Phase 2B.1, and Phase 2B.2 intentionally exclude a backend,
  database, authentication, real accounts, roles, permissions, AI, budget
  management, Kanban, calendar, Gantt, synchronization, audit trail,
  production notifications, integrations, and hosting.
- Template editing, multi-event workflows, a permanent logo, and production
  deployment remain future decisions; none should be implied by the prototype.
- Phase 2B.2 is a Tasks-only visual and interaction-hierarchy refinement, not a
  new feature set, product-market validation, or proof of usability. The
  approved Phase 2B.1 Dashboard remains locked. Any later scope should be
  selected only from real evidence without changing the approved core idea
  silently.
- The available NOIT rules are for **2025–2026** and are historical. Reverify
  the official regulation for the actual competition year, including dates,
  category wording, procedures, deliverables, formats, declarations,
  online-availability periods, media restrictions, and test-account rules.

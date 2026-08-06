# BudoGraph Phase 2A Presentation Outline

Phase 2A builds on, and does not rewrite, the Phase 1 competition MVP. This
outline is year-neutral. Presentation length, required sections, submission
format, online availability, and demonstration rules must be aligned with the
official regulation for the actual competition year.

## 1. Problem, evidence, and boundary

- Organizers can hold the complete event context while work is distributed
  across helpers, calls, messages, documents, and memory.
- BudoGraph provides one current operational view and explicitly preserves
  direct human communication.
- Phase 1 established the fictional, local vertical slice. Phase 2A strengthens
  its usability, localization, visual hierarchy, responsive behavior, and task
  navigation while preserving the workspace data model.
- This remains a competition prototype, not proof of product-market fit,
  commercial demand, adoption, production security, or operational readiness.

## 2. Phase 2A design foundation

- Show the denser operational hierarchy: a small number of meaningful surfaces,
  time-oriented deadlines, actionable attention items, comparative workload,
  operational change impact, and a chronological milestone pattern.
- Explain that BudoGraph keeps its text-only wordmark and restrained navy,
  burgundy, and warm-gold identity without a generated permanent logo or
  decorative martial-arts imagery.
- Point out that information types use different patterns instead of repeating
  one generic card design.
- Use long fictional content and narrow viewports to explain how primary task
  content is prioritized over metadata.

## 3. Demonstration story

1. Open the Dashboard and identify readiness, status totals, late or blocked
   work, the next deadline, workload risk, current change impact, and milestones.
2. Explain that readiness means completed tasks divided by total event tasks.
   Overdue is an overlapping risk flag, not another status added to the total.
3. Select an attention or deadline entry. Show that
   `/tasks?task=<task-id>` opens that exact detail, then demonstrate browser
   Back, Forward, and refresh.
4. Enter an unknown task ID and show the localized warning and safe return to the
   Tasks list; do not imply that a different task was found.
5. Switch between Bulgarian and English, refresh, and show that the manual
   preference persists while fictional names and BudoGraph remain unchanged.
6. Switch among System, Light, and Dark. In System, change the device appearance
   if the presentation environment allows it and show the live response.
7. Open Changes & Plan B and connect the fictional change to affected tasks,
   areas, the current response, the next checkpoint, and the scenario-specific
   escalation instruction. Explain that communication still happens outside BudoGraph.
8. Review a fictional team member's workload, expand a longer milestone set,
   preview the seminar template, and restore the fictional baseline.
9. Refresh once before reset to demonstrate browser-local workspace persistence;
   explain that resetting workspace data does not reset language or theme.

## 4. Technical explanation

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
  shape and falls back to the fictional seed when saved data is unusable.
- There is no backend, authentication, account system, authorization layer,
  external API, AI service, secret, or real personal data.

## 5. Verification evidence

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

Before the actual presentation, separately complete and record the remaining
screen-reader/assistive-technology pass, a clean-console inspection after the
final commit, a live operating-system theme switch where possible, and the
offline/backup rehearsal on the intended machine. Do not convert this outline
or an unperformed checklist into a passing claim.

## 6. Licensing, fictional data, and offline boundary

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

## 7. Limitations and Phase 2B decisions

- Phase 2A intentionally excludes a backend, database, authentication, real
  accounts, roles, permissions, AI, budget management, Kanban, calendar, Gantt,
  synchronization, audit trail, production notifications, integrations, and
  hosting.
- Template editing, multi-event workflows, a permanent logo, and production
  deployment remain future decisions; none should be implied by the prototype.
- Phase 2B should be selected only after reviewing the real Phase 2A evidence
  and demonstration feedback without changing the approved core idea silently.
- The available NOIT rules are for **2025–2026** and are historical. Reverify
  the official regulation for the actual competition year, including dates,
  category wording, procedures, deliverables, formats, declarations,
  online-availability periods, media restrictions, and test-account rules.

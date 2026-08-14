# BudoGraph Phase 1

## Purpose

BudoGraph is a focused event-organization application for martial-arts seminars and events. Its primary job is to help the organizer maintain one current operational overview when responsibilities, changes, deadlines, and context would otherwise be spread across helpers, messages, calls, documents, and memory.

BudoGraph supports direct communication; it does not replace it. A critical operational change may show a scenario-specific escalation instruction, but the prototype does not call, message, or notify anyone.

## Decision and validation boundary

Phase 1 is authorized as a NOIT competition MVP and technical prototype. The project may proceed without additional interviews for this slice. This is not a finding that a market has been validated.

In particular, the Phase 1 decision does not establish:

- product-market fit;
- prevalence across martial-arts organizations;
- demand, adoption, retention, or willingness to pay;
- a production-ready security or privacy posture; or
- measurable product impact.

Historical validation files under `docs/validation/` and market-research files under `docs/market-research/` remain the source record. They must not be deleted or rewritten to imply stronger evidence.

## Included product slice

The approved Phase 1 product scope is:

1. **Application shell** - a text-only BudoGraph wordmark, current-event context, desktop sidebar, compact mobile navigation, and routes for Dashboard, Tasks, Team, Changes & Plan B, and Templates.
2. **Fictional demonstration event** - one realistic seminar with fictional people, preparation work, travel and accommodation details, venue work, participant communication, and a contingency. It contains no real interview or dojo details.
3. **Dashboard** - event status, calculated readiness, completed/in-progress/blocked/overdue task summaries, upcoming deadlines, risks and changes, team workload, organizer-attention items, and milestones.
4. **Tasks** - typed task records with category, owner, deadline, status, priority, context, dependency, consequence, acknowledgement, and last-updated information. The user can filter, update status, accept or unaccept a task through the current UI, see overdue state, and inspect task details. The compatible stored boolean remains `acknowledged`.
5. **Team** - organizer and helper roles, task counts, completion, overdue/blocked load, workload summaries, and a selected member's assigned tasks.
6. **Changes & Plan B** - severity, report time, affected work, owner, response, acknowledgement, escalation guidance, and response-state updates for a fictional disruption.
7. **Templates** - a reusable seminar-template preview with the common venue, instructor, travel, accommodation, schedule, team, registration, communication, equipment, and contingency preparation areas. Phase 1 may use it to restore the local demonstration state; it is not a full template editor.
8. **Local persistence** - supported task and change interactions persist across refreshes in the same browser profile through `localStorage`.

## Phase 2A - UX foundation

Phase 2A preserves the Phase 1 product slice and its `budograph.workspace.v1` data shape. It improves how the existing information is presented and reached; it does not replace the application or change the approved core idea.

### Localization architecture

- Bulgarian (`bg`) and English (`en`) use central, typed message catalogs rather than component-level language checks.
- On a first visit with no saved language, the first available device/browser locale beginning with `bg` selects Bulgarian; every other locale selects English.
- A manual language choice is stored in the separate versioned `budograph.preferences.v1` record and takes precedence on later visits.
- Dates, date ranges, relative dates, counts, percentages, and plural forms use the selected locale through `Intl` APIs.
- The BudoGraph product name and fictional personal names are not translated. The supplied fictional demonstration workspace has localized operational copy without changing its stable IDs or stored schema.

### Theme architecture

- The available preferences are `System`, `Light`, and `Dark`.
- With no explicit saved theme, the application uses `System` and resolves the current `prefers-color-scheme` value.
- While `System` remains selected, a media-query listener updates the resolved theme when the device preference changes.
- A small script in `index.html` reads the same validated preference shape before React renders and applies the initial `lang`, resolved theme, color scheme, and theme color to reduce an incorrect-theme flash.
- React keeps the document language, metadata, theme attribute, and color scheme synchronized. Semantic CSS tokens provide designed light and dark palettes rather than a blanket color inversion.

### Routing and task deep links

The application still uses a small History API router and has no routing-library dependency. Exact top-level paths remain `/`, `/tasks`, `/team`, `/changes`, and `/templates`.

A task detail link uses:

```text
/tasks?task=<encoded-task-id>
```

The query parameter is URL-decoded and resolved only against tasks in the current event. A known current-event task opens its detail. A missing, blank, duplicated, malformed, unknown, or wrong-event task value does not throw or substitute another task; the Tasks view remains available with an invalid-task state where applicable. URL parsing supports direct loading, refresh, and browser back/forward navigation. In-app task entries carry a small typed History state marker, so closing a detail returns to its originating page without adding a duplicate Tasks entry; directly loaded URLs use a safe Tasks-list fallback.

### Dashboard and responsive behavior

The Phase 2A Dashboard prioritizes what requires attention, what is late or blocked, what happens next, workload risk, readiness, and recent change impact. Readiness is explicitly the share of current-event tasks marked completed. Completed, active, blocked, overdue, and total counts are labelled so that overdue remains a risk flag rather than an extra task-status bucket. Attention and deadline entries link directly to their task details. Recent-first change summaries include response state and connect changes to affected work. Workload rows separate assigned and state-specific counts and expose blocked, overdue, or high-active-load flags using one shared threshold. Changes, team workload, and milestones use compact previews with bounded or collapsible continuations for longer datasets.

The shell keeps language and theme controls available in a sticky application header. Layout rules account for narrow phones, longer Bulgarian text, long names and task titles, wrapping badges, and large milestone/task sets. The completed in-app Chromium checks are recorded separately in `docs/TEST_EVIDENCE.md`; formal assistive-technology and cross-browser coverage remains outside Phase 2A.

## Phase 2B.1 - visual identity and information hierarchy

Phase 2B.1 is a refinement of the approved local prototype, not a new product slice. It preserves the Phase 1 domain model, routes, interactions, fictional demonstration data, and the `budograph.workspace.v1` storage shape. It adds no backend, database, authentication, authorization, real accounts, external integration, or other new feature.

### Semantic visual roles

The light and dark themes use the same semantic roles:

- **navy / structure** - navigation, stable framing, and the primary structural surface;
- **burgundy / decision** - human decisions, the selected action or state, and the primary action;
- **gold / time** - time, event stages, milestones, and organizational structure;
- **red / risk** - genuine blockers and serious operational risk only;
- **green / completion** - confirmed completion and safe positive state; and
- **blue / process** - active process and neutral information.

Color is supportive rather than the only carrier of meaning; labels, icons, layout, and accessible names continue to identify state. Red is intentionally not used as general decoration or for every decision.

### Surface concepts

Three surface concepts reduce repeated-card noise and express purpose:

1. **Operational surfaces** contain dense, actionable work with minimal framing.
2. **Context surfaces** provide event, team, or explanatory context with quieter treatment.
3. **Critical surfaces** are rare and reserved for blockers or serious risk that genuinely require escalation.

### Dashboard sequence

The Dashboard is read in this order:

1. `EventOverview` - current event identity, task progress, and the task-state formula;
2. `OperationalFocus` - decisions and work requiring organizer attention;
3. `PreparationTimeline` - time-ordered upcoming tasks and milestones;
4. `ChangeImpact` - active operational changes and the work they affect; and
5. `TeamPressure` - members with blocked, overdue, or high active load before quieter members.

This order moves from orientation to immediate action, time, changed conditions, and capacity. Event progress is still completed tasks divided by total event tasks. It is not a safety assessment, readiness certification, or go/no-go decision.

### Task acceptance compatibility

Task-facing labels now describe **Accepted** and **Not accepted**. Accepted means that the assigned person has seen and accepted the task; it does not mean that the work is complete or approved. The implementation deliberately retains the existing `Task.acknowledged` boolean, reducer action, and `budograph.workspace.v1` record so saved Phase 1/2A workspaces remain compatible. This is a UI-language clarification, not a schema migration or new workflow.

Acknowledging an operational change in Changes & Plan B remains distinct. It records that the change itself has been seen and must not be described as accepting the assigned task. Task completion is also a separate status, and any future approval concept would require its own model and evidence.

### Evidence boundary

Phase 2B.1 is a visual and information-hierarchy refinement. It is not product-market validation and does not prove usability, accessibility, organizer effectiveness, reduced risk, adoption, or other product impact. Final implementation and browser evidence belongs in `docs/TEST_EVIDENCE.md` only after the relevant checks have actually run and been recorded.

## Phase 2B.2 - Tasks workspace redesign

Phase 2B.2 applies the approved Phase 2B.1 identity to the Tasks experience only. The Dashboard sequence and every other primary page remain unchanged. No domain field, reducer action, local-storage key, route shape, dependency, or production-service boundary changes.

### Operational register and filtering

Desktop Tasks uses a flat four-column responsibility register: task, responsibility, deadline, and primary status. A title is the dominant row element; category and important/critical priority are quieter supporting context. Owner and Accepted/Not accepted share the responsibility column, but acceptance remains visually secondary to the task's progress status. Overdue is a separate timing flag and never replaces status.

The toolbar supports localized search across title, context, category, and owner plus status, owner, and category filters. Filters combine, expose a live visible/total count, and can be cleared together. The existing owner grouping remains optional. Pure selectors in `src/pages/tasks/helpers.ts` keep search, filtering, category derivation, and overdue/blocker/deadline ordering outside the visual row component.

### Canonical row interaction and drawer

The existing title anchor is stretched across non-control row space, preserving a real `/tasks?task=<encoded-task-id>` link, modifier-click semantics, keyboard focus, History API state, refresh parsing, and focus restoration. The drawer is the primary task editing surface. It separates:

1. identity and existing task context;
2. owner plus the independent Accepted/Not accepted responsibility state;
3. editable progress status, deadline, priority, and separate overdue guidance;
4. existing dependency/consequence relationships; and
5. category and last-updated metadata.

Only the existing status and acceptance mutations are editable. Owner, deadline, priority, context, relationships, and timestamps remain read-only because the local prototype has no corresponding persistence actions.

### Responsive contract and evidence boundary

At tablet and phone widths, the desktop columns become purpose-built summaries that retain title, status, owner, deadline/overdue, and acceptance. Filter controls reflow without horizontal scrolling, the drawer uses dynamic viewport height and safe-area-aware bottom padding, and the existing fixed mobile navigation remains reachable without covering the final row.

Phase 2B.2 remains a focused visual/product implementation. It does not prove usability, accessibility, organizer efficiency, error reduction, or product-market fit. Controlled browser and automated evidence is recorded separately in `docs/TEST_EVIDENCE.md`; physical-device, assistive-technology, and multi-browser validation remain required.

## Explicitly excluded

Phase 1 does not contain:

- a production server, backend, database, or cloud synchronization;
- registration, login, authentication, authorization, or real user roles;
- payments, budgets, participant management, or document storage;
- external APIs, AI, recommendation models, or secret keys;
- email, SMS, chat, calling, calendar, or push-notification integrations;
- a complex template editor;
- production analytics, audit logs, backups, monitoring, or multi-user collaboration;
- claims that the prototype is suitable for real personal data; or
- a generated, stock, or permanent visual logo.

Phase 2A also intentionally excludes budget management, Kanban, calendar, and Gantt views. Phases 2B.1 and 2B.2 add no new product area and do not change any of the production-service exclusions above.

Placeholders for excluded functions are not part of the required core screens and must not be presented as working features.

## Local-data architecture

Phase 1 is a client-side TypeScript application:

```text
Fictional typed seed data
          |
          v
Workspace/domain state and calculations
          |
          +----> React pages and reusable components
          |
          v
Browser localStorage persistence
```

Phase 2A adds independent preference and URL-state paths around that unchanged workspace flow:

```text
Device locale + prefers-color-scheme
          |
          v
Typed preference state <----> budograph.preferences.v1
          |
          v
Localized React shell and semantic theme tokens

pathname + search <----> typed History API location
                              |
                              v
                    current-event task resolution
```

The domain model uses stable IDs and includes at least:

- `Event`
- `TeamMember`
- `Task`
- `EventChange`
- `EventTemplate`

Views consume typed workspace data and actions. Readiness, task summaries, overdue state, workload, affected-task relationships, and attention items are derived locally. Persistence is a browser adapter, not a production data layer. Phase 2B.1 reorganizes existing Dashboard values, and Phase 2B.2 adds pure Tasks search/filter/order selectors without changing the storage schema. This separation is intended to let a later backend implement loading and saving without moving network logic into presentation components.

There is no server validation in Phase 1, Phase 2A, Phase 2B.1, or Phase 2B.2 because there is no server. This is a known architecture boundary, not a security claim.

## Demonstration data rules

- Use fictional event, team, instructor, and operational information only.
- Do not copy names, contact details, private links, Zoom information, quotations, or incidents from interview files.
- Do not use real email addresses, telephone numbers, participants, dojo members, or payment details.
- Label the data as demonstration data in the interface or supporting material.
- Do not repurpose the prototype to store sensitive or real operational data.

## Main local flows

1. The organizer opens the fictional current event and checks readiness and attention items.
2. The organizer searches or combines task status, owner, and category filters, opens any task row, then changes status or Accepted/Not accepted in the sectioned drawer. Acceptance still persists through the compatible `acknowledged` boolean and remains separate from progress.
3. The organizer checks workload and selects a team member to review assigned work.
4. The organizer reviews a disruption, sees affected tasks, acknowledges it, and advances the response while using direct communication outside BudoGraph when recommended.
5. The organizer previews the seminar template and may reset the local demonstration state.
6. The browser reloads the saved local state for the same browser profile.
7. On first use, the shell follows the detected language and system theme; a manual language or theme choice persists independently of the event workspace.
8. A Dashboard attention or deadline link opens the exact task at `/tasks?task=<encoded-task-id>`; Back returns to the previous page and a valid refreshed URL resolves the same task.

## Running and verification commands

Run from the repository root:

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
```

Passing results must be captured only after the commands are actually run. This scope document does not itself provide test evidence.

## Hand-drawn logo replacement

The Phase 1 identity is deliberately limited to a clean text-only wordmark in `src/components/BrandWordmark.tsx`. That component is the replacement boundary for the future hand-drawn logo.

When the author's final logo is ready:

1. Export an appropriate original web asset, preferably SVG when the artwork is genuinely vector or PNG when raster detail must be retained.
2. Add the source and web-ready asset to a clearly named repository asset location.
3. Update only the visual content inside `BrandWordmark`, retaining its `compact` behavior so desktop and mobile navigation continue to fit.
4. Preserve an accessible `BudoGraph` name through visible text, alternative text, or an equivalent accessible label.
5. Verify contrast, focus-adjacent layout, small-size legibility, and both desktop and mobile navigation.
6. Record authorship and licensing in `docs/THIRD_PARTY_NOTICES.md`; if it is entirely original, state that rather than inventing a third-party license.

Until then, do not add a generated martial-arts symbol, dragon, fist, Japanese character, stock logo, or permanent placeholder asset.

## NOIT regulation boundary

The repository contains `NOIT_REGULATIONS_2025_2026.pdf` as a historical source. That edition describes, among other items, GPLv3 licensing, source and documentation submission, a user guide, installation/use guidance, licensing of external resources, project testing and evidence, online availability, and test accounts where roles exist.

Those details are specific to the 2025-2026 competition year. Before an actual later participation, recheck the official regulation for:

- dates and submission windows;
- age groups, directions, and category wording;
- registration and round procedures;
- required declarations, files, and documentation format;
- online availability and hosting periods;
- test-account and role requirements;
- presentation, test, and defense arrangements; and
- evaluation criteria and scoring details.

An internal project schedule or this Phase 1 scope is not an official competition rule.

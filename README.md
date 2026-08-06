# BudoGraph

BudoGraph is an organizer workspace for martial-arts seminars and events. It gives the organizer one current operational overview of preparation tasks, ownership, deadlines, risks, changes, and contingency responses while continuing to treat direct human communication as essential.

## Project status and evidence boundary

This repository contains the **Phase 1 NOIT competition MVP and the Phase 2A UX foundation**. Phase 1 established the coherent, interactive vertical slice. Phase 2A strengthens localization, theming, operational dashboard hierarchy, responsive behavior, and task navigation without changing the approved product idea or adding production services.

The application remains a technical prototype. Neither phase proves product-market fit, commercial demand, adoption, or willingness to pay.

The historical research and validation record remains under `docs/validation/` and `docs/market-research/`. Those files are preserved as evidence and are not rewritten to make the Phase 1 decision appear stronger than the evidence supports. The decision to build this prototype is a competition-project decision, not a commercial-validation conclusion.

## Phase 1 scope

The approved Phase 1 slice covers:

- a responsive organizer application shell with desktop and mobile navigation;
- a dashboard for readiness, task state, deadlines, risks, workload, attention items, and milestones;
- an interactive task workspace with status and owner filtering, status updates, acknowledgement, overdue calculation, dependencies, consequences, and task details;
- a team overview with workload and assigned-task drill-down;
- a Changes & Plan B area for acknowledging and responding to operational changes, including scenario-specific escalation instructions;
- a reusable seminar-template preview and local demonstration-data reset flow;
- one fictional martial-arts seminar with fictional organizers, helpers, tasks, and contingencies; and
- browser-local persistence so permitted interactions can survive a refresh in the same browser profile.

Phase 1 explicitly excludes a production backend, database, authentication, authorization roles, external APIs, AI, email or messaging integrations, payments, participant registration, document storage, and production notifications. See [Phase 1 scope](docs/BUDOGRAPH_PHASE_1.md) and [known limitations](docs/KNOWN_LIMITATIONS.md) for the precise boundary.

## Phase 2A UX foundation

Phase 2A extends the existing application rather than rebuilding it. It adds:

- typed Bulgarian (`bg`) and English (`en`) message catalogs shared by pages, navigation, accessibility text, notices, labels, and demo-workspace localization;
- first-visit language detection from the browser: locales beginning with `bg` select Bulgarian and all other locales select English;
- a compact language control whose manual choice is saved separately from workspace data;
- `System`, `Light`, and `Dark` theme preferences, including live response to `prefers-color-scheme` while `System` is selected and an early document script that reduces incorrect-theme flash;
- a denser operational Dashboard organized around readiness, task-state totals, attention, deadlines, recent change impact, explicit workload flags, and bounded/collapsible secondary sections;
- stable task links in the form `/tasks?task=<encoded-task-id>`, including History API back/forward behavior, refresh parsing, and a graceful invalid-task state; and
- long-content and responsive layout rules intended for phones, tablets, laptops, and large displays.

Phase 2A intentionally does **not** add a backend, authentication, real accounts, roles or permissions, AI, budget management, Kanban, calendar, or Gantt views.

## Architecture

The application uses React, TypeScript, and Vite. Typed local domain data represents `Event`, `TeamMember`, `Task`, `EventChange`, and `EventTemplate` records with stable IDs. Domain calculations and workspace state are kept separate from page components where practical. Interactive demo state remains compatible with the versioned `budograph.workspace.v1` browser-storage record; the fictional seed state is used when no usable saved state exists or when the demonstration is reset.

Phase 2A adds three focused client-side layers:

- `src/i18n/` owns typed messages, localized demo copy, plural selection, and `Intl` date and number formatting;
- `src/preferences/` detects, validates, applies, and persists language and theme preferences in `budograph.preferences.v1`; and
- `src/routes.ts` parses exact top-level paths and optional task URL state without a routing dependency.

Workspace state, UI preferences, and URL state are deliberately separate. Selecting a language or theme does not rewrite the saved event workspace, and opening a task link does not change the task record.

This boundary is deliberately replaceable: a later data service can load and save the same domain records through a backend without making visual components responsible for networking. No backend, account system, secret key, API request, or AI model is part of Phase 2A.

## Data and privacy

All demonstration names, event details, contact-like information, tasks, and incidents must be fictional. The prototype is not designed to store real personal, interview, participant, payment, health, or safeguarding data. Do not enter sensitive information: local browser storage is not a secure database and is not encrypted by BudoGraph.

## Run locally

Prerequisites: a Node.js installation compatible with the locked toolchain and `pnpm` (the repository declares `pnpm@11.9.0`).

Install dependencies:

```sh
pnpm install
```

Start the local development server:

```sh
pnpm dev
```

Create a production build:

```sh
pnpm build
```

Run the focused automated tests:

```sh
pnpm test
```

Run linting:

```sh
pnpm lint
```

Run TypeScript checking:

```sh
pnpm typecheck
```

Check formatting without modifying files:

```sh
pnpm format:check
```

Apply the repository formatter when intentionally preparing changes:

```sh
pnpm format
```

These are the project commands, not claims that a particular run passed. Record verified results separately as test evidence; do not infer them from this README.

## Replaceable wordmark

The current Phase 1 and Phase 2A prototype uses a text-only `BudoGraph` wordmark. The isolated component is `src/components/BrandWordmark.tsx`. When the project author finishes the hand-drawn logo, replace the visual content of that component while preserving its compact layout behavior and accessible name. Add the original asset to the repository, document its authorship and license status, and keep a readable text fallback. No generated, stock, or permanent placeholder logo is used in the current prototype.

## Documentation

- [Phase 1 record and Phase 2A architecture boundary](docs/BUDOGRAPH_PHASE_1.md)
- [Phase 2A user guide](docs/USER_GUIDE.md)
- [Installation, deployment, and demonstration plan](docs/DEPLOYMENT_AND_DEMO_PLAN.md)
- [Presentation outline](docs/PRESENTATION_OUTLINE.md)
- [Phase 1 and Phase 2A test evidence](docs/TEST_EVIDENCE.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Third-party notices and license register](docs/THIRD_PARTY_NOTICES.md)
- [AI assistance log](docs/AI_ASSISTANCE_LOG.md)
- Historical source: `docs/NOIT_REGULATIONS_2025_2026.pdf`
- Project requirements: `docs/NOIT_MASTER_PROMPT.md`

The available NOIT regulation is for the **2025-2026 competition year** and is historical. Before registration or submission for another year, verify the official regulation for that actual year, especially dates, category wording, procedures, required documents and formats, online-availability periods, declarations, and test-account rules.

## License

BudoGraph source code is licensed under the GNU General Public License version 3 only (`GPL-3.0-only`). See [LICENSE](LICENSE). Third-party components retain their own licenses as recorded in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

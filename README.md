# BudoGraph

BudoGraph is an organizer workspace for martial-arts seminars and events. It gives the organizer one current operational overview of preparation tasks, ownership, deadlines, risks, changes, and contingency responses while continuing to treat direct human communication as essential.

## Project status and evidence boundary

This repository contains the **Phase 1 NOIT competition MVP, the Phase 2A UX foundation, the locked Phase 2B.1 Dashboard direction, and the Phase 2B.2 Tasks workspace redesign**. Phase 1 established the coherent, interactive vertical slice. Phase 2A strengthened localization, theming, responsive behavior, and task navigation. Phase 2B.1 clarified BudoGraph's visual identity and Dashboard reading order. Phase 2B.2 applies that identity to a dense operational task register, compact search and filtering, and a primary task detail/editing drawer without changing the approved product idea or adding production services.

The repository also contains the Backend P1A/P1B/P1C foundation and P1D.1 browser
authentication described below. Login uses real database-backed sessions; the
workspace content still uses fictional local data. The application remains a technical prototype. These
phases do not prove product-market fit, commercial demand, adoption, willingness
to pay, or usability.

The historical research and validation record remains under `docs/validation/` and `docs/market-research/`. Those files are preserved as evidence and are not rewritten to make the Phase 1 decision appear stronger than the evidence supports. The decision to build this prototype is a competition-project decision, not a commercial-validation conclusion.

## Phase 1 scope

The approved Phase 1 slice covers:

- a responsive organizer application shell with desktop and mobile navigation;
- a dashboard for readiness, task state, deadlines, risks, workload, attention items, and milestones;
- an interactive task workspace with status and owner filtering, status updates, task acceptance, overdue calculation, dependencies, consequences, and task details;
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

## Phase 2B.1 visual and information hierarchy

Phase 2B.1 refines the existing experience rather than adding a product feature. Its semantic color roles are:

- **navy** for structure, navigation, and stable primary surfaces;
- **burgundy** for decisions, the selected action or state, and primary actions;
- **gold** for time, event stages, milestones, and organizational structure;
- **red** only for genuine blockers or serious risk;
- **green** for confirmed completion and safe positive state; and
- **blue** for active process and neutral information.

Three surface concepts keep the hierarchy legible: **operational surfaces** are dense and actionable, **context surfaces** explain event or team context quietly, and **critical surfaces** are reserved for blockers and serious risk.

The Dashboard now follows one deliberate reading sequence: `EventOverview`, `OperationalFocus`, `PreparationTimeline`, `ChangeImpact`, then `TeamPressure`. Event progress remains a task-completion calculation, not a safety or go/no-go assessment. The new structure reorganizes existing local data; it does not add a backend, authentication, accounts, permissions, integrations, or another feature area.

Task-facing wording now uses **Accepted** and **Not accepted** to mean that the assigned person has seen and accepted the task. For storage compatibility, the underlying boolean remains `Task.acknowledged` in `budograph.workspace.v1`. It is not an approval workflow and is separate from task completion. Acknowledging an operational change in Changes & Plan B remains a distinct action with distinct wording.

This refinement is not product-market validation and does not prove usability, accessibility, adoption, or measurable product impact. Those claims require separate evidence.

## Phase 2B.2 Tasks workspace

Phase 2B.2 redesigns only the Tasks experience. Desktop uses one flat, separator-based operational register with four priorities: task identity, responsibility, deadline, and true task status. Category and urgency remain secondary; Accepted/Not accepted is shown quietly under the owner and never replaces progress status. Each row retains a canonical `/tasks?task=<encoded-task-id>` link and opens the detail drawer across its full hit area.

The compact toolbar searches localized task title, context, category, and owner, and combines status, owner, and category filters with the existing optional owner grouping. The drawer is the primary editing surface: identity/context, responsibility and acceptance, progress and timing, existing task relationships, and record metadata are separated into deliberate sections. At narrow widths the register becomes a purpose-built task summary instead of shrinking desktop columns. No schema, storage key, dependency, backend boundary, or non-Tasks information architecture changes in this phase; the approved Dashboard remains locked.

## Architecture

### Deterministic demo snapshot — Phase 2B.2.3B

The editable local prototype shows fictional preparation **as of 7 September
2026**, eleven days before the unchanged **18–20 September 2026** seminar.
Every page displays a localized, quiet demo-snapshot notice. Today, Near,
Later, overdue, attention, team risk and the Dashboard next checkpoint use this
reference, not the date on the presentation computer.

`src/data/demoTime.ts` is the explicit demo-time boundary. App supplies one local
calendar reference to Dashboard, Tasks and Team; domain functions still accept
arbitrary injected `now` values. Local noon preserves the reference calendar day
across timezones. Reported/updated timestamps are displayed in `Europe/Sofia`
(Varna); demo task edits use the fixed snapshot timestamp, not a real audit clock.
The real-clock midnight/resume helper and its independent calendar/DST tests
remain available and unchanged; the demo does not subscribe to that clock.

Fresh storage or **Templates → Reset demo event → Reset local data** loads the
new scenario. Valid existing `budograph.workspace.v1` data is not migrated or
re-dated, even if it contains the old August deadlines. It is displayed against
the same explicit demo reference until the user chooses reset. Reset replaces
workspace edits and preserves `budograph.preferences.v1` language/theme choices.
There is no automatic date shifting, storage-version change or new dependency.

The baseline includes one overdue accessibility check, today's blocked arrival
confirmation, near-term travel/safety preparation and later opening tasks.
Milestone status remains manual/persisted and separate from Task status; fixture
dates are coherent with the reference rather than automatically advancing status.

### Application layers

The application uses React, TypeScript, and Vite. Typed local domain data represents `Event`, `TeamMember`, `Task`, `EventChange`, and `EventTemplate` records with stable IDs. Domain calculations and workspace state are kept separate from page components where practical. Interactive demo state remains compatible with the versioned `budograph.workspace.v1` browser-storage record; the fictional seed state is used when no usable saved state exists or when the demonstration is reset. Phases 2B.1 and 2B.2 preserve that schema, including the task `acknowledged` boolean whose current UI meaning is accepted/not accepted. Phase 2B.2 adds a pure Tasks selector module for localized search, combined filtering, category derivation, and operational ordering without moving those decisions into the visual row component.

Phase 2A adds three focused client-side layers:

- `src/i18n/` owns typed messages, localized demo copy, plural selection, and `Intl` date and number formatting;
- `src/preferences/` detects, validates, applies, and persists language and theme preferences in `budograph.preferences.v1`; and
- `src/routes.ts` parses exact top-level paths and optional task URL state without a routing dependency.

Workspace state, UI preferences, and URL state are deliberately separate. Selecting a language or theme does not rewrite the saved event workspace, and opening a task link does not change the task record.

This boundary is deliberately replaceable: a later data service can load and save the same domain records through a backend without making visual components responsible for networking. No backend, account system, secret key, API request, or AI model is part of Phase 2A, Phase 2B.1, or Phase 2B.2.

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

## Backend P1A/P1B/P1C

Backend P1A adds a separate TypeScript/Fastify server, PostgreSQL pool,
liveness/readiness endpoints, validated configuration, and versioned SQL runner.
P1B adds pinned Better Auth **1.7.7** email/password authentication with
database-backed sessions, a safe `GET /api/me` diagnostic, controlled CLI account
provisioning, Event/EventMember/Task/ActivityEntry relational schema, and
server-side Event authorization helpers. Public sign-up is closed.

P1C adds backend task reads, assignment/reassignment/unassignment,
acceptance/withdrawal, status commands, version conflicts and atomic activity
history. An explicit development-only CLI creates a separate real Event with
the controlled Organizer and Member. The real two-session responsibility loop
is verified against development PostgreSQL; see the evidence below.

The browser application continues to use fictional local demo data; Dashboard,
Tasks, and Team remain locked. P1D.1 adds real Login and a protected shell. Remote
workspace integration remains the next P1D.2 step.

Backend development requires Node.js **22.x from 22.18.0, or 24.0.0 and later**, and the repository's
**pnpm 11.9.0**. From the repository root, copy `server/.env.example` to the ignored
`server/.env`, replace placeholders using an approved local/test database, and
provide a cryptographically generated `BETTER_AUTH_SECRET` plus an explicit
`BETTER_AUTH_URL`. Keep credentials in ignored local environment files or the
process environment. Run reviewed migrations explicitly before auth usage:

```sh
pnpm db:migrate
```

Then start the backend:

```sh
pnpm server:dev
```

The default listener is `http://127.0.0.1:3001`. Liveness is
`GET /api/health/live`; PostgreSQL readiness is `GET /api/health/ready`.
Use `pnpm server:typecheck`, `pnpm server:test`, and `pnpm server:build` for backend
checks. `pnpm server:provision` creates two controlled development users through
Better Auth's server API using local credentials; `pnpm server:verify-auth`
checks real auth behavior; `pnpm server:test:integration` explicitly runs
rollback-only PostgreSQL schema/constraint checks. These commands require the
approved database and configuration; credentials must remain untracked.
`pnpm server:bootstrap-event` uses only the two controlled account emails and
never runs at startup. `pnpm server:verify-responsibility` signs in with separate
in-memory cookie jars over real loopback HTTP, checks the workflow/database
state and logs out its sessions. It intentionally adds development task history;
foreign fixtures are rolled back. It is not a browser UI test.

No CORS dependency is added. P1D.1 also trusts the exact development browser
origin `http://127.0.0.1:5173`; production trusts only the configured auth origin.
Business UUIDs are server-generated;
date-only deadlines remain Event-local DATE values. RLS without public policies
protects auth/business tables from direct Supabase public API access; backend
least-privilege deployment grants still require review.

See [backend development](docs/BACKEND_DEVELOPMENT.md) for configuration, lifecycle,
migration/schema generation, provisioning, and the verification boundary. See
[test evidence](docs/TEST_EVIDENCE.md) for actual command results and remaining
verification limits; this README does not assert a passing run or production
deployment.

## P1D.1 authentication UI

Start `pnpm server:dev` and `pnpm dev` in separate terminals, then open
`http://127.0.0.1:5173/login`. Use the existing controlled development accounts;
credentials stay in ignored files or your process environment. Public signup
remains closed. The official pinned Better Auth client handles sign-in/sign-out;
`GET /api/me` resolves only `{ id, name, email }` for application state. No session
token is stored in React, browser storage or URLs.

Vite dev and preview proxy same-origin `/api/*` requests to
`http://127.0.0.1:3001`. Port 5173 is strict: use the documented `127.0.0.1` origin,
not an automatically selected port or `localhost` alias. Refreshes check the
server session before revealing the workspace. Logged-out routes redirect to
Login, with an allowlisted task/page return destination; authenticated Login
redirects to the workspace. Logout is available in the desktop sidebar and the
mobile BudoGraph wordmark menu. Focus, visibility, online and navigation events
recheck the session without polling.

Authentication identity and local demo task/team data are intentionally separate.
Logging in as Member does not turn the fictional demo actions into authorized
server task commands. P1D.2 will integrate the real responsibility workflow.

`pnpm test:browser:auth` runs the real browser check when Playwright and a browser
are available; see [backend development](docs/BACKEND_DEVELOPMENT.md) for runtime
configuration and the stopped-backend test. Production must serve the frontend
and `/api` at the same HTTPS origin, preserve History API routes, and proxy to
Fastify. Hosting and production proxy verification remain separate work.

## Replaceable wordmark

The current Phase 1, Phase 2A, Phase 2B.1, and Phase 2B.2 prototype uses a text-only `BudoGraph` wordmark. The isolated component is `src/components/BrandWordmark.tsx`. When the project author finishes the hand-drawn logo, replace the visual content of that component while preserving its compact layout behavior and accessible name. Add the original asset to the repository, document its authorship and license status, and keep a readable text fallback. No generated, stock, or permanent placeholder logo is used in the current prototype.

## Documentation

- [Phase 1 record and Phase 2A/2B architecture boundary](docs/BUDOGRAPH_PHASE_1.md)
- [Phase 2B.2 user guide](docs/USER_GUIDE.md)
- [Installation, deployment, and demonstration plan](docs/DEPLOYMENT_AND_DEMO_PLAN.md)
- [Presentation outline](docs/PRESENTATION_OUTLINE.md)
- [Phase 1, Phase 2A, and Phase 2B test evidence](docs/TEST_EVIDENCE.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Third-party notices and license register](docs/THIRD_PARTY_NOTICES.md)
- [AI assistance log](docs/AI_ASSISTANCE_LOG.md)
- Historical source: `docs/NOIT_REGULATIONS_2025_2026.pdf`
- Project requirements: `docs/NOIT_MASTER_PROMPT.md`

The available NOIT regulation is for the **2025-2026 competition year** and is historical. Before registration or submission for another year, verify the official regulation for that actual year, especially dates, category wording, procedures, required documents and formats, online-availability periods, declarations, and test-account rules.

## License

BudoGraph source code is licensed under the GNU General Public License version 3 only (`GPL-3.0-only`). See [LICENSE](LICENSE). Third-party components retain their own licenses as recorded in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

# BudoGraph

BudoGraph is an organizer workspace for martial-arts seminars and events. It gives the organizer one current operational overview of preparation tasks, ownership, deadlines, risks, changes, and contingency responses while continuing to treat direct human communication as essential.

## Project status and evidence boundary

This repository currently contains a **Phase 1 NOIT competition MVP and technical prototype**. Phase 1 is intended to demonstrate a coherent, interactive vertical slice; it is not a production service and it does not prove product-market fit, commercial demand, adoption, or willingness to pay.

The historical research and validation record remains under `docs/validation/` and `docs/market-research/`. Those files are preserved as evidence and are not rewritten to make the Phase 1 decision appear stronger than the evidence supports. The decision to build this prototype is a competition-project decision, not a commercial-validation conclusion.

## Phase 1 scope

The approved Phase 1 slice covers:

- a responsive organizer application shell with desktop and mobile navigation;
- a dashboard for readiness, task state, deadlines, risks, workload, attention items, and milestones;
- an interactive task workspace with status and owner filtering, status updates, acknowledgement, overdue calculation, dependencies, consequences, and task details;
- a team overview with workload and assigned-task drill-down;
- a Changes & Plan B area for acknowledging and responding to operational changes, including a clear `Direct contact recommended` escalation;
- a reusable seminar-template preview and local demonstration-data reset flow;
- one fictional martial-arts seminar with fictional organizers, helpers, tasks, and contingencies; and
- browser-local persistence so permitted interactions can survive a refresh in the same browser profile.

Phase 1 explicitly excludes a production backend, database, authentication, authorization roles, external APIs, AI, email or messaging integrations, payments, participant registration, document storage, and production notifications. See [Phase 1 scope](docs/BUDOGRAPH_PHASE_1.md) and [known limitations](docs/KNOWN_LIMITATIONS.md) for the precise boundary.

## Architecture

The application uses React, TypeScript, and Vite. Typed local domain data represents `Event`, `TeamMember`, `Task`, `EventChange`, and `EventTemplate` records with stable IDs. Domain calculations and workspace state are kept separate from page components where practical. Interactive demo state is persisted with browser `localStorage`; the fictional seed state is used when no usable saved state exists or when the demonstration is reset.

This boundary is deliberately replaceable: a later data service can load and save the same domain records through a backend without making visual components responsible for networking. No backend, account system, secret key, API request, or AI model is part of Phase 1.

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

These are the project commands, not claims that a particular run passed. Record verified results separately as test evidence; do not infer them from this README.

## Replaceable wordmark

Phase 1 uses a text-only `BudoGraph` wordmark. The isolated component is `src/components/BrandWordmark.tsx`. When the project author finishes the hand-drawn logo, replace the visual content of that component while preserving its compact layout behavior and accessible name. Add the original asset to the repository, document its authorship and license status, and keep a readable text fallback. No generated, stock, or permanent placeholder logo is used in Phase 1.

## Documentation

- [Phase 1 product and architecture boundary](docs/BUDOGRAPH_PHASE_1.md)
- [Phase 1 user guide](docs/USER_GUIDE.md)
- [Installation, deployment, and demonstration plan](docs/DEPLOYMENT_AND_DEMO_PLAN.md)
- [Presentation outline](docs/PRESENTATION_OUTLINE.md)
- [Phase 1 test evidence](docs/TEST_EVIDENCE.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Third-party notices and license register](docs/THIRD_PARTY_NOTICES.md)
- [AI assistance log](docs/AI_ASSISTANCE_LOG.md)
- Historical source: `docs/NOIT_REGULATIONS_2025_2026.pdf`
- Project requirements: `docs/NOIT_MASTER_PROMPT.md`

The available NOIT regulation is for the **2025-2026 competition year** and is historical. Before registration or submission for another year, verify the official regulation for that actual year, especially dates, category wording, procedures, required documents and formats, online-availability periods, declarations, and test-account rules.

## License

BudoGraph source code is licensed under the GNU General Public License version 3 only (`GPL-3.0-only`). See [LICENSE](LICENSE). Third-party components retain their own licenses as recorded in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

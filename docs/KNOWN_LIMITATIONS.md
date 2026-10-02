# Known Limitations

This document describes the honest Phase 1, Phase 2A, Phase 2B.1, and Phase 2B.2 boundary. It must be updated when a limitation is removed or a new one is discovered.

## Product and evidence

- BudoGraph is a NOIT competition MVP and technical prototype, not a production service.
- The decision to build Phase 1 is not proof of product-market fit, commercial demand, adoption, retention, willingness to pay, or market prevalence.
- Historical interviews are qualitative and bounded. Their original files are preserved under `docs/validation/`; they must not be generalized into statistics.
- No measured claim is made that BudoGraph reduces omissions, organizer workload, response time, or event risk.
- Phase 2B.1 is a visual and information-hierarchy refinement and Phase 2B.2 is a focused Tasks workspace implementation. Neither is product-market validation or proof of usability, accessibility, adoption, organizer effectiveness, or preference for the visual direction.

## Data and persistence

- State is stored only in browser `localStorage` for the current browser profile and origin.
- Workspace data and UI preferences use separate versioned records: `budograph.workspace.v1` and `budograph.preferences.v1`. This separation preserves the existing workspace schema, but neither record is a production database.
- The task acceptance UI still stores its value in the Phase 1-compatible `Task.acknowledged` boolean. Accepted means that the assigned person has seen and accepted the task; it is not authenticated, does not prove that the person actually reviewed it, and is neither completion nor approval.
- Task acceptance and acknowledgement of an operational change are separate interactions even though the compatible internal naming uses acknowledgement language. They must not be interpreted as one shared workflow.
- There is no cloud sync, multi-device continuity, concurrent editing, conflict resolution, server backup, recovery service, or audit history.
- Clearing site data, using a different origin/profile/browser, or resetting the demo can remove or replace local changes.
- A blocked or unavailable browser-storage API causes a safe in-memory/default fallback and a notice; manual language, theme, or workspace changes may not survive the next visit in that case.
- Local data is not encrypted by BudoGraph and must not contain passwords, private operational details, personal data, interview information, payment data, or other sensitive content.
- The included dataset is fictional demonstration data. It is not a production dataset and does not represent real people, dojos, instructors, participants, or incidents.
- Client-side validation and TypeScript types improve development safety but do not provide server-side trust or security enforcement.

## Functional boundary

- Phase 1, Phase 2A, Phase 2B.1, and Phase 2B.2 have no backend, production database, authentication, authorization, accounts, or real role permissions.
- There is no external API, AI feature, email, SMS, chat, telephone, calendar, payment, file-storage, or push-notification integration.
- Phase 2A does not include budget management, Kanban, calendar, or Gantt views.
- Scenario-specific escalation instructions are guidance only. BudoGraph cannot contact anyone or confirm that communication occurred.
- The template capability is intentionally simple; it is not a complete template editor or a general event-generation system.
- The prototype is centered on one fictional current event and a limited local template/reset flow rather than production multi-event management.
- The local prototype uses an explicitly disclosed fictional snapshot date, 7 September 2026. It is not a live operational clock or a real audit trail: task edits receive the snapshot timestamp and reported/updated times display in Varna time. Domain helpers still support arbitrary local-calendar references independently. There is no trusted server clock. Valid older saved workspaces retain their dates until an explicit reset.
- The local-data boundary is designed for later replacement, but no backend migration, import/export, or synchronization path is implemented in Phase 1, Phase 2A, Phase 2B.1, or Phase 2B.2.
- The Phase 2B.2 drawer edits only the two interactions already supported by the local model: task status and Accepted/Not accepted. Owner, deadline, priority, context, relationships, and timestamps remain read-only; this is not a complete task-authoring workflow.
- Task deep links cover task details only and use `/tasks?task=<encoded-task-id>`. Other entities do not yet have dedicated deep links.
- An unknown or wrong-event task ID is treated as invalid and does not open a detail drawer. IDs remain local synthetic identifiers rather than public, authorized server resources.
- Only Bulgarian and English are supported. Language detection uses the first available browser/device language tag and otherwise falls back to English; it is not regional content negotiation.
- `System` theme depends on browser support for `prefers-color-scheme` and its change events. The explicit Light and Dark options do not provide additional contrast modes.

## Design, compatibility, and quality evidence

- The permanent logo is not present. The current prototype uses a replaceable text-only `BudoGraph` wordmark until the author supplies a hand-drawn original.
- No external images, downloaded fonts, stock artwork, or visual logo assets are used.
- The Phase 2B.1 semantic roles are navy structure, burgundy decisions/selected action, gold time/stages, red genuine risk, green completion, and blue active/info. Their implementation in light and dark themes is a design system, not evidence that every user will interpret the colors correctly; labels, icons, focus states, contrast, and assistive-technology checks remain necessary.
- Operational, context, and critical surfaces clarify purpose, but they do not themselves prove information findability or task success. Critical styling is intentionally scarce and depends on correct domain classification.
- The Phase 2B.1 Dashboard direction remains locked. Phase 2B.2 adds the dense operational Tasks register, compact search/status/owner/category filters, and sectioned task drawer. Team, Changes & Plan B, and Templates retain compatible styling and behavior; detailed redesign of those views remains future work.
- Responsive and accessible behavior is an implementation goal, but formal accessibility certification and exhaustive assistive-technology, device, and browser testing are outside this documentation pass.
- Controlled in-app Chromium evidence for Phase 2A.1 and the focused Phase 2B.2 Tasks matrix is recorded in `docs/TEST_EVIDENCE.md`. It is not exhaustive real-device, multi-browser, zoom, screen-reader, or assistive-technology coverage.
- Automated tests are intentionally focused and do not prove the absence of defects. Broader keyboard, screen-reader, contrast, empty/error-state, real-device, and cross-browser checks are still required.
- This file records limitations; it does not claim that lint, type checking, tests, or the production build have passed. Verified command results belong in separate test evidence.
- The third-party register covers the named top-level Phase 1, Phase 2A, and Phase 2B dependencies and tooling. Phase 2B.2 adds no dependency or asset. The full transitive lockfile still requires a final redistribution and notice audit.

## Deployment and operations

- A local development/build workflow is documented, but Phase 2A, Phase 2B.1, and Phase 2B.2 do not by themselves provide production hosting, uptime monitoring, error reporting, analytics, backup deployment, or disaster recovery.
- Production hosting must preserve all top-level History API paths and the `/tasks?task=...` query when serving or refreshing the application.
- No offline-first service worker or installable PWA behavior is promised. Previously loaded browser resources should not be treated as a reliable offline demonstration plan.
- A production deployment, online availability period, test accounts, and an offline/backup demonstration package must be planned and verified separately if the applicable competition rules require them.

## Competition-year warning

`docs/NOIT_REGULATIONS_2025_2026.pdf` is a historical, year-specific regulation. It cannot establish the rules for a later competition year. Before actual participation, verify the then-current official regulation, including:

- dates and submission deadlines;
- age groups, directions, and category wording;
- registration, municipal, regional, and national-round procedures;
- documentation structure, format, declarations, and required files;
- source, executable/build, installation, and user-guide requirements;
- online availability and hosting periods;
- test-account rules for any implemented roles;
- licensing and external-resource requirements;
- test, presentation, defense, and scoring arrangements; and
- any privacy or consent forms and retention procedures.

The internal project schedule and the current project choices are not official NOIT rules.

## Backend P1A foundation - 2026-10-03

The earlier phase descriptions above remain historical. P1A adds an independent
Fastify server with health endpoints, validated configuration, a PostgreSQL pool,
and SQL migration infrastructure. It does not connect the browser demo to a backend
or implement authentication, authorization, accounts, business tables, task
persistence, task mutations, real collaboration, or production deployment.
Dashboard, Tasks, and Team retain their existing local prototype behavior.

The migration directory contains no business SQL files. Only an explicit
`pnpm db:migrate` invocation can create migration metadata or apply future SQL;
server startup does not run migrations. Migration files must contain PostgreSQL
commands that can run within one transaction; automatic rollback/down migrations
are outside P1A.

REAL POSTGRESQL INTEGRATION CHECK: **NOT RUN - no approved test database configured.**
Injected readiness checks and database protocol test doubles exercise application
logic but do not verify an actual PostgreSQL server. Backend configuration and
pool settings still require verification against an approved database before
claiming a working database integration. The historical 2025-2026 competition
requirements must be checked for the actual participation year.

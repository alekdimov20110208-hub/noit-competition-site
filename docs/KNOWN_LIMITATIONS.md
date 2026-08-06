# Known Limitations

This document describes the honest Phase 1 and Phase 2A boundary. It must be updated when a limitation is removed or a new one is discovered.

## Product and evidence

- BudoGraph is a NOIT competition MVP and technical prototype, not a production service.
- The decision to build Phase 1 is not proof of product-market fit, commercial demand, adoption, retention, willingness to pay, or market prevalence.
- Historical interviews are qualitative and bounded. Their original files are preserved under `docs/validation/`; they must not be generalized into statistics.
- No measured claim is made that BudoGraph reduces omissions, organizer workload, response time, or event risk.

## Data and persistence

- State is stored only in browser `localStorage` for the current browser profile and origin.
- Workspace data and UI preferences use separate versioned records: `budograph.workspace.v1` and `budograph.preferences.v1`. This separation preserves the existing workspace schema, but neither record is a production database.
- There is no cloud sync, multi-device continuity, concurrent editing, conflict resolution, server backup, recovery service, or audit history.
- Clearing site data, using a different origin/profile/browser, or resetting the demo can remove or replace local changes.
- A blocked or unavailable browser-storage API causes a safe in-memory/default fallback and a notice; manual language, theme, or workspace changes may not survive the next visit in that case.
- Local data is not encrypted by BudoGraph and must not contain passwords, private operational details, personal data, interview information, payment data, or other sensitive content.
- The included dataset is fictional demonstration data. It is not a production dataset and does not represent real people, dojos, instructors, participants, or incidents.
- Client-side validation and TypeScript types improve development safety but do not provide server-side trust or security enforcement.

## Functional boundary

- Phase 1 has no backend, production database, authentication, authorization, accounts, or real role permissions.
- There is no external API, AI feature, email, SMS, chat, telephone, calendar, payment, file-storage, or push-notification integration.
- Phase 2A does not include budget management, Kanban, calendar, or Gantt views.
- Scenario-specific escalation instructions are guidance only. BudoGraph cannot contact anyone or confirm that communication occurred.
- The template capability is intentionally simple; it is not a complete template editor or a general event-generation system.
- The prototype is centered on one fictional current event and a limited local template/reset flow rather than production multi-event management.
- Overdue and date-sensitive behavior depends on the device clock and local browser environment; there is no trusted server clock.
- The local-data boundary is designed for later replacement, but no backend migration, import/export, or synchronization path is implemented in Phase 1 or Phase 2A.
- Task deep links cover task details only and use `/tasks?task=<encoded-task-id>`. Other entities do not yet have dedicated deep links.
- An unknown or wrong-event task ID is treated as invalid and does not open a detail drawer. IDs remain local synthetic identifiers rather than public, authorized server resources.
- Only Bulgarian and English are supported. Language detection uses the first available browser/device language tag and otherwise falls back to English; it is not regional content negotiation.
- `System` theme depends on browser support for `prefers-color-scheme` and its change events. The explicit Light and Dark options do not provide additional contrast modes.

## Design, compatibility, and quality evidence

- The permanent logo is not present. The current prototype uses a replaceable text-only `BudoGraph` wordmark until the author supplies a hand-drawn original.
- No external images, downloaded fonts, stock artwork, or visual logo assets are used.
- Responsive and accessible behavior is an implementation goal, but formal accessibility certification and exhaustive assistive-technology, device, and browser testing are outside this documentation pass.
- A Phase 2A.1 in-app Chromium pass at 320, 327, 360, 390, 768, 1080, and 1440 pixels is recorded in `docs/TEST_EVIDENCE.md`; every primary page was checked at 320 and 390 pixels, but this is not exhaustive real-device, multi-browser, zoom, or assistive-technology coverage.
- Automated tests are intentionally focused and do not prove the absence of defects. Broader keyboard, screen-reader, contrast, empty/error-state, real-device, and cross-browser checks are still required.
- This file records limitations; it does not claim that lint, type checking, tests, or the production build have passed. Verified command results belong in separate test evidence.
- The third-party register covers the named top-level Phase 1 and Phase 2A dependencies and tooling. The full transitive lockfile still requires a final redistribution and notice audit.

## Deployment and operations

- A local development/build workflow is documented, but Phase 2A does not by itself provide production hosting, uptime monitoring, error reporting, analytics, backup deployment, or disaster recovery.
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

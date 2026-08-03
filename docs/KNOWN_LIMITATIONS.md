# Known Limitations

This document describes the honest Phase 1 boundary. It must be updated when a limitation is removed or a new one is discovered.

## Product and evidence

- BudoGraph is a NOIT competition MVP and technical prototype, not a production service.
- The decision to build Phase 1 is not proof of product-market fit, commercial demand, adoption, retention, willingness to pay, or market prevalence.
- Historical interviews are qualitative and bounded. Their original files are preserved under `docs/validation/`; they must not be generalized into statistics.
- No measured claim is made that BudoGraph reduces omissions, organizer workload, response time, or event risk.

## Data and persistence

- State is stored only in browser `localStorage` for the current browser profile and origin.
- There is no cloud sync, multi-device continuity, concurrent editing, conflict resolution, server backup, recovery service, or audit history.
- Clearing site data, using a different origin/profile/browser, or resetting the demo can remove or replace local changes.
- Local data is not encrypted by BudoGraph and must not contain passwords, private operational details, personal data, interview information, payment data, or other sensitive content.
- The included dataset is fictional demonstration data. It is not a production dataset and does not represent real people, dojos, instructors, participants, or incidents.
- Client-side validation and TypeScript types improve development safety but do not provide server-side trust or security enforcement.

## Functional boundary

- Phase 1 has no backend, production database, authentication, authorization, accounts, or real role permissions.
- There is no external API, AI feature, email, SMS, chat, telephone, calendar, payment, file-storage, or push-notification integration.
- `Direct contact recommended` is guidance only. BudoGraph cannot contact anyone or confirm that communication occurred.
- The template capability is intentionally simple; it is not a complete template editor or a general event-generation system.
- The prototype is centered on one fictional current event and a limited local template/reset flow rather than production multi-event management.
- Overdue and date-sensitive behavior depends on the device clock and local browser environment; there is no trusted server clock.
- The local-data boundary is designed for later replacement, but no backend migration, import/export, or synchronization path is implemented in Phase 1.

## Design, compatibility, and quality evidence

- The permanent logo is not present. Phase 1 uses a replaceable text-only `BudoGraph` wordmark until the author supplies a hand-drawn original.
- No external images, downloaded fonts, stock artwork, or visual logo assets are used.
- Responsive and accessible behavior is an implementation goal, but formal accessibility certification and exhaustive assistive-technology, device, and browser testing are outside this Phase 1 documentation pass.
- Automated tests are intentionally focused and do not prove the absence of defects. Manual interaction, refresh-persistence, responsive, keyboard, contrast, empty/error-state, and browser checks are still required.
- This file records limitations; it does not claim that lint, type checking, tests, or the production build have passed. Verified command results belong in separate test evidence.
- The third-party register covers the named top-level Phase 1 dependencies and tooling. The full transitive lockfile still requires a final redistribution and notice audit.

## Deployment and operations

- A local development/build workflow is documented, but Phase 1 does not by itself provide production hosting, uptime monitoring, error reporting, analytics, backup deployment, or disaster recovery.
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

The internal project schedule and the current Phase 1 choices are not official NOIT rules.

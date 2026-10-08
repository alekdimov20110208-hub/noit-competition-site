# Changelog

## 2026-10-08 — Task reminders and in-app notifications

- Add durable current-Event TASK_ASSIGNED and TASK_DUE_REMINDER history with personal read state.
- Add fixed 1-day/1-hour/15-minute Task presets, Event timezone schedules and atomic time-removal cleanup.
- Add a bounded PostgreSQL worker, catch-up before deadlines, current-assignee delivery and multi-instance uniqueness.
- Extend the existing header and Organizer Task form with quiet BG/EN controls, explicit failure handling and scoped Task navigation.
- Add immutable migration 0007, deterministic PostgreSQL/browser tests and deployment/user documentation.
- Preserve Task acceptance/version contracts, P1/P2/P3, Dashboard attention and P4A. No email, push, realtime or client polling.

## 2026-10-06 — BudoGraph P4A

- Add isolated server-only Resend HTTP delivery and BG/EN HTML/plain-text emails.
- Hide production invitation bearer links; support pending-send failure and scoped,
  rate-limited resend with token rotation and unchanged expiry.
- Add Better Auth verification and recovery, closed public signup, verified-session
  enforcement and session revocation after password reset.
- Extend existing AuthShell with localized accessible recovery/verification states.
- Add provider, real Better Auth/PostgreSQL and browser tests, setup/security docs.
- No dependency or migration changes. Real inbox human gate NOT RUN.

## 2026-10-06 — BudoGraph P3C

- Connected existing Dashboard Operational Changes to canonical current-Event P3 reads and durable links.
- Added deterministic personal Change attention with one reason per Change; missing Plan B alone is excluded and Task attention stays independent.
- Clarified response coordination ownership and the Decision/Response/optional Plan B hierarchy in BG/EN.
- Preserved Member read-only access and locked composition; no migration, dependency, AI, notification or realtime addition.
- Added focused integration/browser coverage and current documentation.

## 2026-10-05 — BudoGraph P3B

- Extended Change with one current Decision, operational Response and optional Plan B.
- Added immutable migration 0005 preserving P3A Changes, Task links and owners.
- Preserved Organizer-only authoring, read-only Members and one expectedVersion boundary.
- Added atomic presence-based activity for response add/edit/clear without prose duplication.
- Extended localized detail/forms and retained stale drafts until explicit reload.
- Added PostgreSQL/browser coverage for concurrency, rollback and live Task independence.
- Preserved locked P1/P2/P3A designs; no AI, automatic execution or dependencies.

## 2026-10-05 — BudoGraph P3A

- Added Event-scoped Change records and explicit affected Task links in migration 0004.
- Added Organizer create/edit, Member reads, expectedVersion/409 and atomic business history.
- Projected current Task assignees, deadlines and statuses without duplicated snapshots.
- Added localized Changes list/detail/forms, durable routes and Event-switch isolation.
- Renamed the existing navigation placeholder; retained locked core designs and semantics.
- Added focused unit/PostgreSQL/browser coverage and P3A documentation, without dependencies.
- P3B / Plan B remains unimplemented.

## 2026-10-04 — BudoGraph P2C

- Added secure Event invitations, Organizer pending-invitation management and revocation.
- Added existing-account acceptance and invite-only registration through Better Auth.
- Added real active MEMBER onboarding, Team/Event-switcher and Task assignment integration.
- Added immutable migration 0003 and token/referrer/logging protections.
- Email delivery remains unconfigured; explicit one-time development links are available.
- Preserved locked Dashboard/Tasks/Team composition and P1/P2A/P2B responsibility semantics.
- Added focused automated/browser verification and setup/user/security documentation.

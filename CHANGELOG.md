# Changelog

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

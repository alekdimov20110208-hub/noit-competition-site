# Changelog

## 2026-10-11 — Event Management Stages 2 + 3 LOCK

- Record explicit project-author Human Acceptance — 6/6 PASS on 2026-10-11 and LOCK Stage 2 Detail & UX and Stage 3 Event History at implementation `9372f4974f1746008f1d3f3ec2c2b7b65e4535bc`.
- Document precise accepted scopes and preserve Stage 1 LOCK, existing technical evidence, historical failures and pre-acceptance PENDING states. Keep current-name/history limitations, 572.83 kB advisory and competition-year boundary.
- Documentation only: no application, test, schema, dependency, configuration, infrastructure, credential or data change; no product/browser/PostgreSQL/password matrix or restart. Stages 4–7 remain NOT STARTED; the unrelated shortcut stays excluded.

## 2026-10-11 — Event Management Stages 2 + 3

- Clarify existing Create/Edit hierarchy, required fields, calendar-date and timezone guidance, accessible descriptions and pending controls; retain canonical validation, conflicts and successful-save navigation.
- Add read-only, membership-authorized Event history with deterministic 50-record PostgreSQL cursor pages, current actor/target names, actual recorded versions, status and coordination-presence changes, and scoped Task/Change links.
- Add only a History link to management rows for Stage 3 compatibility; preserve Stage 1 controls, filters, permissions, shell and locked interiors.
- Add focused history, API, PostgreSQL and browser coverage; preserve original references and prior failure evidence. No migrations, dependencies, destructive operations, credential rotation or Stage 4–7 work.
- Human acceptance remains pending; Stage 2 + 3 are not locked. Final technical evidence is recorded separately.

## 2026-10-11 — Event Management Stage 1 LOCK

- Record the project author's explicit Human Acceptance: 6/6 PASS, following Technical PASS, and lock Global Event Listing & Navigation at implementation `8959b51eb054f71ddf9cafe7136f096edcc9b1f5`.
- Update the existing project status and Stage 1 LOCK record with the precise accepted scope, preserved authorization/design/history invariants and links to unchanged evidence.
- Distinguish Active/Archived listing from future Archive Event operations. UX refinements, Event History improvements, durable idempotency, Duplicate Event and Clear All Tasks remain future work; Stage 2 is not started.
- Documentation only: no product, test, database, fixture, credential, environment or infrastructure changes; preserve the unrelated untracked shortcut.

## 2026-10-11 — Event Management Stage 1 verification closure

- Complete the mandatory Profile regression once on isolated local PostgreSQL 17.11: 13/13 functional groups and 20/20 layouts, with verified disposable and runtime cleanup.
- Resolve the evidenced mobile menu/focus and short-sidebar transition measurement races only in the existing browser harness; preserve assertions, deadlines and locked product styling.
- Reconcile all 15 principal PASS suites: 170 functional groups and 831 layout/presentation cases, plus preserved unit/PostgreSQL/concurrency/locked-visual gates; distinguish mocked presentation from real authentication.
- Preserve historical failures, unchanged established accounts/environment/reference files and the unrelated shortcut. Final typechecks, lint, builds and formatting pass; Stage 1 is TECHNICAL PASS. Human Acceptance and LOCK remain pending, and Stage 2 is not started.

## 2026-10-09 — Event Management Stage 1 (technical verification partial)

- Add authenticated global `/events`, membership-scoped listing, Active/Archived and Event-name search.
- Replace switcher Create/Edit actions with one BG/EN Manage link and preserve five bottom items.
- Preserve existing Create/Edit forms/APIs and readable archived workspace links; restrict Edit to active same-Event Organizers.
- Isolate listing reads from Tasks; preserve explicit scope/history and meaningful no-active-Event entry.
- Add responsive/focus, route/controller/listing tests and evidence; real browser gate is blocked by configured login credentials.
- Diagnose the stale ignored Organizer test password without credential changes; resolve all seven visual investigations with strict original-reference comparison and interior-change controls.
- No schema, migration, dependency or deployment; human acceptance/LOCK pending and stages 2–7 not started.

## 2026-10-08 — Profile & Account Settings V1

- Add global authenticated `/account` and desktop/mobile account navigation.
- Allow only validated display-name writes through Better Auth 1.7.7 and refresh canonical identity.
- Add current-password change, prior-session revocation and a new current cookie; strip bearer output.
- Reuse language/theme preferences; add Unicode initials and complete BG/EN messages.
- Keep email/photos behind V2 gates; add focused unit/PostgreSQL/browser checks and docs.
- No schema, dependencies, notification-engine or brand asset changes.

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

# Known Limitations

This document records the local prototype boundary and the separate backend
P1A/P1B/P1C backend. Historical phase descriptions remain scoped to those phases;
the current backend limitations are recorded below. Update this record when a
limitation is removed or discovered.

## Current P1D.1 authentication boundary — 2026-10-03

- Real Login, server-backed logout, safe current-user bootstrap and a protected application shell are implemented. Authentication identity and the fictional local workspace remain deliberately separate. The historical P1C exclusions below describe that earlier stage.
- Dashboard/Tasks/Team still use the existing LocalDemoWorkspaceService boundary (`useWorkspace` and its browser-local reducer/persistence). Demo responsibility actions are not real authorized PostgreSQL commands even when signed in. There is no RemoteWorkspaceService or remote Task/Team/Dashboard data. P1D.2 is the next integration step and has not begun.
- Only controlled development accounts can sign in. Signup remains closed; recovery, onboarding, invitations, profile/account editing, social login and MFA remain excluded.
- Session checks occur at bootstrap, focus/visibility, online and navigation events. There is no polling: an idle foreground screen can remain visible until the next recheck. Server authorization remains authoritative for every backend request.
- Same-origin `/api` requests use the Vite dev/preview proxy at `http://127.0.0.1:5173` to the existing backend on port 3001. Only this exact extra browser origin is trusted in development; production gets no development origin or CORS wildcard. Custom origins/ports and production HTTPS reverse proxy deployment require separate configuration and verification.
- Session-check errors fail closed and remove current identity. A failed logout is shown as unconfirmed and does not pretend to revoke the server session; it can be retried.
- Browser evidence uses the installed desktop Edge/Chromium engine. It does not establish real-device, Safari/Firefox, screen-reader, password-manager product compatibility, formal accessibility certification or product validation.
- The 2025–2026 NOIT regulations remain year-specific. Verify the actual participation year's rules, dates, licensing, documentation format and availability requirements before submission.

## Historical backend P1C boundary — 2026-10-03

- P1C implements backend task reads and the two-user responsibility loop with scoped authorization, atomic task/history transactions and optimistic conflicts. P1B's exclusions below are historical, superseded only for this approved slice.
- Dashboard/Tasks/Team still use local fictional data. No login UI, remote workspace service, browser auth integration, demo migration, realtime updates, Event/task authoring or invitation UI is implemented.
- Bootstrap is explicit and DEVELOPMENT ONLY. It creates one separate real Event and minimal task with the two controlled users; reruns preserve current state. It is not general Event creation or public onboarding.
- Verification intentionally appends real development history. Immutable history is preserved; disposal uses transaction rollback for synthetic fixtures. There is no reset/drop/delete-history operation.
- Organizer manages assignment and status; only the current assignee accepts/withdraws. Operational descriptions grant no authority. Archived Event writes are denied conservatively.
- No new migration is needed. Owner transfer, membership management/deactivation with open work and soft deletion commands remain unimplemented; their future transactions must preserve the approved contract.
- Task reads currently return the authorized Event's full live task list; pagination, aggregate snapshots, member/Event navigation and a history-read endpoint are later scope.
- Actual changes increment version; matching-version repeats are unchanged 200 responses. Stale repeats return 409. Clients must refetch; no automatic intent replay.
- P1C cookie writes require the exact configured Origin; separate-origin browser CORS/auth integration remains future work. Auth abuse controls remain single-process Better Auth limits; dedicated task-route/distributed rate limiting is deployment hardening work.
- Real HTTP two-session verification is not a browser interaction test, product validation, formal security certification, production deployment or backup/restore verification.
- Separate least-privilege runtime/migration DB grants, production HTTPS/proxy configuration, restore drills, recovery and invitation onboarding remain limitations. No dependencies or licenses were added in P1C.
- The supplied 2025–2026 NOIT rules still require verification for the actual competition year, including eligibility, licensing, submissions, documentation format and online availability.

## Product and evidence

- BudoGraph is a NOIT competition MVP and technical prototype, not a production service.
- The decision to build Phase 1 is not proof of product-market fit, commercial demand, adoption, retention, willingness to pay, or market prevalence.
- Historical interviews are qualitative and bounded. Their original files are preserved under `docs/validation/`; they must not be generalized into statistics.
- No measured claim is made that BudoGraph reduces omissions, organizer workload, response time, or event risk.
- Phase 2B.1 is a visual and information-hierarchy refinement and Phase 2B.2 is a focused Tasks workspace implementation. Neither is product-market validation or proof of usability, accessibility, adoption, organizer effectiveness, or preference for the visual direction.

## Data and persistence

- The browser workspace's state is stored only in `localStorage` for the current browser profile and origin. P1D.1 uses the PostgreSQL-backed backend for authentication only; workspace content does not use it yet.
- Workspace data and UI preferences use separate versioned records: `budograph.workspace.v1` and `budograph.preferences.v1`. This separation preserves the existing workspace schema, but neither record is a production database.
- The task acceptance UI still stores its value in the Phase 1-compatible `Task.acknowledged` boolean. Accepted means that the assigned person has seen and accepted the task; it is not authenticated, does not prove that the person actually reviewed it, and is neither completion nor approval.
- Task acceptance and acknowledgement of an operational change are separate interactions even though the compatible internal naming uses acknowledgement language. They must not be interpreted as one shared workflow.
- The browser prototype has no cloud sync, multi-device continuity, concurrent editing, conflict resolution, server backup, recovery service, or audit history. P1C implements backend version conflicts and activity history separately.
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

REAL POSTGRESQL INTEGRATION VERIFIED: **YES - human manual verification.**
REAL MIGRATION RUNNER VERIFIED: **YES - two successful empty runs.**
The human verified readiness against the approved Supabase-hosted development
database and safe unavailable behavior, then ran the empty migration runner twice.
No business tables were created. See [test evidence](TEST_EVIDENCE.md).
Applying pending SQL files, metadata inspection, checksum-change rejection,
concurrent locking, transactional rollback, and least-privilege permissions
remain unverified against a real database. The historical 2025-2026 competition
requirements must be checked for the actual participation year.

## Backend P1B auth/schema foundation - 2026-10-03

P1B adds Better Auth 1.7.7 database-backed email/password sessions, a protected
safe-identity diagnostic, controlled development provisioning, immutable auth
and Event/EventMember/Task/ActivityEntry migrations, and scoped authorization
helpers. It does not remove the local browser limitations above.

- No frontend login, remote workspace service, server data loading, or demo-to-real migration is implemented. The locked UI remains independent of authentication.
- No Event authoring/bootstrap, assignment/acceptance/status HTTP command, concurrency loop, or real two-user task collaboration is implemented. Those are P1C/later scope.
- Organizer/Member provisioning labels identify controlled accounts, not global auth permissions. Permanent Event memberships and ownership setup are deferred; tests create only isolated rollback fixtures.
- Public sign-up is disabled. The CLI provisions only in development through Better Auth-supported account creation and reports existing accounts without rotating their passwords. It is not an invitation or administration UI.
- Email verification, recovery, social login, MFA, self-service onboarding, and a complete jury-account package are not implemented.
- Active User/session and active EventMember checks are server-side foundations; no generic policy engine or task mutation service exists. Operational-role text grants no permission.
- Composite foreign keys and checks reject invalid relational scope/acceptance, but future transactions must enforce owner/active ORGANIZER consistency, inactive-assignee rejection, open-work deactivation safeguards, atomic version checks, and business update/history writes.
- Activity history rejects UPDATE, DELETE, and TRUNCATE through one narrow database trigger and has no edit API. Future commands still must validate polymorphic targets and atomically append history with business updates. It is not event sourcing or a complete production audit system.
- No CORS plugin or `CLIENT_ORIGIN` is configured because P1B has no browser frontend integration. Only the configured auth base origin is trusted; later separate-origin integration requires an explicit credentialed origin allowlist.
- Cookies are HttpOnly, SameSite=Lax, and Secure for production/HTTPS. HTTP development is local-only; production HTTPS/proxy configuration remains unverified until deployment.
- Better Auth rate limits use memory in one process. Proxy trust, restart behavior, distributed rate limiting, and abuse controls need deployment review.
- RLS is enabled without public policies on auth/business tables to deny direct Supabase public API access. The trusted backend connection currently requires table-owner/bypass capability. Separate least-privilege runtime/migration grants have not been audited or implemented as deployment infrastructure.
- `skipLibCheck` accommodates Better Auth's published `bun:sqlite` type import; application TypeScript remains strict. This does not validate every upstream declaration.
- Database migration/constraint checks and real auth checks are distinct from offline test doubles. Exact executed results belong in [test evidence](TEST_EVIDENCE.md); this limitation register does not assert test passes.
- No production hosting, monitoring, tested restore, account-retention/deletion process, or deployment security certification is delivered by P1B. Destructive database work still requires separate human approval.

The schema uses application-generated UUIDs and Event-local DATE values with
TIMESTAMPTZ audit/auth/activity instants. UUID knowledge does not grant access.
Fictional local demo state is never imported automatically. GPLv3/source,
documentation, test-role account, and online-access requirements remain
**2025–2026 source rules requiring verification for a later competition year**.

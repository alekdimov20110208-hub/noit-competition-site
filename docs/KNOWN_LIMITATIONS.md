# Known Limitations

## Event Management Stage 1 — 2026-10-09

All mandatory technical coverage and final quality checks pass, including fresh
isolated Profile 13/13 groups and 20/20 layouts. Stage 1 is **TECHNICAL PASS**.
Human Acceptance is **PENDING** and
Stage 1 remains **NOT LOCKED**. Earlier stale credentials, infrastructure failures
and Profile timing failures remain historical evidence, not current missing
coverage. The remote intermittency's root cause remains unproven; local Profile
isolation does not claim to fix it. All 112 locked interiors match their original
references under the approved shared-header normalization. No established-account
password change was used for final closure; the disposable fixture/runtime were
independently removed. P4A external provider/inbox setup, physical-device and
formal accessibility certification are separate pending human gates.
Stages 2–7 remain **NOT STARTED**.
Only an Event-name client-side search is provided; no management detail, duplicate,
archive or Clear All Tasks action exists. Existing Create/Edit forms are unchanged.
Physical devices, other engines and formal accessibility validation remain human
checks. See [the Stage 1 report](BUDOGRAPH_EVENT_MANAGEMENT_STAGE_1.md) and
[test evidence](TEST_EVIDENCE.md) for exact executed results and limitations.

## Profile V1 — 2026-10-08

Only display name is editable; email changes/photos remain V2. The nullable image
field is not upload infrastructure and is not rendered. Preferences remain
browser-local; notification delivery settings are unavailable. A lost response
can make a write uncertain; UI explains reload/recovery instead of announcing success.
Better Auth changes the credential before deleting/creating sessions; failure
between those library steps can require signing in again. Same-user exclusion
is per server process; multiple instances need shared concurrency/rate-limit policy.
Long desktop names are ellipsized; full values remain in the Profile field and
accessible text. P4A domain/Resend inbox verification remains NOT RUN.
Physical-device, other browser-engine, password-manager and formal accessibility
validation remain human checks. V2, Event Management stages 2–7 and deployment are unstarted.

## Optional Task due time — 2026-10-08

Task deadlines support optional minute-level Event-local wall-clock time. Events
have a canonical timezone; configured reminders convert the deadline to an instant.
Urgency,
overdue/attention and ordering remain date-based, so an earlier time today does not
make a Task overdue. Date-only Tasks cannot have reminders. Recurrence and calendar
integrations are absent. See [the reminder extension](BUDOGRAPH_TASK_REMINDERS.md).
Physical-device behavior and formal accessibility certification have
not been claimed. See [feature contract](BUDOGRAPH_TASK_DUE_TIME.md).

## P4A boundary — 2026-10-06

Resend delivery, verification and recovery are implemented; actual inbox delivery
is **NOT RUN** pending human domain/DNS/provider setup. Provider acceptance does not
prove inbox arrival. Pending invitations have resend but no persisted delivery log;
resend invalidates old links without extending expiry. Background auth work is not
a durable queue. In-memory limits reset on restart, are per process and share peer
quotas behind proxies. Mail-enabled environments reject unverified sessions;
deliberate local disabled mode preserves controlled account testing. No inaccessible-
inbox support policy, physical-device validation or formal accessibility audit is
claimed. See BUDOGRAPH_P4A.md for complete limits and setup.

The first new P4A test adapter committed a disposable synthetic fixture before its
transaction mapping was corrected to savepoints. The fixture was retained without
destructive cleanup; no existing account was modified. Subsequent P4A fixtures roll
back. Existing browser/concurrency tests retain synthetic fixtures as documented.

## Current P3A + P3B + P3C boundary — 2026-10-06

Event-scoped Change records, explicit affected Tasks, derived current assignees/dates/
statuses, independent response ownership and Organizer create/edit are implemented.
Decision, operational Response and optional Plan B are persisted on Change.
Members read only, even as response owners; expectedVersion and history are atomic.
Canonical Dashboard Operational Changes and deterministic personal Change attention
are connected; Task attention remains independent. Detail/list copy clarifies
coordination ownership, Decision, Response and optional fallback without a lifecycle.
See BUDOGRAPH_P3A.md, BUDOGRAPH_P3B.md and BUDOGRAPH_P3C.md
and TEST_EVIDENCE.md for contracts and actual verification. Earlier phase descriptions
below retain historical limitations superseded by this section.

Automatic fallback execution, resolved/closed lifecycle, response-owner acceptance, Change deletion,
comments, Change notifications, realtime, polling and automatic impact inference are absent.
Task deadlines remain required; DTO support for null dates does not add deadline-free
Task authoring. Dashboard reads refresh on explicit retry, Event switch or reentry;
other clients' changes are not pushed automatically. Lists are unpaginated and
authoring is bounded to 1000 Task IDs.
Drafts live in memory; leaving a form discards them. After an uncertain create response,
check the list before retrying to avoid a duplicate. No write replay is automatic.
P3B activity records added/changed/cleared presence and server author/version;
it does not archive historical full Decision/Response/Plan B prose. The current
aggregate is authoritative. No Decision approvals/voting, independent Response
assignment/status/deadline or fallback execution is provided.
Historical inactive references remain readable; owner selection requires an active
member when saving. Member management/deactivation remains outside this phase.

Cross-browser/physical-device, formal accessibility/security and human usability
validation remain separate. Existing production hosting, least-privilege grants,
mail/recovery, backup/restore and competition-year verification limitations continue.
The production build retains Vite's existing 500 kB chunk advisory; the current
measured size is recorded in TEST_EVIDENCE. Bundle splitting/performance work is separate.

This document records the local prototype boundary and the separate backend
P1A/P1B/P1C backend. Historical phase descriptions remain scoped to those phases;
the current backend limitations are recorded below. Update this record when a
limitation is removed or discovered.

## Current P2C boundary — 2026-10-04

Event-scoped Organizer invitations, pending reads/revocation, existing-account join,
invite-only Better Auth registration and active MEMBER creation are implemented.
Normal Member onboarding no longer needs CLI provisioning or precreated EventMember
rows. Public registration remains closed. Account creation is separate from the
atomic membership/invitation/history transaction; an account can remain after a join
failure and sign in to retry a still-valid invitation.

**OUTBOUND INVITATION EMAIL IMPLEMENTED: NO. DEVELOPMENT INVITE LINK IMPLEMENTED: YES.**
Links are displayed once in a transient Organizer dialog, not persisted or recoverable
from hashes. Lost-link recovery is revoke and recreate. Organizer bootstrapping for
an initially empty deployment remains an explicit infrastructure operation.
Possession of a shared invitation is not a general email-verification system.

**MEMBER REMOVAL NOT YET IMPLEMENTED. ROLE EDITING NOT YET IMPLEMENTED.
ORGANIZER INVITATION/PROMOTION NOT YET IMPLEMENTED. PASSWORD RECOVERY NOT YET IMPLEMENTED.
GENERAL EMAIL VERIFICATION NOT YET IMPLEMENTED. EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED.
TASK DELETE NOT YET IMPLEMENTED. DEPENDENCIES NOT YET IMPLEMENTED.
CHANGES/PLAN B NOT YET IMPLEMENTED. REALTIME NOT IMPLEMENTED.**

No inactive-member restoration, bulk invites, resend/reminder automation, social auth,
MFA, notification center, Templates expansion, Budget or AI was added. Memory rate
limiting needs shared storage before multiple server instances. Production mail,
hosting/proxy/least-privilege grant review and backup/restore remain separate.
Testing uses real Edge/Chromium and emulated viewport sizes; it does not establish
Safari/Firefox/physical-device compatibility or formal accessibility/security certification.
Human P2C product/visual acceptance is still a separate review.

All supplied NOIT rules concern 2025–2026. Verify actual-year eligibility, directions,
GPLv3/licensing, required deliverables, dates, online period, PDF format and rubric
before registration; the internal September deadline is not an official NOIT date.

## Historical P2B boundary — 2026-10-04

Active current-Event Organizers can create and edit real Tasks using the existing
drawer and Event snapshot. Fields are title, optional free-text category/context,
calendar deadline, priority, and optional initial active same-Event assignee.
New Tasks are `not-started` and unaccepted. Editing does not change assignment,
acceptance or lifecycle; the existing responsibility commands remain separate.
Expected-version conflicts require canonical reload and explicit reviewed save;
failed reload disables save. Pending form controls prevent duplicate submission.
Task create/update and append-only activity history are atomic.

**TASK DELETION NOT YET IMPLEMENTED. INVITATIONS NOT YET IMPLEMENTED.
EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED. CHANGES/PLAN B NOT YET IMPLEMENTED.
DEPENDENCIES NOT YET IMPLEMENTED. REALTIME NOT IMPLEMENTED.**
No task archive, duplication, bulk authoring, subtasks, comments, attachments,
notifications, templates, Budget or AI was added. A network response can be lost
after commit: the application refetches but never automatically repeats the write.
Before retrying an uncertain create, review the task list to avoid duplicates.
Production deployment, least-privilege grants, backup/restore, physical-device and
Safari/Firefox verification, human usability acceptance and formal security/
accessibility certification remain separate. NOIT rules supplied are 2025–2026;
all year-dependent eligibility, licensing, deliverables, schedule, online period,
document format and rubric require verification for actual-year participation.

## Historical P2A boundary — 2026-10-03

Event creation/basic editing and explicit Event-scoped navigation extend P1.
Any authenticated active User can create an Event and become its owner/active
ORGANIZER. There is no global Organizer account type. New Events contain no
authored Tasks, sample fixtures or copied development data; they show real empty
Dashboard/Tasks regions and the creator on Team. Dates remain calendar strings.

The switcher uses active accessible memberships and Event IDs in URLs. A URL is
navigation state, never authorization. Event Organizer edits require expectedVersion;
409 loads current details, never replays intent, and requires explicit review/save.
Refetch failure blocks save. Scoped controller revisions/cancellation prevent old
Event data from rendering after switching; no offline cache/polling/realtime exists.

**TASK AUTHORING NOT YET IMPLEMENTED. INVITATIONS NOT YET IMPLEMENTED.
EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED. CHANGES/PLAN B NOT YET IMPLEMENTED.**
There is no ownership transfer, role/member management, public signup, email
verification, recovery, Templates, Budget, AI or activity feed. Archived Events
retain P1 read-only behavior; P2A adds no archival action. List pagination and a
large-Event-count navigation design are future work, not new P2A infrastructure.

Production deployment, least-privilege grant audit and backup/restore remain
separate. Browser evidence uses desktop Edge/Chromium emulation, not human
acceptance, physical devices, Safari/Firefox or formal certification. Supplied
NOIT requirements are for 2025–2026 and need actual-year reverification.

## Historical P1D.3 real workspace boundary — 2026-10-03

**P1D.3 REAL WORKSPACE: PASS. P1 CORE COMPLETE: YES.** This closes the approved P1
scope; it does not implement P2/P3 or establish production readiness.

- Authenticated data mode: **Dashboard REAL, Tasks REAL, Team REAL**. One shared
  cancellable controller owns Event/member/task reads and task commands. There is
  no normal local demo workspace initialization, migration, or failure fallback.
- Initial Event selection remains earliest accessible start date, then UUID. The
  Event stays pinned across page navigation and refetch; removal fails explicitly
  rather than selecting another Event. A full browser reload resolves again.
  Multiple-Event navigation and Event authoring remain P2.
- Team and Team Pressure use only active EventMembers of active Users. Historical
  inactive assignees remain name context on real tasks. Operational role is only
  descriptive; access role remains separate and the server authorizes every request.
- Dashboard preserves existing count/attention/pressure semantics. Timeline uses
  real task deadlines and Event start/end calendar boundaries, not fictional
  milestones. Location, guest and operational Event status have no persisted fields
  in P1; the readout identifies missing additional details rather than inventing them.
- Changes/Plan B persistence is **NOT YET IMPLEMENTED** until P3. Dashboard retains
  the ChangeImpact region with a truthful empty state. Plan B and Templates have
  truthful unconnected states; their legacy fixture pages are not normal runtime sources.
- No activity feed, member mutations, authoring, AI, budget, notifications, polling
  or realtime was added. Failed command refetch labels stale summaries on all core
  pages and requires refresh before further task commands.
- Page navigation shares the loaded snapshot. Reload, focus/visibility, online and
  explicit retry refetch the pinned Event. Clock updates once a minute only recalculate
  Event-calendar timing; they do not poll. There is no offline remote cache.
- Production hosting/proxy verification, recovery, invitations, least-privilege grant
  audit and backup/restore remain outside this stage. Controlled accounts and development
  fixtures do not constitute the final competition jury-account package.
- Browser checks use Edge/Chromium emulation, not physical devices, other engines,
  formal accessibility/security certification or user validation. The supplied NOIT
  rules are for **2025–2026**; eligibility, categories, dates, GPLv3, online availability,
  role accounts, documentation format and scoring need actual-year verification.

## Historical P1D.2B task responsibility boundary — 2026-10-03

- Real Login, server-backed logout, safe current-user bootstrap and a protected application shell are implemented. Authentication identity and the fictional local workspace remain deliberately separate. The historical P1C exclusions below describe that earlier stage.
- Tasks use `RemoteWorkspaceService` for authorized Event/task reads. Dashboard and Team keep the existing LocalDemoWorkspaceService boundary (`useWorkspace`, local reducer/persistence) unchanged. This temporary split is explicit in the Tasks shell. Remote errors and empty results never fall back to fictional tasks or migrate local data.
- Assignment/reassignment/unassignment, Member acceptance/withdrawal and allowed status UI commands are connected through the existing drawer. Server membership controls affordances; backend authorization remains authoritative. Task/Event creation, editing, deletion, invitations, onboarding and activity-feed UI remain excluded.
- Dashboard/Team still link to fictional task IDs. Remote Tasks show their safe unavailable-task notice for those IDs, alongside real Event tasks. Integrating those demo navigation sources is later work; no local drawer fallback is provided.
- Without a switcher, Tasks automatically select the accessible Event with earliest start date, then UUID as a stable tie-breaker. One Event selects automatically; zero shows no active membership. Multiple-Event product navigation remains P2 work. Accessible archived Events remain readable, matching existing P1C policy.
- Assignment candidates come from an authenticated active same-Event member read, projecting only ID, name and operational-role text. Inactive memberships/Users are excluded. Historical inactive assignees remain named in task reads, with their assignment-select option disabled. This is not a remote Team view. Current member ID, access role and archive state come from backend Event discovery.
- Commands send the canonical `expectedVersion`; they never send actor IDs or acceptance timestamps. Confirmed responses and scoped refetch update memory only. A 409 requires review and an explicit new action. Failed refetch blocks writes and labels potential stale state until refresh. Lost responses can mean a committed change; the UI refetches before any explicit retry.
- Remote tasks reload on Tasks entry, refresh, focus/visibility, online, or explicit retry. Full reload clears data; mutation/refetch retains confirmed content where safe. Logout, account change, inaccessible Event and leaving Tasks clear memory and abort requests. No realtime updates, offline cache or silent fallback. An idle foreground view does not poll server data.
- Real task deadlines stay `YYYY-MM-DD`; timestamps use the selected Event timezone. Deadline timing uses the real clock projected into the Event calendar, checked at minute intervals and on focus. The demo reference date remains exclusive to demo pages.
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

- The fictional Dashboard/Team workspace is stored only in `localStorage` for the current browser profile and origin. Authentication and Tasks reads use the PostgreSQL-backed backend. Remote task/session content is never persisted into that local demo workspace.
- Workspace data and UI preferences use separate versioned records: `budograph.workspace.v1` and `budograph.preferences.v1`. This separation preserves the existing workspace schema, but neither record is a production database.
- The local demo stores acceptance in the Phase 1-compatible `Task.acknowledged` boolean without authentication. Remote Tasks map that display field from server-confirmed acceptance with authenticated member/time metadata. Neither mode proves that the person actually reviewed the task, and acceptance is neither completion nor approval.
- Task acceptance and acknowledgement of an operational change are separate interactions even though the compatible internal naming uses acknowledgement language. They must not be interpreted as one shared workflow.
- The local demo has no cloud sync, multi-device continuity, concurrent editing, conflict resolution, server backup, recovery service, or audit history. Remote Tasks now use backend version conflicts and activity history; updates between sessions require explicit refetch. Backup and recovery verification remain unfinished.
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

## In-app reminders V1

Recent notification history is limited to 50 displayed rows; unread count and mark-all cover older rows. Reminders refresh on panel/workspace actions, without realtime/client polling. Worker passes are bounded to 100 eligible candidates with 30 seconds between passes; backlog/lock contention may delay delivery. Missed windows after the deadline are suppressed. DST uses PostgreSQL platform resolution and notification snapshots preserve the original delivery meaning. No push/email/recurrence/custom reminder durations or new calendar integration. Formal accessibility certification and physical-device verification are not claimed. P4A external human setup remains PARTIAL.

The production frontend build still emits Vite's advisory for a single minified chunk above 500 kB (about 534 kB, 148 kB gzip in this phase). Build succeeds; no production latency or performance certification is claimed.

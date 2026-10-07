# Installation, Deployment, and Demonstration Plan

Optional Task due time requires additive migration `0006_task_deadline_time.sql`
before starting the updated backend. Use the existing reviewed migration runner;
no default/backfill, deadline rewrite or destructive operation is needed. The
configured development database is migrated and verified; production application
is a separate deployment action. Date-only existing Tasks remain valid. Demonstrate
Add time → change → remove and linked Change current impact using controlled
accounts. The existing offline/backup plan remains; a failed server save must retain
confirmed data and report the failure. No reminder/notification scheduling is
available. See [feature contract](BUDOGRAPH_TASK_DUE_TIME.md). P4A's external human
gate remains PARTIAL and has not been run in this phase.

P4A adds production-capable email integration; **no deployment was performed**.
Follow [BUDOGRAPH_P4A.md](BUDOGRAPH_P4A.md) for exact human domain/DNS/Resend setup and
server variable names. Copy DNS values from the dashboard; store keys server-side
only. Production requires a verified controlled sender and matching public/auth
HTTPS origins. Existing unverified users prove inbox ownership; no blanket migration
runs. Real inbox testing is NOT RUN. Offline/backup demos retain labelled development
links or recorded evidence and cannot claim offline email delivery.

P3A adds real Event-scoped Changes. Apply `pnpm db:migrate`, verify a no-op rerun,
and restart the backend before demonstrating. Use Changes to record an arrival
change, link two development Tasks, choose a response owner, then edit a Task's
deadline/assignment and refresh Change detail. Use an independent Member session
to show read-only access and switch Events to show isolation. P3B adds authored
Decision, Response and optional Plan B on the same detail. Apply migration 0005;
show separate fields, partial states, refresh persistence and a real two-tab stale
conflict. Change a linked Task deadline/assignee/status and refetch to show live
impact while coordination state and response owner stay independent. Show Member
read-only access even when selected as response owner. No fallback executes
automatically; actual Task changes use existing commands. P3B adds no deployment.
P3C connects Dashboard Operational Changes with no additional migration. Start on
Dashboard, open a real Change, then return after changing its owner, Decision and
Response to show the corresponding personal attention reason progressing/clearing.
Clear only Plan B to demonstrate that its absence alone does not create attention.
Show the same read-only route as a Member response owner and switch Events. Keep
Task attention/responsibility independent throughout this demonstration.
Current contracts are in BUDOGRAPH_P3A.md, BUDOGRAPH_P3B.md and BUDOGRAPH_P3C.md; earlier-phase boundaries
are historical. Keep the existing local-backend/PostgreSQL and recorded-demo backup
plan; no new offline remote cache or production deployment is claimed by P3A.

Current scope: Backend P1A/P1B/P1C, P1D.1/P1D.2A/P1D.2B/P1D.3, P2A, P2B and P2C. Better Auth
login protects Event-scoped workspaces backed by the configured PostgreSQL
(Supabase-hosted development) database. **Dashboard REAL, Tasks REAL, Team REAL.**
They share the same authorized Event, tasks and members; no runtime demo fallback
or local-demo reset exists in the authenticated application. **P2A implements
Event creation/basic editing and switching.** The older frontend Phase 2A/2B
names refer to historical UI work, not this backend authoring phase.

P2C adds invitation-based MEMBER onboarding. Apply `pnpm db:migrate` before starting
the updated backend; do not edit applied migrations or reset the database. Public
signup remains blocked. The existing development bootstrap can establish the initial
Organizer; ordinary new Members use Team invitations without CLI setup.

Outbound mail is **not configured**. Demo with the labelled development link in an
independent browser/profile: existing-user sign-in → explicit join, or new-account
creation → normal sign-in → explicit join. Show the Member in Team/switcher, create
and assign a real Task, and demonstrate explicit acceptance from the Member session.
Do not publish invitation URLs, passwords or cookies in screenshots/evidence. Links
are transient and expire after seven days; prepare fresh invitations before a demo.

Offline backup remains a prepared local backend plus reachable PostgreSQL or a
recorded/redacted demo; this application has no offline data fallback. Hosting must
serve the SPA for direct `/invite/:token` and scoped Event URLs, preserve secure
cookies/trusted origins, disable caching of auth/invitation responses and redact bearer
paths from reverse-proxy/access logs. Do not add a mail provider without separate
deployment configuration. Shared rate limiting, grant review and restore drills remain
deployment work. Run write-verification suites one at a time; SQL constraint fixtures
can lock tables. Browser-created disposable test records are intentionally retained.

## P2A demonstration extension

P2B extends the fresh Event demonstration: open Tasks, create a Task with a
preparation deadline, refresh its canonical deep link, then edit its title/date/
priority. Verify Dashboard and Team use that same real snapshot. In the controlled
two-member Event, create assigned but unaccepted work, accept independently as the
Member, edit a non-assignment field as Organizer, and demonstrate preserved
acceptance. Reassignment clears acceptance; assigning back requires reacceptance.
Prepare this real Event plan in advance for the backup video; authenticated offline
sync is not implemented. Existing recorded/local backup guidance remains separate.

Sign in, choose **Create event**, supply name/start/end/timezone and save. The new
Event opens at `/events/:eventId/dashboard`, has no Tasks and contains the creator
as Organizer on Team. Edit basics, refresh, then switch Dashboard/Tasks/Team back
to the original P1 Event and confirm its data. Sign in independently as the Member
and create a separate Event: Member-in-A / Organizer-in-B is Event-scoped authority,
not a global account type. Never clone/bootstrap demo data into a new Event.

Event editing uses expectedVersion; stale edits load canonical details and require
explicit save, with failed-refetch recovery. Production SPA fallback must also
support `/events/new` and `/events/:eventId/{dashboard,tasks,team,edit}` while
keeping all `/api` requests outside fallback and uncached. No hosting verification
or offline authenticated package is implied by this local implementation.

## Historical P1D.3 development demonstration

Follow [backend development](BACKEND_DEVELOPMENT.md) for ignored local
configuration, reviewed migrations, controlled development Organizer/Member
account provisioning and explicit Event bootstrap. Do not rerun setup to reset
task state. Account credentials belong only in ignored configuration or the
approved private handoff, never this document. Start both servers as described
below, then open `http://127.0.0.1:5173/login`.

1. Sign in with the controlled Organizer through Better Auth. Dashboard displays
   stored Event identity/dates/timezone and real task totals, attention, preparation
   and Team pressure. Missing location/guest/status fields remain honestly absent.
2. Open a real task from Dashboard, Tasks or Team. Assign responsibility using
   active Event membership, change status, and inspect confirmed data after refresh.
3. Assign the controlled task to the current Organizer. That Organizer can Accept
   and Withdraw their own responsibility. Assign it to Member: the Organizer can
   no longer accept/withdraw for Member. In an independent browser session, Member
   can accept their current assignment normally. Access role governs authorization;
   current assignment governs acceptance eligibility. Backend checks every command.
4. Verify acceptance, assignment and lifecycle remain independent. Reassignment or
   unassignment clears current acceptance; assigning back never restores it. A stale
   version returns 409 and requires review/refetch, never an automatic replay.
5. Navigate Dashboard/Tasks/Team, check real links and Back/Forward, then sign out.
   Refresh/focus/visibility/online revalidate; there is no polling or offline cache.

Legacy URLs resolve an accessible Event then replace with its Event-scoped route;
the compact shell switcher changes context explicitly. **TASK AUTHORING NOT YET
IMPLEMENTED. INVITATIONS NOT YET IMPLEMENTED. EVENT ARCHIVE/DELETE NOT YET
IMPLEMENTED. CHANGES/PLAN B NOT YET IMPLEMENTED.** There is no public signup
or recovery UI; the Plan B page/region has no fictional records.
Templates are unconnected; Budget and AI are excluded. These are scope boundaries,
not partially working P2 features. Preserve the locked Dashboard/Tasks/Team UI.

The task-action verifier uses explicit UI commands, preserves ActivityEntry history
and finishes the controlled task assigned to Member, unaccepted, `not-started`.
This is a documented development state, not a database reset. Record any manually
chosen demo end state; never delete history or reset the database to satisfy a test.

Production must serve frontend and `/api` at the configured HTTPS auth origin,
proxy API requests to Fastify, exclude `/api` from SPA fallback, preserve `/login`
and all existing History API paths, and never cache `/api/me` identity responses.
Production hosting/reverse proxy and online availability are not yet verified.

The historical frontend-only offline plan cannot verify real authentication.
An offline authenticated demonstration requires a separately prepared and
verified local PostgreSQL/backend setup; that package is not implemented here.
Use a previously captured walkthrough/screenshots as the backup explanation,
clearly labelled recorded evidence rather than a live authenticated demo.
Existing cached browser resources/sessions are not a reliable offline backup.
No authentication bypass or fake session fallback is added. Keep the existing
backup materials credential-free and verify actual-year NOIT requirements
before the competition package is finalized.

## Local installation

Prerequisites are a compatible Node.js installation and pnpm. The repository
declares pnpm `11.9.0`.

```sh
pnpm install
pnpm server:dev
```

In a second terminal:

```sh
pnpm dev
```

The backend requires the configured database and ignored secrets; Vite alone cannot
authenticate or load the real workspace. Dev/preview proxy `/api` on strict port
5173 to backend port 3001. No secret belongs in a frontend `VITE_*` setting.

## Local quality and production commands

Run the complete verification suite from the repository root:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm server:typecheck
pnpm server:test
pnpm server:build
git diff --check
```

For the approved development database, run the opt-in rollback-only integration
suite with `RUN_DATABASE_INTEGRATION=1` as documented in the backend guide. A default
skip is not PostgreSQL verification. Run browser suites serially with the backend,
Vite, controlled inputs and existing Playwright/browser runtime available:

```sh
pnpm test:browser:workspace
pnpm test:browser:task-actions
pnpm test:browser:auth
pnpm test:browser:tasks
```

The workspace verifier compares real reads with SQL and uses any visible Dashboard
task link. If a completed-only state offers no link, a labelled isolated transport
fixture exercises navigation with a loaded task ID without business writes. Its
no-attention/no-link regressions remain separate from real SQL evidence. Task-action
verification intentionally appends development history; auth/read suites revoke
only their own sessions. Do not run concurrent suites against the controlled task.
Repeat Dashboard/Tasks/Team visual comparisons at desktop/narrow widths in BG/EN
and light/dark, including the newly authorized Organizer acceptance controls.

Use `pnpm format` when formatting source and documentation intentionally. To
inspect the generated production bundle locally, run:

```sh
pnpm preview
```

These are the current project commands, not claims that any particular run
passed. Record command output, date, environment, and failures honestly in the
project evidence after each actual verification run.

## Hosting and route requirements

The generated `dist/` directory is build output and is not committed. A future
static host must:

1. serve the application over HTTPS where it is public;
2. return `index.html` as the single-page-application fallback for `/tasks`,
   `/team`, `/changes`, and `/templates`;
3. retain query strings such as `/tasks?task=<task-id>` through direct requests
   and redirects; and
4. use suitable cache rules so a new HTML entry point does not reference
   unavailable older assets.

Task navigation uses the browser History API without a routing library. The
application parses the pathname and `task` query on initial load and on browser
Back/Forward events. A valid ID reopens its task after refresh; an invalid ID
leaves the user on Tasks with a localized warning and a safe return action.
Task details opened inside the application receive a scoped History-state
marker, allowing Close or `Escape` to return to the originating page. A direct
task URL without that marker replaces the URL with the safe Tasks list instead.

No public deployment, uptime promise, monitoring, tested server backup, or disaster
recovery service is delivered by P1. Hosting and
online-availability requirements must be selected and verified against the
rules for the actual competition year.

## Historical frontend-only data and preferences

The following local-workspace behavior describes the isolated historical prototype,
not authenticated P1. Only language/theme preferences remain browser-local in P1;
auth/session tokens and real workspace records are not stored there.

- `budograph.workspace.v1` remains the versioned Phase 1-compatible fictional
  workspace record. Its task boolean remains `acknowledged`; the Phase 2B task
  UI interprets that value as Accepted/Not accepted so existing saved
  workspaces do not need a migration.
- `budograph.preferences.v1` separately stores a manually selected `bg` or `en`
  language and `system`, `light`, or `dark` theme.
- Without a stored language, a primary locale beginning with `bg` selects
  Bulgarian; all other locales select English.
- Without a stored theme, BudoGraph uses System. System mode listens for live
  `prefers-color-scheme` changes; Light and Dark remain explicit.
- Safe parsing falls back when stored preference or workspace data is missing
  or unusable. Browser-storage read or write failures are surfaced in the
  interface.

This persistence is local to one browser profile and origin. It is not a
database, encrypted store, synchronization layer, audit trail, or backup.

The task acceptance value is not a completion or approval record and is not
authenticated. Acknowledging a change in Changes & Plan B remains a different
interaction and should be demonstrated with its distinct wording.

## Historical frontend-only demonstration data (not current P1)

The snapshot/reset instructions below are preserved historical context. They cannot
be followed in the authenticated application; Templates has no reset control and
`?fixture=stress` does not activate a local workspace in the current App.

Phase 2B.2.3B uses a deterministic snapshot: **7 September 2026**, preparing for
**18–20 September 2026**. A BG/EN notice appears on every page. All relative/task
timing calculations use that reference, not the presentation machine's current
date. Date-only calculations preserve the local calendar day; timestamp display
uses `Europe/Sofia`, and task edits use a fixed fictional noon timestamp.
Real-calendar helper behavior remains independently tested and is not replaced
by demo-specific arithmetic. Manual milestone lifecycle is unchanged.

Valid old `budograph.workspace.v1` records remain untouched on startup; old
deadlines can therefore remain visible until an explicit reset. There is no
storage migration or silent rewrite when the actual date changes. Do not erase
someone's local work just to prepare a demo: use an intended demo browser/profile
and the existing reset confirmation. Preferences remain in their separate v1 key.

- There are no accounts, roles, credentials, passwords, permissions, or test
  account flows.
- The prototype opens directly into one clearly labelled fictional event.
- All visible people, venue details, tasks, and incidents are synthetic.
- Use **Templates → Reset demo event → Reset local data** before a
  presentation when a clean workspace scenario is needed. This does not reset
  the saved language or theme.
- After reset, verify 16 tasks, 3 completed (19%), 1 blocked, 1 overdue,
  7 attention items and useful Today/Near/Later Timeline content. The blocked
  arrival task is due Today; Lina and Anton have distinct risk signals while
  three teammates have no pressure flag. Quiet is not spare capacity.
- Demonstrate **Next checkpoint in Dashboard ChangeImpact**, followed by the
  full response in Changes & Plan B. The airline change is reported on the
  snapshot morning and affects the Friday 18 September arrival, not an August
  incident presented as current.
- Never enter private interview details or real personal, participant, payment,
  health, travel, or safeguarding information.

## Historical frontend Phase 2B browser verification checklist

Perform and record this checklist; the checklist itself is not evidence that a
result passed:

During local development only, append `?fixture=stress` to any application path
(for example, `/tasks?fixture=stress`) to load the synthetic 44-task,
18-milestone long-content workspace. This mode bypasses workspace persistence
and is disabled in production builds. It is appropriate for recorded stress-test
evidence, but it must not be presented as real user/event data or as a
production feature.

1. Verify the Dashboard, Tasks, Team, Changes & Plan B, and Templates at viewport
   widths of 320, 327, 360, 390, 768, 1080, and 1440 pixels.
2. At every width, inspect long event and task names, long Bulgarian content,
   multiple badges, many milestones, action controls, and task-detail content.
3. Confirm there is no application-content horizontal scrolling and that
   dates, headings, badges, descriptions, controls, desktop navigation, and
   mobile navigation remain usable.
4. With clean preference storage, simulate a Bulgarian device locale and a
   non-Bulgarian locale. Then choose each language manually, refresh, and
   confirm persistence.
5. Select System, Light, and Dark. In System, change the operating-system theme
   while the application is open and confirm a live update. Refresh each saved
   selection and inspect text, borders, status indicators, disabled controls,
   and focus rings for contrast.
6. Open a Dashboard attention item, deadline, affected task, and checkpoint.
   Confirm each URL targets the intended task, browser Back/Forward works, and
   refresh reopens the detail.
7. Test missing, empty, duplicate, encoded, unknown, and wrong-event task IDs.
   Confirm they do not crash the page or open a stale/different task.
8. Update task and change state, refresh, switch language and theme, and confirm
   workspace compatibility and separate preference persistence.
9. Check keyboard navigation, the skip link, visible focus, `Escape` task-detail
   closing, screen-reader labels, browser console output, and the fictional-data
   boundary.
10. Confirm the Dashboard reads in the intended sequence: `EventOverview`,
    `OperationalFocus`, `PreparationTimeline`, `ChangeImpact`, and
    `TeamPressure`. Check that task progress is described as a completion ratio,
    not as a safety or go/no-go assessment.
11. Inspect both light and dark themes for the semantic roles: navy structure,
    burgundy decisions/selected action, gold time/stages, red genuine risk,
    green completion, and blue active/info. Confirm that state is also conveyed
    by text, icons, and structure.
12. Confirm operational, context, and critical surfaces remain visually
    distinct; critical treatment must be rare and reserved for real blockers or
    serious risk.
13. Mark a task Accepted and Not accepted, refresh, and confirm the compatible
    `acknowledged` value persists. Separately acknowledge a change and confirm
    that neither interaction is presented as task completion or approval.

### Historical frontend Phase 2B.2 Tasks checklist

Record actual results rather than checking these items by assumption:

1. Confirm the standard event renders 16 tasks and the development stress
   fixture renders 44 without horizontal overflow or hidden final rows.
2. Search localized title, context, category, and owner text. Exercise status,
   owner, and category individually and in combination; verify live counts,
   zero-result recovery, Clear, and owner grouping.
3. Select task-row whitespace and the title link. Confirm both open the canonical
   `/tasks?task=<encoded-id>` URL while preserving a real link target and visible
   focus.
4. Verify direct load, refresh, Back, Forward, invalid/wrong-event IDs, Close,
   `Escape`, and backdrop close. Confirm focus enters the drawer, remains trapped
   while tabbing, and returns to the originating task link when it is still in
   the filtered result.
5. In the drawer, verify identity/context, owner plus Accepted, progress status
   plus deadline/overdue, relationships, and metadata remain distinct. Change
   status and Accepted independently, refresh on a disposable local origin, and
   confirm one does not change the other.
6. Inspect 320, 327, 360, 390, 768, 1080, and 1440 pixels with both Bulgarian and
   English represented, Light and Dark represented, and stress data where it
   pressures long titles or owner names. Measure `scrollWidth` as well as visible
   scrollbars because the shell intentionally suppresses page-level horizontal
   overflow.
7. At narrow widths, verify title, status, owner, deadline/overdue, and Accepted
   remain in the purpose-built summary; the final row has more trailing space
   than the fixed bottom navigation; and every drawer control and final metadata
   section can be reached with safe-area padding.
8. Inspect the locked Dashboard and compatible Team, Changes & Plan B, and
   Templates pages for visible regression, then record application console
   warnings/errors from the final development and production-preview sources.

## Historical frontend-only offline checklist (not current P1)

This is a preparation plan, not a claim that an offline package has been tested
or accepted on a competition machine.

Before the presentation:

1. Verify the current source commit and retain the exact `pnpm-lock.yaml`.
2. On the presentation computer, install dependencies while network access is
   available and run the full quality and production commands above.
3. Disconnect networking and verify both `pnpm dev` and `pnpm preview`, all five
   routes, exact task links, Back/Forward and refresh, both languages, all three
   theme preferences, reset, and local persistence.
4. Repeat the responsive checklist on the actual presentation display and at
   least one narrow mobile viewport.
5. Keep a second tested copy of the GPLv3-licensed source, lockfile, installed
   dependency store, license notices, and production build on encrypted
   removable media where permitted.
6. Keep a second prepared laptop where permitted, plus non-interactive screen
   captures for explanation if live interaction fails. Captures are a
   presentation fallback, not evidence that the application is running.
7. Rehearse a clean reset and the critical fictional change scenario without
   entering real personal data.

If the application or a modified version is distributed, preserve the
`GPL-3.0-only` license and provide corresponding source and notices as required
by GPLv3. Third-party dependencies retain their recorded licenses.

The available NOIT regulation is only for the **2025–2026 competition year**
and must be treated as historical. Recheck the official rules for the actual
year before registration, submission, deployment, or presentation, especially
dates, categories, procedures, required documents and formats, media rules,
online-availability windows, declarations, and test-account requirements.

## Historical frontend Phase 2A and Phase 2B exclusions

Phase 2A does not include a backend, database, authentication, real accounts,
roles, permissions, AI, budget management, Kanban, calendar, Gantt, external
integrations, participant registration, payments, production notifications,
monitoring, or production hosting. Phase 2B.1 is limited to visual and
information-hierarchy refinement; Phase 2B.2 is limited to the existing Tasks
experience. Neither removes any exclusion above. The checklist is not
product-market validation or proof of usability.

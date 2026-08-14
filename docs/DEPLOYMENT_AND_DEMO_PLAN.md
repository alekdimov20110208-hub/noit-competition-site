# Installation, Deployment, and Demonstration Plan

Phase 2A extended the existing Phase 1 local prototype with Bulgarian/English
localization, light/dark/system preferences, responsive behavior, and exact task
URLs. Phase 2B.1 refines the same local prototype's visual identity and
information hierarchy. Phase 2B.2 redesigns the Tasks workspace as a dense
responsibility register with compact filters and a primary editing drawer. It
does not alter the locked Dashboard or introduce a backend, account system, new
feature area, or production service.

## Local installation

Prerequisites are a compatible Node.js installation and pnpm. The repository
declares pnpm `11.9.0`.

```sh
pnpm install
pnpm dev
```

Vite prints the local URL. BudoGraph has no database, server configuration,
secret, account, or required environment file in Phase 2A, Phase 2B.1, or Phase
2B.2.

## Local quality and production commands

Run the complete verification suite from the repository root:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

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

No public deployment, uptime promise, monitoring, server backup, or disaster
recovery service is part of Phase 2A, Phase 2B.1, or Phase 2B.2. Hosting and
online-availability requirements must be selected and verified against the
rules for the actual competition year.

## Browser-local data and preferences

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

## Demonstration data and accounts

- There are no accounts, roles, credentials, passwords, permissions, or test
  account flows.
- The prototype opens directly into one clearly labelled fictional event.
- All visible people, venue details, tasks, and incidents are synthetic.
- Use **Templates → Reset demo event → Reset local data** before a
  presentation when a clean workspace scenario is needed. This does not reset
  the saved language or theme.
- Never enter private interview details or real personal, participant, payment,
  health, travel, or safeguarding information.

## Phase 2B browser verification checklist

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

### Phase 2B.2 Tasks checklist

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

## Offline and backup presentation plan

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

## Intentional Phase 2A and Phase 2B exclusions

Phase 2A does not include a backend, database, authentication, real accounts,
roles, permissions, AI, budget management, Kanban, calendar, Gantt, external
integrations, participant registration, payments, production notifications,
monitoring, or production hosting. Phase 2B.1 is limited to visual and
information-hierarchy refinement; Phase 2B.2 is limited to the existing Tasks
experience. Neither removes any exclusion above. The checklist is not
product-market validation or proof of usability.

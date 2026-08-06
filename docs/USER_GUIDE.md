# BudoGraph Phase 2A User Guide

Phase 2A refines the existing Phase 1 competition MVP; it does not replace its
workspace model or fictional demonstration scenario. BudoGraph remains a local
organizer prototype, not a service for real participant or operational data.

## Start the workspace

From the repository root, install dependencies once and start the development
server:

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. No account is required.

## Language

Use the compact Bulgarian/English control in the upper-right application
header. Its short labels are **BG**/**EN** in English and **БГ**/**EN** in
Bulgarian. It is available on every page on desktop and mobile.

- On a first visit with no saved preference, BudoGraph checks the primary
  browser/device locale. A locale beginning with `bg` selects Bulgarian;
  every other locale selects English.
- Selecting Bulgarian or English saves that choice for future visits in the
  same browser profile and origin. The saved choice takes priority over later
  device locale changes.
- Interface text, dates, relative dates, ranges, numbers, and percentages use
  the selected locale. Fictional personal names and the BudoGraph product name
  remain unchanged.

If browser storage is unavailable, the interface still works with the safe
fallback language, but it displays a notice because the preference cannot be
saved.

## Theme

Use the three compact theme controls beside the language control:

- **System** follows the operating-system light/dark preference. It is the
  default when no theme preference has been saved and updates live when the
  device preference changes.
- **Light** keeps the designed light palette regardless of the device setting.
- **Dark** keeps the designed dark palette regardless of the device setting.

Any manual selection, including **System**, is saved for future visits in the
same browser profile and origin. The page applies the saved or system-resolved
theme before the React interface loads where the browser permits it, reducing
an incorrect-theme flash.

## Dashboard

The Dashboard is organized for a quick operational scan:

- **Event readiness** is the number of completed event tasks divided by the
  total number of event tasks. It is not a subjective event-quality score.
- **Operational summary** separates completed, active, and blocked tasks.
  Active means not started or in progress. Overdue is a risk flag that can
  overlap active or blocked work, so it is not added to those status totals.
- **Attention** states the next required action for blocked, overdue, critical,
  or unacknowledged work.
- **Upcoming deadlines** show relative timing, calendar date, owner, and task
  status.
- **Changes** connect an operational change to affected areas and tasks, the
  response status, current response, and the next task checkpoint supported by
  the data. Changes are ordered by report time, including resolved history.
- **Workload** distinguishes all assigned work from completed, active, blocked,
  overdue, and at-risk work for each fictional team member. A concise flag
  identifies blocked, overdue, or high active load; the high-load comparison
  begins at four active tasks and is not a capacity guarantee.
- **Long secondary sections** show a compact preview. Additional changes and
  team members can be expanded into bounded scrolling continuations.
- **Milestones** follow chronological order. When there are more than six,
  expand or collapse the remaining milestones with the section control.

Selecting a task in Attention, Upcoming deadlines, or an affected-work or
checkpoint entry opens that exact task rather than the general task list.

## Task links and navigation

An exact task uses this URL form:

```text
/tasks?task=<task-id>
```

- Dashboard task actions update the URL and open the matching task detail.
- Browser Back and Forward restore the corresponding application location.
- Refreshing a valid task URL reopens that task from saved or fictional
  workspace data.
- An absent, empty, malformed, or duplicate task query leaves the normal Tasks
  list open. An unknown or wrong-event task ID shows a localized notice and an
  action to return to that list. Neither case crashes the interface or opens a
  stale or different task.
- Closing task details, including with `Escape`, returns to the originating
  in-app page when the detail was opened inside BudoGraph. A directly loaded
  detail without an in-app history entry falls back to the Tasks list.

Task IDs are stable workspace identifiers. Do not edit a copied task ID or use
one from a different event and expect it to resolve.

## Main views

- **Dashboard** summarizes readiness, task state, attention, deadlines,
  operational changes, workload, and milestones.
- **Tasks** filters work by status or owner. Use **Group by owner** for an
  ownership view. Update a status, acknowledge work, or select a task title to
  inspect its context and dependencies.
- **Team** shows roles, comparable workload counts, and assigned-task details
  for fictional team members.
- **Changes & Plan B** connects a change to affected work. Update its response
  state, acknowledge it, and treat any scenario-specific escalation instruction
  as guidance for communication outside BudoGraph.
- **Templates** previews the fictional seminar preparation structure.
  **Reset demo event** opens a confirmation before replacing saved workspace
  changes with the fictional seed.

## Saved local state

Workspace interactions and interface preferences are stored separately in
browser `localStorage`:

- `budograph.workspace.v1` preserves the Phase 1 workspace format and stores
  supported task and change interactions.
- `budograph.preferences.v1` stores an optional language and theme preference.

Both are limited to the current browser profile and local origin. Clearing site
data, changing browser or origin, or using private browsing can remove them.
Resetting the demo event replaces workspace data but does not reset the
language or theme; clearing all site storage resets both.

Do not enter real names, contact details, private event information, payment or
health information, interview content, passwords, or other sensitive data.
Local storage is not an encrypted database.

## Keyboard and small-screen use

Use `Tab` and `Shift+Tab` to move through links, buttons, filters, and status
controls; use `Enter` or `Space` to activate buttons; and use `Escape` to close
task details. A skip link appears when focused at the start of the page. Visible
focus indicators and accessible labels support keyboard and screen-reader use.

On small screens, primary navigation moves to the bottom of the viewport while
the language and theme controls remain in the header. Long titles, descriptions,
names, dates, and badges are intended to wrap; task content takes priority over
secondary metadata.

## Intentional Phase 2A boundary

Phase 2A does not add a backend, database, authentication, real user accounts,
roles or permissions, AI, budget management, Kanban, calendar, or Gantt views.
It also does not add synchronization, production notifications, participant
registration, payments, or document storage.

All included events, people, venue details, tasks, and changes are fictional.
The source code is licensed under GNU GPL version 3 only (`GPL-3.0-only`);
third-party assets and dependencies retain the licenses recorded in the
repository license register.

The available NOIT regulation covers the **2025–2026 competition year** and is
historical. Before using BudoGraph for a later competition year, reverify the
official rules, dates, category wording, procedures, deliverables, formats,
online-availability periods, declarations, and test-account requirements.

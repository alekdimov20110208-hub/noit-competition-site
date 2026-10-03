# BudoGraph User Guide

## Create, switch and edit Events (P2A)

After signing in, use **Create event** in the shell or the first-event empty state.
Enter a name (1–200 characters), start/end calendar dates, and the region/city's
timezone. End must be on or after start. The browser timezone is only an editable
initial suggestion; the server validates your choice. Saving opens the new Event's
Dashboard without a page reload. You are its owner and Organizer, even if you are
a Member in another Event. Team contains your real membership; Tasks are empty.

Use **Switch event** in the sidebar (desktop) or header (mobile/tablet) to choose
an accessible Event. Keyboard users can use the native select's arrows/typeahead.
Dashboard, Tasks and Team retain their page when switching. An open task detail
returns to the selected Event's Tasks list. Refresh and browser history keep Event
context in `/events/:eventId/dashboard`, `/events/:eventId/tasks` and
`/events/:eventId/team`; sharing a URL does not give its recipient permission.

An Organizer of the current Event can use **Edit event** to change only its name,
dates and timezone. A Member has no actionable edit control for that Event.
If details changed elsewhere, the latest details appear with an explanation;
review them before choosing **Save event** again. Failed conflict refresh blocks
saving; choose **Load latest details**. Errors preserve a safe retry path and never
show fictional data. Switching away discards an unsaved form; no automatic save exists.

**TASK AUTHORING NOT YET IMPLEMENTED. INVITATIONS NOT YET IMPLEMENTED.
EVENT ARCHIVE/DELETE NOT YET IMPLEMENTED. CHANGES/PLAN B NOT YET IMPLEMENTED.**
No additional setup/bootstrap script is needed to create a normal Event. The P1
development Event remains separate for existing task responsibility demonstrations.

## Sign in and sign out (P1D.1)

Open `/login` and enter the email and password of your provided account. There
is no public signup or password-recovery flow. If a protected page was opened
first, successful sign-in returns to that page. A session check runs before the
workspace appears and refresh preserves a valid session.

On desktop, your account name and Sign out are at the bottom of the sidebar. On
tablet/mobile, open the BudoGraph wordmark menu in the header and choose Sign out.
Successful logout ends the server session and returns to Login. If logout cannot
be confirmed, retry it. A session that has ended returns to Login at the next
session check. Server-unavailable errors show a safe retry message.

Your account identity, Dashboard, Tasks and Team reads are real. All three pages
share the same authorized Event and PostgreSQL tasks/members. Loading, empty results and retryable errors are
explicit; a server failure never replaces records with fictional data. A legacy
workspace URL resolves an accessible Event and replaces itself with its scoped URL.
The P2A switcher then chooses Event context explicitly. Dates use the Event calendar and real current day.
An expired workspace-read or action session returns to Login.

Dashboard shows the stored Event name, dates and timezone, existing task-completion
and lifecycle totals, deterministic attention items, task deadlines and Event date
boundaries, and the existing Team pressure flags. Location, guest and Event status
are not stored; missing details are identified without invented values. Progress
counts completed tasks; it does not certify Event readiness or safety.

Team lists active Event participants with their descriptive operational roles.
Select a person to inspect their real assigned tasks, acceptance and existing
deadline/blocker signals. Role text does not grant permissions. Task links from
Dashboard and Team open the same real Tasks drawer; closing it returns to the
origin and preserves focus/history. Historical inactive assignees can remain named
on Tasks without appearing as active Team members.

Changes/Plan B persistence is **NOT YET IMPLEMENTED**. The region and Plan B page
show a restrained absence of saved responses. Templates are also unconnected;
neither page displays fictional records in the authenticated workspace.

## Real task responsibility actions (P1D.2B)

Open a task row to use its existing detail drawer:

- Organizer: choose a real active participant in **Assign responsibility**. Choose
  another participant to reassign, or **Unassigned** to remove assignment. A changed
  assignment clears acceptance, including when assigning back to a previous owner.
- Current assignee (Organizer or Member): choose **Accept responsibility**. After confirmation, **Accepted**
  appears in the drawer and register. Use **Withdraw acceptance** to clear acceptance
  while keeping the task assigned to you. An Organizer can accept or withdraw only
  their own assigned responsibility, never on another participant's behalf.
  Access role controls authorization; current assignment determines acceptance
  eligibility. Other participants do not see acceptance actions for this task.
- Organizer or assigned Member: use **Current status** for Not started, In progress,
  Blocked or Completed. Status and responsibility acceptance are independent.

Controls disable while saving and refreshing. The page shows confirmed server data.
If the task changed elsewhere, a short conflict message appears with the refreshed
state. Review it and perform the action again if still needed. If refresh fails,
the display may be stale and further actions remain disabled; choose **Refresh task**.
The refresh action remains available after closing the drawer or opening another task.
Other errors explain the problem without showing internal server details.

There is no realtime synchronization or polling. Refresh the browser, revisit
Tasks, or refocus the page to see another user's changes. Archived Events remain
readable without action controls. Keyboard users can Tab to the assignment select,
use arrow keys for member choices, and use Enter/arrow/Home/End keys in the status
listbox. Dashboard and Team use the same refreshed server data.

An old bookmarked fictional task ID shows an unavailable-task notice. Use the
current real links instead. The local prototype descriptions below are historical
and apply only to explicitly isolated demo/test fixtures, not the authenticated application.

Phase 2A established the localization, theme, responsive, and navigation
foundation for the existing Phase 1 competition MVP. Phase 2B.1 refines its
visual identity and information hierarchy without replacing the workspace model
or fictional demonstration scenario. Phase 2B.2 redesigns the Tasks workspace
within that approved visual direction. BudoGraph remains a local organizer
prototype, not a service for real participant or operational data.

## Start the workspace

From the repository root, install dependencies once and start the development
server:

```sh
pnpm install
pnpm server:dev
```

In a second terminal:

```sh
pnpm dev
```

Open `http://127.0.0.1:5173` and sign in using your controlled development account.
The backend requires the ignored configuration described in the backend guide.

## Demonstration date

The notice **Demo snapshot · 7 Sept 2026** / **Демо състояние · 7.09.2026 г.**
identifies fictional preparation for the seminar on **18–20 September 2026**.
This is an editable local demonstration, not the real current day. Today,
relative dates, overdue, attention and team risk are evaluated as of 7 September
regardless of when the application is opened. Reported/updated times use Varna
time (`Europe/Sofia`). Task edits are simulated at noon on the snapshot date;
the displayed update time is not a real-world audit trail.

After an explicit reset, the arrival confirmation is blocked and due Today;
the accessibility check is overdue; transfer, hotel and safety preparation are
Near (1–7 days); the check-in kit, signage, sound check and final walk-through
are Later (more than 7 days). Completed work is not overdue. Milestone statuses
are separately persisted planning decisions, not derived task statuses.

Existing saved workspaces are preserved, including older fictional dates and
your task/change edits. To load this refreshed scenario, explicitly use
**Templates → Reset demo event → Reset local data**. Simply opening the app,
changing the real clock or switching language never replaces valid saved data.

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

The two palettes share semantic roles: navy gives the application structure;
burgundy identifies decisions, selected action, and the primary action; gold
marks time and event stages; red is reserved for genuine blockers or serious
risk; green marks confirmed completion; and blue marks an active process or
neutral information. Labels and icons remain authoritative, so do not interpret
color alone.

BudoGraph also distinguishes three kinds of surface. An **operational surface**
is dense and actionable, a **context surface** quietly explains event or team
context, and a **critical surface** is reserved for a blocker or serious risk.

## Dashboard

The Dashboard is organized in one vertical decision sequence:

1. **EventOverview** establishes the current event, task progress, and the task
   state formula. Progress is completed event tasks divided by total event
   tasks. It is not a safety, quality, readiness-certification, or go/no-go
   score. Completed, active, and blocked make up the total; overdue is an
   overlapping timing-risk flag.
2. **OperationalFocus** shows open work that is blocked, overdue, not accepted,
   or Critical with a Today/Near deadline. Critical Later work does not qualify
   on priority alone. Multiple reasons remain visible. Five tasks are initially
   shown; Show more reveals the remainder.
3. **PreparationTimeline** combines upcoming tasks and milestones into a
   chronological preparation view. Its task entries show timing, owner, and
   status.
4. **ChangeImpact** shows active operational changes and connects each change to
   its affected areas, affected-task count, response state, current response,
   and supported checkpoint. Resolved history is not treated as active impact.
5. **TeamPressure** prioritizes members with blocked, overdue, or high active
   load, while quieter team members remain secondary. The high-load comparison
   begins at four active tasks and is not a capacity guarantee.

The reset snapshot has 7 attention tasks and 12 Today/Near/Later task entries
in the Timeline, with bounded previews. Team Pressure identifies Lina's overdue
accessibility check and Anton's blocked arrival confirmation. The other three
people have work but no pressure flag; this does not mean spare capacity.
In Dashboard ChangeImpact, **Next checkpoint** is the arrival confirmation due
Today. Changes & Plan B contains the full change/response and affected-task view.

Selecting a task in OperationalFocus or PreparationTimeline, or selecting the
next checkpoint in ChangeImpact, opens that exact task rather than the general
task list.

## Tasks operational workspace

The Tasks page is a responsibility register rather than a set of isolated task
cards. The compact header shows total, active, blocked, and overdue counts.
Overdue is a timing flag that may overlap an active or blocked task; it is not a
fifth progress status.

Use the toolbar to narrow the current event's work:

- **Search tasks** matches the localized task title, context, category, or
  owner name.
- **All statuses**, **All owners**, and **All categories** open their respective
  filters. Any combination may be active at the same time.
- **Group by owner** reorganizes the current result without changing or hiding
  its tasks.
- The live count reports visible tasks against the event total. **Clear** resets
  search, status, owner, and category filters; the owner grouping is a separate
  view choice.

Each desktop row emphasizes the title and true progress status, followed by
owner, deadline, category, important/critical priority, and overdue timing.
Accepted/Not accepted appears quietly under the owner because it describes
responsibility acknowledgement, not progress. Select anywhere in the row's
non-control area or activate its task link to open the exact drawer URL.

The drawer is the primary task detail and editing surface:

1. **Identity** shows category, title, current status, timing/priority signals,
   and the existing task context.
2. **Responsibility & acceptance** shows the read-only owner and role, explains
   Accepted/Not accepted, and provides the supported acceptance toggle.
3. **Progress & timing** provides the supported status selector while keeping
   deadline, priority, and overdue guidance distinct.
4. **Operational context** shows existing blocked-by and consequence data when
   present.
5. **Task metadata** shows the read-only category and last-updated time.

Owner, deadline, priority, context, relationships, and timestamps are read-only
because the local prototype does not implement persistence actions for those
fields. Do not interpret their display as a complete editing workflow.

## Task links and navigation

An exact task uses this URL form:

```text
/tasks?task=<task-id>
```

- Dashboard actions and Tasks rows update the URL and open the matching task
  detail.
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
- **Tasks** provides localized search, combined status/owner/category filters,
  optional owner grouping, dense responsibility rows, and the primary task
  detail/editing drawer described above.
- **Team** is a responsibility workspace with a compact roster and selected
  person's work. It shows factual task counts and attention reasons for the
  fictional seminar, without capacity or performance ratings.
- **Changes & Plan B** connects a change to affected work. Update its response
  state, acknowledge it, and treat any scenario-specific escalation instruction
  as guidance for communication outside BudoGraph.
- **Templates** previews the fictional seminar preparation structure.
  **Reset demo event** opens a confirmation before replacing saved workspace
  changes with the fictional seed.

## Team responsibility workspace

The roster puts people with blocked or overdue work first, followed by other
work needing attention, then open work without attention, then people with no
open work. This is an inspection order for the organizer, not a rating of people.
A fresh visit selects the first person in that order. Select another person to
keep reviewing their responsibilities even if task edits change the order.

On desktop, the roster and detail sit side by side. Selection keeps keyboard
focus on the roster; **Go to [name]'s tasks** moves to the detail heading.
At compact widths, selecting a person opens a fullscreen sheet. **Close**,
`Escape`, or browser Back returns to that person's roster row. The sheet keeps
keyboard focus inside it and scrolls independently of the page.

The detail shows the person's role, actual task categories, and open/attention
counts. Overdue, blocked, and not-accepted counts can overlap. Attention uses
the same rules and demo date as Dashboard and Tasks. Accepted is an independent
local responsibility state; it is neither completion nor verified identity.

Needs attention and Upcoming work contain different tasks. Upcoming includes
today, the next seven days, and later work. Initially up to five tasks appear
across these sections; **Show more** reveals all remaining rows in that section,
and **Show less** restores its preview. Completed work is a separate, initially
collapsed disclosure. No assigned tasks and all tasks completed have distinct
empty states.

Choose a task title to open its canonical Tasks drawer. Back, Close, or `Escape`
restores the person, disclosure state, useful scroll position, and task focus;
if an edit moves or removes that row, focus returns to a visible alternative.
**Open Tasks** opens the complete seminar register for all people. Temporary
Team context belongs to that browser history entry and is not saved in
`localStorage`. A new Team visit starts fresh.

## Saved local state

Workspace interactions and interface preferences are stored separately in
browser `localStorage`:

- `budograph.workspace.v1` preserves the Phase 1 workspace format and stores
  supported task and change interactions. Its task boolean is still named
  `acknowledged` for compatibility, although the task UI presents it as
  Accepted/Not accepted.
- `budograph.preferences.v1` stores an optional language and theme preference.

Both are limited to the current browser profile and local origin. Clearing site
data, changing browser or origin, or using private browsing can remove them.
Resetting the demo event replaces workspace data but does not reset the
language or theme; clearing all site storage resets both.

The task `acknowledged` value and the acknowledgement of an operational change
are separate interactions. Neither is authenticated or an approval record, and
neither replaces task completion.

Do not enter real names, contact details, private event information, payment or
health information, interview content, passwords, or other sensitive data.
Local storage is not an encrypted database.

## Keyboard and small-screen use

Use `Tab` and `Shift+Tab` to move through links, buttons, filters, and drawer
controls; use `Enter` to follow a task row's real link, `Enter` or `Space` to
activate buttons, and `Escape` to close task details. Focus moves to the drawer
close button when it opens, stays within the modal while tabbing, and returns to
the originating task link when that link remains available. A skip link appears
when focused at the start of the page. Visible focus indicators and accessible
labels support keyboard use, but this is not a screen-reader certification.

On small screens, primary navigation moves to the bottom of the viewport while
the language and theme controls remain in the header. Tasks becomes a custom
summary with title, status, owner, deadline/overdue, and acceptance rather than
shrinking the desktop columns. Search stays visible, filters reflow, and the
final row retains safe space above the fixed navigation. The drawer becomes a
full-width sheet with scrollable sections, touch-sized controls, dynamic
viewport height, and safe-area-aware bottom padding.

## Intentional Phase 2A and Phase 2B boundary

Phase 2A, Phase 2B.1, and Phase 2B.2 do not add a backend, database,
authentication, real user accounts, roles or permissions, AI, budget management,
Kanban, calendar, or Gantt views. They also do not add synchronization,
production notifications, participant registration, payments, or document
storage.

Phase 2B.1 is a visual and information-hierarchy refinement and Phase 2B.2 is a
focused Tasks implementation within that boundary, not a new product area.
Neither is product-market validation or proof of usability, accessibility,
organizer effectiveness, or reduced operational risk.

All included events, people, venue details, tasks, and changes are fictional.
The source code is licensed under GNU GPL version 3 only (`GPL-3.0-only`);
third-party assets and dependencies retain the licenses recorded in the
repository license register.

The available NOIT regulation covers the **2025–2026 competition year** and is
historical. Before using BudoGraph for a later competition year, reverify the
official rules, dates, category wording, procedures, deliverables, formats,
online-availability periods, declarations, and test-account requirements.

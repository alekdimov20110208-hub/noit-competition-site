# BudoGraph Phase 1 User Guide

BudoGraph Phase 1 is a local organizer workspace using fictional seminar data.
It is a technical prototype, not a service for real participant or operational
information.

## Start the workspace

From the repository root, install dependencies once and start the development
server:

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. No account is required.

## Main views

- **Dashboard** summarizes task progress, late and blocked work, deadlines,
  active changes, team workload, attention items, and milestones.
- **Tasks** filters work by status or owner. Use **Group by owner** for an
  ownership view. Change a row's status, acknowledge it, or select its title to
  open the detail drawer and inspect context and dependencies.
- **Team** shows role and workload summaries. Select a fictional team member to
  see their assigned tasks.
- **Changes & Plan B** connects an operational change to affected work. Update
  the response, acknowledge the change, and follow the direct-contact guidance
  outside BudoGraph when it appears.
- **Templates** previews the seminar preparation structure. **Reset demo event**
  opens a confirmation before replacing saved changes with the fictional seed.

## Saved local state

Task and change interactions are stored in `localStorage` for the current
browser profile and local origin. They should survive a refresh in that same
context. Clearing browser data, changing browser or origin, or confirming the
reset removes or replaces those changes.

Do not enter real names, contact details, private event information, payment or
health information, interview content, passwords, or other sensitive data.

## Keyboard use

All interactive controls use native links, buttons, and selects. Use `Tab` and
`Shift+Tab` to move between controls, `Enter` or `Space` to activate controls,
and `Escape` to close an open task drawer. A skip link appears when focused at
the start of the page.

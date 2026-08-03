# Phase 1 Test Evidence

Verified on 2026-08-04 in the local Windows workspace using Node.js
`v24.16.0` and pnpm `11.9.0`.

## Automated checks

The following commands were run from the repository root after the Phase 1
implementation was assembled:

| Command             | Result                                                          |
| ------------------- | --------------------------------------------------------------- |
| `pnpm format:check` | Passed; all scoped files matched Prettier formatting.           |
| `pnpm typecheck`    | Passed; the strict TypeScript project build reported no errors. |
| `pnpm lint`         | Passed; ESLint reported no errors or warnings.                  |
| `pnpm test`         | Passed; 8 tests passed with 0 failures.                         |
| `pnpm build`        | Passed; Vite produced the production bundle in `dist/`.         |

The focused tests cover readiness and task counts, overdue calculation,
upcoming and attention queues, team workload, immutable state transitions,
change-to-task relationships, saved-state validation and fallback, and the
fictional seed scenarios.

## Browser verification

The Vite development build was exercised in the Codex in-app Chromium browser
at a `1440 x 900` desktop viewport, an intermediate `1080 x 900` viewport, and
a `390 x 844` mobile viewport.

Verified behavior:

- Dashboard, Tasks, Team, Changes & Plan B, and Templates rendered at desktop
  and mobile breakpoints.
- The desktop sidebar changed to the compact mobile header and fixed bottom
  navigation at the mobile breakpoint.
- No horizontal document overflow was detected on the checked desktop or
  mobile views.
- At 1080 px, task rows used the intended three-column reflow, placed status and
  acknowledgement controls on the second line, and clipped no controls.
- Targeted edge checks at 1260 px and 1130 px confirmed the five-column and
  three-column task layouts respectively, with no clipped controls or overflow.
- Task status and owner filters reduced the visible list correctly; owner
  grouping produced five team sections.
- A task status update and acknowledgement were reflected in its row and detail
  drawer.
- The task drawer opened at desktop and mobile sizes, focused its close control,
  trapped forward and reverse `Tab` movement, retained select focus after a
  status update, closed with `Escape`, and restored focus to its task trigger.
- The task status and acknowledgement survived a browser reload, exercising the
  `localStorage` adapter.
- Selecting a team member updated the assigned-task detail area.
- Before resolution, the change showed affected work and the direct-contact
  escalation. Its response then advanced to resolved and could be acknowledged.
- Resolving the only active change produced a meaningful dashboard empty state
  rather than a blank panel.
- The template reset used a confirmation step, restored the fictional seed,
  and displayed a success status. The reset returned the task and change state
  to its original demonstration values.
- The checked browser console contained no warning or error entries.

## Demonstration-data check

A scoped source scan found no prohibited interview names (`Sato`, `Getov`),
`Sensei`, Zoom references, `mailto:` or `tel:` links, or email-address-like
strings under `src/`. The visible seed identities and venue are fictional and
the interface labels the workspace as fictional demonstration data.

## Evidence boundary

These results verify the listed local checks only. They are not production,
security, usability, formal accessibility, device-coverage, or product-market
validation. The demonstration data is synthetic, and no interview respondent
or real participant data was used in the browser checks.

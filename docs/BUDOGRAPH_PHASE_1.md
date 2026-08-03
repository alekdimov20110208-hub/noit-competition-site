# BudoGraph Phase 1

## Purpose

BudoGraph is a focused event-organization application for martial-arts seminars and events. Its primary job is to help the organizer maintain one current operational overview when responsibilities, changes, deadlines, and context would otherwise be spread across helpers, messages, calls, documents, and memory.

BudoGraph supports direct communication; it does not replace it. A critical operational change may show `Direct contact recommended`, but the prototype does not call, message, or notify anyone.

## Decision and validation boundary

Phase 1 is authorized as a NOIT competition MVP and technical prototype. The project may proceed without additional interviews for this slice. This is not a finding that a market has been validated.

In particular, the Phase 1 decision does not establish:

- product-market fit;
- prevalence across martial-arts organizations;
- demand, adoption, retention, or willingness to pay;
- a production-ready security or privacy posture; or
- measurable product impact.

Historical validation files under `docs/validation/` and market-research files under `docs/market-research/` remain the source record. They must not be deleted or rewritten to imply stronger evidence.

## Included product slice

The approved Phase 1 product scope is:

1. **Application shell** - a text-only BudoGraph wordmark, current-event context, desktop sidebar, compact mobile navigation, and routes for Dashboard, Tasks, Team, Changes & Plan B, and Templates.
2. **Fictional demonstration event** - one realistic seminar with fictional people, preparation work, travel and accommodation details, venue work, participant communication, and a contingency. It contains no real interview or dojo details.
3. **Dashboard** - event status, calculated readiness, completed/in-progress/blocked/overdue task summaries, upcoming deadlines, risks and changes, team workload, organizer-attention items, and milestones.
4. **Tasks** - typed task records with category, owner, deadline, status, priority, context, dependency, consequence, acknowledgement, and last-updated information. The user can filter, update status, acknowledge, see overdue state, and inspect task details.
5. **Team** - organizer and helper roles, task counts, completion, overdue/blocked load, workload summaries, and a selected member's assigned tasks.
6. **Changes & Plan B** - severity, report time, affected work, owner, response, acknowledgement, escalation guidance, and response-state updates for a fictional disruption.
7. **Templates** - a reusable seminar-template preview with the common venue, instructor, travel, accommodation, schedule, team, registration, communication, equipment, and contingency preparation areas. Phase 1 may use it to restore the local demonstration state; it is not a full template editor.
8. **Local persistence** - supported task and change interactions persist across refreshes in the same browser profile through `localStorage`.

## Explicitly excluded

Phase 1 does not contain:

- a production server, backend, database, or cloud synchronization;
- registration, login, authentication, authorization, or real user roles;
- payments, budgets, participant management, or document storage;
- external APIs, AI, recommendation models, or secret keys;
- email, SMS, chat, calling, calendar, or push-notification integrations;
- a complex template editor;
- production analytics, audit logs, backups, monitoring, or multi-user collaboration;
- claims that the prototype is suitable for real personal data; or
- a generated, stock, or permanent visual logo.

Placeholders for excluded functions are not part of the required core screens and must not be presented as working features.

## Local-data architecture

Phase 1 is a client-side TypeScript application:

```text
Fictional typed seed data
          |
          v
Workspace/domain state and calculations
          |
          +----> React pages and reusable components
          |
          v
Browser localStorage persistence
```

The domain model uses stable IDs and includes at least:

- `Event`
- `TeamMember`
- `Task`
- `EventChange`
- `EventTemplate`

Views consume typed workspace data and actions. Readiness, task summaries, overdue state, workload, affected-task relationships, and attention items are derived locally. Persistence is a browser adapter, not a production data layer. This separation is intended to let a later backend implement loading and saving without moving network logic into presentation components.

There is no server validation in Phase 1 because there is no server. This is a known architecture boundary, not a security claim.

## Demonstration data rules

- Use fictional event, team, instructor, and operational information only.
- Do not copy names, contact details, private links, Zoom information, quotations, or incidents from interview files.
- Do not use real email addresses, telephone numbers, participants, dojo members, or payment details.
- Label the data as demonstration data in the interface or supporting material.
- Do not repurpose the prototype to store sensitive or real operational data.

## Main local flows

1. The organizer opens the fictional current event and checks readiness and attention items.
2. The organizer filters tasks, opens task details, changes a status, or acknowledges a task.
3. The organizer checks workload and selects a team member to review assigned work.
4. The organizer reviews a disruption, sees affected tasks, acknowledges it, and advances the response while using direct communication outside BudoGraph when recommended.
5. The organizer previews the seminar template and may reset the local demonstration state.
6. The browser reloads the saved local state for the same browser profile.

## Running and verification commands

Run from the repository root:

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Passing results must be captured only after the commands are actually run. This scope document does not itself provide test evidence.

## Hand-drawn logo replacement

The Phase 1 identity is deliberately limited to a clean text-only wordmark in `src/components/BrandWordmark.tsx`. That component is the replacement boundary for the future hand-drawn logo.

When the author's final logo is ready:

1. Export an appropriate original web asset, preferably SVG when the artwork is genuinely vector or PNG when raster detail must be retained.
2. Add the source and web-ready asset to a clearly named repository asset location.
3. Update only the visual content inside `BrandWordmark`, retaining its `compact` behavior so desktop and mobile navigation continue to fit.
4. Preserve an accessible `BudoGraph` name through visible text, alternative text, or an equivalent accessible label.
5. Verify contrast, focus-adjacent layout, small-size legibility, and both desktop and mobile navigation.
6. Record authorship and licensing in `docs/THIRD_PARTY_NOTICES.md`; if it is entirely original, state that rather than inventing a third-party license.

Until then, do not add a generated martial-arts symbol, dragon, fist, Japanese character, stock logo, or permanent placeholder asset.

## NOIT regulation boundary

The repository contains `NOIT_REGULATIONS_2025_2026.pdf` as a historical source. That edition describes, among other items, GPLv3 licensing, source and documentation submission, a user guide, installation/use guidance, licensing of external resources, project testing and evidence, online availability, and test accounts where roles exist.

Those details are specific to the 2025-2026 competition year. Before an actual later participation, recheck the official regulation for:

- dates and submission windows;
- age groups, directions, and category wording;
- registration and round procedures;
- required declarations, files, and documentation format;
- online availability and hosting periods;
- test-account and role requirements;
- presentation, test, and defense arrangements; and
- evaluation criteria and scoring details.

An internal project schedule or this Phase 1 scope is not an official competition rule.

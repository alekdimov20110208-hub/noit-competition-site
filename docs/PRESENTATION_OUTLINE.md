# BudoGraph Presentation Outline

This outline is year-neutral. Presentation length, required sections, and
submission format must be aligned with the regulation for the actual
competition year.

## 1. Problem and boundary

- Organizers can hold the complete event context while work is distributed
  across helpers, calls, messages, documents, and memory.
- BudoGraph provides one current operational view and explicitly preserves
  direct human communication.
- Phase 1 is a competition MVP, not proof of product-market fit or commercial
  demand.

## 2. Demonstration story

1. Open the Dashboard and answer what is ready, late, blocked, changed, and
   requiring attention.
2. Open the overdue guest-itinerary task, inspect what blocks it and what it
   blocks, then update and acknowledge it.
3. Select a team member and review their workload.
4. Open Changes & Plan B, connect the flight change to affected tasks, and show
   **Direct contact recommended**.
5. Preview the seminar template and restore the fictional baseline.
6. Refresh once to demonstrate browser-local persistence before the reset.

## 3. Technical explanation

- React, TypeScript, and Vite with a responsive application shell.
- Typed `Event`, `TeamMember`, `Task`, `EventChange`, and `EventTemplate`
  records with stable IDs.
- Pure domain calculations and reducer transitions separated from pages.
- Validated, versioned `localStorage` loading with a fictional fallback seed.
- No backend, authentication, external API, AI, secret, or real personal data.

## 4. Verification evidence

Show the actual formatter, lint, strict TypeScript, focused test, production
build, desktop/mobile browser, persistence, privacy-scan, and clean-console
results recorded in `docs/TEST_EVIDENCE.md`. Do not add results that were not
run.

## 5. Limitations and next decision

- Local, single-browser state only; no accounts, synchronization, audit trail,
  production security, or hosting.
- Template editing and multi-event workflows are intentionally excluded.
- The permanent hand-drawn logo is not yet added.
- The next product step should be chosen only after reviewing the demonstration
  and evidence; later-year NOIT requirements must be verified separately.

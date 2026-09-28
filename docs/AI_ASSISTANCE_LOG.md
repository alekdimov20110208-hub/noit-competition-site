# AI Assistance Log

This log records material AI assistance so the project author can review, understand, test, and explain the resulting work. It does not transfer authorship responsibility to the tool and it is not evidence that the work is correct or that tests passed.

No personal author details are recorded here.

| Date       | Tool         | Assistance provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Required human review and verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-04 | OpenAI Codex | Assisted with repository inspection and the initial BudoGraph Phase 1 implementation and documentation, including the organizer-workspace structure, typed fictional demonstration data, browser-local persistence approach, responsive interface work, focused automated-test scaffolding, license documentation, scope documentation, and known-limitations documentation. Codex also reviewed the repository master prompt and the historical 2025-2026 NOIT regulation while preparing the work.                                                                                                                                                                                                                                                                                     | The human project author must review every changed file, understand and be able to explain the code and architecture, verify that all demonstration content is fictional, inspect licenses, run the application, and independently run and evaluate formatting, lint, type checking, automated tests, the production build, responsive/accessibility checks, refresh persistence, and personal-data checks before accepting or submitting the work. Any generated code or prose that is unclear, incorrect, unverified, or beyond the author's understanding must be corrected or removed.                                                                                                        |
| 2026-08-06 | OpenAI Codex | Assisted with the Phase 2A UX foundation, including central typed Bulgarian/English localization, browser-language and preference persistence logic, System/Light/Dark theme handling, semantic theme tokens, operational Dashboard restructuring, task query deep-link primitives, long-content and responsive refinements, focused test cases, and updates to user, architecture, deployment, limitation, and presentation documentation. The work preserved the fictional demo boundary and the existing workspace-storage version.                                                                                                                                                                                                                                                   | The human project author must inspect and understand the localization catalogs, preference lifecycle, early-theme script, Dashboard calculations, History API behavior, invalid-link handling, responsive CSS, and every documentation claim. The author must independently run the complete formatter, lint, strict TypeScript, automated-test, production-build, browser-width, keyboard, contrast, persistence, deep-link refresh/back-forward, privacy, and clean-console checks and retain the real evidence. Unclear code or unsupported claims must be corrected or removed before acceptance.                                                                                             |
| 2026-08-06 | OpenAI Codex | Assisted with the focused Phase 2A.1 responsive stabilization review. The work traced screenshot regressions to badge wrapping, retained flex basis, desktop row composition, summary flow, safe-area spacing, compact-header sizing, and sidebar copy; updated the affected Dashboard component and CSS; added targeted responsive contract tests; removed the implicit favicon request; and recorded a fresh final-source Chromium matrix across seven widths, both languages, all theme preferences, every primary mobile page, stress data, deep links, focus, keyboard behavior, and the application console.                                                                                                                                                                       | The human project author must inspect the responsive CSS and Workload component structure, confirm that the CSS-contract tests protect intent rather than screenshots, repeat physical-device and non-Chromium checks, review the distinction between application console output and extension/runtime noise, and independently confirm the commit and remote branch before relying on this evidence. Controlled viewport emulation is not a substitute for real-device, accessibility, or performance certification.                                                                                                                                                                             |
| 2026-08-12 | OpenAI Codex | Assisted with the Phase 2B.1 BudoGraph visual-identity and information-hierarchy refinement. The work defined semantic roles for structure, decisions, time, risk, completion, and active/info states; introduced operational, context, and critical surface concepts; reorganized the Dashboard into EventOverview, OperationalFocus, PreparationTimeline, ChangeImpact, and TeamPressure; clarified task-facing Accepted/Not accepted language while preserving the `Task.acknowledged` field in `budograph.workspace.v1`; kept change acknowledgement distinct; and updated the phase, user, deployment/demo, presentation, limitation, and project documentation. No backend, authentication, new product feature, external asset, font, or dependency was introduced by this scope. | The human project author must inspect and understand every component, style token, localized string, state transition, and documentation claim; confirm that task acceptance is not presented as completion or approval; and independently complete the final formatter, lint, type-check, automated-test, build, browser-width, theme, keyboard, focus, deep-link, persistence, clean-console, contrast, assistive-technology, and offline checks before relying on Phase 2B.1. This refinement is not product-market validation or proof of usability. The historical 2025–2026 NOIT requirements must be reverified for the actual competition year.                                           |
| 2026-08-12 | OpenAI Codex | Assisted with the focused Phase 2B.1.1 Dashboard visual-hierarchy polish. The work compacted Event Overview and Change Impact, removed redundant persistent explanation, reduced large warning-surface mass, restricted uppercase to structural eyebrows, improved mobile metadata readability, retained the explicit fictional-demo boundary, and preserved the five Phase 2B.1 domain components and existing behavior. The scope did not start Phase 2B.2, redesign another page, add a feature, or change a schema or dependency.                                                                                                                                                                                                                                                    | The human project author must inspect the information retained and removed, semantic color hierarchy, scoped contrast, mobile text sizes, Bulgarian and English copy, exact viewport and other-page regression matrices, task deep-link and focus behavior, and the absence of Phase 2B.2 scope creep. Controlled Chromium checks are not physical-device, cross-browser, screen-reader, formal accessibility, usability, organizer-effectiveness, or product-market validation. The historical 2025–2026 NOIT requirements must be reverified for the actual competition year.                                                                                                                   |
| 2026-08-15 | OpenAI Codex | Assisted with the focused Phase 2B.2 Tasks workspace redesign. The work introduced a compact operational summary, localized task search and combined status/owner/category filters, deterministic urgency ordering, flat canonical task rows, a grouped primary detail/editing drawer, purpose-built mobile task summaries, pure helper tests, reducer-invariant tests, responsive contracts, and related project documentation. It preserved the approved Dashboard, stable task IDs and routes, `budograph.workspace.v1` schema, fictional local-prototype boundary, dependencies, and asset set.                                                                                                                                                                                      | The human project author must inspect and understand the task filtering and ordering rules, row-link semantics, drawer focus/history behavior, status-versus-Accepted state transitions, responsive CSS, localized copy, and every evidence claim. The author must independently repeat the final formatter, lint, strict TypeScript, automated-test, production-build, browser-width, keyboard, focus, persistence, contrast, physical-device, non-Chromium, screen-reader, privacy, and offline checks before relying on the work. The historical 2025–2026 NOIT requirements must be reverified for the actual competition year.                                                               |
| 2026-08-15 | OpenAI Codex | Assisted with the focused Phase 2B.2.1 Tasks dropdown and final-polish pass. The work created a dependency-free reusable button/listbox selection control, deterministic value/navigation/collision helpers and tests, collision-aware bounded popups, theme-scoped visual states, drawer Escape integration, a narrow Tasks result-count refinement, and a targeted mobile category-metadata adjustment. It preserved the approved Tasks register and drawer information architecture, locked Dashboard and supporting pages, canonical routes, task schema, both browser-storage keys, dependencies, and fictional-data boundary.                                                                                                                                                      | The human project author must review the button/listbox semantics, roving option focus, click and keyboard selection, Tab and Shift+Tab behavior, two-stage drawer Escape handling, outside-click dismissal, trigger-focus restoration, popup collision and internal scrolling, Light/Dark contrast, narrow-screen layout, Status-versus-Accepted persistence, and locked-page regression evidence. Controlled Chromium checks do not replace physical-device, Safari, Firefox, screen-reader, or formal accessibility review. Visual polish is not proof of usability or organizer effectiveness. The historical 2025–2026 NOIT requirements must be reverified for the actual competition year. |

## Logging rules for later assistance

Add a dated entry for each material AI-assisted task. Record:

- the tool used;
- the concrete task and the kind of output produced;
- the files or areas affected;
- the human review, tests, and changes actually completed; and
- unresolved concerns or rejected suggestions.

When an assisted task relies on competition rules, record the source year. The
available 2025–2026 NOIT regulation is historical and must be reverified against
the official regulation for the actual participation year.

Do not write `reviewed`, `tested`, or `passed` unless those actions actually occurred and supporting evidence is retained. Do not include prompts, transcripts, credentials, private links, contact details, or personal author information in this log.

## 2026-09-28 — Phase 2B.2.2 task attention and deadline semantics

OpenAI Codex assisted with the explicitly authorized semantic correction from
baseline `24795ec6c5551f2091a6bbdb9224279de0693a9f`. Work covered the pure local
calendar timing model, explicit multi-reason task attention and deterministic
ordering, a small midnight/resume refresh hook, Operational Focus disclosure
and localized wording, timing alignment in Tasks, the minimal Team
status/overdue presentation correction, focused automated tests and evidence.
The complete changed-file list and reproduction boundaries are appended in
`TEST_EVIDENCE.md`; historical entries were retained.

The implemented contract is: Status = lifecycle; Priority = impact; Timing =
derived local calendar relationship; Needs attention = derived operational
signal; Accepted = separate responsibility acknowledgement. `completed`,
`acknowledged`, the v1 Task shape and `budograph.workspace.v1` remain stable.
Upcoming is derived task timing only; milestone Upcoming remains unchanged.
No dependency, backend, authentication, Team 2B.3, broad visual redesign or
seed-date refresh was introduced.

The implementing agent ran formatter/check, lint, TypeScript, all 63 automated
tests, production build and diff-whitespace checks successfully. It ran and
visually inspected controlled Edge/Chromium production-browser evidence for
the required Dashboard, Tasks and Team configurations, disclosures, canonical
links, filters, four-status drawer, persistence and midnight rollover. All 15
browser cases passed with zero application console warnings/errors or uncaught
page errors and no observed horizontal page overflow. Synthetic test fixtures
and explicit clocks were used; these checks are not real-user feedback.

A separate read-only agent reviewed the implementation and found a clock-startup
race when rendering and subscription straddled midnight. The implementing agent
fixed it by publishing subscription-time now immediately and added a regression
test. The reviewer independently reran all nine focused tests and confirmed the
fix with no further confirmed findings. No independent human review,
physical-device, Firefox/Safari, screen-reader or formal accessibility validation
is claimed. The human project author still needs to understand and defend the
calendar, attention, persistence and accessibility decisions.

Confirmed unresolved follow-up: **Demo Freshness / Critique Verification**.
The fictional 18–20 September 2026 seminar remains stale at the 28 September
reference date, producing overdue work and outdated milestone narrative. Its
source dates and milestone statuses were deliberately preserved for the next
separately scoped task. The mandatory NOIT regulation remains the historical
**2025–2026** source; later-year competition requirements need verification.

## 2026-09-28 — Phase 2B.2.3B deterministic demo snapshot

OpenAI Codex assisted with the explicitly authorized demo-only implementation
from baseline `c87fb9a90ac75494b1d00df09497950ebd1a0639`: one explicit demo-time
boundary for 7 September 2026, shared injected calendar reference, Varna
(Europe/Sofia) timestamp display, fixed fictional edit timestamps, coherent
preparation deadlines/milestones/travel-change story, a quiet BG/EN disclosure,
reset copy, focused tests and current documentation. Stable IDs, storage keys
and schema, accepted task semantics and locked page designs were preserved.
No dependency, backend/authentication or Team 2B.3 work was introduced.

The implementing agent ran formatter/check, lint, typecheck, all 70 tests,
production build and whitespace checks successfully. It executed and visually
inspected the production-browser matrix and reset/persistence evidence recorded
in `TEST_EVIDENCE.md`: 15 cases passed, with zero application console
warnings/errors or uncaught page errors. A fixture-dependent old August test was
updated after its first-run failure; a screenshot harness was corrected to wait
for drawer entrance animation. Neither was hidden or described as successful
before correction.

A separate read-only agent independently reviewed the implementation and current
documentation and ran 18 focused tests, all passing. It found no confirmed
defects. Controlled clock/timezone checks, fictional test data and emulated
viewports are not human usability feedback, a screen-reader review or physical
device/cross-browser certification. The human author must understand and defend
the difference between real local-calendar domain semantics and this explicitly
fixed, editable demonstration snapshot, including simulated edit timestamps.

Existing valid saved workspaces are not silently re-dated: users explicitly
reset to adopt the refreshed seed, while language/theme preferences remain.
The remaining narrow-desktop, sticky-transparency, disclosure-context and Team
layout critique items remain deferred. The mandatory NOIT source is still the
historical **2025–2026** regulation and must be reverified for the actual later
competition year. Historical assistance and test entries remain intact.

## 2026-09-28 — Phase 2B.2.3C narrow desktop and sticky surfaces

OpenAI Codex assisted with the explicitly authorized focused correction from
baseline `5c6dfc8609c8afc90fb528f0d5813ab73c1691e8`. It reproduced BG status/arrow
overlap at 961 px, moved the existing compact task-row rules into a 50rem
available-results-width container query, and changed only the drawer sticky
header and mobile bottom navigation to the existing opaque theme surface.
Sidebar collapse was deliberately not implemented: responsive content behavior
solves the width issue. Typography, mobile summaries, task semantics, demo data,
global tokens and the normal application header were preserved.

Three CSS-contract regression tests were added; existing tests were retained.
Formatter/check, lint, typecheck, all 73 tests, production build and whitespace
checks passed. The implementing agent ran 47 normal Tasks browser configurations,
11 synthetic BG stress configurations (each grouped and ungrouped), four
interaction/reflow configurations, six scrolling-surface checks and six locked
page regression checks. Screenshots were visually inspected across the required
matrix and representative transitions/stress cases. No measured operational
collision or page horizontal overflow was found. Pixel comparisons proved the
two corrected surfaces stayed visually solid during underlying scroll in Light
and Dark. Application warnings/errors and uncaught page errors were zero.
Detailed widths, interaction coverage, contrast and limitations are appended
to `TEST_EVIDENCE.md`; local raw evidence is retained under ignored `tmp/`.

A separate read-only agent found no confirmed defects and independently passed
all nine responsive tests. Browser verification was performed by the implementing
agent, not an independent human. Synthetic data and emulated widths are not
real-user feedback, physical-device, screen-reader or cross-browser certification.
The 720 CSS px reflow check is not a claim of native or text-only 200% zoom testing.
The human author should understand and defend the content-width layout contract
and the limited use of opaque surfaces.

Disclosure/context corrections, Team 2B.3 and backend/authentication remain
outside this completed phase. Only two source/test files and these two evidence
logs changed. Historical entries remain intact. The mandatory NOIT source is
still the **2025–2026** regulation and requires later-year verification.

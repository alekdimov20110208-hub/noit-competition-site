# ReadyGraph validation decision rules

## Purpose

These rules determine whether ReadyGraph should proceed, be revised and retested, or be rejected before application development. They preserve the previously approved kill criteria while making their measurement explicit.

Thresholds are defined before research results are collected. Do not weaken them after seeing unfavorable evidence.

## Required sample before a decision

- At least 8 valid problem interviews.
- At least 2 interviews from each target audience.
- At least 5 valid prototype tests.
- At least one prototype participant from each target audience.
- Raw evidence recorded using anonymous IDs.
- Both supporting and contradicting evidence summarized.

Without this minimum, the only allowed decision is `INSUFFICIENT EVIDENCE`.

## Decision states

- `VALIDATE` — the problem and core mechanism have enough evidence to proceed to a bounded product specification.
- `REVISE AND RETEST` — the problem may be real, but the audience, workflow, representation, or scope needs one defined revision and a new test.
- `REJECT` — a hard kill criterion is met or remains met after one reasonable low-fidelity revision.
- `INSUFFICIENT EVIDENCE` — minimum sample or measurement quality is missing.

Validation does not authorize application code. Architecture, MVP, security baseline, data model, test strategy, and deployment plan still require approval.

## Gate 1: problem recognition

Count an interview as recognizing the target problem only when it scores `2` on the problem-recognition scale: a specific past omission or dependency issue plus an observable consequence.

- **Pass:** at least 5 of 8 valid interviews score `2`.
- **Inconclusive:** exactly 4 of 8 score `2`; refine the audience or wording and conduct at least 3 additional interviews.
- **Kill:** fewer than 4 of 8 score `2`.

For sample sizes above 8, use the equivalent proportions: pass `>=62.5%`, inconclusive `50-62.4%`, kill `<50%`.

This makes the earlier criterion "fewer than half recognize the problem" measurable.

## Gate 2: evidence of real past incidents

A qualifying incident has evidence strength `>=2`: the participant identifies the event, missing or late element, discovery point, and consequence.

- **Pass:** at least 4 of 8 interviews contain a qualifying incident, with qualifying incidents represented in at least 2 audiences.
- **Inconclusive:** 3 of 8 contain qualifying incidents or all incidents come from only one audience; narrow the target audience or collect more evidence.
- **Kill:** 0-2 of 8 contain a qualifying incident.

General statements such as "things sometimes get forgotten" do not qualify.

This preserves the criterion that organizers must be able to point to real dependency failures.

## Gate 3: current alternatives and complexity

Do not assume existing tools are too complex.

- **Pass:** at least 5 of 8 participants describe a relevant limitation in their current process, and at least 3 provide a concrete example of fragmentation, duplicated checking, hidden dependency, or unnecessary tool overhead.
- **Inconclusive:** 3-4 of 8 report a relevant limitation.
- **Kill:** at least 5 of 8 report that their existing approach is sufficient for relevant events and cannot identify a meaningful missing capability.

Preference for chat or paper is not itself evidence of failure.

## Gate 4: time required to model a plan

Measure from first card placement to the participant declaring the plan ready for simulation.

- **Pass:** median time is `<=15:00`, and at least 4 of the first 5 valid tests finish within 15 minutes.
- **Revise and retest:** median is `<=15:00` but only 3 of 5 finish within 15 minutes, or confusion is concentrated in one correctable interaction.
- **Kill:** median is `>15:00` or at least 3 of 5 participants exceed 15 minutes after one low-fidelity simplification.

This operationalizes the earlier criterion that modeling must not regularly take more than 15 minutes.

## Gate 5: dependency-graph comprehension

Use the five fixed comprehension questions.

- **Pass:** at least 4 of 5 participants answer at least 4 of 5 questions correctly without hints.
- **Revise and retest:** exactly 3 of 5 reach 4/5; simplify notation and repeat with at least 3 new participants.
- **Kill:** 0-2 of 5 reach 4/5 after one simplified iteration.

A participant who needs the moderator to identify the path does not count as unaided comprehension.

## Gate 6: useful blockers discovered

Use the definition in `LOW_FIDELITY_PROTOTYPE_PLAN.md`.

- **Pass:** at least 3 of 5 participants independently discover at least one useful blocker that was not obvious to them from the flat checklist.
- **Revise and retest:** exactly 2 of 5 do so.
- **Kill:** 0-1 of 5 do so, or the criterion still fails after one representation revision.

This preserves the earlier requirement that the simulation reveal useful risk in at least 3 of 5 tests.

## Gate 7: preference compared with a normal checklist

Preference must follow completion of matched tasks in both formats.

- **Pass:** at least 3 of 5 prefer the graph for events with multiple dependencies and can name a concrete advantage; participants may still prefer a checklist for simple events.
- **Revise and retest:** responses are split with no majority, or 3 of 5 understand the advantage but consider setup effort too high.
- **Kill:** at least 3 of 5 prefer the checklist for the complex test scenario and cannot identify added value from the graph after one simplification.

The goal is not to replace checklists for simple events.

## Gate 8: willingness to use again

Ask only after participants complete both representations.

- **Pass:** at least 3 of 5 give repeat-use willingness `4` or `5`, including at least one adult organizer, and identify a real event type where they would use it.
- **Revise and retest:** exactly 2 of 5 give `4` or `5`, or positive intent lacks a real use context.
- **Kill:** 0-1 of 5 give `4` or `5` after one scope/interaction revision.

Stated willingness is weaker than observed reuse and must be labeled as intent, not behavior.

## Gate 9: feasible competition scope

Before full architecture, create a feature-level effort check for the validated core only.

- **Pass:** expected core implementation, tests, essential documentation, and deployment preparation fit within 50 working hours, leaving at least 13 hours of the approximately 63-hour window as buffer.
- **Revise:** estimate is 51-60 hours; remove non-core functions and estimate again.
- **Kill or postpone:** the smallest version that preserves the validated value remains above 50 hours, requires unavailable hardware/data, or exceeds the stated budget.

The estimate is a planning gate, not proof of delivery.

## Gate 10: regulatory fit

The 2025-2026 regulation is historical guidance for this project. When the 2026-2027 regulation is published, verify at minimum:

- the VIII-X age group and applicable direction;
- definition and eligibility of the software product;
- team-size and prior-participation rules;
- licensing requirements;
- online availability period;
- test-account requirements;
- documentation format and required personal-data fields;
- evaluation categories and weights;
- registration and submission dates.

- **Pass:** ReadyGraph remains eligible in the intended direction and can meet all mandatory requirements.
- **Revise:** classification, deliverables, or dates change but the concept remains eligible.
- **Hard kill:** the new regulation makes the concept ineligible or impossible to submit compliantly within the available time.

## Overall decision algorithm

1. If the minimum sample is missing, choose `INSUFFICIENT EVIDENCE`.
2. If regulatory fit reaches hard kill, choose `REJECT` for the intended competition entry.
3. If any other gate reaches kill for the first time, make at most one clearly documented low-fidelity revision when the rule permits retesting.
4. If the same killed gate fails after that revision, choose `REJECT`.
5. If all gates pass, choose `VALIDATE` and request approval for bounded product specification.
6. If no gate is killed but one or more are inconclusive, choose `REVISE AND RETEST`.
7. Do not average failed critical gates into a positive overall score.

## Decision record template

| Gate | Result | Measured value | Evidence IDs | Counter-evidence | Action |
|---|---|---:|---|---|---|
| Problem recognition | `UNTESTED` | | | | |
| Past incidents | `UNTESTED` | | | | |
| Current alternatives | `UNTESTED` | | | | |
| Modeling time | `UNTESTED` | | | | |
| Graph comprehension | `UNTESTED` | | | | |
| Useful blockers | `UNTESTED` | | | | |
| Checklist comparison | `UNTESTED` | | | | |
| Repeat use | `UNTESTED` | | | | |
| Feasible scope | `UNTESTED` | | | | |
| Regulatory fit | `PENDING 2026-2027 REGULATION` | | | | |

Final decision: `UNTESTED`

Decision date: `[YYYY-MM-DD]`

Decision maker(s): `[placeholder]`

Limitations and unresolved uncertainty:

- 

# ReadyGraph validation scorecard

## Evidence status

All entries are initially blank. Targets and thresholds below are decision rules, not achieved results.

Use these labels consistently:

- **Hypothesis** — a claim that still needs testing.
- **Participant report** — what one participant says happened.
- **Observed evidence** — behavior, timing, artifact, or result directly observed during research.
- **Validated evidence** — a pattern that meets a predefined threshold and minimum sample.
- **Inconclusive** — available evidence does not meet either the pass or kill threshold.

## Minimum evidence package

A validation decision must not be made until the package contains:

- at least 8 completed problem interviews;
- at least 2 interviews from each of the three target audiences;
- at least 5 moderated low-fidelity prototype tests;
- at least 3 anonymized real-event workflows or artifacts, when participants can share them lawfully;
- completed metric calculations with links to anonymous interview or test IDs;
- documented evidence both for and against the concept.

If these minimums are not met, status is `INSUFFICIENT EVIDENCE`.

## Core hypotheses

| ID | Hypothesis | Evidence needed | Current status |
|---|---|---|---|
| H1 | Small-event preparation is fragmented across multiple tools, conversations, or memory. | Interview workflow maps and voluntarily shared anonymized artifacts. | `UNTESTED` |
| H2 | Missing people, resources, confirmations, or dependencies have caused real consequences. | Specific past incidents scored 2 or 3 for evidence strength. | `UNTESTED` |
| H3 | Existing tools do not make important dependencies and fallback gaps sufficiently visible for this audience. | Comparisons of current methods with prototype tasks; counter-evidence from satisfied users. | `UNTESTED` |
| H4 | A representative plan can be modeled in 10-15 minutes. | Timed prototype modeling sessions. | `UNTESTED` |
| H5 | Target users can understand the graph and cascading effects without extensive explanation. | Comprehension task results. | `UNTESTED` |
| H6 | Scenario simulation reveals useful blockers beyond a normal checklist. | Blockers identified and usefulness rating with participant explanation. | `UNTESTED` |
| H7 | Enough target users would choose the structured approach for suitable events and use it again. | Forced comparison and repeat-use response after task completion. | `UNTESTED` |

## Interview-level coding

### Problem recognition score

- `0` — participant reports no relevant difficulty and current method is sufficient.
- `1` — participant recognizes inconvenience but cannot provide a concrete past incident with a consequence.
- `2` — participant provides at least one specific incident involving a missing/late person, resource, confirmation, or dependency and an observable consequence.

### Workflow fragmentation score

- `0` — one reliable source of truth, with no relevant fragmentation described.
- `1` — multiple locations are used, but the participant reports an effective reconciliation method.
- `2` — multiple locations or memory are used and the participant describes lost, duplicated, stale, or unclear information.

### Past-incident evidence score

Use the `0-3` definition from `INTERVIEW_NOTES_TEMPLATE.md`.

## Prototype metrics

| Metric | Measurement method | Unit |
|---|---|---|
| Time to model a plan | Start at first card placement; stop when participant declares the plan ready for simulation. Exclude consent and tutorial time. | Minutes and seconds |
| Graph comprehension | Five fixed questions about ownership, prerequisites, downstream effects, critical elements, and fallback coverage. | Correct answers out of 5 |
| Useful blockers discovered | Count only previously unmarked issues the participant judges actionable and can explain. Deduplicate equivalent blockers. | Count per participant |
| Simulation accuracy | Compare participant prediction with the scenario's predefined cascade. | Correct affected elements / expected affected elements |
| Checklist comparison | Participant completes matched tasks using checklist and graph; order is counterbalanced. | `graph/checklist/no preference` plus reason |
| Repeat-use willingness | Ask after both tasks: likelihood of using the approach for a suitable real event. | 1-5 scale plus reason |
| Setup burden | Participant rates effort after timed modeling. | 1-5 scale plus explanation |

Repeat-use scale:

- `1` definitely would not use;
- `2` probably would not use;
- `3` unsure or depends;
- `4` probably would use;
- `5` definitely would use.

## Raw interview scorecard

| Interview ID | Audience | Problem recognition 0-2 | Incident evidence 0-3 | Fragmentation 0-2 | Frequency stated | Existing tools sufficient? | 10-15 min condition exists? | Evidence notes |
|---|---|---:|---:|---:|---|---|---|---|
| | | | | | | | | |

## Raw prototype scorecard

| Test ID | Audience | Scenario | Modeling time | Comprehension /5 | Useful blockers | Simulation accuracy | Preference | Repeat use 1-5 | Setup burden 1-5 | Notes |
|---|---|---|---:|---:|---:|---:|---|---:|---:|---|
| | | | | | | | | | | |

## Aggregate calculations

Complete only from raw rows. Do not estimate missing values.

| Metric | Calculation | Result | Evidence IDs | Status |
|---|---|---:|---|---|
| Problem recognition | Interviews scoring `2` / all valid interviews | | | `UNTESTED` |
| Specific incident coverage | Interviews with incident evidence `>=2` / all valid interviews | | | `UNTESTED` |
| Cross-audience incident coverage | Number of audiences containing at least one evidence `>=2` incident | | | `UNTESTED` |
| Workflow fragmentation | Interviews scoring `2` / all valid interviews | | | `UNTESTED` |
| Median modeling time | Median of valid timed tests | | | `UNTESTED` |
| Tests completed within 15 minutes | Valid tests `<=15:00` / all valid tests | | | `UNTESTED` |
| Graph comprehension | Tests scoring `>=4/5` / all valid tests | | | `UNTESTED` |
| Useful-blocker discovery | Tests finding `>=1` useful blocker / all valid tests | | | `UNTESTED` |
| Graph preference | Tests preferring graph / all valid tests | | | `UNTESTED` |
| Checklist preference | Tests preferring checklist / all valid tests | | | `UNTESTED` |
| Repeat-use intent | Tests scoring `4` or `5` / all valid tests | | | `UNTESTED` |

## Bias and quality checks

Before interpreting results, answer:

- Were participants recruited only from people likely to support the author?
- Did the interviewer disclose ReadyGraph before completing the problem questions?
- Were prompts or explanations different between participants?
- Was checklist/graph task order counterbalanced?
- Were synthetic scenarios mistaken for real evidence?
- Were duplicate incidents counted more than once?
- Were negative responses and failed tasks retained?
- Did any participant feel evaluated rather than the prototype being evaluated?
- Were any results excluded? If so, was the reason defined before viewing the outcome?

## Evidence summary

### Evidence supporting the hypotheses

- `[No evidence recorded yet]`

### Evidence contradicting the hypotheses

- `[No evidence recorded yet]`

### Unresolved questions

- `[No evidence recorded yet]`

### Overall status

`UNTESTED / INSUFFICIENT EVIDENCE / VALIDATE / REVISE AND RETEST / REJECT`

Apply the thresholds in `VALIDATION_DECISION_RULES.md`; do not decide by averaging all scores into a single flattering number.

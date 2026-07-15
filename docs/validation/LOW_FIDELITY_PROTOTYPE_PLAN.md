# ReadyGraph low-fidelity prototype test plan

## Objective

Test the proposed interaction and problem-solving mechanism without writing code. The test evaluates whether users can build a small structured plan, understand dependencies, reason about cascading failures, discover useful blockers, and judge when the method offers more value than a normal checklist.

This test does not validate the problem by itself. Problem evidence comes first from interviews about real past behavior and incidents.

## Prototype format

Use paper on a table or a simple non-interactive slide/whiteboard controlled by the participant. Do not build a clickable application.

### Materials

- A3 or larger paper labeled `Event plan`.
- Index cards or paper rectangles in four neutral styles:
  - tasks;
  - people/roles;
  - resources/confirmations;
  - fallback options.
- Arrow strips labeled `requires`.
- Small markers for `ready`, `not ready`, `unknown`, and `critical`.
- Failure cards such as `unavailable`, `late`, or `not confirmed`.
- A separate normal checklist containing the same scenario elements.
- Stopwatch.
- Printed moderator score sheet.
- Blank cards so participants can add missing elements.

Avoid polished branding, persuasive copy, readiness percentages, animation, or AI effects. The test should evaluate the mechanism, not visual appeal.

## Participants

- Minimum for a decision: 5 valid prototype tests.
- Preferred: 6-8 tests if time permits.
- Include at least one participant from every target audience.
- Prefer participants who have organized or helped organize a real activity.
- Do not use the same synthetic scenario if the participant helped write it.

## Session length

Target 40-55 minutes:

1. Introduction and consent: 3 minutes.
2. Neutral tutorial with an unrelated three-card example: 3-5 minutes.
3. First representation task: up to 15 minutes.
4. Failure simulation and comprehension: 8-10 minutes.
5. Matched checklist comparison: 5-8 minutes.
6. Debrief: 5-8 minutes.

Tutorial time is not included in modeling time.

## Counterbalanced comparison

To avoid favoring the graph through task order:

- Participants with odd test IDs use the normal checklist first, then the graph.
- Participants with even test IDs use the graph first, then the normal checklist.
- Both representations must contain the same underlying event information.
- Do not tell participants that the graph is the proposed product and the checklist is the competitor.

## Moderator introduction

> We are testing two ways of representing event preparation. We are testing the materials, not you. Some information may be unclear or incomplete on purpose. Please think aloud. I may ask what you expect to happen, but I will not tell you where to place an item. You may stop at any time.

Do not mention ReadyGraph, AI, innovation, competition scoring, or the expected answer.

## Task 1: understand the event

Give the participant one scenario brief from `TEST_SCENARIOS.md` and the corresponding shuffled cards, without the dependency answer table.

Ask:

> Please review the event information. Tell me when you think you understand what the group is preparing.

Observe:

- questions asked;
- terms that are unclear;
- whether participant searches for missing information;
- whether participant assumes facts not provided.

## Task 2: build the structured plan

Ask:

> Arrange the cards in a way that shows what must be ready and what depends on something else. Add a blank card if you believe something important is missing. Mark any element you consider critical and add backup options where they matter. Tell me when the plan is ready to test.

Start timing at the first placement or annotation. Stop when the participant says the plan is ready.

Moderator rules:

- Do not suggest a dependency.
- If asked what `requires` means, repeat the neutral tutorial definition.
- Do not correct the plan during the task.
- Record each added, removed, or disputed element.
- Stop at 15 minutes and record the state as incomplete unless the participant independently finishes at that moment.

## Task 3: simulate failures

Apply at least three predefined failure cards one at a time. Reset to the baseline between failures.

For each failure ask:

1. What is affected immediately?
2. What else becomes blocked or needs to be checked again?
3. Which critical outcome is affected, if any?
4. Is there a usable fallback?
5. What should the organizer do next?

Record:

- direct effects identified;
- cascading effects identified;
- false effects added;
- missed effects;
- fallback selected;
- explanation quality;
- new useful blocker discovered.

## Fixed comprehension questions

Ask all five after a failure simulation:

1. Which element is the first unresolved prerequisite for the blocked outcome?
2. Which tasks can still proceed despite the failure?
3. Which critical element has the greatest number of downstream effects?
4. Does the proposed fallback fully restore the original plan or require another change?
5. If one status changes from ready to unknown, which completed-looking items must be checked again?

Score one point per correct answer using the scenario answer key. Do not award a point for guessing without a coherent reference to the representation.

## Task 4: normal checklist comparison

Give the participant a flat checklist containing the same tasks and statuses. Ask them to answer a matched failure question.

Then ask:

- Which representation made the affected work easier to identify, if either?
- Which representation was faster to understand?
- Which would you choose for a simple event? Why?
- Which would you choose for an event with several people and fallback options? Why?
- What information was easier to overlook in each version?

Record preference as `graph`, `checklist`, or `no preference`, followed by the participant's explanation. Do not infer preference from completion time alone.

## Task 5: repeat-use and setup-cost questions

Ask after both formats have been tested:

1. On a scale from 1 to 5, how likely would you be to use the structured approach for a suitable real event?
2. What kind of event, if any, would justify the setup effort?
3. What kind of event would not justify it?
4. Which step felt like unnecessary work?
5. What is the maximum setup time you would accept before such an event?
6. What would have to be true for you to trust the simulation result?

## Metrics captured

| Metric | Capture rule |
|---|---|
| Modeling time | Exact elapsed time; tutorial excluded |
| Completion | Complete/incomplete at 15 minutes |
| Comprehension | Correct answers out of 5 |
| Cascade accuracy | Correct expected effects divided by all expected effects for tested failures |
| False-positive effects | Effects participant marks that are not implied by the scenario |
| Useful blockers | New, actionable issues participant identifies and can explain |
| Format preference | Graph/checklist/no preference plus reason |
| Repeat-use willingness | 1-5 plus reason |
| Setup burden | 1-5 plus explanation |

## What counts as a useful blocker

A discovered blocker counts only if all are true:

- it was not already explicitly marked as unresolved;
- it can prevent or materially change a scenario outcome;
- the participant can explain the causal link;
- it leads to a plausible next action, decision, or fallback check;
- it is not a duplicate of another counted blocker.

The moderator must not create the blocker through a hint.

## Invalid or interrupted tests

Mark a test invalid only when:

- the participant cannot complete it because of an interruption unrelated to the prototype;
- the moderator reveals the answer before the task;
- materials are missing or inconsistent with the answer key;
- the participant already knows the full scenario answer key.

Do not invalidate a test because the participant dislikes the idea, fails the task, or prefers the checklist.

## Post-session synthesis

For every test retain:

- anonymous test ID;
- audience;
- scenario and task order;
- raw timing;
- comprehension answers;
- failures tested;
- blockers found;
- errors and confusion;
- preference and reason;
- repeat-use response;
- strongest supporting observation;
- strongest contradicting observation.

Transfer only measured values to `VALIDATION_SCORECARD.md`.

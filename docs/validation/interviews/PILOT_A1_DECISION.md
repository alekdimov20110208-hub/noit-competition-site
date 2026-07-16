# PILOT_A1 — validation decision

## Decision

**Status: `REVISE`**

Do not proceed with the generic ReadyGraph solution, do not kill the underlying coordination problem, and do not select a final pivot yet.

This is a decision based on one pilot interview. It is not a final validation outcome.

## 1. What is validated

The following points are supported **for this participant and the events described**:

- Event preparation can involve many people with distinct communication, content, outreach, website, participant, and transport responsibilities.
- Relevant information can be fragmented across notes, documents, cloud drives, chats, verbal communication, and individual memory.
- Information can be duplicated or remain available only through a particular person's memory.
- Late tasks, missed deadlines, unsuccessful first attempts, and last-minute changes can create additional work and replanning.
- Dependencies between people, tasks, resources, and venue constraints existed in a specific past theatre incident.
- Backup arrangements may exist without being recorded or communicated consistently.
- A detailed plan may be valuable when it produces a clear efficiency benefit.
- The participant found the broad ReadyGraph proposal insufficiently targeted and identified update friction as a central weakness.

"Validated" here means grounded in one participant's reported experience. It does not mean validated across the target market.

## 2. What is not validated

The interview does not validate:

- the frequency or prevalence of the problem across organizers;
- any quantitative frequency estimate from this interview;
- that organizers will spend 10–15 minutes creating a plan;
- that a dependency graph is the preferred representation;
- that manual status updates are acceptable;
- that users will visit a separate website during normal coordination;
- that ReadyGraph is better than Viber, Google Drive, calls, checklists, or established management tools;
- that participants will understand or prefer a prototype;
- that they will use the product repeatedly;
- that one event category is already the correct specialization;
- that the product is feasible, secure, or competition-ready;
- that the underlying problem is large enough to justify implementation.

Prototype-test willingness was not asked and must remain unknown.

## 3. Coordination problem retained

Retain the following problem hypothesis for further validation:

> During preparation of a specific type of small event, information, responsibilities, confirmations, and changes may be spread across several people and tools. When a person, resource, or prerequisite changes, dependent work may require additional coordination and replanning that is not clearly represented in the existing process.

The hypothesis is intentionally about the coordination problem, not about a graph, readiness score, AI feature, or particular interface.

## 4. Generic ReadyGraph solution paused

Pause the broad positioning of ReadyGraph as a workspace for all event types.

Reasons grounded in the interview:

- the value proposition was not sufficiently specific;
- the participant saw overlap with established management tools;
- manual status maintenance appeared burdensome;
- requiring another site introduced friction;
- existing calls, Viber, and Google Drive appeared faster for many ordinary situations;
- the mechanism for detecting a failed element was unclear.

No technical solution to these objections is selected in this decision. In particular, do not assume automation, integrations, notifications, AI monitoring, or background data collection before the target workflow is validated.

## 5. Candidate direction A: specialized martial-arts seminar workspace

### Provisional focus

A narrowly scoped workspace for preparing martial-arts seminars or comparable club events.

### Questions for further interviews

- Which preparation steps recur across seminars?
- Which roles, confirmations, communications, and transport arrangements create the most coordination effort?
- Which changes have meaningful downstream effects?
- What information already lives effectively in chats or cloud documents?
- What specialized view would add value without duplicating those tools?
- Who would maintain the plan, and at what moments?
- Is the problem important for ordinary seminars or only for larger events?

### Current evidence level

`CANDIDATE — NOT SELECTED`

The pilot provides relevant experience and a specialization suggestion, but not enough evidence to choose this direction.

## 6. Candidate direction B: specialized school-theatre production workspace

### Provisional focus

A narrowly scoped workspace for coordinating a school theatre production, where cast participation, scenes, positions, clothing, scenery, venue constraints, and rehearsals can affect one another.

### Questions for further interviews

- Which dependencies recur across school theatre productions?
- How are cast changes propagated to scenes, positions, clothing, and scenery today?
- At what point are venue constraints normally discovered?
- Which artifacts or tools already function as the source of truth?
- Who has authority to update a shared plan?
- Would a specialized workspace reduce work or add another layer of maintenance?
- Are productions frequent enough for repeated use?

### Current evidence level

`CANDIDATE — NOT SELECTED`

The concrete theatre incident makes this direction plausible, but one incident is insufficient for selection.

## 7. Required evidence before choosing a direction

Complete **five additional problem interviews** before choosing between the two candidates or considering another direction.

The five interviews must:

- use the approved neutral interview guide;
- ask for real past events before discussing any concept;
- include the open-ended acceptable-time question before mentioning 10–15 minutes;
- record the 10–15-minute follow-up separately;
- avoid suggesting percentages or frequency ranges before the participant answers;
- keep spontaneous concept reactions separate from later discussion;
- include both supporting and contradicting evidence;
- avoid treating technically oriented participants as representative of all organizers.

Recruitment should obtain evidence relevant to both candidate directions. A final split may depend on access, but neither direction may be selected without more than one relevant participant or incident.

After five additional interviews, compare at minimum:

| Criterion | Martial-arts seminar direction | School-theatre direction |
|---|---|---|
| Number and strength of real incidents | `not yet measured` | `not yet measured` |
| Recurrence of the workflow | `not yet measured` | `not yet measured` |
| Existing-tool gaps | `not yet measured` | `not yet measured` |
| Acceptable setup effort | `not yet measured` | `not yet measured` |
| Clear owner for maintaining information | `not yet measured` | `not yet measured` |
| Access to prototype testers | `not yet measured` | `not yet measured` |
| Potential for repeated use | `not yet measured` | `not yet measured` |

Do not choose by interview count alone; assess evidence quality and counter-evidence.

## 8. Updated time constraint

Use **approximately 22 hours per week** for all future:

- feasibility estimates;
- MVP planning;
- roadmaps and development timelines;
- testing schedules;
- documentation schedules;
- risk and scope assessments.

The earlier assumption of 7 hours per week is superseded.

Additional available time is not permission to expand scope without evidence. Future planning must prioritize a polished, reliable, secure, well-tested core product and retain explicit buffer for testing, documentation, correction, deployment, and competition preparation.

## 9. Next allowed action

Conduct and record five additional neutral interviews. Do not write application code, create the technical architecture, or select a final pivot before reviewing that evidence.

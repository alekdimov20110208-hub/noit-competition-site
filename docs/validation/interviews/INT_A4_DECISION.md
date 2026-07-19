# Interview INT-A4 Decision

## Decision

`REVISE`

The specialized martial-arts seminar domain remains supported, but the target user and core value proposition require further revision. Mature recurring teams may rely successfully on learned routines, messaging, and Google Drive, while first-time or infrequent seminar organizers may have a stronger need for structured guidance.

This is an interview-level decision. It is not a final `PROCEED` decision and does not authorize application development, architecture, or prototype creation.

## What was supported

The following findings are supported for this participant and the seminar workflow described:

- **[PR]** Seminar operations followed a highly repeatable process over multiple years.
- **[PR]** Operational helpers learned recurring tasks well enough that the team stopped using an earlier Excel responsibility plan.
- **[PR]** The chief instructor retained the complete picture, decision authority, timelines, and some broader contingency knowledge.
- **[PR]** Helpers knew local tasks and simple fallbacks without having access to the complete contingency model.
- **[PR]** Late breakfast, late food delivery, travel disruption, testing rescheduling, and registration misunderstanding were real incidents.
- **[PR]** Time-sensitive work still used concrete times and verbal or text-message confirmation.
- **[PR]** Google Drive and messaging worked well for the described team.
- **[PO]** Heavy administrative expectations could frustrate helpers with limited volunteer time.
- **[PO]** An application appeared more relevant to a first-time or inexperienced seminar organizer than to a mature recurring team.

These remain participant-level findings and must not be generalized to every seminar team.

## What was not validated

INT-A4 does not validate:

- replacing messaging applications or Google Drive;
- “everything in one place” as differentiated value;
- heavy or continuous team-wide task administration;
- requiring every helper to use a new application;
- a complex visual dependency graph;
- extensive prompts for obvious and locally resolvable risks;
- routine product use by experienced recurring seminar teams;
- automatic simulation as the core value;
- willingness to pay;
- prototype usability, task-confirmation behavior, or repeated use;
- the participant as the final strategic decision-maker;
- first-time organizers as a validated primary segment.

## Candidate segment A: experienced chief organizers

### Possible value

- private organizer cockpit;
- long-range planning and critical deadlines;
- private contingencies and knowledge transfer;
- complex guest logistics;
- promotion and merchandise tracking;
- limited helper interaction.

### Evidence and counter-evidence

- **[PR]** INT-A3 provides direct evidence of complex chief-organizer responsibility and concentrated activation logic.
- **[PR]** INT-A4 independently reports that the chief instructor holds the complete picture.
- **[PO]** INT-A4 predicts that an experienced organizer who knows a mature recurring process would probably not use the application routinely.
- **[RI]** Complexity, event variation, and knowledge-transfer needs may distinguish useful cases from mature routine seminars, but this has not been tested.

## Candidate segment B: first-time or infrequent organizers

### Possible value

- guided reusable first-seminar playbook;
- explanation of what must be done and why;
- adaptable timeline and onboarding;
- common-omission prevention;
- simple delegation and confirmations;
- links to existing chat and Drive resources.

### Evidence and counter-evidence

- **[PO]** INT-A4 identifies first-time or inexperienced organizers as a more plausible user group.
- **[PR]** INT-A3 reports that another martial-arts group requested substantial seminar-planning advice.
- **[PO]** Earlier interviews favored specialization and reusable templates.
- **[RI]** No participant has yet been interviewed as an actual first-time seminar organizer, so this segment remains unvalidated.

Neither candidate segment is selected.

## Main product implications to research

Candidate requirements for competitor research and later prototype scoping include:

- a reusable seminar playbook with explanations;
- adaptable timelines and time-sensitive responsibilities;
- one-tap or similarly lightweight confirmation;
- registration status and venue exception handling;
- external-provider and travel contingency notes;
- limited helper views;
- text-message sharing and links to existing Drive files;
- lightweight post-event review;
- reliability or replacement notes for critical roles.

These are research candidates, not approved implementation scope.

## Contradictions and tensions retained

- **[PR]** The workflow was repeatable enough to support a template but familiar enough that the team abandoned formal responsibility tracking.
- **[PR]** The chief instructor held the complete picture while operational helpers knew enough to perform recurring work.
- **[PR]** The participant described no major organizational problems while reporting several absorbed disruptions and exceptions.
- **[PR]** Simple fallbacks were known locally, while broader contingencies were not visible to the participant.
- **[PO]** Prototype testing was accepted, while routine product use by an experienced organizer was doubted.
- **[RI]** These tensions require segment comparison rather than choosing either experienced or first-time organizers from one interview.

## Why the decision is REVISE

- The specialized seminar domain remains supported.
- Repeatability and concentration of strategic knowledge remain supported.
- Existing tools work better for a mature team than previously assumed.
- Mature recurring teams may not need a permanent planning system.
- First-time or infrequent organizers may be a stronger segment, but have not yet been directly studied.
- Helper administrative effort must be extremely low.
- Chat and Drive replacement should be removed from the core value proposition.
- Dependency visualization and extensive risk prompts remain unvalidated.
- No prototype or payment behavior was tested.

## Current project status

`REVISE / MOVE TO MARKET RESEARCH`

The planned core interview phase is complete for the current stage after INT-A4. INT-A5 is not required before market research and remains reserved only for a targeted follow-up if competitor research or later prototype testing exposes a specific evidence gap.

Market research must compare existing seminar checklists, templates, registration tools, club-event products, project-management tools, messaging workflows, and cloud-file workflows before selecting prototype scope.

Development remains unauthorized.

## Next research questions

1. Are first-time or infrequent seminar organizers the strongest primary segment?
2. Would an experienced chief organizer use a private cockpit for a complex international seminar?
3. What existing products already offer seminar checklists, templates, registration, or club-event planning?
4. What differentiated value remains when chat and Drive already work well?
5. How little helper interaction is acceptable, and would one-tap confirmation be used?
6. Should the product link to existing chats and Drive files rather than replace them?
7. Which risks are sufficiently non-obvious and context-dependent to justify guided prompts?
8. Is knowledge transfer a strong enough problem for mature teams?
9. Would a first-time organizer pay for guidance or expect a free checklist?
10. Which features belong in the first low-fidelity prototype?
11. Does another targeted interview become necessary after market research?

## Interview limitations

- The automatic transcript may contain recognition errors.
- English was not the interviewer's native language.
- Some questions required repetition or rephrasing.
- Some examples were abstract or poorly matched to the participant's context.
- The interviewer occasionally supplied possible answers and sometimes defended the concept after negative reactions.
- The initial product explanation was unclear.
- A leading dismissive question is excluded from valid product evidence.
- The participant was an operational helper rather than the chief organizer and deferred some strategic questions.
- Consent was confirmed after the interview; the exchange is not present in the provided transcript.
- No prototype or payment behavior was tested.

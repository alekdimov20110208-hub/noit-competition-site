# Competitor Inventory

## 1. Status and scope

This is an initial discovery inventory for the two unresolved martial-arts seminar organizer hypotheses defined in `docs/market-research/MARKET_RESEARCH_PLAN.md`:

- **Candidate A:** experienced chief organizers of larger or more complex seminars;
- **Candidate B:** first-time or infrequent seminar organizers.

The inventory records current public alternatives, substitute workflows, exclusions, and evidence gaps. It does not select a segment, establish product demand, approve a product concept, compare complete feature sets, authorize a prototype, or authorize development.

The available NOIT regulations apply to the 2025-2026 competition year. Any year-specific requirements must be verified for the actual participation year.

## 2. Research date

- **Discovery completed:** 2026-07-19
- **Initial public-source check date:** 2026-07-19; completed detailed profiles use source checks dated 2026-07-19 or 2026-07-20 as recorded in each corrected row.
- **Detailed-profile review completed:** 2026-07-20 for the 10 shortlisted detailed-review subjects.
- **Research stage:** Inventory synthesis corrected from the completed detailed profiles; authenticated product behavior and remaining profile-specific `Unknown` fields are still unverified.

## 3. Search method

The search covered all nine categories required by the research plan. Representative queries combined the target context and job, for example `martial arts seminar planning software`, `martial arts club management`, `combat sports tournament software`, `event registration software`, `event planning template`, `volunteer scheduling`, and `AI event planner`.

Discovery followed these rules:

1. Search broadly within each category.
2. Open the candidate's official product, documentation, support, or resource page.
3. Confirm current public availability before classification.
4. Record only discovery-level target and job overlap.
5. Mark missing or ambiguous information for later verification instead of inferring feature absence.
6. Treat interview-supported workflows as serious alternatives to a new product.

Search-result snippets were not used as evidence. No account, trial, demo, or paid plan was tested.

## 4. Classification rules

| Classification | Inventory use |
|---|---|
| `DIRECT` | Currently available product explicitly supporting martial-arts seminar planning or operation with substantial target-user and primary-job overlap. |
| `ADJACENT` | Product solving a meaningful part of the workflow without specializing in martial-arts seminar planning. |
| `SUBSTITUTE WORKFLOW` | General tools or habits realistically used instead of a specialized product. |
| `INFORMATIONAL SUBSTITUTE` | Actionable guide, checklist, template, or similar non-software planning resource. |
| `DEPRIORITIZED` | Real product with limited overlap, excessive scope, or weak likelihood of adoption by the target users. |
| `EXCLUDED` | Candidate outside the inclusion boundary after source review. |
| `UNCLEAR` | Potentially relevant candidate requiring deeper verification before inclusion or exclusion. |

`Available` means that a current official page presents the product or resource as usable. It is not proof of regional access, plan access, usability, adoption, or effectiveness.

## 5. Executive inventory summary

- **Total candidates examined:** 30
- **Qualified for continued comparison:** 25
- **Classification counts:** 0 `DIRECT`; 16 `ADJACENT`; 8 `SUBSTITUTE WORKFLOW`; 1 `INFORMATIONAL SUBSTITUTE`; 4 `DEPRIORITIZED`; 1 `EXCLUDED`; 0 `UNCLEAR`.
- **Strongest product categories:** martial-arts club administration, combat-sport tournament execution, general event registration, generic task templates, and volunteer scheduling.
- **Direct-competitor result:** no current official source reviewed in the discovery pass or the completed detailed profiles established a credible product explicitly centered on planning and operating martial-arts seminars for Candidate A or Candidate B.
- **Hardest substitutes to displace:** phone and chat for urgency; messaging plus Google Drive or shared documents for low-friction coordination; learned routines, personal templates, and organizer memory for recurring seminars.

These counts describe search coverage, not market size or product quality. The absence of a confirmed direct competitor in the reviewed evidence is not evidence that none exists in the wider market, and it is not evidence of demand.

## 6. Category search coverage

| Category | Representative queries | Qualified candidates | Excluded or deprioritized | Main evidence gap | Credible direct competitor found? |
|---|---|---|---|---|---|
| Martial-arts club management | `martial arts management software`; `dojo management software`; `martial arts club event software` | Gymdesk, Zen Planner, Martialytics, ClubWorx, Kihon | None in this pass | Whether any product has a seminar-planning workflow beyond membership, classes, attendance, billing, and communication. | No |
| Martial-arts tournament and event platforms | `martial arts tournament software`; `combat sports event management`; `martial arts seminar registration software` | Smoothcomp, Sportdata, Kihapp | Taikai | Whether non-tournament seminar setup extends beyond registration into organizer tasks, contingencies, and learning. | No |
| General event registration | `event registration software`; `small event registration`; `seminar registration platform` | Eventbrite | Ticket Tailor | Whether lightweight registration products connect meaningfully to organizer planning without adding excessive overhead. | No |
| Event planning and checklist products | `event planning software checklist`; `event organizer workflow templates` | Planning Pod, Cvent | None in this pass | Fit and setup burden for small volunteer martial-arts teams. | No |
| Project and task management | `event planning project template`; `reusable event task template`; `event task dependencies` | Asana, ClickUp | None in this pass | Whether generic configuration is simpler than a specialized playbook for either candidate segment. | No |
| Volunteer and staff coordination | `volunteer event scheduling`; `helper confirmation software`; `staff event coordination` | SignUpGenius, VolunteerLocal | Better Impact | Whether one-tap confirmations and limited helper views can work without formal volunteer-program administration. | No |
| Shared-document and communication workflows | `event planning Google Drive chat`; `shared calendar event team`; interview-supported alternatives | Eight substitute workflows | None | Actual effort, reliability, and switching costs across independent seminar teams. | No |
| Seminar checklists, templates, and guides | `seminar planning checklist`; `event planning checklist`; `first event organizer guide` | An Event Planning Checklist for Any Event | None | Martial-arts-specific depth, adaptation effort, and whether static guidance is sufficient for Candidate B. | No |
| AI-assisted event planning | `AI event planning software`; `AI event planner`; `AI event workflow generator` | PlanBrite | Taskade, Dream Event | Output quality, operational depth, privacy, and whether generated plans remain reusable and trustworthy. | No |

## 7. Candidate inventory table

`H`, `M`, and `L` are discovery priorities or relevance judgments, not feature scores. `Unknown` is retained where public evidence is insufficient.

| Candidate | Classification | Category | Current availability | Primary target | Relevant job overlap | Candidate A relevance | Candidate B relevance | Official source | Date checked | Evidence label | Inclusion or exclusion reason | Next research priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gymdesk | ADJACENT | Martial-arts club management | Available | Martial-arts schools and gyms | One-day seminars through scheduled sessions; multi-day seminars/workshops through dated memberships/programs; booking or sign-up forms; waivers/documents; capacity and waitlists; payments; attendance and participant tracking; communications; staff tasks; merchandise/POS; reporting | M | M | https://gymdesk.com/software/martial-arts | 2026-07-20 | **[OD] [OP] [RI]** | Official documentation verifies substantial seminar operations inside a martial-arts school-management product, not a complete seminar-preparation playbook. Current tiers are Micro `$75 USD/month` (up to 50 active members), Small `$100` (51-100), Medium `$150` (101-200), Large `$200` (201-400), and Enterprise contact sales, with a 30-day no-card trial and no permanent free plan. See `docs/market-research/competitors/GYMDESK_PROFILE.md`. | H |
| Zen Planner | ADJACENT | Martial-arts club management | Available | Martial-arts schools | Belt progress, family memberships, payments, and class scheduling | L | M | https://zenplanner.com/martial-arts/ | 2026-07-19 | **[OS]** | Specialized club workflow may shape adoption expectations; event and seminar planning require verification. | M |
| Martialytics | ADJACENT | Martial-arts club management | Available | Martial-arts school owners | Registration, waivers, payments, attendance, progress, communication, and mobile administration | M | M | https://www.martialytics.com/ | 2026-07-19 | **[OS]** | Strong niche positioning and onboarding overlap justify comparison; its public focus is school administration rather than seminar operations. | H |
| ClubWorx | ADJACENT | Martial-arts club management | Available | Martial-arts schools and fitness businesses | Memberships, payments, gradings, classes, attendance, waivers, communication, sales, and marketing | M | M | https://www.clubworx.com/business-types/martial-arts | 2026-07-19 | **[OS]** | Relevant specialized administration and communication, with seminar-specific planning still unknown. | M |
| Kihon | ADJACENT | Martial-arts club management | Available | Martial-arts schools and dojos | Membership, billing, scheduling, waivers, attendance, SMS, and in-app communication | L | M | https://kihonhq.com/ | 2026-07-19 | **[OS]** | Current martial-arts-specific alternative; discovery page does not establish seminar playbooks or organizer contingencies. | M |
| Smoothcomp | ADJACENT | Martial-arts tournament and event platform | Available | Combat-sport tournament organizers, federations, and athletes | Registration, payments, entries, brackets, scheduling, communication, check-in, scoring, and streaming | M | L | https://smoothcomp.com/en | 2026-07-19 | **[OS]** | High martial-arts event relevance but tournament-execution focus; pre-event organizer workflow beyond competition operations needs verification. | H |
| Sportdata | ADJACENT | Martial-arts tournament and event platform | Available | Professional sports-event organizers and federations | Registration, fees, draws, results, schedules, accreditation, scoring, and event services | M | L | https://www.sportdata.org/index_eventcalendar.html | 2026-07-19 | **[OS]** | Substantial event-operation overlap, but scale and tournament orientation may limit adoption by small seminar teams. | M |
| Kihapp | ADJACENT | Martial-arts tournament and event platform | Available | Martial-arts tournament organizers | Registration, payment tracking, divisions, brackets, schedules, results, scoreboards, printable outputs, and configurable public registration for some seminar/training-camp events | M | M | https://www.kihapp.com/terms | 2026-07-19 | **[OS] [DO] [RI]** | Official terms and bounded public-event observation support seminar registration use, not a distinct or complete seminar-planning workflow. Instructor travel/accommodation, organizer cloud-file integration, regional restrictions, supported payment methods by country, currency availability, and seminar-only pricing remain `Unknown`; no unstable demo/configuration URL is retained here. See `docs/market-research/competitors/KIHAPP_PROFILE.md`. | H |
| Taikai | DEPRIORITIZED | Martial-arts tournament and event platform | Limited availability | Karate tournament directors | Registration, divisions, brackets, check-in, scoring, and offline tournament operation | L | L | https://www.taikaiapp.com/ | 2026-07-19 | **[OS]** | Public beta and tightly tournament-specific job create little current overlap with seminar organization. | L |
| Eventbrite | ADJACENT | General event registration | Available | Event creators and organizers | Registration, ticketing, capacity, waitlists, promotion, attendee management, finance, reporting, reminders, and mobile check-in | M | H | https://www.eventbrite.com/organizer/pricing/ | 2026-07-20 | **[OD] [OP] [RI]** | Strong attendee-facing and event-execution coverage; internal preparation tasks, dependencies, contingencies, instructor logistics, and knowledge transfer remain weak or `Unknown`. Bulgaria was absent from the reviewed Eventbrite Payment Processing, payout-country fee, and Pro-plan lists, so Bulgarian paid-event availability and exact pricing remain `Unknown`; US and other European prices are not Bulgarian proxies. See `docs/market-research/competitors/EVENTBRITE_PROFILE.md`. | H |
| Ticket Tailor | DEPRIORITIZED | General event registration | Available | Independent event organizers selling or issuing tickets | Ticketing and mobile check-in | L | M | https://www.tickettailor.com/pricing | 2026-07-19 | **[OP]** | The official pricing page establishes a currently available ticketing and mobile check-in product, but it does not establish meaningful organizer-planning, task, contingency, or knowledge-transfer overlap. | L |
| Planning Pod | ADJACENT | Event planning and checklist product | Available | Event venues, planning firms, and coordination teams | Timelines, assigned tasks, reminders, reusable templates, registration, check-in, permissions, vendors, budgets, cloud-file links, forms, and retained event records | H | M | https://planningpod.com/features | 2026-07-19 | **[OD] [RI]** | Official documentation establishes broad event-operations coverage. Small volunteer-team fit, setup burden, current numeric price, explicit task dependencies, and dedicated contingency behavior remain unverified or `Unknown`, rather than treated as observed absences. See `docs/market-research/competitors/PLANNING_POD_PROFILE.md`. | H |
| Cvent | ADJACENT | Event planning and checklist product | Available | Enterprise event, marketing, and hospitality teams | Registration, templates, attendee operations, integrations, travel, analytics, and AI-assisted event programs | M | L | https://www.cvent.com/en/event-management-software | 2026-07-19 | **[OS]** | Covers complex-event jobs, including travel integrations, but enterprise scale may make it unrealistic for small seminar teams. | M |
| Asana event-planning template | ADJACENT | Project and task management | Available | Event planners and cross-functional teams | Official reusable event-planning template plus broader-product tasks, owners, dates, completion, dependencies, privacy controls, files, status views, and mobile access | H | H | https://asana.com/templates/event-planning | 2026-07-20 | **[OS] [OD] [OP] [RI]** | Strong generic baseline for both candidates. Current Personal is limited to two users per team/project; custom templates, dependencies, forms, rules, private projects, and related planning controls are Starter+ where documented. Exact entitlement for the official gallery template remains `Unknown`, and paid Asana capabilities are not attributed to the template itself. See `docs/market-research/competitors/ASANA_EVENT_PLANNING_TEMPLATE_PROFILE.md`. | H |
| ClickUp event-planning template | ADJACENT | Project and task management | Available | Event-planning teams | Reusable workspace, tasks, owners, deadlines, dependencies, budgets, resources, documents, and multiple views | H | H | https://clickup.com/templates/event-planning-t-4389476 | 2026-07-19 | **[OS]** | Broad planning overlap and ready-made template make it a strong generic baseline; setup and helper burden require testing. | H |
| SignUpGenius | ADJACENT | Volunteer and staff coordination | Available | Schools, nonprofits, teams, and event coordinators | Standard claimable sign-up slots with no-account participation; a separate Events workflow with ticket types/quantities, capacity, attendee questions, reminders, QR tickets, reporting, and check-in | M | H | https://www.signupgenius.com/ | 2026-07-20 | **[OS] [OD] [OP] [RI]** | Strong low-friction helper and lightweight event-execution baseline, not complete long-range event planning. The current public card/digital-wallet fee is `3.95% + $0.95`; the page prints `$` without a currency code. Reviewed documentation limits organizer payment-account availability to the United States or Canada. See `docs/market-research/competitors/SIGNUPGENIUS_PROFILE.md`. | H |
| VolunteerLocal | ADJACENT | Volunteer and staff coordination | Available | Volunteer coordinators and event organizers | Volunteer recruitment, scheduling, email, SMS, mobile access, and delivery tracking | M | M | https://www.volunteerlocal.com/ | 2026-07-19 | **[OS]** | Relevant lightweight staffing and communication overlap; fit for a small recurring seminar team remains unknown. | H |
| Better Impact | DEPRIORITIZED | Volunteer and staff coordination | Available | Formal volunteer programs and larger organizations | Applications, role assignments, shifts, reminders, messaging, permissions, training, and reporting | L | L | https://www.betterimpact.com/features | 2026-07-19 | **[OS]** | Strong volunteer-management capability but likely excessive administrative scope for the small helper teams described in interviews. | L |
| An Event Planning Checklist for Any Event | INFORMATIONAL SUBSTITUTE | Seminar checklists, templates, and guides | Available | General event organizers | Thirteen explanatory planning parts covering goals, budget, venue, experience, promotion, vendors, contingencies, event-day work, and post-event review | M | H | https://www.eventbrite.com/resources/event-planning/checklist/ | 2026-07-20 | **[OS] [RI]** | The exact URL is a live, free, ungated public HTML article. It is not a PDF, download, editable template, or interactive checklist. It supplies broad `what and why` guidance but no native assignment, tracking, reminders, completion, privacy, files, registration, or collaboration. See `docs/market-research/competitors/EVENTBRITE_EVENT_PLANNING_CHECKLIST_PROFILE.md`. | H |
| PlanBrite | ADJACENT | AI-assisted event planning | Available | Event planners and producers | AI-assisted event-production planning with generated budgets, workback timelines, vendor records, production assets, run-of-show details, risks, approvals, collaboration, and exports | H | M | https://www.weplanbrite.com/ | 2026-07-19 | **[OD] [OP] [RI]** | Strong complex-event planning overlap and meaningful product breadth, but the professional-production model, `$39/mo` displayed price with currency code `Unknown`, one-active-event Basic limit, setup, and unverified seminar explanations weaken fit for a lightweight first-time-organizer playbook. See `docs/market-research/competitors/PLANBRITE_PROFILE.md`. | H |
| Dream Event | EXCLUDED | AI-assisted event planning | Available | Consumers seeking event concepts | AI-generated event concepts and planning suggestions | L | L | https://dreamevent.ai/ | 2026-07-19 | **[OS]** | Reviewed positioning does not establish operational team planning for martial-arts seminars; keep outside the detailed-profile queue unless evidence changes. | L |
| Taskade AI | DEPRIORITIZED | AI-assisted event planning | Available | General teams building AI agents and automated workflows | AI agents, generated workflows, tasks, knowledge, and automations | M | M | https://help.taskade.com/hc/en-us/sections/16625853125139--Taskade-AI | 2026-07-19 | **[OD]** | Generic AI workspace may reproduce parts of the concept, but an official seminar or event-planning job was not established in this pass. | M |

## 8. Substitute-workflow inventory

The internal sources below are anonymized validation records, not independent market reviews. Each classification is a **[RI] researcher inference** from the participant-level evidence preserved in those records. These workflows must not be described as broken merely because they distribute information across tools.

| Candidate | Classification | Category | Current availability | Primary target | Relevant job overlap | Candidate A relevance | Candidate B relevance | Official source | Date checked | Evidence label | Inclusion or exclusion reason | Next research priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Messaging plus Google Drive | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Small organizer teams already using chat and cloud files | One selected messaging tool, such as WhatsApp, Viber, or Messenger, for tool-specific replies, reactions, polls, events/reminders, files, and calls, combined with Drive sharing roles, restricted access, versions, offline files, and reusable artifacts; optional Workspace accounts add assigned Docs tasks and shared drives | H | H | `docs/validation/interviews/INT_A4_DECISION.md` | 2026-07-20 | **[RI]** | The messaging products are alternatives, not identical or simultaneously required. This manually assembled workflow has no unified seminar-specific task/file/chat state or built-in martial-arts guidance. INT-A4 nevertheless reports that messaging and Drive worked well for one mature team, so the workflow must not be described as broken. See `docs/market-research/competitors/MESSAGING_PLUS_GOOGLE_DRIVE_PROFILE.md`. | H |
| Messaging plus shared documents | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Small teams coordinating through familiar tools | Discussion, shared plans, notes, and lightweight collaboration | H | H | `docs/validation/interviews/PILOT_A1_DECISION.md` | 2026-07-19 | **[RI]** | Earlier interviews recorded shared documents and chats as established behavior; switching cost and fragmentation must be measured rather than assumed. | H |
| Spreadsheets | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Organizers comfortable with tabular plans | Responsibilities, deadlines, registration, budgets, and repeatable lists | M | H | `docs/validation/interviews/INT_A4_DECISION.md` | 2026-07-19 | **[RI]** | INT-A4 reports that an Excel responsibility plan was useful earlier and abandoned after the routine became familiar. | H |
| Shared calendars | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Teams coordinating dated work | Deadlines, appointments, travel, sessions, and reminders | H | M | `docs/validation/INTERVIEW_SYNTHESIS_TEMPLATE.md` | 2026-07-19 | **[RI]** | Included by the approved research plan as a realistic workflow; actual use and adequacy need direct verification. | M |
| Paper checklists | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Individual organizers and small on-site teams | Portable task, registration, finance, and day-of tracking | M | H | `docs/validation/interviews/INT_A3_DECISION.md` | 2026-07-19 | **[RI]** | Paper lists were reported in the underlying interview record and impose almost no onboarding burden. | H |
| Reusable personal templates | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Experienced organizers with a learned method | External reusable artifacts such as copied spreadsheets, documents, paper checklists, private notes, earlier budgets, schedules, itineraries, materials, and folder structures | H | H | `docs/validation/interviews/INT_A3_DECISION.md` | 2026-07-20 | **[RI]** | The recurring seminar model can be retained privately without adopting a new platform; completeness, freshness, embedded rationale, and transferability remain uncertain. This row remains separately counted from organizer memory. See `docs/market-research/competitors/ORGANIZER_MEMORY_PLUS_REUSABLE_PERSONAL_TEMPLATES_PROFILE.md`. | H |
| Organizer memory | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Experienced chief organizers | Tacit, person-dependent full-plan context, activation logic, trusted assignments, relationships, and private contingencies | H | L | `docs/validation/interviews/INT_A3_DECISION.md` | 2026-07-20 | **[RI]** | Highly flexible and already used in the described cases, but participant-level evidence also identifies concentration and knowledge-transfer risk. This row remains separately counted from reusable personal templates. See `docs/market-research/competitors/ORGANIZER_MEMORY_PLUS_REUSABLE_PERSONAL_TEMPLATES_PROFILE.md`. | H |
| Phone calls for urgent coordination | SUBSTITUTE WORKFLOW | Shared-document and communication workflow | Available | Organizers and helpers handling time-sensitive changes | Immediate feedback, escalation, transport checks, and disruption response | H | H | `docs/validation/interviews/INT_A3_DECISION.md` | 2026-07-19 | **[RI]** | Immediate feedback is valued; the proposed product should coexist with urgent calls rather than attempt to replace them. | H |

**Composite cross-reference - not an additional counted row:** `Organizer memory` and `Reusable personal templates` frequently operate together, but they remain different substitutes: memory is tacit and person-dependent, while templates are external reusable artifacts. The completed composite profile rates the combined workflow Candidate A `High` and Candidate B `Medium`; Candidate B requires access to the artifacts plus sufficient explanation or mentoring. Combining the two in narrative summaries or detailed review must not create a ninth substitute-workflow row. See `docs/market-research/competitors/ORGANIZER_MEMORY_PLUS_REUSABLE_PERSONAL_TEMPLATES_PROFILE.md`.

## 9. Excluded and deprioritized candidates

| Candidate | Result | Evidence-backed reason | Re-entry condition |
|---|---|---|---|
| Taikai | DEPRIORITIZED | **[OS]** Current public-beta positioning is specific to karate tournament registration, brackets, and scoring. | Evidence of reusable seminar planning or non-tournament organizer workflow. |
| Ticket Tailor | DEPRIORITIZED | **[OP]** The official pricing page establishes a currently available ticketing and mobile check-in product, but it does not establish meaningful organizer-planning, task, contingency, or knowledge-transfer overlap. | Official evidence of tasks, reusable organizer plans, or staff coordination. |
| Better Impact | DEPRIORITIZED | **[OS]** Formal volunteer-program scope appears disproportionate to the small seminar helper teams described in interviews. | Evidence of a low-administration mode suitable for small one-off events. |
| Taskade AI | DEPRIORITIZED | **[OD]** Generic AI-agent and automation capability creates only indirect overlap in this pass. | A current official event-planning workflow with reusable operational output. |
| Dream Event | EXCLUDED | **[OS]** Public positioning centers on event concepts rather than operational seminar organization. | Credible official evidence of team tasks, timelines, confirmations, and reusable plans. |

No candidate was excluded merely because a feature was not mentioned on its first public page.

## 10. Direct-competitor finding

### NO CREDIBLE DIRECT COMPETITOR IDENTIFIED IN INITIAL SEARCH

The reviewed martial-arts products focus mainly on ongoing club administration or competition execution. The reviewed planning products are general-purpose, enterprise-oriented, volunteer-focused, informational, or AI-assisted without verified martial-arts seminar specialization.

The completed detailed profiles also retained non-`DIRECT` classifications for all ten detailed-review subjects. Kihapp remains the closest martial-arts event candidate because official terms and bounded public-event evidence include seminars, while PlanBrite remains a strong general event-production planner. Neither detailed profile establishes the substantial target-user, seminar-context, and primary-job overlap required for `DIRECT`. See `docs/market-research/competitors/KIHAPP_PROFILE.md` and `docs/market-research/competitors/PLANBRITE_PROFILE.md`; the other eight controlling profile filenames are listed in section 11.

This finding is bounded to the queries, languages, regions, public sources, and completed profiles checked on 2026-07-19 and 2026-07-20. It is not proof that no direct competitor exists anywhere in the market, and it is not evidence of demand, differentiation, adoption, or willingness to pay.

## 11. Completed detailed-profile shortlist

The ten detailed-review subjects were completed in the original priority order. The shortlist continues to include specialized products, generic planners, a volunteer tool, an informational substitute, and interview-supported workflows; no subject was added, removed, or reordered.

| Priority order | Candidate | Why it is decision-critical |
|---|---|---|
| 1 | PlanBrite | Strong complex-event planning comparator with Candidate A `High` and corrected Candidate B `Medium`; see `docs/market-research/competitors/PLANBRITE_PROFILE.md`. |
| 2 | Kihapp | Closest martial-arts event candidate, with seminar registration use but no verified complete seminar-planning workflow; see `docs/market-research/competitors/KIHAPP_PROFILE.md`. |
| 3 | Planning Pod | Broad general planning/operations comparator whose small-team fit and current numeric price remain unverified; see `docs/market-research/competitors/PLANNING_POD_PROFILE.md`. |
| 4 | Asana event-planning template | Strong generic baseline for reusable plans, ownership, deadlines, dependencies, privacy, files, and mobile access; see `docs/market-research/competitors/ASANA_EVENT_PLANNING_TEMPLATE_PROFILE.md`. |
| 5 | SignUpGenius | Strong baseline for low-burden sign-up slots and the separate lightweight Events/ticketing workflow; see `docs/market-research/competitors/SIGNUPGENIUS_PROFILE.md`. |
| 6 | Eventbrite | Strong registration, ticketing, promotion, attendee, finance, reporting, and check-in alternative, with Bulgarian paid-event availability still `Unknown`; see `docs/market-research/competitors/EVENTBRITE_PROFILE.md`. |
| 7 | Gymdesk | Martial-arts school-management baseline with a verified seminar-operations workflow but no verified complete preparation playbook; see `docs/market-research/competitors/GYMDESK_PROFILE.md`. |
| 8 | An Event Planning Checklist for Any Event | Free, ungated 13-part HTML informational alternative, not an interactive or downloadable checklist; see `docs/market-research/competitors/EVENTBRITE_EVENT_PLANNING_CHECKLIST_PROFILE.md`. |
| 9 | Messaging plus Google Drive | Manually assembled but capable workflow that one mature team reported worked well; see `docs/market-research/competitors/MESSAGING_PLUS_GOOGLE_DRIVE_PROFILE.md`. |
| 10 | Organizer memory plus reusable personal templates | Composite detailed review of the two separately counted substitute rows; Candidate A `High`, Candidate B `Medium`, with artifacts plus explanation/mentoring required for Candidate B. See `docs/market-research/competitors/ORGANIZER_MEMORY_PLUS_REUSABLE_PERSONAL_TEMPLATES_PROFILE.md`. |

ClickUp, Smoothcomp, VolunteerLocal, and Martialytics remain second-wave profiles if the first ten leave a decision-critical gap.

## 12. Evidence gaps

The following questions need deeper source verification or direct observation. They are not feature-absence claims:

- Do Kihapp or martial-arts club platforms support reusable non-tournament seminar plans?
- Can any candidate provide first-time organizer explanations showing what must be done and why?
- Do generic templates preserve a reusable long-range seminar timeline with low setup effort?
- How do products handle guest-instructor travel, accommodation, arrival, departure, and preferences?
- Can organizer-only notes and contingencies be restricted without creating heavy permissions work?
- Can helpers confirm a task without creating an account or navigating a complex workspace?
- Are contingency prompts context-aware, optional, and useful beyond obvious local fallbacks?
- Is post-event learning captured in a reusable way?
- Are promotion and merchandise checkpoints operational features or only generic task categories?
- What current plans, regional restrictions, currencies, free tiers, and limits apply?
- How do PlanBrite's generated outputs, collaboration, and reusable workflows behave in official documentation, trial access, or direct observation?
- Are there Bulgarian-language or regional martial-arts seminar resources missing from the English-led search?

## 13. Next research step

The ten detailed vertical records are complete. The next bounded research stage may:

1. produce the compact comparison matrix from the controlling profiles;
2. compare Candidate A and Candidate B without selecting either prematurely;
3. preserve all pricing, plan, access, region, and currency boundaries;
4. assess remaining feature gaps against messaging/Drive, calls, spreadsheets, checklists, organizer memory, and reusable personal templates;
5. decide whether a specifically targeted interview or approved direct-observation exercise is necessary for a named decision gap;
6. apply one decision rule from `docs/market-research/MARKET_RESEARCH_PLAN.md`.

Completion of the detailed profiles and this inventory correction does not establish demand, select a final segment, authorize a prototype, or authorize development.

## 14. Limitations

- Public pages may omit capabilities, limitations, regional restrictions, or plan requirements.
- No authenticated product account, trial, paid plan, registration, or payment flow was accessed. Bounded public Kihapp event and demonstration pages were inspected without changing data, as recorded in `docs/market-research/competitors/KIHAPP_PROFILE.md`.
- Availability, pricing, and plan contents can change after the detailed-profile checks on 2026-07-19 and 2026-07-20.
- The search was primarily English-language and may underrepresent Bulgarian, regional, or invitation-only products and resources.
- Absence from this inventory is not evidence of absence from the market.
- No authenticated usability, organizer adoption, helper behavior, repeated use, or integration quality was observed.
- No willingness-to-pay or purchase behavior was tested.
- Official marketing claims are evidence of positioning, not proof of effectiveness.
- Candidate relevance and priority are researcher judgments for selecting deeper research, not validated market conclusions.

## Initial-discovery evidence-source count

The following arithmetic preserves the one-primary-label census from the 30-row discovery inventory. Corrected detailed-review rows may now cite multiple evidence types from their controlling profiles; those additional sources are not double-counted below.

| Evidence type | Candidate rows | Use in this inventory |
|---|---:|---|
| **[OS] Official source** | 19 | Official product, company, or resource pages. |
| **[OD] Official documentation** | 1 | Taskade help documentation. |
| **[OP] Official pricing** | 2 | Eventbrite and Ticket Tailor official pricing pages. |
| **[IR] Independent review** | 0 | No third-party review was needed for initial classification. |
| **[DO] Direct observation** | 0 | No direct observation was used as the primary evidence label in the initial discovery census; later bounded Kihapp public-page observation is documented in its profile. |
| **[RI] Researcher inference** | 8 | Classification of interview-supported substitute workflows from anonymized internal records. |
| **Total** | **30** | One initial primary evidence label per counted candidate row. |

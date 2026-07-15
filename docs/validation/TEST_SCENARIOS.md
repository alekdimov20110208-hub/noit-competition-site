# ReadyGraph synthetic low-fidelity test scenarios

## Important limitation

All three scenarios are fictional and exist only for prototype testing. They are not interview results, proof that the problem exists, safety guidance, or descriptions of real organizations. Names and data must remain synthetic.

The scenarios test whether participants can model tasks, roles, resources, dependencies, critical elements, fallbacks, and cascading failures. They deliberately contain discoverable weaknesses.

## Shared card notation

- `T` — task or milestone.
- `P` — person or role.
- `R` — resource, place, or confirmation.
- `requires` — the source cannot be ready until the target is ready.
- `critical` — failure blocks a core outcome unless a valid fallback is activated.
- `fallback` — predefined alternative that may restore readiness.

---

## Scenario 1: regional aikido seminar

### Scenario brief

A small aikido club plans a one-day regional seminar for 35 participants. The seminar uses a rented sports hall. A guest instructor leads two sessions. Club volunteers prepare the training area, welcome participants, and communicate schedule details.

This scenario does not evaluate martial-arts technique, medical readiness, or legal compliance.

### People and roles

| ID | Person or role | Responsibility | Critical? | Fallback |
|---|---|---|---|---|
| P1 | Lead organizer | Coordinates plan and final go/no-go review | Yes | Assistant organizer receives the current plan and contact list |
| P2 | Guest instructor | Leads the planned seminar sessions | Yes | Approved local instructor runs a reduced alternative program |
| P3 | Venue contact | Confirms hall access and opening time | Yes | Escalation to venue office; no assumed substitute venue |
| P4 | Equipment coordinator | Confirms mats and setup transport | Yes | Borrow a predefined smaller mat set and reduce capacity |
| P5 | Registration volunteer | Checks participant list and arrivals | No | Lead organizer uses printed/exported list |
| P6 | Setup team | Lays out and later stores mats | Yes | Recruit two pre-identified reserve volunteers |
| P7 | Communications volunteer | Sends final participant update | No | Lead organizer uses the approved message template |

### Resources and confirmations

| ID | Resource | Critical? | Fallback |
|---|---|---|---|
| R1 | Confirmed hall booking and access time | Yes | Escalate to venue office; postpone if confirmation cannot be obtained |
| R2 | Training mats | Yes | Smaller borrowed set with reduced participant capacity |
| R3 | Vehicle or delivery arrangement for mats | Yes | Pre-identified second vehicle |
| R4 | Participant registration list | No | Latest exported copy |
| R5 | Final schedule and arrival instructions | Yes | Short manual message based on confirmed facts |
| R6 | Basic event contact sheet | No | Printed minimal contact list held by lead organizer |

### Tasks and dependencies

| ID | Task | Requires | Critical? | Completion evidence |
|---|---|---|---|---|
| T1 | Confirm seminar date and program with instructor | P2 | Yes | Instructor confirmation recorded |
| T2 | Confirm venue booking and access | P3, R1 | Yes | Booking/access confirmation recorded |
| T3 | Open participant registration | T1, T2 | No | Registration form available |
| T4 | Confirm mat quantity and delivery plan | P4, R2, R3 | Yes | Quantity and transport owner recorded |
| T5 | Assign setup and registration volunteers | P5, P6 | Yes | Named roles accepted |
| T6 | Freeze participant capacity | T3, T4 | Yes | Capacity decision recorded |
| T7 | Send final participant instructions | T1, T2, T6, P7, R5 | Yes | Approved message marked sent |
| T8 | Open hall and receive equipment | T2, T4, P3, P4 | Yes | Access and delivery confirmed |
| T9 | Prepare training area | T5, T8, P6 | Yes | Setup marked complete |
| T10 | Run participant check-in | T3, T5, R4 | No | Check-in process ready |
| T11 | Begin seminar | T1, T7, T9, P2 | Yes | All critical prerequisites ready |
| T12 | Close event and return equipment | T11, P4, P6 | No | Equipment return recorded |

### Deliberately hidden blocker

The mat fallback reduces usable capacity, but the participant message cannot be finalized until capacity is recalculated. A normal checklist may show both items as separate tasks without revealing the dependency.

### Simulated failures and expected cascades

#### Failure A: guest instructor becomes unavailable

- Failed element: `P2`.
- Direct effects: `T1` and `T11` become blocked.
- Cascading effects without fallback: `T3`, `T7`, and the advertised seminar program are no longer ready.
- Valid recovery: activate the approved local-instructor fallback, revise `T1`, capacity/program assumptions, and `R5`, then resend final information if already distributed.
- Expected insight: replacing the instructor is not a single checkbox; program and communication nodes must be revalidated.

#### Failure B: primary mat transport fails

- Failed element: `R3`.
- Direct effects: `T4` and `T8` become blocked.
- Cascading effects: `T6`, `T7`, `T9`, and `T11` become blocked.
- Valid recovery: use the second vehicle if it supports the full load; otherwise activate the smaller mat set, reduce capacity, update `T6`, and revise `T7`.
- Expected insight: equipment transport affects both physical setup and previously communicated capacity.

#### Failure C: hall access remains unconfirmed

- Failed element: `R1` or `P3` confirmation.
- Direct effects: `T2` is blocked.
- Cascading effects: `T3`, `T7`, `T8`, `T9`, and `T11` are blocked.
- Valid recovery: escalate to venue office. If confirmation is not obtained by the decision deadline, postpone; the scenario intentionally has no invented substitute venue.
- Expected insight: a task marked "booking requested" is not equivalent to confirmed access.

#### Failure D: setup team loses two members

- Failed element: `P6` capacity.
- Direct effects: `T5` or `T9` becomes at risk.
- Cascading effects without reserves: `T11` may be delayed.
- Valid recovery: activate the two reserve volunteers and confirm their arrival time.

---

## Scenario 2: school technology exhibition

### Scenario brief

A school plans an evening exhibition where student teams demonstrate technology projects to families and teachers. Ten exhibits need tables and power. A short opening presentation uses the school projector. Students help with setup and visitor guidance.

### People and roles

| ID | Person or role | Responsibility | Critical? | Fallback |
|---|---|---|---|---|
| P1 | Teacher organizer | Owns the plan and coordinates approvals | Yes | Second teacher receives plan and authority defined by school |
| P2 | School administration contact | Confirms room and event approval | Yes | Escalation to designated administrator |
| P3 | Technical support teacher | Checks power and projector setup | Yes for opening; partial for exhibits | Skip opening projection and use printed introduction |
| P4 | Student exhibit leads | Confirm exhibit needs and attendance | Yes | Team nominates another student; absent exhibit may be removed |
| P5 | Student setup group | Arranges tables, signs, and visitor route | Yes | Reserve student volunteers |
| P6 | Welcome-desk students | Greet visitors and provide program | No | Teacher organizer provides minimal welcome |
| P7 | Communications contact | Sends approved invitation/update | No | Teacher organizer sends approved short message |

### Resources and confirmations

| ID | Resource | Critical? | Fallback |
|---|---|---|---|
| R1 | Approved hall booking | Yes | Approved smaller room with reduced exhibit count, if available |
| R2 | Exhibit requirements list | Yes | Remove unconfirmed exhibits from final layout |
| R3 | Tables and safe power locations | Yes | Reduce powered exhibits and revise layout |
| R4 | Projector and presentation device | No | Printed opening and verbal introduction |
| R5 | Approved visitor invitation | Yes | Delay distribution until approval |
| R6 | Printed or digital floor plan | No | Simple numbered table list |

### Tasks and dependencies

| ID | Task | Requires | Critical? | Completion evidence |
|---|---|---|---|---|
| T1 | Obtain event and room approval | P1, P2, R1 | Yes | Approval recorded |
| T2 | Collect exhibit attendance and needs | P4 | Yes | Each exhibit confirmed or removed |
| T3 | Design room layout | T1, T2, R2, R3 | Yes | Reviewed layout available |
| T4 | Confirm student helper roles | P5, P6 | Yes | Accepted assignments recorded |
| T5 | Prepare invitation | T1, P7, R5 | Yes | Approved content ready |
| T6 | Send invitation | T5 | No | Distribution recorded |
| T7 | Check projector and presentation | P3, R4 | No | Test result recorded |
| T8 | Prepare signs and visitor route | T3, P5, R6 | No | Materials ready |
| T9 | Set up exhibits | T2, T3, T4, P4, P5 | Yes | All active exhibits checked |
| T10 | Run opening presentation | T7, P1 | No | Opening ready or fallback chosen |
| T11 | Open exhibition | T1, T4, T8, T9 | Yes | Critical prerequisites ready |
| T12 | Close and restore room | T11, P4, P5 | No | Room handback recorded |

### Deliberately hidden blocker

The invitation may announce ten exhibits before exhibit power needs and the feasible layout are confirmed. Reducing exhibits later requires updated visitor information.

### Simulated failures and expected cascades

#### Failure A: two exhibit teams do not confirm their requirements

- Failed element: part of `P4` and `R2`.
- Direct effects: `T2` is incomplete.
- Cascading effects: `T3`, `T8`, `T9`, and `T11` cannot be treated as fully ready.
- Valid recovery: remove the unconfirmed exhibits at a defined deadline, recalculate layout, and check whether `T5/T6` needs correction.

#### Failure B: projector fails during the final check

- Failed element: `R4`.
- Direct effect: `T7` and `T10` are blocked.
- Cascading effect: none on the core exhibition if the opening is explicitly non-critical.
- Valid recovery: printed introduction and verbal opening.
- Expected insight: not every failure should reduce core readiness; criticality must be modeled correctly.

#### Failure C: the approved hall becomes unavailable

- Failed element: `R1`.
- Direct effect: `T1` is no longer satisfied.
- Cascading effects: `T3`, `T5/T6`, `T8`, `T9`, and `T11` require revalidation.
- Valid recovery: use the approved smaller room only after reducing exhibit count, redesigning layout, and updating communication.

#### Failure D: half of the setup students are absent

- Failed element: capacity of `P5`.
- Direct effects: `T4`, `T8`, and `T9` are at risk.
- Cascading effect: `T11` may be delayed.
- Valid recovery: activate reserve helpers and simplify non-critical signs before removing exhibit setup work.

---

## Scenario 3: community book-donation sorting day

### Scenario brief

A volunteer group collects donated books, sorts them during a Saturday activity, and prepares accepted books for delivery to a community reading center. The activity uses a borrowed indoor room and volunteer transport.

### People and roles

| ID | Person or role | Responsibility | Critical? | Fallback |
|---|---|---|---|---|
| P1 | Activity coordinator | Confirms plan and partner expectations | Yes | Deputy coordinator has plan and contact sheet |
| P2 | Venue contact | Confirms room access | Yes | Pre-agreed alternative room, if confirmed by deadline |
| P3 | Recipient contact | Confirms accepted categories and capacity | Yes | Pause collection of uncertain categories |
| P4 | Sorting lead | Briefs volunteers and checks categories | Yes | Coordinator uses simplified sorting guide |
| P5 | Volunteer group | Sorts, labels, and packs books | Yes | Reduce intake volume and extend no hours automatically |
| P6 | Transport volunteer | Delivers accepted boxes | Yes | Pre-identified second driver or rescheduled delivery |
| P7 | Communications volunteer | Publishes collection instructions | No | Coordinator sends approved basic notice |

### Resources and confirmations

| ID | Resource | Critical? | Fallback |
|---|---|---|---|
| R1 | Confirmed indoor room and access time | Yes | Confirmed alternative room |
| R2 | Recipient acceptance criteria | Yes | Accept only categories already confirmed in writing |
| R3 | Boxes, labels, and markers | Yes | Smaller reserve pack; reduce intake limit |
| R4 | Vehicle capacity | Yes | Second driver or split delivery on agreed later date |
| R5 | Volunteer attendance estimate | No | Reduce advertised intake and sorting stations |
| R6 | Public collection notice | No | Short corrected notice before collection opens |

### Tasks and dependencies

| ID | Task | Requires | Critical? | Completion evidence |
|---|---|---|---|---|
| T1 | Confirm recipient needs and capacity | P3, R2 | Yes | Criteria and capacity recorded |
| T2 | Confirm room and access | P2, R1 | Yes | Access confirmation recorded |
| T3 | Estimate collection limit | T1, R3, R4, R5 | Yes | Maximum intake recorded |
| T4 | Publish collection instructions | T1, T2, T3, P7, R6 | Yes | Correct notice marked published |
| T5 | Confirm volunteer roles | P4, P5, P6 | Yes | Accepted assignments recorded |
| T6 | Prepare sorting guide and stations | T1, T2, P4, R3 | Yes | Guide and station plan ready |
| T7 | Receive donations | T4, T5, T6 | Yes | Intake process ready |
| T8 | Sort and label accepted books | T7, P4, P5, R2, R3 | Yes | Boxes categorized and labeled |
| T9 | Load and deliver boxes | T8, P6, R4 | Yes | Delivery accepted or rescheduled |
| T10 | Record remaining or rejected items | T8 | No | Disposition list recorded |
| T11 | Close room and report outcome | T9, T10, P1 | No | Closeout recorded |

### Deliberately hidden blocker

The public collection notice depends on both recipient capacity and actual transport/packing capacity. Publishing before those are known can produce more donations than the group can accept or deliver.

### Simulated failures and expected cascades

#### Failure A: recipient reduces accepted categories

- Failed element: part of `R2`.
- Direct effects: `T1` must be updated and `T6` is stale.
- Cascading effects: `T3`, `T4`, `T7`, and `T8` require revalidation.
- Valid recovery: restrict intake to confirmed categories and correct the notice before collection begins.

#### Failure B: transport volunteer becomes unavailable

- Failed element: `P6`.
- Direct effects: `T5` and `T9` are blocked.
- Cascading effects: `T3` and therefore `T4` may no longer be valid because collection capacity assumed transport.
- Valid recovery: confirm the second driver; otherwise lower the intake limit or agree a later delivery and storage plan before receiving items.

#### Failure C: only half the expected boxes are available

- Failed element: capacity of `R3`.
- Direct effects: `T3`, `T6`, and `T8` are constrained.
- Cascading effects: `T4` must reflect a lower intake limit; `T7` cannot proceed under the original plan.
- Valid recovery: use the reserve pack and reduce intake, or obtain additional suitable boxes before the decision deadline.

#### Failure D: primary room access is cancelled

- Failed element: `R1`.
- Direct effect: `T2` fails.
- Cascading effects: `T4`, `T6`, and `T7` are blocked.
- Valid recovery: activate the alternative room only after confirming access and correcting the public notice.

## Moderator answer key

Do not show the dependency tables or cascades to the participant before the modeling and simulation tasks. Give only the scenario brief plus separate task, role, and resource cards. Use the tables afterward to score comprehension and cascade accuracy consistently.

# BudoGraph P3C — Dashboard integration and Change clarity

Date: 2026-10-06. Authorized baseline:
`51a9b51c9044edd74609c64978a03643ab407cc1`. The detailed request approves the
integration scope, rules, flows and tests. P3A/P3B domain contracts remain intact.

## Inspection and implementation boundary

The authenticated Dashboard receives the shared client-composed Task/member
workspace. There is no dedicated backend Dashboard projection. Its presentation
mapper hardcodes an empty legacy Change array and `changesPersisted: false`.
The old ChangeImpact component expects prototype severity/response-status fields;
its unavailable-response message therefore cannot reflect real P3 records.
OperationalFocus currently derives only Task attention. These are disconnected
historical presentation semantics, not an empty database or a P3 read failure.

Reuse ChangeService's validated canonical Event-scoped GET inside the existing
RemoteWorkspaceService composition. No copied Change model, persistence, endpoint,
schema migration or dependency. Only successful canonical reads mean zero Changes.
Unavailable/invalid Change reads clear that data and expose safe loading/error/retry
in the two Dashboard sections; Task/Team reads retain their established behavior.
Authentication/scope loss still clears the complete protected workspace. Existing
abort/revision guards prevent old Event/identity requests publishing. Dashboard
entry, explicit refresh and existing focus/online reads reload; no polling.
Dashboard automatic reentry refresh respects a Task mutation awaiting explicit
recovery: confirmed data, stale warning and disabled Task writes remain intact
until the existing explicit refresh succeeds.

## Deterministic presentation and attention

Operational Changes shows current-Event canonical records by updatedAt descending,
then ID. Preserve one visible record and the existing collapsible continuation.
Each entry links to its durable Change route and shows title, affected Task count,
response owner/unassigned state and one restrained authored-state label. Pending
Decision takes precedence, then prepared Plan B, then recorded Decision. These
labels are derived display descriptions, not persisted lifecycle/status values.

One personal P3 attention item maximum per Change, with this precedence:

1. Active Organizer + no response owner: coordination needs an owner.
2. Current membership is response owner + no Decision: coordinate a decision.
3. Current membership is response owner + Decision + no Response: coordinate the
   operational response.

Missing Plan B alone never produces attention. Another person's owned Change does
not produce personal owner attention. A Member response owner can coordinate and
open read-only detail; only active Organizers author. Operational role grants no
permissions. All P3 attention links use canonical Event/Change URLs.

Existing Task attention selectors and relative ordering are unchanged. Append
personal coordination items in Change order, preserving the existing five-item
collapsed preview and show-more control. Linking a Task to a Change creates no
additional Task attention row and no Task mutation. Task and coordination reasons
remain separately labeled. No risk score or cross-domain priority is invented.

## Clarity and verification

Keep Dashboard composition, section surfaces, typography, palette and responsive
architecture. Replace content in existing structures. Change detail reads cause,
impact, response owner, Decision, Response, then secondary Plan B. Reuse sections,
subtle dividers and short BG/EN explanations; clarify owner versus Task assignee.
The Changes list gains one plain derived state label without badges or new filters.
No generic incident workflow, resolution state, cards, AI, realtime, notifications,
email, Templates, Budget or infrastructure work.

Stages: inspected baseline/locked captures; canonical composition and rule tests;
scoped UI extension and focused checks; real PostgreSQL/browser role/scenario/
navigation/failure matrix; fresh read-only clarity review and locked regressions;
standard checks, evidence/docs and staged-secret audit before commit/push.
Executed counts/results belong in TEST_EVIDENCE. Labeled transport/visual fixtures
are distinct from real backend evidence. No fabricated human acceptance or formal
accessibility certification. Existing human Change is preserved.

The complete master prompt and all 30 supplied regulation pages were reread.
2025–2026 eligibility, team/category, dates, online availability, PDF format,
GPLv3/deliverable and 20/25/35/20 scoring requirements need verification for the
actual participation year. September 15, 2026 is an internal date, not an official
NOIT deadline. This phase maintains source, docs, tests and license records.

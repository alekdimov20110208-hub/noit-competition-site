# BudoGraph P3B — Decision, Response and Plan B

Date: 2026-10-05. Authorized continuation from locked HEAD
`112fe48300082d2963c22da0eb3ec2075cb33d7f`. The detailed P3B request approves the
problem, model, scope, flows, architecture and verification strategy. P1/P2/Auth
and P3A contracts remain locked. Executed verification belongs in TEST_EVIDENCE.

[P3C](BUDOGRAPH_P3C.md) adds canonical Dashboard reads and detail/list clarity. It
supersedes the historical Dashboard snapshot boundary below; the P3B response,
version, history, Task independence and Organizer-only permissions remain unchanged.

## Inspection and implementation contract

The existing React/Vite/TypeScript and Fastify modular monolith, Better Auth
sessions, PostgreSQL/pg, immutable migrations, BG/EN and theme tokens are reused.
Change is the aggregate/security resource. Its Task links project current Task
assignment, status and DATE deadlines in one SQL snapshot. Task state is never
duplicated into response state. The locked Dashboard uses its historical snapshot;
the dedicated Changes route is authoritative for current P3 state.

The historical Backend Foundation roadmap allowed future response-owner Member
editing. The explicit P3B request supersedes that future permission: **only active
Organizers author Decision, Response and Plan B**, even when a Member owns the
response. Operational role and response ownership never grant authorization.

## Current authored state

One Decision per Change, represented as `decision: { text, authoredBy, createdAt,
updatedAt } | null`. The parent Change ID identifies its sole current Decision;
no separate identity, table or version is needed. `authoredBy` is the Organizer
who authored the current revision, resolved from the session's EventMember.
`createdAt` is the first authoring instant of the current uninterrupted Decision;
`updatedAt` changes only when its text changes. Clearing removes text/provenance;
subsequent authoring starts a new current Decision. Other Change edits and Task
changes preserve Decision provenance. Change version covers the entire aggregate.

`response: string | null` records operational action/coordination underway.
`planB: string | null` records the fallback if the primary response cannot proceed.
They have no independent assignee, status, deadline, acceptance or execution.
All fields can be absent; partial states are valid without fabricated placeholders.
Response owner remains the independent active EventMember coordinating the response.

## Persistence and API

Immutable `0005_change_response.sql` adds six nullable columns to `event_change`:
Decision text/author/created/updated, Response text and Plan B text. SQL bounds,
Decision all-or-none provenance, finite ordered timestamps and the composite
same-Event author FK protect persistence. Existing RLS continues unchanged.
Existing Changes acquire null state; rows, versions, timestamps, owners and links
are preserved. No edits to applied migrations or unrelated schema.

Existing POST and PATCH accept optional `decision`, `response`, `planB` text/null.
Decision is bounded to 2,000 characters; Response and Plan B to 5,000, matching
existing bounded prose conventions. Server trims text; supplied whitespace-only,
NUL, malformed Unicode, objects or unbounded values are 400. Explicit null clears;
omitted PATCH fields preserve state. UI clearing an empty textarea sends null.
Canonical GET/list/command responses expose all three plus current live impact.
No new routes, Change deletion or Plan B activation endpoint.

Session/active membership, Event scope, Organizer role, trusted Origin and Fetch
Metadata rules remain authoritative. Forged actor, role, Event authority,
provenance, timestamps or history metadata are rejected by the whitelist.
Inactive/foreign scope is a non-disclosing 404, Member authoring is 403.

## Transactions, versions and activity

Existing Event → identity/membership → Change locking is preserved. Required
`expectedVersion` is checked before any edit/no-op. Meaningful edits atomically
persist all supplied authored state, Decision provenance, one version increment
and one `CHANGE_UPDATED` ActivityEntry. Creation uses `CHANGE_CREATED`. Current
no-op preserves version/time/history; stale no-op is still 409. History-insertion
failure rolls back everything, including any supplied P3A owner/link edits.

P3B changed fields use `{before: "absent" | "present", after: "absent" | "present"}`.
Absent→present means added, present→present means changed, present→absent means
cleared. The entry includes parent before/after version, server actor and clock.
Creation records presence of each field. Coordination prose is not duplicated in
history; P3A metadata remains unchanged. This records operations rather than
reconstructing historical text; ActivityEntry is not event sourcing.

Task deadline/reassignment/status edits do not alter Change version, response
owner or any P3B field. Decision/Response/Plan B and owner edits never mutate Tasks.

## Interface and verification strategy

Existing list/routes/sidebar/switcher and P3A composition are retained. Detail
extends cause/impact with a connected Decision/Response section and quiet fallback
border. Separate labeled plain-text fields extend the existing Organizer form.
Members see readable text/empty states without disabled forms. Shared theme tokens
provide Light/Dark; narrow layouts stack sections and wrap BG text. No list badges.

409 retains the entire local draft and announces/focuses conflict; save is blocked
until explicit canonical reload. Reload replaces the draft only at the user's
explicit request; no automatic merge/replay. Cancel/Escape returns focus.

Stages: model/migration and focused checks; existing UI/adapter extension; real
PostgreSQL transactions and two independent editor connections; real browser
authoring/member/partial/conflict and five-width BG/EN/theme checks; locked P1/P2/
P3A regressions; documentation, full quality checks and secret audit before commit.
Rollback-only fixtures stay transient; committed concurrency/browser synthetic
fixtures and their append-only history are intentionally retained. Existing human
Change is checked read-only for migration compatibility. Transport/long-text mocks
are labeled, separate from real backend evidence. No external human validation or
formal accessibility certification is implied.

No AI, automatic Task mutation, automatic fallback execution, email, notification,
realtime/polling, templates, budget, deployment or generic incident workflow.
Production email remains a later phase. No new dependencies or license assets.

## Competition-year boundary

The complete master prompt and supplied 30-page regulations were read. This phase
maintains complete source, test evidence, user/setup docs and GPLv3 register.
2025–2026 eligibility, categories, team size, schedule, online availability,
PDF formatting, licensing/deliverables and 20/25/35/20 rubric require verification
against the actual participation year's official rules. No later-year currency
or legal compliance is claimed. 15 September 2026 was an internal project date.

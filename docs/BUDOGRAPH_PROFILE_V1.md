# BudoGraph Profile & Account Settings V1

Authorized baseline: `a404169f416761466dc40cc2de06f4acf68ab54e`.
The explicit Profile V1 request approves this extension of the existing concept,
MVP, flows, architecture, PostgreSQL model and testing strategy.

## Contract

`/account` is authenticated and global. Account controls provide the entry point;
it is absent from primary sidebar/mobile navigation. Event routes, public signup,
P4A recovery and the Concept 3 brand remain locked.

The only editable identity field is `name`: trim, 1–100 UTF-16 code units, at
least one Unicode letter/number, no control/format/surrogate characters or angle
brackets. The HTTP adapter rejects every extra field and query parameter.
Better Auth 1.7.7 `/update-user` derives the User ID from the session. Email,
verification, active/image and memberships are preserved. Historical activity
and notification snapshots are not rewritten. `/api/me` supplies the canonical
safe identity; a fresh read after the write supersedes older reads. Failed writes
never replace identity; a failed refresh is explicitly reported with recovery.

Password change uses the installed `/change-password`, current password and
8–128-character new password. UI confirmation must match. Hashing, verification
and session rotation belong to Better Auth. The adapter forces
`revokeOtherSessions=true`: the installed implementation removes **all previous
sessions**, then issues a new HttpOnly cookie for this browser. It strips the
library's returned bearer token/full user from the response. UI clears submitted
password fields. Forgotten-password reset remains separate and still revokes all
sessions without keeping the browser signed in.

Both commands require an authenticated active user, explicit trusted origin and
non-cross-site Fetch Metadata. Existing cookie/verification requirements and
Better Auth limits remain enabled. Extra fields are rejected. The single server
process rejects overlapping commands for the same user (409); UI also prevents
duplicates across page instances and disables logout during a profile write to
avoid competing cookie responses. Navigation and ordinary identity refresh cannot
release another command's client lock. The server lock and existing in-memory
limits are not distributed.
No schema, migration, dependency or infrastructure changes are required.

Preferences reuse PreferencesProvider and its browser-local storage, device
language, system-theme observer and storage failure notices. They are immediate
and synchronized with the header; they are not database profile fields.
Initials use the first and last Unicode words with grapheme-aware first letters,
uppercase and `?` fallback. No image URL is rendered.

Email is read-only. Verified email change requires separately approved ownership,
invitation identity and P4A infrastructure verification. Photo upload requires
approved durable storage, authenticated upload/access policy, file/size/type
validation and retention/deletion rules. No V2 controls or storage are added.
Notification copy describes only current in-app Event task reminders.

## Verification record

Repository checks pass: 263 frontend tests; 133 backend passes with 15 explicitly
opt-in database skips; full real PostgreSQL execution passes 113 results without
failures/skips. Focused coverage adds eight frontend, four backend and six PG
results. Final Vite output retains its existing >500 kB chunk warning.

The final profile browser run passes 13 functional checks, real name/password/session behavior and
20 long-identity cases at 1440/1080/768/390/320, BG/EN, Light/Dark, 125% text
expansion and short-sidebar sizing. System observation and both directions of
preference synchronization pass. Initials are decorative, inputs labelled, notices
focused/live, password autocomplete correct and mobile controls at least 44px.
History, pending navigation/remount, busy/logout and refresh recovery pass.
There are zero application errors. Controlled account values are restored through
the supported APIs; no credential or profile identity is persisted in browser storage.

Frozen synthetic visual comparisons against exact baseline pass all 80
Dashboard/Tasks/Team/Changes cases with pixel-identical content and matching
header, bell, Event switcher and navigation geometry. No global CSS/brand change.
All 14 applicable browser suites pass. TEST_EVIDENCE records exact results,
labelled fixtures and unsuccessful early attempts separately.
Exact staged-content and production-bundle audit passes for all 30 manifest files
and seven configured private-value forms. No environment/secret file, cookie,
real account value, generated screenshot, temporary report or unrelated shortcut
is staged. Dependencies, schema, global styles, brand and notification source
remain unchanged. Formatting and both working/staged diff checks pass.

No pre-existing failure is inferred from an unexplained timeout. The initial
Task actions attempt timed out awaiting an injected-error notice; its stable
repeat passed that section without changes to Task behavior or assertions.

## Exact change manifest

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/BUDOGRAPH_PROFILE_V1.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TEST_EVIDENCE.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-auth-ui.mjs`
- `scripts/verify-profile-ui.mjs`
- `scripts/verify-task-actions-ui.mjs`
- `server/src/auth/profile.ts`
- `server/src/routes/auth.ts`
- `server/tests/profile.integration.test.ts`
- `server/tests/profile.test.ts`
- `src/App.tsx`
- `src/auth/AccountControl.tsx`
- `src/auth/auth.css`
- `src/auth/profile.test.ts`
- `src/auth/profile.ts`
- `src/auth/routing.ts`
- `src/auth/state.ts`
- `src/components/AppShell.tsx`
- `src/i18n/messages.ts`
- `src/i18n/profileMessages.ts`
- `src/pages/AccountPage.tsx`
- `src/pages/account.css`
- `src/routes.ts`

## Competition-year boundary

The complete master prompt and supplied 30-page 2025–2026 regulations were read.
That document confirms VIII–X Software Applications, max two student authors,
source/documentation/user guide, role test accounts, licensed assets/GPLv3 and
the 20/25/35/20 rubric. Eligibility, categories, team limits, dates, online access
periods, PDF formatting and defence rules require verification for the actual
participation year. September 15, 2026 is the historical internal project deadline.
No registration or deployment is performed by this stage.

## Human gates

- Review and understand the code and its security/session policy.
- Exercise keyboard/screen reader and physical-device/password-manager behavior.
- Verify current-year NOIT eligibility, deadlines, access periods and submission/defence rules.
- P4A domain/DNS/Resend invitation, verification and recovery inbox gate is **NOT RUN**.
- Profile V2 remains unstarted. No real email or uploaded photo capability is claimed.

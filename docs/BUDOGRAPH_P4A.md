# P4A — Production email and account safety

Authorized baseline: `4b815432a0a5ecf02a1fc334fed7c93321a44feb`, 2026-10-06.
The user's implementation request approves this stage of the existing problem,
MVP, flows, architecture, PostgreSQL model and testing strategy. P1/P2/P3 and the
AuthShell composition remain locked. Templates, Budget, AI and deployment work
are outside this stage.

## Architecture and dependency contract

Better Auth **1.7.7** remains pinned. Installed route implementations were inspected
alongside official documentation. Better Auth owns signup/password hashing,
verification JWTs, reset-token consumption, sessions and expiry. Fastify exposes
its handler at `/api/auth/*`; public `/sign-up/email` remains disabled, including
on the private registration instance. Invite-only registration still derives the
email from an unexpired, unrevoked invitation under an Event lock.

`server/src/email/service.ts` supplies a small server-only transactional service.
The Resend implementation uses native fetch and `POST https://api.resend.com/emails`.
There are **no dependency upgrades or additions**, no email framework, custom auth
tokens, new business tables or migrations. Existing immutable migrations remain
unchanged. Resend is external delivery infrastructure, not identity storage.

Reference sources checked on 2026-10-06:

- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [Resend send API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction)
- [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction)

## Configuration and trusted links

Server variable names: `EMAIL_MODE`, `RESEND_API_KEY`, `EMAIL_FROM`,
`PUBLIC_APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`,
`NODE_ENV`, `HOST`, `PORT`. Placeholder examples are in `server/.env.example`.
Actual values belong only in ignored local server environment files or the
deployment platform's server secret store. No Vite/client email configuration
exists. Never paste secrets into chat or commit them.

Development/test default to deliberate `EMAIL_MODE=disabled`. `resend` enables
verification and recovery as well as invitation mail. Production always requires
Resend mode, a valid key and a configured non-provider-demo sender. Startup fails
instead of falling back to a developer link. A configured sender cannot prove
domain ownership; Resend dashboard verification is a separate human gate.

`PUBLIC_APP_URL` defaults to the explicit trusted `BETTER_AUTH_URL` origin. For
development email testing, configure the reachable frontend origin. Production
requires matching public/auth HTTPS DNS origins for the same-origin deployment;
localhost/loopback links are rejected. No final domain is hardcoded. Host headers
and forwarded client IP headers never select email origins. The auth adapter
replaces caller callback destinations with server-generated `/verify-email` or
`/reset-password` URLs. Only allowlisted workspace/Event paths or strictly validated invitation paths are retained as
verification continuation. Frontend login continuation keeps its existing allowlist.

## Invitation delivery and retry

Active same-Event Organizer authority, archived checks, normalized email,
duplicate-member/duplicate-pending denial, seven-day expiry, revocation,
SHA-256-only persistence and atomic MEMBER acceptance remain intact.

Create commits the canonical invitation before sending. The browser receives its
safe DTO and `delivery=sent`, `failed`, or `development_link`. `sent` means the
Resend API accepted a request with an email ID; it does not prove inbox delivery.
Failure leaves the invitation pending and displays a clear resend instruction.
There is no provider-error body, email log UI or new delivery ActivityEntry.

`POST /api/events/:eventId/invitations/:invitationId/resend` rechecks active
Organizer, Event scope, pending state, membership, expiry and revocation under
the same lock order. It rotates only the token hash in that invitation; its ID,
creation time and original expiry do not change. Previous links become invalid,
including previously delivered links. Resends cannot create membership or duplicate
invitations. If response delivery is interrupted, reload pending invitations and
resend the existing one. Expired invitations need a fresh explicit invitation.
Concurrent resends serialize; only the latest token remains usable. Sending occurs
after commit, so a simultaneous revocation/acceptance can invalidate an emailed
link safely. No durable queue or crash-recovery delivery guarantee is claimed.

Raw links are returned only when the runtime explicitly enables development/test
links. Production never returns `developmentInvitePath`, including on failure.
The frontend renders copy controls only when that field exists. Link state remains
transient, is cleared on disposal and is never stored in browser persistence.

## Verification and existing users

In Resend mode, invite-only creation schedules a verification email, returns
`verification_required` and shows Verify your email. Verification expires in one
hour and uses Better Auth's signed-token flow. Success returns to a safe auth state;
the user signs in and explicitly accepts the invitation. There is no auto-join or
auto-sign-in. Matching the canonical invited email is still mandatory. Both session
creation and existing-session reads reject unverified users; invitation acceptance
also checks the canonical database verification flag when enabled.

Local read-only preflight found 45 active and 10 inactive users with
`emailVerified=false`. This is local development data, not a production inventory.
No blanket verification migration is run. Mail-disabled development preserves
the existing controlled-account/testing behavior. When delivery is enabled,
existing legitimate users use the generic verification request screen to prove
ownership; correct-password login reports verification needed with a resend action.
Users with an unavailable inbox need a separately approved support policy.
Controlled local accounts can remain in deliberate disabled mode; real mail tests
must use tester-owned inboxes. Arbitrary accounts are never marked verified.

## Recovery, sessions, enumeration and abuse

Login adds a secondary Forgot password link. Requesting recovery returns a generic
result for eligible and nonexistent accounts. Better Auth owns the one-hour reset
record in its existing verification table. Invalid, expired and consumed reset
tokens fail; successful reset changes the password and revokes **all** account
sessions. Old passwords fail and new passwords work. The user then signs in normally.
Reset credentials are captured in component memory and removed from address/history;
they are never written to localStorage. Verification tokens are idempotent ownership
proofs until JWT expiry; unlike password-reset credentials they are not a custom
single-use database flow.

Mail callbacks schedule tracked asynchronous work and return immediately, avoiding
provider latency as an account-existence oracle. Better Auth's installed verification
route supplies its own 500ms anonymous-response floor; reset simulates absent-user
token lookup. HTTP responses do not distinguish absent/already-verified verification
addresses. The process drains pending auth mail before closing PostgreSQL on graceful
shutdown. Provider failures are logged using email kind and a static message only;
no recipient, provider response, password, key or URL is logged. An abrupt process
termination may lose an auth send; the user can request another message.

Focused auth limits are independent of account existence: 3 mail requests per normalized
identity and 10 per direct peer IP in 15 minutes. Invitations allow 30 sends per
Organizer and 60 per direct peer IP in 15 minutes. Each has a 100-request process budget
and bounded 10,000-entry counters. Auth and invitation routes have separate budgets;
invitation identity means Organizer ID. Better Auth's existing limiter remains an
additional layer and may reject sooner. Verification and recovery share their
identity quota. Forwarded IP spoofing is ignored. Single-process in-memory limits
reset on restart and are not coordinated between instances; multiple production
instances need shared limits. Reverse proxies sharing a direct IP share its quota.

## Language, privacy, UI and demo

All three emails have restrained BG/EN HTML and plain-text content, no external
images, no Task/Team/Change operational data and escaped Event names. Invitation
locale uses the Organizer's current product language header. Invite registration
uses the recipient's current product language in its server-controlled callback;
verification/recovery use the current request language. Missing/unsupported language
falls back explicitly to **BG**. No nationality inference or profile-language schema
is introduced. Transactional templates are distinct from the locked future Templates
product feature.

Recovery/verification screens reuse AuthShell, preferences, labels and existing
theme tokens. State transitions focus headings or live/error notices; controls
use at least 44px targets. UI checks cover BG/EN, light/dark/system and
1440/1080/768/390/320 widths. Browser fixtures are labelled separately from real
Better Auth/PostgreSQL checks; no formal accessibility certification is claimed.
Offline demos keep deliberate mail-disabled mode and labelled development links;
external inbox claims require real connectivity. Existing source, user guide,
licenses, backup plan and competition documentation remain required.

## Human domain/provider setup and real-send gate

1. Create/manage the domain and Resend account yourself. Add the controlled sending
   domain in the Resend Domains dashboard; a transactional subdomain is suitable.
2. Copy the exact SPF/DKIM and any displayed MX records from that dashboard to your
   DNS host. Never invent values or create competing SPF records. Follow the
   provider's verification instructions and confirm the domain is verified.
3. Configure recommended DMARC using the provider's guidance and your domain policy.
   Actual record names and values must come from your dashboard/provider guidance.
   Keep open/click tracking disabled on this transactional sending domain so bearer
   links are not rewritten or collected as engagement telemetry. See
   [Resend tracking configuration](https://resend.com/blog/open-and-click-tracking).
4. Create a **Sending access** API key scoped to that sending domain where supported.
   Store it only under `RESEND_API_KEY` in the server's ignored environment/secret store.
5. Set `EMAIL_MODE`, `EMAIL_FROM`, `PUBLIC_APP_URL`, `BETTER_AUTH_URL` and `NODE_ENV`
   for the real server. Use the verified domain's restrained BudoGraph sender and
   matching public HTTPS origins. Restart and check the safe readiness endpoint.
6. With tester-owned inboxes, send an invitation, receive it and complete invite-only
   registration, receive/complete verification, explicitly join, then request/receive
   recovery and sign in with the new password. Confirm old sessions are rejected.
   Check spam, language, expiry, retry and mobile links. Never send unsolicited mail.

**REAL EMAIL HUMAN GATE: NOT RUN.** No local Resend key, sender or public-origin
configuration was present at preflight. Automated tests never send real email.
Exact verification evidence and remaining limits are recorded in TEST_EVIDENCE.md.

## Competition-year boundary

The complete master prompt and supplied 30-page 2025–2026 regulations were read.
Confirmed in that document: VIII–X Software Applications, max two student authors,
standalone useful software, complete source/docs/user guide, licensed assets/GPLv3,
test accounts for roles and online judging availability, plus 20/25/35/20 rubric.
All eligibility/category/team, dates, access periods (including one week before the
regional round and one month after final), PDF formatting and defence requirements
must be verified against the actual participation year's official regulations.
The master prompt's September 15, 2026 date is an internal historical deadline.

## Files and review

Changed/new implementation: `server/src/email/service.ts`, `email/throttle.ts`,
`server/src/config/env.ts`, `auth/auth.ts`, `auth/session.ts`, `invitations/service.ts`,
`routes/auth.ts`, `routes/invitations.ts`, `server/src/app.ts`, `server/src/main.ts`,
`server/.env.example`; `src/auth/accountSafety.ts`, `AuthBoundary.tsx`, `client.ts`,
`state.ts`, `auth.css`; `src/pages/AccountSafetyPage.tsx`, `InvitationPage.tsx`,
`LoginPage.tsx`; `src/components/TeamInvitations.tsx`, `src/services/invitations.ts`,
`src/i18n/accountSafetyMessages.ts`, `messages.ts`, `invitationMessages.ts`, `vite.config.ts`.
Tests/scripts: `server/tests/email.test.ts`, `account-safety.integration.test.ts`,
`env.test.ts`, `invitations.test.ts`, `src/services/invitations.test.ts`, `src/auth/accountSafety.test.ts`,
`scripts/verify-account-safety-ui.mjs`, `verify-auth-ui.mjs`,
`verify-auth-experience-ui.mjs`, `package.json`.
Documentation: this file, README.md, CHANGELOG.md, BACKEND_DEVELOPMENT.md,
DEPLOYMENT_AND_DEMO_PLAN.md, KNOWN_LIMITATIONS.md, USER_GUIDE.md,
THIRD_PARTY_NOTICES.md, PRESENTATION_OUTLINE.md, AI_ASSISTANCE_LOG.md and TEST_EVIDENCE.md.
The unrelated `docs/market-research/docs - Shortcut.lnk` is untouched.

## Exact repository change manifest

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/BUDOGRAPH_P4A.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/PRESENTATION_OUTLINE.md`
- `docs/TEST_EVIDENCE.md`
- `docs/THIRD_PARTY_NOTICES.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-account-safety-ui.mjs`
- `scripts/verify-auth-experience-ui.mjs`
- `scripts/verify-auth-ui.mjs`
- `server/.env.example`
- `server/src/app.ts`
- `server/src/auth/auth.ts`
- `server/src/auth/session.ts`
- `server/src/config/env.ts`
- `server/src/email/service.ts`
- `server/src/email/throttle.ts`
- `server/src/invitations/service.ts`
- `server/src/main.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/invitations.ts`
- `server/tests/account-safety.integration.test.ts`
- `server/tests/email.test.ts`
- `server/tests/env.test.ts`
- `server/tests/invitations.test.ts`
- `src/auth/AuthBoundary.tsx`
- `src/auth/accountSafety.test.ts`
- `src/auth/accountSafety.ts`
- `src/auth/auth.css`
- `src/auth/client.ts`
- `src/auth/state.ts`
- `src/components/TeamInvitations.tsx`
- `src/i18n/accountSafetyMessages.ts`
- `src/i18n/invitationMessages.ts`
- `src/i18n/messages.ts`
- `src/pages/AccountSafetyPage.tsx`
- `src/pages/InvitationPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/services/invitations.test.ts`
- `src/services/invitations.ts`
- `vite.config.ts`

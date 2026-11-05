# BudoGraph Landing L1

Local implementation based on `1acb1fdcb3508cb49b0a8a90a54f3cd2596c6c57`, branch `codex/budograph-landing-l1`. Human review is pending.

The public root describes martial arts event preparation and team coordination in BG and EN. A confirmed session uses the existing Dashboard. The six product examples use illustrative data. A failed or absent signup capability hides public registration actions.

## Local review

From this worktree, build with `pnpm.cmd production:build`. Start the guest preview with `node scripts/preview-landing-l1.mjs` and open <http://127.0.0.1:5191/>. In a second terminal run `node scripts/preview-landing-l1.mjs --signed-in-fixture` and open <http://127.0.0.1:5192/> to see the authenticated empty Dashboard. Each preview serves the built frontend through Fastify and provides read-only HTTP fixtures. The second preview simulates identity for the browser without a real account or session. Stop either server with Ctrl+C.

The automated runner `node scripts/verify-landing-l1-ui.mjs [playwright-module-file] [chromium-executable]` uses the same built frontend with controlled API responses. It writes a JSON report and 16 full-page Chromium screenshots under `tmp/landing-l1/`. Login, signup capability, invitation and password recovery UI are exercised with fixtures. Delivery to a real inbox and hosted registration require separate acceptance.

## Verification

- Frontend suite: 334 passed. Focused signup suite: 10 passed.
- Frontend and server TypeScript, production build and changed-file ESLint passed. Vite still reports a chunk over 500 kB.
- Chromium: 16 BG/EN and light/dark layouts at 320, 390, 768 and 1440 px, plus 8 scenario groups. The report includes keyboard navigation, the FAQ's native expanded state, system theme, reduced motion, session checks and protected links. No page errors were reported.
- HTTP fixtures simulate authentication and account commands for browser review. The browser results do not certify an external identity, database or email service.

## Competition scope

The public page is an entry point to the operational application. The jury path uses documented Organizer and Member accounts and the existing backup demonstration plan. The 2025–2026 eligibility, dates, documentation, licence, evaluation and online availability requirements must be checked for the actual competition year.

## L1.1 identity and mobile refinement

The owner broadly accepted L1's desktop design and requested a clearer martial arts identity and a mobile layout correction. The refined BG/EN hero describes seminar and tournament preparation. All six examples now follow one illustrative Spring Aikido seminar, with localized owners, training-hall confirmation, instructor arrival and tatami setup. The template examples use the existing catalog names Local Aikido seminar and Guest instructor logistics. The Change describes later access to the hall, an Organizer-authored decision and response, and an optional manually executed Plan B. The FAQ explains that draws, scoring, athlete registration and payments use separate systems.

Chromium inspection reproduced the 320 px header problem. The preference controls required 235 px, the gap 12 px and Sign in 51.61 px, exceeding the available 288 px. Flex wrapping placed Sign in alone on a third row. The mobile header now gives brand, menu and Sign in explicit grid positions and places preferences on their own full-width row. The compact menu at up to 360 px keeps its accessible name. The closed header is now 118 px high at both 320 and 390 px; before refinement it was 162 px at 320 px and 110 px at 390 px.

At 768 px, a feature preview was about 305 px wide but retained three narrow Kanban columns because the old rule depended on a 440 px viewport breakpoint. The new container query switches to status rows when the preview itself is narrow. At desktop width it retains three columns. Long task words use normal word boundaries where they fit.

Verification for L1.1 includes frontend TypeScript, frontend/backend production build, changed-file ESLint and 50 focused localization/preferences/routes/auth tests, all passing. Chromium passed 16 BG/EN light/dark layouts at 320, 390, 768 and 1440 px and 8 scenario groups. The layout assertions inspect element bounds, essential content widths, mobile header alignment and unbroken Kanban words. The browser covers menu and FAQ keyboard interaction, hero anchors and Login, registration OFF/ON presentation, system theme, reduced motion, authenticated routing and recovery/invitation entry with controlled API responses.

Run the existing browser runner with a third argument of tmp/landing-l1-1 to keep its results separate from L1. Evidence includes before-layout.json, after-layout.json, report.json, full-page screenshots, expanded mobile navigation and Kanban screenshots at 320 and 390 px. Preview URLs remain <http://127.0.0.1:5191/> and <http://127.0.0.1:5192/>. The existing Vite chunk-size warning remains. Owner HUMAN review is pending.

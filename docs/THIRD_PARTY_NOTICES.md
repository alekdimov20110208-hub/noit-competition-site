# Third-Party Notices and License Register

## Kanban K1-B

| Package | Version | License | Use |
| --- | --- | --- | --- |
| [@dnd-kit/core](https://github.com/clauderic/dnd-kit) | 6.3.1 | MIT | Pointer and keyboard sensors, draggable handles, column targets and announcements |
| [@dnd-kit/accessibility](https://github.com/clauderic/dnd-kit) | 3.1.1 | MIT | Transitive screen-reader support |
| [@dnd-kit/utilities](https://github.com/clauderic/dnd-kit) | 3.2.2 | MIT | Transitive React and DOM helpers |
| [tslib](https://github.com/microsoft/tslib) | 2.9.1 | 0BSD | Transitive runtime helpers |

The packages are used unmodified. Their notices are included in the installed
distributions and apply when redistributing them with the GPL-3.0-only project.

## Runtime D2 — 2026-10-30

`@better-auth/kysely-adapter` **1.7.7** is now an explicit pinned direct dependency
for the transaction-bound native Better Auth adapter. It was already present in
the locked transitive dependency tree; no transitive version changed. License:
**MIT**, retained in the installed package's `LICENSE.md` and package metadata.
[Upstream source](https://github.com/better-auth/better-auth/tree/main/packages/kysely-adapter).
It is used in `server/src/auth/transactions.ts`, unmodified, with its MIT notice
retained on redistribution. It is compatible with the project's GPL-3.0-only
distribution. No image, font, email SDK or other package was added. Reused local
BudoGraph modules and newly authored D2 code remain GPL-3.0-only.

## Deployment D1 — 2026-10-18

D1 adds **no application dependency or external asset**. Static serving uses
Fastify and Node built-ins with a bounded, exact-route in-memory build inventory.
No request input enters filesystem/glob resolution. New source remains
GPL-3.0-only; existing package versions and license notices remain unchanged.

An evaluated static plugin was removed after its glob chain promoted three
brace-expansion advisories into the runtime tree. The advisory's patched version
was unavailable from the installation registry. Neither that dependency nor a
broken override remains. Final `pnpm audit --prod` reports **0 known runtime
advisories** on 2026-10-18; this is feed-dependent evidence, not certification.

Render/Railway/Supabase recommendations use provider documentation and service
terms; no account or service was created. Disposable PostgreSQL, cryptography,
Playwright/Chromium, Sharp and schema validation packages are local verification
tooling only, not new distributed application dependencies. No certificates,
keys, database files, credentials or synthetic dump are committed.

## Event Templates T3 license register update — 2026-10-17

T3 introduces no dependency or third-party asset. New TypeScript, SQL, CSS,
tests and localization are authored project code under the existing
GPL-3.0-only license. PostgreSQL/Playwright/Chromium used for local verification
remain external test tooling with their existing notices; portable binaries,
credentials, screenshots and cluster data are not distributed in source.

P4A (2026-10-06) adds **Resend as an external transactional delivery service** via
native server HTTP. It adds no SDK/package, template framework or external asset;
Better Auth 1.7.7 and `pnpm-lock.yaml` remain unchanged. Service account terms apply
to infrastructure, separately from GPL-3.0-only project source. HTML/text templates
are project-authored. [Resend API reference](https://resend.com/docs/api-reference/emails/send-email).

P2C (2026-10-04) adds no runtime/development package or external asset and does not
change `pnpm-lock.yaml`. It reuses Node built-in cryptography and the registered
Better Auth/PostgreSQL stack. Browser verification uses an externally supplied
Playwright/Edge runtime without adding it to the distributed project. Existing
GPL-3.0-only source licensing and third-party notices remain applicable.

## Project license

BudoGraph source code is distributed under the **GNU General Public License version 3 only** (`GPL-3.0-only`). The complete project license text is in the repository root at `LICENSE`.

Third-party packages listed below remain under their respective licenses. Their inclusion does not change their copyright ownership or license terms.

## Phase 1 and Phase 2A direct dependency register

Versions are the resolved versions recorded by `pnpm-lock.yaml` for the Phase 1
workspace on 2026-08-04 and rechecked after Phase 2A on 2026-08-06. Phase 2A
added no dependency or external-asset packages.

Runtime packages:

| Dependency   | Version | Use in BudoGraph                         | License | Upstream              |
| ------------ | ------: | ---------------------------------------- | ------- | --------------------- |
| React        |  19.2.8 | Component and state-based user interface | MIT     | <https://react.dev/>  |
| React DOM    |  19.2.8 | Browser rendering for React              | MIT     | <https://react.dev/>  |
| Lucide React | 0.468.0 | Code-based interface icons               | ISC     | <https://lucide.dev/> |

Direct development and build packages:

| Dependency                  | Version | Use in BudoGraph                    | License            | Upstream                                                     |
| --------------------------- | ------: | ----------------------------------- | ------------------ | ------------------------------------------------------------ |
| @eslint/js                  |  9.39.5 | ESLint JavaScript rule set          | MIT                | <https://eslint.org/>                                        |
| @types/node                 | 22.20.1 | Node.js TypeScript declarations     | MIT                | <https://github.com/DefinitelyTyped/DefinitelyTyped>         |
| @types/react                | 19.2.18 | React TypeScript declarations       | MIT                | <https://github.com/DefinitelyTyped/DefinitelyTyped>         |
| @types/react-dom            |  19.2.4 | React DOM TypeScript declarations   | MIT                | <https://github.com/DefinitelyTyped/DefinitelyTyped>         |
| @vitejs/plugin-react        |   4.7.0 | React support for Vite              | MIT                | <https://github.com/vitejs/vite-plugin-react>                |
| ESLint                      |  9.39.5 | Source linting                      | MIT                | <https://eslint.org/>                                        |
| eslint-plugin-react-hooks   |   5.2.0 | React Hooks lint rules              | MIT                | <https://github.com/facebook/react>                          |
| eslint-plugin-react-refresh |  0.4.26 | React Fast Refresh lint rules       | MIT                | <https://github.com/ArnaudBarre/eslint-plugin-react-refresh> |
| globals                     | 15.15.0 | JavaScript global-name definitions  | MIT                | <https://github.com/sindresorhus/globals>                    |
| Prettier                    |   3.9.6 | Source formatting                   | MIT                | <https://prettier.io/>                                       |
| TypeScript                  |   5.7.3 | Static types and compilation checks | Apache License 2.0 | <https://www.typescriptlang.org/>                            |
| typescript-eslint           |  8.65.0 | TypeScript-aware ESLint integration | MIT                | <https://typescript-eslint.io/>                              |
| Vite                        |   6.4.3 | Development server and bundling     | MIT                | <https://vite.dev/>                                          |

The installed package distributions contain their applicable license texts. `pnpm-lock.yaml` is the authoritative resolved dependency tree. Before a competition submission or redistributed release, review the complete locked transitive tree, retain required copyright/license notices, and update this register if packages or versions change.

## Assets

### Official BudoGraph brand — 2026-10-08

The human user explicitly approved the reconstructed **Concept 3 — BG Monogram**
and authorized its integration. The primary visual reference was the user-supplied
raster presentation `a_clean_graphic_design_brand_board_logo_presenta.png`, supplied
from `D:/Downloads/EXE FILES/`. It is an AI-assisted design reference, not an
authoritative production vector. Its original generator, author/owner and any
independent redistribution clearance have not been verified.

Codex reconstructed the mark as two closed vector paths during the preceding
temporary preparation task. The user approved the canonical SVG from
`C:/Users/Lenovo/AppData/Local/Temp/budograph-brand-review/`. Integration preserves
both approved path strings and fills; only its title metadata was shortened for
production. Curves were inferred/regularized from the large primary raster mark;
lighting and texture were flattened to the reference palette. Pixel-perfect
equivalence, trademark clearance and exclusive ownership are not claimed.

| Resource                 | Location                                                                                       | Source / treatment                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Canonical monogram       | `public/brand/budograph-monogram.svg`                                                          | User-approved AI-assisted reconstruction; navy `#0F2A44`, coral `#F0766B`   |
| Inverse monogram         | `public/brand/budograph-monogram-inverse.svg`                                                  | Deterministic fill change to cream `#FBF7F3`; identical geometry            |
| Favicon                  | `public/brand/favicon.svg`                                                                     | Same geometry, inverse treatment on `#111C2B`; no external service          |
| Ordinary app icon        | `public/brand/app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`                            | Approved inset canvas, unchanged paths                                      |
| Future maskable app icon | `public/brand/app-icon-maskable.svg`, `app-icon-maskable-192.png`, `app-icon-maskable-512.png` | More inset canvas, unchanged paths; safe-area check documented in manifest  |
| Asset inventory/exporter | `public/brand/asset-manifest.json`, `scripts/export-brand-assets.mjs`                          | File hashes and deterministic exports; no additional application dependency |

No third-party attribution or new restrictive asset license is invented. The
repository's existing GPL-3.0-only license remains unchanged; this record is not
an independent legal-clearance claim. No original raster, downloaded font,
stock image or temporary review screenshot is added to the product. Existing
wordmark typography and localized tagline are retained. The gold dot is removed
only from the immediate logo pairing. Final students' understanding/review and
actual-year competition licensing checks remain part of the submission workflow.

The exporter reuses an already installed Sharp verification renderer. It is not
an application dependency, bundled library or distributed font/visual resource.
No dependency or lockfile changes accompany this integration.

### Historical Phase 2A asset state

At the time of this Phase 2A review:

- no externally downloaded images are used;
- no external or downloaded font files are used;
- no stock photography or martial-arts artwork is used;
- no visual logo asset is used; `BudoGraph` is rendered as a text-only wordmark; and
- interface icons are supplied as code-based SVG components by Lucide React under the ISC license listed above.

When the author's hand-drawn logo is added, record the original source, author/owner, creation date if known, license or ownership statement, file locations, and any exported variants here. Any future image, font, audio, video, icon set, or other asset must be recorded before release.

## Audit boundary

This file is a Phase 1/Phase 2A direct-dependency register, not legal advice and
not a claim that a final redistribution audit has been completed. The package
manifest and lockfile must be reviewed again before submission, deployment, or
distribution.

## Backend P1A direct dependency register - 2026-10-03

These resolved versions were checked against the installed package manifests and
their complete `LICENSE` files during P1A. No external visual assets were added.

| Dependency | Version | Use in BudoGraph                                                                   | License | Upstream                                             | Installed license evidence       |
| ---------- | ------: | ---------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- | -------------------------------- |
| Fastify    |  5.12.5 | HTTP app, injection tests, request lifecycle, and built-in Pino logging foundation | MIT     | <https://github.com/fastify/fastify>                 | `node_modules/fastify/LICENSE`   |
| pg         |  8.23.1 | PostgreSQL pool, health query, and explicit SQL migration transactions             | MIT     | <https://github.com/brianc/node-postgres>            | `node_modules/pg/LICENSE`        |
| @types/pg  |  8.23.1 | PostgreSQL client TypeScript declarations; development only                        | MIT     | <https://github.com/DefinitelyTyped/DefinitelyTyped> | `node_modules/@types/pg/LICENSE` |

The inspected copyright notices identify the Fastify team (2016-present), Brian
Carlson (2010-2021) for `pg`, and Microsoft Corporation for `@types/pg`. Each MIT
license requires preservation of its copyright and permission notice in copies
or substantial portions of the package. These packages retain their MIT terms
when included with BudoGraph's GPL-3.0-only source; retain their license texts and
required notices in any redistributed package.

P1A reuses the existing Node.js types, TypeScript, test runner, ESLint, and Prettier.
It adds no ORM, migration framework, environment-loading package, or separate
logging library. Fastify's transitive dependencies, including Pino, remain part of
the resolved lockfile tree. This addition checks the three new direct packages;
the final complete transitive redistribution/notice audit remains required and
is not a legal certification.

## Backend P1B direct dependency register - 2026-10-03

P1B adds one direct runtime dependency, pinned in `package.json` and
`pnpm-lock.yaml`:

| Dependency  | Version | Use in BudoGraph                                                                                 | License | Evidence                                                                                                                                           |
| ----------- | ------: | ------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth |   1.7.7 | Email/password credentials, database-backed sessions, supported server APIs, auth schema tooling | MIT     | Installed `node_modules/better-auth/package.json` and [tagged upstream license](https://github.com/better-auth/better-auth/blob/v1.7.7/LICENSE.md) |

The tagged upstream license names **Copyright (c) 2024 - present, Bereket Engida**.
Preserve its copyright and permission notice when redistributing Better Auth.
The installed 1.7.7 package manifest declares MIT; its package distribution
contains `dist` and does not contain a root `LICENSE` file, so the tagged upstream
`LICENSE.md` was read as the complete notice evidence. The MIT component retains
its terms alongside BudoGraph's GPL-3.0-only source; final distribution must
include the required notices.

Schema generation uses the exact-version official `auth@1.7.7` CLI (MIT) as an
explicit `pnpm dlx` development tool, not a new direct runtime/build dependency.
The schema is generated from the locally installed Better Auth configuration
and incorporated into immutable repository SQL. See
[migration provenance](../server/migrations/README.md).

P1B reuses `pg` and Fastify. It adds no `@fastify/cors`, application ORM, password
hashing package, custom session library, Admin plugin, or visual asset.
Better Auth brings transitive auth/crypto/validation and database-adapter
packages, including Kysely internally; these are not direct BudoGraph ORM
dependencies. Their full resolved tree and redistribution notices still require
the final transitive license audit. This entry does not claim legal certification
or current-year NOIT license compliance; verify the applicable competition rules.

## P1D.1 dependency reuse — 2026-10-03

P1D.1 also uses the existing pinned Better Auth **1.7.7** MIT client entry point
for browser sign-in/sign-out. The same attribution and redistribution notice
above applies. No new dependency, downloaded font, image, or visual asset was
added and the lockfile is unchanged. Browser verification reuses an existing
Playwright runtime (Apache-2.0) and installed desktop browser; these are external
development tools, not included application assets/dependencies. A final full
transitive distribution audit and actual-year NOIT license check remain required.

## T4.1 original editorial catalog — 2026-10-17

The 12 new curated BG/EN plans, 108 Task texts and associated UI/source are original project content authored with Codex assistance, under the existing GPL-3.0-only project license. No external checklist text, image, font, asset or new dependency was imported. Existing React/Lucide and development-tool notices remain applicable. The owner has completed T4.1 editorial Human Acceptance 8/8. Actual-year NOIT requirements and legal/license certification remain separate checks; this entry is not legal certification.

## Landing Stage 1.1 application captures — 2026-11-26

The 24 original screenshots and 72 optimized WebP variants are project-owned renders of the approved BudoGraph application, with synthetic seminar records and the existing original curated template catalog. They are distributed under the project's GPL-3.0-only license. React, Lucide and existing UI resource notices above continue to apply. No Phase 14 redesign, external stock image, font, video or new application dependency is added. Screenshot routes, fixed viewport/clock, synthetic-data disclosure and SHA-256 provenance are recorded in the local Stage 1.1 review package. Browser capture and WebP conversion reuse preinstalled Playwright (Apache-2.0) and Sharp (Apache-2.0) as development tools outside the application dependency graph. Actual-year NOIT compliance and final distribution license review remain separate checks.

# Third-Party Notices and License Register

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

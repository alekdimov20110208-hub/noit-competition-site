# Third-Party Notices and License Register

## Project license

BudoGraph source code is distributed under the **GNU General Public License version 3 only** (`GPL-3.0-only`). The complete project license text is in the repository root at `LICENSE`.

Third-party packages listed below remain under their respective licenses. Their inclusion does not change their copyright ownership or license terms.

## Phase 1 direct dependency register

Versions are the resolved versions recorded by `pnpm-lock.yaml` for the Phase 1 workspace on 2026-08-04.

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

At the time of this Phase 1 register:

- no externally downloaded images are used;
- no external or downloaded font files are used;
- no stock photography or martial-arts artwork is used;
- no visual logo asset is used; `BudoGraph` is rendered as a text-only wordmark; and
- interface icons are supplied as code-based SVG components by Lucide React under the ISC license listed above.

When the author's hand-drawn logo is added, record the original source, author/owner, creation date if known, license or ownership statement, file locations, and any exported variants here. Any future image, font, audio, video, icon set, or other asset must be recorded before release.

## Audit boundary

This file is a Phase 1 register, not legal advice and not a claim that a final redistribution audit has been completed. The package manifest and lockfile must be reviewed again before submission, deployment, or distribution.

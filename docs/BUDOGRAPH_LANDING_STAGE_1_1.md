# Landing Stage 1.1 — accepted implementation, final local RC1, 2026-11-26

Status: **Human Visual Acceptance: PASS — 10/10.** The owner explicitly confirmed all ten human visual acceptance checks successfully on 2026-11-26 in this Codex chat. The accepted implementation and composition A are frozen. Final local release candidate RC1 is prepared for review; publication authorization is still pending. No commit, push, merge, deployment, hosted setting change, database operation or dependency installation is authorized or performed.

## Explicit owner acceptance and freeze

Owner statement: “The owner has completed all ten human visual acceptance checks successfully. Human Visual Acceptance: PASS — 10/10.” This is the owner's reported human result, separate from automated technical checks. Individual checklist labels/results were not separately supplied and are not invented here.

`tmp/stage1-1-rc1/accepted-freeze.json` binds the acceptance to 79 files: the 3 showcase/localization source files, all 72 WebP assets, and the 4 unchanged capture/data/preview/browser-verification scripts. They match the previously delivered review manifest byte for byte. The aggregate SHA-256 is `40df4d8a3af4b653354b456e3f87d758005778823fce54f96ab61e3173e28308` (sorted path, NUL, file SHA-256, LF per entry). No screenshot recapture, visual adjustment or functional change is part of RC1 preparation. Only release documentation, the generated inventory and local packaging tooling change after acceptance.

## Baseline and scope

Render read-only API checks in the owner-confirmed workspace `tea-dbj2ueh42hec73bt0kng` identify STAGING service `srv-dbj45tg473hc73b4ecog` (`budograph-staging-d3`). Its live deploy is `dep-dc3v1ht9el5s739o8meg`, commit `1199382616a34ee978b713e4393590e91eb62b22`, finished 2026-11-26 08:42:41 UTC. Auto-deploy is off. This is the successful Stage 1 baseline, not the earlier `5286f83` application publication.

Separate successor worktree: `C:/NOIT/budograph-landing-stage1-1-interactive`, local branch `codex/landing-stage1-1-interactive`, HEAD still the exact live Stage 1 commit. The owner's Stage 1.1 request authorizes this narrow implementation on the previously approved product, flows, architecture, data model and test strategy. There is no new application or database design.

Composition A, section order, typography, descriptions, icons and identity are retained. Only the six-module showcase becomes interactive. Native module buttons expose the selected state with `aria-pressed`, an accent edge and background; hover/pressed feedback and keyboard focus are visible. Arrow keys, Home/End, Tab, Enter and Space work. The image crossfade is 180ms, disabled under reduced motion. There is no automatic rotation.

The image frame reserves its dimensions throughout loading, transitions and failures. Slow loads are labeled; a failed screen has a translated retry action and never silently substitutes another module. Obsolete image loads cannot replace the latest choice. On phone/tablet selection, the figure immediately scrolls into view with a small margin and no animated scroll. Native new-tab full-size links remain available.

## Screenshots and provenance

All six modules have their own genuine application capture: Tasks list, Kanban board, Calendar month, Team, curated Event Templates library, and Changes detail with the decision, response and complete Plan B visible. No Tasks capture is reused for another module. Changes uses a normal scroll in the existing detail page; other screens start at the top. No UI is reconstructed, restyled or overlaid for the captures.

24 PNG originals cover six modules × BG/EN × Light/Dark. Every capture uses a 1600 × 1050 CSS viewport, DPR 2 (3200 × 2100 pixels), a fixed 2026-11-25 10:00 UTC clock and the same Winter Aikido seminar records from Stage 1's synthetic demonstration scenario. The Templates view reads the existing real curated catalog. Authentication and HTTP records are local read-only fixtures; these are actual application renders with synthetic data, not proof of a live account/database or of new backend behavior. Phase 14 is excluded.

Originals are separate under ignored `tmp/stage1-1/originals/`. `tmp/stage1-1/evidence/screenshot-provenance.json` records route, scroll, viewport, original/asset SHA-256 hashes, visible application text and successful capture checks. All 24 originals have distinct hashes.

72 optimized WebP assets (960, 1600, 3200 pixels per capture) live under `public/landing/product/`. Total WebP size is 5,883,752 bytes. The public landing deliberately keeps the accepted Light screenshot direction in either landing theme. The separate review gallery includes Dark captures for inspection and future use. The browser loads only the chosen module, uses 960/1600 responsive sources and requests a 3200px image only when its full-size link is opened. PNG originals are not part of the public build.

## Local review and reproduction

1. Use the existing project dependencies and supported Node version. No `.env` or real account is needed.
2. Build with `node scripts/production-build.mjs` (or the existing `pnpm production:build` command).
3. Start `node scripts/preview-landing-stage1-1.mjs`.
4. Open <http://127.0.0.1:5193/#features> for the interactive landing. The local preview is read-only, binds to loopback and never connects to a database.
5. Open <http://127.0.0.1:5193/__review/index.html> for originals, before/after evidence, reports and the short recording after generating the review package.

The local preview uses the genuine production main entry. The same preview's synthetic application records are used by `node scripts/capture-landing-stage1-1.mjs`. Development-only browser and image tooling comes from the already installed Codex runtime; `BUDOGRAPH_RUNTIME_MODULES` and `BUDOGRAPH_BROWSER_EXECUTABLE` can point to another existing runtime/browser. The capture/verification tools are not application dependencies.

Before rerunning browser verification, preserve the exact Stage 1 build in `tmp/stage1-1/baseline-dist/` from a separate clean checkout of the baseline commit. Run `node scripts/verify-landing-stage1-1.mjs` after the successor build has finished. Do not rebuild/delete `dist` during a browser run. The verifier starts separate loopback servers for baseline and successor.

## Test report

| Check | Result and evidence |
| --- | --- |
| Existing frontend suite | 334/334 pass; `evidence/frontend-tests.log` |
| Frontend TypeScript | Pass; production build runs `tsc -b` |
| Production frontend/backend build | Pass; `evidence/production-build.log`; no backend source modifications |
| Frontend and new script ESLint | Pass; `evidence/changed-and-frontend-lint.log` |
| Module matrix | 96/96 selections: 6 modules × BG/EN × Light/Dark landing × 320/390/768/1440px; `evidence/browser/report.json` |
| Correct screenshots | Paths, selected button, translated alt text, image completion, full-size link and distinct originals verified |
| Responsive and loading | Fixed image geometry, no horizontal overflow, visible mobile images, no eager unseen/full-size downloads |
| Keyboard and reduced motion | All module buttons; arrows, Home/End, Tab, Enter, Space, visible focus; image animation disabled under reduced motion |
| Errors and races | BG/EN image failure and retry; previous image hidden on failure; delayed load and rapid re-selection cannot restore a stale image |
| Live preference changes | Each selected module survives live BG/EN and Light/Dark switching; screenshot direction stays Light |
| Normal motion and full size | Computed duration 0.18s; actual full-size image opens at 3200px; no rotation during an idle check |
| Browser errors | Zero unexpected page errors, console errors or HTTP failures; expected guest `/api/me` 401 and deliberate aborted image requests are identified separately |
| Other landing sections | 128/128 pixel-identical comparisons across the 16 viewport/language/theme cases |
| Recording | `evidence/browser/module-switching-desktop.webm`, six sequential module selections |

The final browser report is the authoritative technical run, retained unchanged and bound to the frozen accepted files. Intermediate harness calibration caught an irrelevant hover color in a FAQ screenshot, a fractional scroll-edge condition (resolved with the figure scroll margin), and an image 404 while a build was replacing `dist`; those intermediate attempts are not counted as passes. The final run uses a stable completed production build. This is Chromium automation, not a physical-device or multi-browser certification or formal screen-reader audit. The separate explicit owner visual result above is PASS 10/10.

Repository-wide ESLint fails with the same 11 inherited errors in 8 unchanged server files, verified against a baseline replay:

- `server/scripts/staging-database.ts:152`: `no-unsafe-finally`.
- `server/scripts/staging-runtime-login.ts:100`: `no-unsafe-finally`.
- `server/src/staging/activation.ts:133` and `:426`: `no-unsafe-finally`.
- `server/src/staging/catalog.ts:124`: `no-unsafe-finally`.
- `server/src/staging/first-account.ts:82` and `:86`: `no-control-regex`.
- `server/tests/staging-connection-errors.test.ts:193`: `no-regex-spaces`.
- `server/tests/staging-connection-probe.test.ts:211`: `no-regex-spaces`.
- `server/tests/staging-witness-package.test.ts:13` (`no-regex-spaces`) and `:112` (`no-useless-escape`).

The existing Vite bundle-size warning remains: the main JavaScript chunk is above 500kB. No unrelated code splitting is introduced in this landing-only stage. The host's `pnpm` launcher was unable to start its configured dependency-status subprocess, so verification used the exact existing Node/TypeScript/Vite/ESLint commands directly, including the unmodified production build script. No package installation or lockfile update was made.

### Targeted desktop visibility acceptance check

The original report contains six `visible:false` records: 1440px / EN / Light and Dark, for Calendar, Team and Templates. That flag requires the **entire** image frame to fit inside the 1440 × 1000 viewport; it does not mean the selected image is hidden, unloaded or incorrect.

A targeted replay tested the original screenshot-capture sequence and ordinary interaction through the Features navigation link, in both landing themes. In ordinary interaction, the image frame was at viewport y=383–1016: 617 of 633 pixels (97.47%) were visible, with 16px below the fold. The capture sequence also changed the viewport position: the Light Calendar replay clipped 68px (89.26% visible), Light Team/Templates clipped 16px, and the Dark replay happened to show the full frame. Both themes have the same frame dimensions; capture-induced scrolling explains the difference between measurements.

Classification: **harmless vertical viewport clipping; no blocking usability issue detected**. Every affected selection displayed the correct genuine screen, with the selected button visible and no horizontal overflow or page error. Ordinary document scrolling fully revealed all six affected cases, and every preserved full-size link opened its corresponding 3200px image. A small lower image edge and its caption/full-size link can require ordinary scrolling at that viewport position. The accepted design has not changed. This does not claim every desktop scroll position always shows the full image simultaneously.

Evidence: RC1 `evidence/desktop-visibility/report.json`, actual viewport PNGs, fully visible recovery PNGs and `evidence/investigate-desktop-visibility.mjs`. The original six records remain intact in the retained browser report.

## Preservation report

Only the showcase component, scoped showcase CSS, six new translated loading/error/retry strings, screenshot assets, local review scripts and documentation change. The exact inventory is `BUDOGRAPH_LANDING_STAGE_1_1_FILES.md`; the review package also contains a machine-readable SHA-256 inventory and byte comparisons against HEAD for every protected tracked file.

The AuthBoundary, authenticated application pages/components, routes, app logic, common stylesheet, landing page, landing base stylesheet, backend tree, migrations, Render configuration, package manifest, lockfile and R&D content are unchanged. No Phase 14 files, redesign assets or promotional video are imported. Other worktrees and the live Stage 1 publication remain intact. Pixel comparisons cover header, hero, Why BudoGraph, showcase section introduction, How it works, FAQ, CTA and footer; showcase selection styling is the intentional visual difference.

## Final local release candidate and verified rollback

`node scripts/package-landing-stage1-1.mjs` now produces the final local RC1 under `tmp/stage1-1-rc1/`. The earlier review ZIP and `tmp/stage1-1/publication-draft/` remain historical review artifacts; use RC1 for the final inventory and patch. Render was rechecked read-only during RC1 preparation and still reports the specified Stage 1 commit/deploy live; the receipt is `evidence/staging-baseline.json`.

RC1 contains:

- `accepted-freeze.json`: explicit PASS 10/10, per-file accepted hashes and aggregate freeze hash.
- `publication/manifest.json`, `publication/SHA256SUMS.txt` and `publication/payload/`: exact modified/new-file inventory, raw-byte SHA-256, canonical patch SHA-256 and full file overlay. Git text normalization is documented separately from accepted raw bytes.
- `publication/publication.patch`: a full-index, binary-inclusive patch covering **all** modified and new files, including all 72 WebP paths. A temporary Git index is used; the actual worktree index, HEAD and refs are not changed. This closes the earlier draft patch's omission of new files.
- `rollback/rollback.patch` and `rollback/baseline-files/`: the complete inverse patch and original bytes for each modified baseline file. The manifest explicitly lists successor-only files to remove during an eventual authorized rollback.
- `evidence/patch-roundtrip.json`: actual isolated forward/rollback verification, per-file reconstruction hashes, baseline restoration checks, and unchanged real Git index/HEAD checks.
- `evidence/preservation.json`: protected tracked files unchanged, scope/freeze verification and the 128 pixel-identical landing-section comparisons.
- `evidence/`, `originals/`, `index.html` and `SHA256SUMS.txt`: passing technical evidence, documented inherited lint failures, all 24 PNG originals, the six-module switching recording, the final review page and checksums for every packaged artifact other than the checksum file itself.

The archive is `C:/NOIT/BudoGraph-Landing-Stage1.1-RC1-2026-11-26.zip`, with a SHA-256 sidecar. Archive CRC, inventory coverage, candidate hashes and the package checksum list are verified before delivery. The exact publication paths remain in `BUDOGRAPH_LANDING_STAGE_1_1_FILES.md`.

The patch and rollback are tested locally without a commit: export the exact baseline into an isolated temporary directory; apply `publication.patch` after its binary check; verify every one of the 84 reconstructed paths against its canonical patch hash; apply the independently generated inverse `rollback.patch` after its own check; then verify every exported baseline file and the absence of every newly added file. This validates the local source rollback. It does not claim a live Render rollback or restore database/external state.

Git line endings are explicit: the baseline export and indexed patch use canonical Git bytes; validation applies with `git -c core.autocrlf=false -c core.eol=lf apply --no-index --check --binary <patch>` followed by the same command without `--check`, for both forward and inverse patches. Without these isolated validation settings, this Windows host's `core.autocrlf` converts text to CRLF on application, producing a different raw SHA-256 even when the Git content is identical. RC1 therefore records **both** raw payload `sha256` and canonical `patchSha256`, plus baseline raw/canonical hashes. Raw candidate payload files preserve the accepted worktree bytes; binary image bytes are unaffected. No `.gitattributes`, repository Git setting, accepted implementation file or real Git index is changed by this handling.

For any later controlled publication, separately obtain publication authorization, re-confirm the then-live STAGING state against `1199382616a34ee978b713e4393590e91eb62b22`, verify RC1 checksums and review the exact manifest. Apply only in a separate clean candidate and run the documented checks. If STAGING has advanced, stop and reconcile the new baseline instead of overwriting it. Production remains outside scope.

For a future failed Stage 1.1 publication only, the rollback target is the successful Stage 1 commit `1199382616a34ee978b713e4393590e91eb62b22` / deploy `dep-dc3v1ht9el5s739o8meg`. First verify the candidate exactly matches RC1, then check/apply the inverse patch in an isolated rollback candidate and confirm baseline hashes and removal of the listed new files. Review any intervening changes and current hosting compatibility before a separately authorized publication. Do not roll back or deactivate the currently successful Stage 1 deployment. No commit, push, merge or deployment is part of RC1 preparation.

## Separate promotional screenshot archive

`C:/NOIT/BudoGraph-Promotional-Original-Screenshots-24-2026-11-26.zip` contains all 24 unmodified PNG originals for Google Drive, organized as `screenshots/<bg|en>/<light|dark>/`, with a manifest, dimensions, source-commit provenance, synthetic-data/license disclosure and original-file SHA-256 checksums. Its ZIP SHA-256 is `7fa9673bd664dfb246eb8afe29f7f25687424f85198f069d9773ca1e593d185f`; the external `.sha256` sidecar and RC1 `evidence/promotional-originals-zip.json` record verification. All 24 source hashes and archive CRCs pass. This is a separately prepared local archive; no Google Drive upload, sharing change, screenshot alteration or promotional video integration has occurred.

## Competition and licensing

Confirmed in the supplied 2025–2026 source: GPLv3 distribution, full source and user/installation documentation, lawful asset use, demo accounts for actual roles, a completed testable product and online availability. The documented target is VIII–X / Software Applications, with at most two student authors. Screenshots are project-owned application renders with synthetic records under the existing GPL-3.0-only project license, using already-registered UI dependencies. No new third-party asset or application dependency is added.

Dates, categories, exact availability windows, scoring, documentation format and other year-dependent rules belong to 2025–2026 and require verification against the actual competition year's regulations. The 15 September 2026 date in the master prompt is an internal historical project target, not a current official deadline. No current-year legal or competition compliance certification is claimed. Owner review of the AI-assisted source remains pending.

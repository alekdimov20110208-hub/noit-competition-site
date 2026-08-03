# Installation, Deployment, and Demonstration Plan

## Local installation

Prerequisites are Node.js and pnpm. The repository declares pnpm `11.9.0`.

```sh
pnpm install
pnpm dev
```

Vite prints the local URL. BudoGraph has no database, server configuration,
secret, account, or environment file in Phase 1.

## Production-build check

Create and inspect a local production bundle with:

```sh
pnpm build
pnpm preview
```

The generated `dist/` directory is build output and is not committed. A real
deployment must serve the single-page application with history fallback for
`/tasks`, `/team`, `/changes`, and `/templates`.

No public production deployment, uptime promise, monitoring, or backup service
is part of Phase 1. Hosting requirements must be selected and verified against
the regulation for the actual competition year.

## Demonstration data and accounts

- There are no accounts, roles, credentials, passwords, or test-account flows.
- The prototype opens directly into one fictional demonstration event.
- All visible people, venue details, tasks, and incidents are synthetic.
- Use **Templates → Reset demo event → Reset local data** before a presentation
  when a clean scenario is needed.

## Offline and backup presentation plan

This is a preparation plan, not a claim that an offline package has already
been accepted or tested on the competition machine.

Before the presentation:

1. Verify the current source commit and retain the exact `pnpm-lock.yaml`.
2. On the presentation computer, install dependencies while network access is
   available and run `pnpm build`.
3. Disconnect networking and verify both `pnpm dev` and `pnpm preview` locally,
   all five routes, the reset flow, and a refresh-persistence scenario.
4. Keep a second tested copy of the source, lockfile, installed dependency
   store, and production build on encrypted removable media where permitted.
5. Keep a second prepared laptop where permitted, plus non-interactive screen
   captures for explanation if live interaction fails. Screen captures are a
   presentation fallback, not evidence that the application is running.
6. Rehearse a clean reset and the critical flight-change scenario without
   entering real personal data.

The final backup format, media restrictions, online-availability window, and
any required executable or archive must be rechecked against the applicable
competition-year rules.

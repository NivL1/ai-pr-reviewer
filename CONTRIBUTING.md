# Contributing

Thanks for your interest in contributing!

## Local setup

```bash
npm install
cp .env.example .env       # fill in the required values
npm run start:dev
```

## Running tests

```bash
npm test
npm run test:cov           # with coverage
npm run test:e2e
```

## Branching model

This repo uses Git Flow:

- **`master`** — stable, released code. Tagged releases live here.
- **`develop`** — integration branch where features land.
- **`feat/*`**, **`fix/*`** — topic branches off `develop`.

## Submitting changes

1. Fork the repo and create a topic branch from `develop` (e.g. `feat/my-thing`).
2. Add tests for any new behavior.
3. Make sure `npm run lint` and `npm test` pass.
4. Open a PR with `develop` as the **base** branch. The repo's own AI reviewer will comment on the diff — feel free to argue with it.

## Code style

- TypeScript strict mode is on; please keep it that way.
- One responsibility per service. If a file passes ~250 lines, split it.
- Public methods get JSDoc; private helpers get inline comments only when not obvious.

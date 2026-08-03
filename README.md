# AI PR Reviewer

> A NestJS service + GitHub Action that runs LLM-powered code review on pull requests. Designed as a small, production-shaped backend you can self-host — not just a wrapper script.

[![CI](https://github.com/NivL1/ai-pr-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/NivL1/ai-pr-reviewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs)](https://nestjs.com/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](./Dockerfile)

---

## Why this exists

Most "AI PR review" tools are thin wrappers around an LLM call. This repo treats the same problem as a real backend service:

- **HMAC-validated webhook ingestion** so the service can be exposed to the public internet.
- **Incremental re-review** — tracks its own last review on a PR and only diffs what changed since then, instead of re-reviewing (and re-flagging) the whole PR on every push.
- **LLM calls behind a single service boundary** — Anthropic today; a second provider is a new class behind the same call site, not a rewrite (not built yet — see Roadmap).
- **Containerized** with a multi-stage Dockerfile and `docker-compose` for local dev.
- **Two run modes**: long-running NestJS service *or* one-shot GitHub Action.

It exists as a reference for how I structure small AI-powered backends in production.

## Architecture

```
                ┌──────────────────────────┐
   GitHub PR ──▶│  Webhook Controller      │  HMAC verify (X-Hub-Signature-256)
                │  (NestJS, /webhooks)     │
                └──────────┬───────────────┘
                           │ ReviewRequestedEvent
                           ▼
                ┌──────────────────────────┐
                │  Reviewer Service        │  fetch diff (incremental
                │  (orchestrator)          │  since last review), filter
                └──────────┬───────────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌──────────────────┐       ┌──────────────────┐
   │  LLM Service     │       │  GitHub Service  │
   │  (Anthropic SDK) │       │  (Octokit)       │
   └──────────────────┘       └──────────────────┘
```

See [`docs/architecture.md`](./docs/architecture.md) for the long version and [`docs/runbook.md`](./docs/runbook.md) for setup and operations.

## Features

- Inline code review comments on changed lines (not just a top-level summary).
- Incremental re-review: diffs only the changes since its own last review on a PR, not the whole thing every time.
- Cost guardrails: max diff size (skips the review outright rather than truncating it), model pinning.
- Skips generated files, lockfiles, and sourcemaps by default — a fixed ignore list in `reviewer.service.ts`, extend it there to add more (not yet a per-repo runtime config; see Roadmap).
- Health and readiness endpoints suitable for Kubernetes probes.

### Example review comment

![Example inline review comment from Claude](./docs/example-review-comment.png)

## Getting started

### Prerequisites

- Node.js 20+
- Docker (optional, for the container path)
- An Anthropic API key
- A GitHub App or PAT with `pull_requests:write` and `contents:read`

### Local development

```bash
git clone https://github.com/NivL1/ai-pr-reviewer.git
cd ai-pr-reviewer
cp .env.example .env        # fill in ANTHROPIC_API_KEY and GITHUB_WEBHOOK_SECRET
npm install
npm run start:dev
```

Then point a GitHub webhook at `http://<your-ngrok-host>/webhooks/github` with the same secret.

### Docker

```bash
docker compose up --build
```

### As a GitHub Action

Drop this into `.github/workflows/pr-review.yml` in any repo:

```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - name: Run AI review
        uses: NivL1/ai-pr-reviewer@v0.1.2 # pin a tag or commit SHA, not @master
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          GITHUB_SHA: ${{ github.event.pull_request.head.sha }}
```

Add `ANTHROPIC_API_KEY` to your repo's secrets (**Settings → Secrets and variables → Actions**) and you're done. See [`docs/runbook.md`](./docs/runbook.md) for the full setup guide.

## Configuration

| Env var | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key used by the LLM client. |
| `GITHUB_TOKEN` | yes | Token used to fetch diffs and post comments. |
| `GITHUB_WEBHOOK_SECRET` | yes (service mode) | HMAC secret for webhook signature validation. |
| `LLM_MODEL` | no | Defaults to `claude-sonnet-4-6`. |
| `MAX_DIFF_LINES` | no | Cost guardrail. Defaults to `2000`. |
| `PORT` | no | HTTP port. Defaults to `3000`. |

Per-repo `.ai-review.yml` configuration (focus areas, ignore patterns, comment caps) is planned but not implemented yet — see Roadmap.

## Project layout

```
src/
├── main.ts
├── app.module.ts
├── config/             # env validation, typed config
├── github/             # webhook controller, signature guard, Octokit client
├── reviewer/           # diff parsing, filtering, orchestration
├── llm/                # LLM client wrapping the Anthropic SDK directly (not yet abstracted behind a provider interface)
└── health/             # liveness/readiness endpoints
test/                   # unit + e2e tests
.github/workflows/      # CI
action.yml              # GitHub Action manifest
Dockerfile              # multi-stage build
```

## Roadmap

- [x] Anthropic provider — first LLM implementation
- [x] Incremental re-review (only diff changes since the last review on a PR)
- [ ] OpenAI provider behind a shared interface
- [ ] Per-repo `.ai-review.yml` parsing
- [ ] Diff chunking with overlap for large PRs
- [ ] Idempotency cache so a duplicate webhook delivery for the same commit can't double-post
- [ ] Web dashboard (read-only) showing review history
- [ ] Self-hostable Helm chart

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Niv Lusky](https://github.com/NivL1) — Tech Lead @ HopOn.

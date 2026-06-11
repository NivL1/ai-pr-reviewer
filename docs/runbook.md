# Runbook

How to set up, run, and maintain ai-pr-reviewer.

## GitHub Action setup (recommended)

The easiest way to use this is as a GitHub Action in any repo you want reviewed.

### 1. Add the secret

In the target repo: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### 2. Add the workflow

Create `.github/workflows/pr-review.yml` in the target repo:

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
        uses: NivL1/ai-pr-reviewer@master
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          GITHUB_SHA: ${{ github.event.pull_request.head.sha }}
```

That's it. Open a non-draft PR and Claude will post a review.

## Self-hosted service setup

Use this if you want to run the reviewer as a persistent service that receives GitHub webhooks.

### Prerequisites

- Node.js 20+
- An Anthropic API key
- A GitHub token with `pull_requests: write` on the target repos
- A public URL (or ngrok for local dev)

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `GITHUB_TOKEN` | Yes | — | GitHub token with `pull_requests: write` |
| `GITHUB_WEBHOOK_SECRET` | Yes (service mode) | — | Secret used to verify webhook signatures |
| `LLM_MODEL` | No | `claude-sonnet-4-6` | Anthropic model ID |
| `MAX_DIFF_LINES` | No | `2000` | Skip review if filtered diff exceeds this |
| `PORT` | No | `3000` | HTTP port |

### Run locally

```bash
npm install
npm run start:dev
```

### Configure the GitHub webhook

In the repo (or org) you want reviewed: **Settings → Webhooks → Add webhook**

- **Payload URL**: `https://your-host/webhooks/github`
- **Content type**: `application/json`
- **Secret**: same value as `GITHUB_WEBHOOK_SECRET`
- **Events**: Select "Pull requests"

### Run in production

```bash
npm run build
npm run start:prod
```

Or use the provided Docker image:

```bash
docker compose up
```

## Rebuilding the action bundle

`dist/action/index.js` is the bundled entry point for Action mode. It must be committed to the repo. Rebuild it whenever you change any source file:

```bash
npm run build:action
git add dist/action/index.js dist/action/index.js.map
git commit -m "chore(action): rebuild bundle"
```

## Tuning what gets reviewed

### Exclude files from the diff

Edit the `IGNORED` array in `src/reviewer/reviewer.service.ts`:

```typescript
const IGNORED = [/^dist\//, /^build\//, /package-lock\.json$/, /\.map$/];
```

Add any pattern you want Claude to skip (e.g. `/^migrations\//`, `/\.snap$/`).

### Change the review focus

Edit the system prompt in `src/llm/prompts.ts`. By default Claude focuses on bugs, security, race conditions, and missing error handling — and ignores style.

### Increase the diff size limit

Set `MAX_DIFF_LINES` in your env. Note this affects token usage and cost directly.

## Troubleshooting

**Action fails with no output** — `bufferLogs` was previously enabled and swallowed errors. Should be fixed; if you see this again check that `bufferLogs: false` is set in `scripts/run-action.ts`.

**429 rate limit from Anthropic** — The diff sent to Claude is too large. Check that generated files (dist/, lockfiles, sourcemaps) are being filtered. Lower `MAX_DIFF_LINES` or upgrade your Anthropic usage tier.

**`GITHUB_WEBHOOK_SECRET` validation error on startup (Action mode)** — The secret is optional in Action mode. Ensure you're on a version after the `@IsOptional()` fix in `src/config/configuration.ts`.

**Review posted but all comments are on wrong lines** — The `line` field in the LLM response refers to lines in the diff, not the file. If this happens, check the prompt in `src/llm/prompts.ts` and ensure the model is returning line numbers relative to the new file.

# Architecture

This document explains how the service is structured and why.

## Components

### 1. Webhook controller (`src/github/github.controller.ts`)

The only HTTP entry point. Accepts GitHub webhook deliveries at `POST /webhooks/github`. Three things happen here:

1. `WebhookSignatureGuard` runs first and verifies `X-Hub-Signature-256` against the raw body using a timing-safe HMAC comparison. If `GITHUB_WEBHOOK_SECRET` is not set, the guard throws `UnauthorizedException` — it never silently skips validation.
2. The controller filters events: it only acts on `pull_request` events with action `opened`, `synchronize`, or `reopened`, and skips drafts.
3. The actual review work is fired off asynchronously and the controller returns `202 Accepted` immediately, so GitHub doesn't time out and retry.

### 2. Reviewer service (`src/reviewer/reviewer.service.ts`)

Pure orchestration — no HTTP and no model calls of its own:

1. Asks `GithubService` for the diff since our last review on this PR (see below), or the full PR diff the first time
2. Strips generated/irrelevant files via `filterDiff()` (see below)
3. Enforces the `MAX_DIFF_LINES` guardrail on the filtered diff
4. Asks `LlmService` for review output
5. Hands the result back to `GithubService` to post a single review

This separation makes the orchestration logic trivial to unit test (see `test/reviewer.service.spec.ts`).

#### Incremental re-review

Every push to an open PR re-triggers a review. Diffing base...head on every run would mean re-showing the LLM code it already reviewed, which produces the same comments again — including ones already replied to or fixed.

Instead, `GithubService.postReview` stamps a hidden `<!-- ai-pr-reviewer:review -->` marker into every review body it posts. Before reviewing, `ReviewerService` calls `GithubService.findLastReviewedCommit`, which lists past reviews on the PR, finds the most recent one carrying our marker, and returns the commit it was posted against. If found, we diff from that commit to the new head instead of from the PR base — so only genuinely new changes get reviewed. No database needed: GitHub's own review history is the source of truth.

Edge cases:
- No prior review from us → full base...head diff (first review on the PR).
- Last-reviewed commit equals the new head → nothing changed since we last looked (e.g. a redundant webhook delivery); skip without calling the LLM.
- Incremental compare fails (e.g. the old commit is unreachable after a force-push) → fall back to the full base...head diff rather than erroring out.

#### Diff filtering

`filterDiff()` splits the unified diff on `diff --git` boundaries and drops any file chunk whose path matches an ignore pattern:

```
dist/**, build/**, package-lock.json, *.map
```

This prevents generated and lock files from consuming token budget. Extend the `IGNORED` array in `reviewer.service.ts` to add more patterns.

### 3. LLM service (`src/llm/llm.service.ts`)

Wraps the Anthropic SDK behind a single `reviewDiff(diff)` method. The prompt format is defined in `src/llm/prompts.ts` and asks the model for JSON output, which the service parses defensively.

When a second provider is added (OpenAI, a local model), this becomes an abstract `LlmClient` with one implementation per provider, selected by config.

### 4. GitHub service (`src/github/github.service.ts`)

Thin Octokit wrapper: fetch a full or incremental PR diff, find the commit our last review was posted against, and post a review with inline comments. Posting a single review (rather than N separate comments) keeps PR pages readable.

### 5. Health module (`src/health/health.controller.ts`)

`/health` and `/ready` endpoints using `@nestjs/terminus`. Suitable for Kubernetes liveness and readiness probes.

## Two run modes

The same orchestration runs in two shapes:

### Service mode

`npm run start` boots the NestJS HTTP server and listens for webhooks. Suitable for self-hosting behind any reverse proxy. Requires all env vars including `GITHUB_WEBHOOK_SECRET`.

### Action mode

`scripts/run-action.ts` boots NestJS as an `ApplicationContext` (no HTTP listener), runs one review against the PR identified by `GITHUB_REPOSITORY`, `PR_NUMBER`, and `GITHUB_SHA`, then exits. This is what `action.yml` invokes inside a GitHub Actions runner.

The action entry point is bundled into a single file using [`ncc`](https://github.com/vercel/ncc):

```
npm run build:action   # outputs dist/action/index.js
```

`dist/action/` is committed to the repo (excluded from the normal `dist/` gitignore rule) so GitHub Actions runners can execute it without an `npm install` step. **Rebuild and commit `dist/action/index.js` whenever `scripts/run-action.ts` or any `src/` file it depends on changes.**

## Things that are intentionally not here

- **No database.** The service is stateless. Idempotency will be added with an in-memory LRU keyed on `(deliveryId, headSha)` first, then optionally Redis.
- **No queue.** GitHub already retries failed webhook deliveries, so a queue isn't needed for reliability at this scale. If review latency matters, a queue gets added.
- **No multi-tenant config service.** Per-repo configuration lives in each repo's `.ai-review.yml` — fetched on demand, no central database to migrate.

These are the right defaults for v1. They get revisited the moment someone tries to run this at meaningful scale.

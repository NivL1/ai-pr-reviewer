# Architecture

This document explains how the service is structured and why.

## Components

### 1. Webhook controller (`src/github/github.controller.ts`)

The only HTTP entry point. Accepts GitHub webhook deliveries at `POST /webhooks/github`. Three things happen here:

1. `WebhookSignatureGuard` runs first and verifies `X-Hub-Signature-256` against the raw body using a timing-safe HMAC comparison.
2. The controller filters events: it only acts on `pull_request` events with action `opened`, `synchronize`, or `reopened`, and skips drafts.
3. The actual review work is fired off asynchronously and the controller returns `202 Accepted` immediately, so GitHub doesn't time out and retry.

### 2. Reviewer service (`src/reviewer/reviewer.service.ts`)

Pure orchestration — no HTTP and no model calls of its own:

- Asks `GithubService` for the PR diff
- Enforces the `MAX_DIFF_LINES` guardrail
- Asks `LlmService` for review output
- Hands the result back to `GithubService` to post a single review

This separation makes the orchestration logic trivial to unit test (see `test/reviewer.service.spec.ts`).

### 3. LLM service (`src/llm/llm.service.ts`)

Wraps the Anthropic SDK behind a single `reviewDiff(diff)` method. The prompt format is defined in `src/llm/prompts.ts` and asks the model for JSON output, which the service parses defensively.

When a second provider is added (OpenAI, a local model), this becomes an abstract `LlmClient` with one implementation per provider, selected by config.

### 4. GitHub service (`src/github/github.service.ts`)

Thin Octokit wrapper. Two responsibilities: fetch the unified diff for a PR, and post a review with inline comments. Posting a single review (rather than N separate comments) keeps PR pages readable.

### 5. Health module (`src/health/health.controller.ts`)

`/health` and `/ready` endpoints using `@nestjs/terminus`. Suitable for Kubernetes liveness and readiness probes.

## Two run modes

The same orchestration runs in two shapes:

- **Service mode** (default) — `npm run start` boots the NestJS HTTP server and listens for webhooks. Suitable for self-hosting.
- **Action mode** — `scripts/run-action.ts` boots NestJS as an `ApplicationContext` (no HTTP listener), runs one review, and exits. This is what `action.yml` invokes inside a GitHub Actions runner.

## Things that are intentionally not here

- **No database.** The service is stateless. Idempotency will be added with an in-memory LRU keyed on `(deliveryId, headSha)` first, then optionally Redis.
- **No queue.** GitHub already retries failed webhook deliveries, so a queue isn't needed for reliability at this scale. If review latency matters, a queue gets added.
- **No multi-tenant config service.** Per-repo configuration lives in each repo's `.ai-review.yml` — fetched on demand, no central database to migrate.

These are the right defaults for v1. They get revisited the moment someone tries to run this at meaningful scale.

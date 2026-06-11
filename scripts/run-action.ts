/**
 * Entry point used by the GitHub Action mode (see action.yml).
 *
 * Runs a one-shot review against the current PR using env vars set by the
 * action runner (GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_REF, etc.). This file
 * is bundled to dist/action/index.js by the release workflow.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ReviewerService } from '../src/reviewer/reviewer.service';

async function main(): Promise<void> {
  console.log('[Action] Starting ai-pr-reviewer action...');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const reviewer = app.get(ReviewerService);

  const repoFull = process.env.GITHUB_REPOSITORY;
  const prNumber = parseInt(process.env.PR_NUMBER ?? '0', 10);
  const headSha = process.env.GITHUB_SHA;

  if (!repoFull || !prNumber || !headSha) {
    Logger.error('Missing GITHUB_REPOSITORY, PR_NUMBER, or GITHUB_SHA', 'Action');
    process.exit(1);
  }

  const [owner, repo] = repoFull.split('/');

  await reviewer.reviewPullRequest({
    owner,
    repo,
    prNumber,
    headSha,
    deliveryId: `action-${headSha}`,
  });

  await app.close();
}

main().catch((err) => {
  console.error('[Action] Fatal error:', err.stack ?? String(err));
  process.exit(1);
});

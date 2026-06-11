import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GithubService } from '../github/github.service';
import { LlmService } from '../llm/llm.service';

export interface ReviewRequest {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  deliveryId: string;
}

@Injectable()
export class ReviewerService {
  private readonly logger = new Logger(ReviewerService.name);

  constructor(
    private readonly github: GithubService,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  /**
   * End-to-end: fetch the PR diff, ask the LLM for review comments, post them
   * as a single GitHub review.
   *
   * TODO(milestone-1): smart diff chunking with overlap for large PRs.
   * TODO(milestone-1): per-repo .ai-review.yml support (focus areas, ignores).
   * TODO(milestone-2): idempotency cache keyed on (deliveryId, headSha).
   */
  async reviewPullRequest(req: ReviewRequest): Promise<void> {
    const { owner, repo, prNumber, headSha, deliveryId } = req;
    this.logger.log(`Reviewing ${owner}/${repo}#${prNumber} (${deliveryId})`);

    const rawDiff = await this.github.fetchPullRequestDiff(owner, repo, prNumber);
    const diff = this.filterDiff(rawDiff);
    const lineCount = diff.split('\n').length;
    const max = this.config.get<number>('reviewer.maxDiffLines', { infer: true }) ?? 2000;

    if (lineCount > max) {
      this.logger.warn(
        `Skipping ${owner}/${repo}#${prNumber}: diff has ${lineCount} lines, max is ${max}`,
      );
      return;
    }

    const result = await this.llm.reviewDiff(diff);

    await this.github.postReview(owner, repo, prNumber, headSha, result.summary, result.comments);

    this.logger.log(`Posted ${result.comments.length} comments on ${owner}/${repo}#${prNumber}`);
  }

  private filterDiff(diff: string): string {
    const IGNORED = [/^dist\//, /^build\//, /package-lock\.json$/, /\.map$/];
    const files = diff.split(/(?=^diff --git )/m);
    return files
      .filter((chunk) => chunk.trim().length > 0)
      .filter((chunk) => {
        const header = chunk.match(/^diff --git a\/(\S+)/);
        if (!header) return true;
        return !IGNORED.some((pattern) => pattern.test(header[1]));
      })
      .join('');
  }
}

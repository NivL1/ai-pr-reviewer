import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

export interface InlineComment {
  path: string;
  line: number;
  body: string;
}

// Hidden in every review body we post, so we can recognize our own past
// reviews on a PR (and find the commit they were posted against) without
// needing a database — GitHub's own review list is the source of truth.
const REVIEW_MARKER = '<!-- ai-pr-reviewer:review -->';

@Injectable()
export class GithubService implements OnModuleInit {
  private readonly logger = new Logger(GithubService.name);
  private octokit!: Octokit;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const token = this.config.get<string>('github.token', { infer: true });
    this.octokit = new Octokit({ auth: token });
  }

  /** Returns the unified diff for a PR (base...head). */
  async fetchPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });
    // When mediaType.format is 'diff' the body is the raw diff string.
    return data as unknown as string;
  }

  /** Returns the unified diff between two arbitrary commits. */
  async fetchDiffSince(owner: string, repo: string, base: string, head: string): Promise<string> {
    const { data } = await this.octokit.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${base}...${head}`,
      mediaType: { format: 'diff' },
    });
    return data as unknown as string;
  }

  /**
   * Finds the commit our most recent review on this PR was posted against,
   * by looking for our hidden marker in past review bodies — so the caller
   * can diff from there instead of re-reviewing the whole PR on every push.
   * Returns null if we haven't reviewed this PR before.
   */
  async findLastReviewedCommit(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<string | null> {
    const reviews = await this.octokit.paginate(this.octokit.pulls.listReviews, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    const ours = reviews.filter((review) => review.body?.includes(REVIEW_MARKER));
    if (ours.length === 0) {
      return null;
    }

    // listReviews returns reviews oldest-first; the last one is the most recent.
    return ours[ours.length - 1].commit_id ?? null;
  }

  /**
   * Posts an inline review with multiple comments. We post a single review
   * (not N separate comments) so the PR stays readable.
   */
  async postReview(
    owner: string,
    repo: string,
    prNumber: number,
    headSha: string,
    summary: string,
    comments: InlineComment[],
  ): Promise<void> {
    if (comments.length === 0) {
      this.logger.log(`No comments to post on ${owner}/${repo}#${prNumber}`);
      return;
    }

    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      body: `${REVIEW_MARKER}\n${summary}`,
      event: 'COMMENT',
      comments: comments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    });
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

export interface InlineComment {
  path: string;
  line: number;
  body: string;
}

@Injectable()
export class GithubService implements OnModuleInit {
  private readonly logger = new Logger(GithubService.name);
  private octokit!: Octokit;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const token = this.config.get<string>('github.token', { infer: true });
    this.octokit = new Octokit({ auth: token });
  }

  /** Returns the unified diff for a PR. */
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
      body: summary,
      event: 'COMMENT',
      comments: comments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    });
  }
}

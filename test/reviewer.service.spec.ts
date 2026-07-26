import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReviewerService } from '../src/reviewer/reviewer.service';
import { GithubService } from '../src/github/github.service';
import { LlmService } from '../src/llm/llm.service';

describe('ReviewerService', () => {
  let reviewer: ReviewerService;
  let github: jest.Mocked<GithubService>;
  let llm: jest.Mocked<LlmService>;

  beforeEach(async () => {
    github = {
      fetchPullRequestDiff: jest.fn(),
      fetchDiffSince: jest.fn(),
      findLastReviewedCommit: jest.fn().mockResolvedValue(null),
      postReview: jest.fn(),
    } as unknown as jest.Mocked<GithubService>;

    llm = {
      reviewDiff: jest.fn(),
    } as unknown as jest.Mocked<LlmService>;

    const module = await Test.createTestingModule({
      providers: [
        ReviewerService,
        { provide: GithubService, useValue: github },
        { provide: LlmService, useValue: llm },
        {
          provide: ConfigService,
          useValue: { get: () => 2000 },
        },
      ],
    }).compile();

    reviewer = module.get(ReviewerService);
  });

  it('posts a review when the LLM returns comments', async () => {
    github.fetchPullRequestDiff.mockResolvedValue('diff line\n'.repeat(50));
    llm.reviewDiff.mockResolvedValue({
      summary: 'LGTM with one note.',
      comments: [{ path: 'src/foo.ts', line: 12, body: 'Nullable, please guard.' }],
    });

    await reviewer.reviewPullRequest({
      owner: 'me',
      repo: 'repo',
      prNumber: 1,
      headSha: 'abc',
      deliveryId: 'd1',
    });

    expect(github.postReview).toHaveBeenCalledWith('me', 'repo', 1, 'abc', 'LGTM with one note.', [
      { path: 'src/foo.ts', line: 12, body: 'Nullable, please guard.' },
    ]);
  });

  it('skips diffs above the configured size limit', async () => {
    github.fetchPullRequestDiff.mockResolvedValue('x\n'.repeat(5000));

    await reviewer.reviewPullRequest({
      owner: 'me',
      repo: 'repo',
      prNumber: 2,
      headSha: 'abc',
      deliveryId: 'd2',
    });

    expect(llm.reviewDiff).not.toHaveBeenCalled();
    expect(github.postReview).not.toHaveBeenCalled();
  });

  it('diffs only since our last review, when we have reviewed this PR before', async () => {
    github.findLastReviewedCommit.mockResolvedValue('sha-old');
    github.fetchDiffSince.mockResolvedValue('diff line\n'.repeat(10));
    llm.reviewDiff.mockResolvedValue({ summary: 'ok', comments: [] });

    await reviewer.reviewPullRequest({
      owner: 'me',
      repo: 'repo',
      prNumber: 3,
      headSha: 'sha-new',
      deliveryId: 'd3',
    });

    expect(github.fetchDiffSince).toHaveBeenCalledWith('me', 'repo', 'sha-old', 'sha-new');
    expect(github.fetchPullRequestDiff).not.toHaveBeenCalled();
  });

  it('skips entirely when the head commit was already reviewed', async () => {
    github.findLastReviewedCommit.mockResolvedValue('sha-same');

    await reviewer.reviewPullRequest({
      owner: 'me',
      repo: 'repo',
      prNumber: 4,
      headSha: 'sha-same',
      deliveryId: 'd4',
    });

    expect(github.fetchDiffSince).not.toHaveBeenCalled();
    expect(github.fetchPullRequestDiff).not.toHaveBeenCalled();
    expect(llm.reviewDiff).not.toHaveBeenCalled();
    expect(github.postReview).not.toHaveBeenCalled();
  });

  it('falls back to the full PR diff when the incremental compare fails', async () => {
    github.findLastReviewedCommit.mockResolvedValue('sha-unreachable');
    github.fetchDiffSince.mockRejectedValue(new Error('404 Not Found'));
    github.fetchPullRequestDiff.mockResolvedValue('diff line\n'.repeat(10));
    llm.reviewDiff.mockResolvedValue({ summary: 'ok', comments: [] });

    await reviewer.reviewPullRequest({
      owner: 'me',
      repo: 'repo',
      prNumber: 5,
      headSha: 'sha-new',
      deliveryId: 'd5',
    });

    expect(github.fetchPullRequestDiff).toHaveBeenCalledWith('me', 'repo', 5);
    expect(llm.reviewDiff).toHaveBeenCalled();
  });
});

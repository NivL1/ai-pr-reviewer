import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface InlineComment {
    path: string;
    line: number;
    body: string;
}
export declare class GithubService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private octokit;
    constructor(config: ConfigService);
    onModuleInit(): void;
    fetchPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string>;
    fetchDiffSince(owner: string, repo: string, base: string, head: string): Promise<string>;
    findLastReviewedCommit(owner: string, repo: string, prNumber: number): Promise<string | null>;
    postReview(owner: string, repo: string, prNumber: number, headSha: string, summary: string, comments: InlineComment[]): Promise<void>;
}

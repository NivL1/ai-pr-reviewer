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
export declare class ReviewerService {
    private readonly github;
    private readonly llm;
    private readonly config;
    private readonly logger;
    constructor(github: GithubService, llm: LlmService, config: ConfigService);
    reviewPullRequest(req: ReviewRequest): Promise<void>;
}

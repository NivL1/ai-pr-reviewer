import { ReviewerService } from '../reviewer/reviewer.service';
interface PullRequestWebhookPayload {
    action: string;
    pull_request: {
        number: number;
        head: {
            sha: string;
        };
        draft: boolean;
    };
    repository: {
        name: string;
        owner: {
            login: string;
        };
        full_name: string;
    };
}
export declare class GithubController {
    private readonly reviewer;
    private readonly logger;
    constructor(reviewer: ReviewerService);
    handleWebhook(event: string, deliveryId: string, payload: PullRequestWebhookPayload): Promise<{
        ok: true;
        deliveryId: string;
    }>;
}
export {};

import { Body, Controller, Headers, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { WebhookSignatureGuard } from './webhook.guard';
import { ReviewerService } from '../reviewer/reviewer.service';

interface PullRequestWebhookPayload {
  action: string;
  pull_request: {
    number: number;
    head: { sha: string };
    draft: boolean;
  };
  repository: {
    name: string;
    owner: { login: string };
    full_name: string;
  };
}

@Controller('webhooks')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(private readonly reviewer: ReviewerService) {}

  @Post('github')
  @HttpCode(202)
  @UseGuards(WebhookSignatureGuard)
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: PullRequestWebhookPayload,
  ): Promise<{ ok: true; deliveryId: string }> {
    this.logger.log(`Received ${event} (${deliveryId})`);

    if (event !== 'pull_request') {
      return { ok: true, deliveryId };
    }

    const triggers = new Set(['opened', 'synchronize', 'reopened']);
    if (!triggers.has(payload.action) || payload.pull_request.draft) {
      return { ok: true, deliveryId };
    }

    void this.reviewer
      .reviewPullRequest({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        prNumber: payload.pull_request.number,
        headSha: payload.pull_request.head.sha,
        deliveryId,
      })
      .catch((err) =>
        this.logger.error(`Review failed for delivery ${deliveryId}`, err.stack),
      );

    return { ok: true, deliveryId };
  }
}

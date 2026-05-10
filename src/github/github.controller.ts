import { Body, Controller, Headers, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { WebhookSignatureGuard } from './webhook.guard';

@Controller('webhooks')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  @Post('github')
  @HttpCode(202)
  @UseGuards(WebhookSignatureGuard)
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() _payload: unknown,
  ): Promise<{ ok: true; deliveryId: string }> {
    this.logger.log(`Received ${event} (${deliveryId})`);
    return { ok: true, deliveryId };
  }
}

import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { WebhookSignatureGuard } from './webhook.guard';

@Module({
  controllers: [GithubController],
  providers: [GithubService, WebhookSignatureGuard],
  exports: [GithubService],
})
export class GithubModule {}

import { Module, forwardRef } from '@nestjs/common';
import { ReviewerService } from './reviewer.service';
import { LlmModule } from '../llm/llm.module';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [LlmModule, forwardRef(() => GithubModule)],
  providers: [ReviewerService],
  exports: [ReviewerService],
})
export class ReviewerModule {}

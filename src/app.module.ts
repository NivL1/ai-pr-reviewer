import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration, validateEnv } from './config/configuration';
import { GithubModule } from './github/github.module';
import { ReviewerModule } from './reviewer/reviewer.module';
import { LlmModule } from './llm/llm.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LlmModule,
    GithubModule,
    ReviewerModule,
    HealthModule,
  ],
})
export class AppModule {}

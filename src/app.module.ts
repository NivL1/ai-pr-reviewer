import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration, validateEnv } from './config/configuration';
import { LlmModule } from './llm/llm.module';
import { GithubModule } from './github/github.module';
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
    HealthModule,
  ],
})
export class AppModule {}

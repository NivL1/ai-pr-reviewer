import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

export class EnvVars {
  @IsString()
  @MinLength(10)
  ANTHROPIC_API_KEY!: string;

  @IsString()
  @MinLength(10)
  GITHUB_TOKEN!: string;

  @IsString()
  @MinLength(8)
  GITHUB_WEBHOOK_SECRET!: string;

  @IsOptional()
  @IsString()
  LLM_MODEL?: string;

  @IsOptional()
  @IsInt()
  MAX_DIFF_LINES?: number;

  @IsOptional()
  @IsInt()
  PORT?: number;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const parsed = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }
  return parsed;
}

export const configuration = (): Record<string, unknown> => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  reviewer: {
    maxDiffLines: parseInt(process.env.MAX_DIFF_LINES ?? '2000', 10),
  },
});

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from './prompts';
import type { InlineComment } from '../github/github.service';

export interface LlmReviewResult {
  summary: string;
  comments: InlineComment[];
}

/**
 * Provider-agnostic LLM interface. Today there's a single Anthropic
 * implementation — when an OpenAI/local backend is added, extract this
 * to an abstract `LlmClient` and select via config.
 */
@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private client!: Anthropic;
  private model!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('anthropic.apiKey', { infer: true }),
    });
    this.model = this.config.get<string>('anthropic.model', { infer: true }) ?? 'claude-sonnet-4-6';
  }

  async reviewDiff(diff: string): Promise<LlmReviewResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildReviewUserPrompt(diff) }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return this.parseModelResponse(text);
  }

  /**
   * Expects a JSON block of the form:
   *   { "summary": "...", "comments": [{ "path": "...", "line": 0, "body": "..." }] }
   * Falls back to an empty review if parsing fails.
   */
  private parseModelResponse(text: string): LlmReviewResult {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.warn('Model response had no parseable JSON; returning empty review');
      return { summary: text.slice(0, 500), comments: [] };
    }
    try {
      const json = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      return {
        summary: typeof json.summary === 'string' ? json.summary : '',
        comments: Array.isArray(json.comments) ? json.comments : [],
      };
    } catch (err) {
      this.logger.warn(`JSON parse failed: ${(err as Error).message}`);
      return { summary: '', comments: [] };
    }
  }
}

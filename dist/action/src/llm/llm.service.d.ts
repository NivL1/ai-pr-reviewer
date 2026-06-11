import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InlineComment } from '../github/github.service';
export interface LlmReviewResult {
    summary: string;
    comments: InlineComment[];
}
export declare class LlmService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private client;
    private model;
    constructor(config: ConfigService);
    onModuleInit(): void;
    reviewDiff(diff: string): Promise<LlmReviewResult>;
    private parseModelResponse;
}

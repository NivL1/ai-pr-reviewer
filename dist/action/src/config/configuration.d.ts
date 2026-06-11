export declare class EnvVars {
    ANTHROPIC_API_KEY: string;
    GITHUB_TOKEN: string;
    GITHUB_WEBHOOK_SECRET: string;
    LLM_MODEL?: string;
    MAX_DIFF_LINES?: number;
    PORT?: number;
    NODE_ENV?: string;
}
export declare function validateEnv(raw: Record<string, unknown>): EnvVars;
export declare const configuration: () => Record<string, unknown>;

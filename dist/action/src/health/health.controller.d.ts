import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
export declare class HealthController {
    private readonly health;
    private readonly memory;
    constructor(health: HealthCheckService, memory: MemoryHealthIndicator);
    liveness(): Promise<import("@nestjs/terminus").HealthCheckResult>;
    readiness(): Promise<import("@nestjs/terminus").HealthCheckResult>;
}

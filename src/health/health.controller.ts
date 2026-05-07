import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024)]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    // Add downstream dependency checks (LLM provider ping, GitHub API) here
    // when the service goes to production.
    return this.health.check([]);
  }
}

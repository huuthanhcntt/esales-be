import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([
      () =>
        Promise.resolve<HealthIndicatorResult>({
          process: { status: 'up' },
        }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    // Subclasses or dynamic indicators can be added per-service
    // (e.g., DB connectivity). Base readiness = process is up.
    return this.health.check([
      () =>
        Promise.resolve<HealthIndicatorResult>({
          process: { status: 'up' },
        }),
    ]);
  }

  // Keep backward compatibility with existing GET /
  @Get()
  @HealthCheck()
  root() {
    return this.health.check([
      () =>
        Promise.resolve<HealthIndicatorResult>({
          process: { status: 'up' },
        }),
    ]);
  }
}

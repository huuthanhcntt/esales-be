import { Controller, Get, Inject, Optional } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { HEALTH_INDICATORS } from './health.constants';
import { HealthIndicatorFunction } from './health.interfaces';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Optional()
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: HealthIndicatorFunction[],
  ) {}

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
    const checks = [
      () =>
        Promise.resolve<HealthIndicatorResult>({
          process: { status: 'up' },
        }),
      ...(this.indicators || []),
    ];
    return this.health.check(checks);
  }

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

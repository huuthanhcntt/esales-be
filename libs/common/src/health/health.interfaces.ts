import { HealthIndicatorResult } from '@nestjs/terminus';

export type HealthIndicatorFunction = () => Promise<HealthIndicatorResult>;

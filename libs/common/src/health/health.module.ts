import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HEALTH_INDICATORS } from './health.constants';
import { createPrismaHealthIndicator } from './prisma-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_INDICATORS,
      useValue: [],
    },
  ],
})
export class HealthModule {
  /**
   * Register health module with a DB check using the service's PrismaService.
   * Usage: HealthModule.forDatabase(PrismaService)
   */
  static forDatabase(prismaServiceClass: Type<any>): DynamicModule {
    const indicatorProvider: Provider = {
      provide: HEALTH_INDICATORS,
      useFactory: (prisma: any) => [createPrismaHealthIndicator(prisma)],
      inject: [prismaServiceClass],
    };

    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [indicatorProvider],
    };
  }
}

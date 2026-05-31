import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import {
  AuditLogInterceptor,
  HealthModule,
  LoggerModule,
  MetricsModule,
  RedisCacheModule,
  NOTIFICATIONS_SERVICE,
  createServiceClient,
} from '@app/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ClientsModule } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        NOTIFICATIONS_HOST: Joi.string().required(),
        NOTIFICATIONS_PORT: Joi.number().required(),
        STRIPE_STUB: Joi.string().optional().default('false'),
        STRIPE_SECRET_KEY: Joi.string().when('STRIPE_STUB', {
          is: 'true',
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
      }),
    }),
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    MetricsModule,
    HealthModule,
    RedisCacheModule,
    ClientsModule.registerAsync([
      {
        name: NOTIFICATIONS_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient(
            'notifications',
            configService,
            'NOTIFICATIONS_HOST',
            'NOTIFICATIONS_PORT',
          ),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class PaymentsModule {}

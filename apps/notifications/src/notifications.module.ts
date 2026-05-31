import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import {
  AuditLogInterceptor,
  HealthModule,
  LoggerModule,
  MetricsModule,
  RedisCacheModule,
} from '@app/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().optional().default(1025),
        SMTP_USER: Joi.string().optional().default('noreply@esales.local'),
        GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
        GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_OAUTH_REFRESH_TOKEN: Joi.string().optional(),
      }),
    }),
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    MetricsModule,
    HealthModule,
    RedisCacheModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class NotificationsModule {}

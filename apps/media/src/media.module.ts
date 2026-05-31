import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import {
  AuditLogInterceptor,
  LoggerModule,
  AUTH_SERVICE,
  HealthModule,
  MetricsModule,
  createServiceClient,
} from '@app/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        TCP_PORT: Joi.number().required(),
        AUTH_HOST: Joi.string().required(),
        AUTH_PORT: Joi.number().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_PORT: Joi.number().required(),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        MINIO_USE_SSL: Joi.string().default('false'),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient('auth', configService, 'AUTH_HOST', 'AUTH_PORT'),
        inject: [ConfigService],
      },
    ]),
    HealthModule,
    MetricsModule,
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class MediaModule {}

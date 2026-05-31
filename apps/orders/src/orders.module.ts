import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StripeWebhookController } from './webhook/stripe-webhook.controller';
import {
  AuditLogInterceptor,
  LoggerModule,
  AUTH_SERVICE,
  PAYMENTS_SERVICE,
  PRODUCTS_SERVICE,
  NOTIFICATIONS_SERVICE,
  HealthModule,
  MetricsModule,
  RedisCacheModule,
  createServiceClient,
} from '@app/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().required(),
        TCP_PORT: Joi.number().required(),
        AUTH_HOST: Joi.string().required(),
        AUTH_PORT: Joi.number().required(),
        PRODUCTS_HOST: Joi.string().required(),
        PRODUCTS_PORT: Joi.number().required(),
        PAYMENTS_HOST: Joi.string().required(),
        PAYMENTS_PORT: Joi.number().required(),
        NOTIFICATIONS_HOST: Joi.string().required(),
        NOTIFICATIONS_PORT: Joi.number().required(),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient('auth', configService, 'AUTH_HOST', 'AUTH_PORT'),
        inject: [ConfigService],
      },
      {
        name: PRODUCTS_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient(
            'products',
            configService,
            'PRODUCTS_HOST',
            'PRODUCTS_PORT',
          ),
        inject: [ConfigService],
      },
      {
        name: PAYMENTS_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient(
            'payments',
            configService,
            'PAYMENTS_HOST',
            'PAYMENTS_PORT',
          ),
        inject: [ConfigService],
      },
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
    HealthModule.forDatabase(PrismaService),
    MetricsModule,
    RedisCacheModule,
  ],
  controllers: [OrdersController, StripeWebhookController],
  providers: [
    OrdersService,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class OrdersModule {}

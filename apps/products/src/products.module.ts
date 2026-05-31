import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsGateway } from './products.gateway';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import {
  AuditLogInterceptor,
  LoggerModule,
  AUTH_SERVICE,
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
    HealthModule.forDatabase(PrismaService),
    MetricsModule,
    RedisCacheModule,
  ],
  controllers: [ProductsController, CategoriesController],
  providers: [
    ProductsService,
    ProductsGateway,
    CategoriesService,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class ProductsModule {}

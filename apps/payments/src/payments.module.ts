import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import {
  HealthModule,
  LoggerModule,
  MetricsModule,
  NOTIFICATIONS_SERVICE,
  createServiceClient,
} from '@app/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ClientsModule } from '@nestjs/microservices';

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
    MetricsModule,
    HealthModule,
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
  providers: [PaymentsService],
})
export class PaymentsModule {}

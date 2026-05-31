import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { HealthModule, LoggerModule, MetricsModule } from '@app/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        // SMTP_HOST enables local mail (Mailpit). When set, Gmail OAuth is not needed.
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().optional().default(1025),
        SMTP_USER: Joi.string().optional().default('noreply@esales.local'),
        GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
        GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_OAUTH_REFRESH_TOKEN: Joi.string().optional(),
      }),
    }),
    LoggerModule,
    MetricsModule,
    HealthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice(
    createMicroserviceOptions('notifications', configService, 'PORT'),
  );
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
  // HTTP listener for /metrics and /health endpoints
  await app.listen(configService.get('HTTP_PORT') || 3014);
}
bootstrap();

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { PaymentsModule } from './payments.module';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice(
    createMicroserviceOptions('payments', configService, 'PORT'),
  );
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
  // HTTP listener for /metrics and /health endpoints
  await app.listen(configService.get('HTTP_PORT') || 3013);
}
bootstrap();

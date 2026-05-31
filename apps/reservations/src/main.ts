import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { ReservationsModule } from './reservations.module';

async function bootstrap() {
  const app = await NestFactory.create(ReservationsModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('eSales Reservations API')
    .setDescription('Reservation management endpoints')
    .setVersion('1.0')
    .addCookieAuth('Authentication')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
  );

  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT'));
}
bootstrap();

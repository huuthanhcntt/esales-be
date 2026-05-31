import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { OrdersModule } from './orders.module';

async function bootstrap() {
  const app = await NestFactory.create(OrdersModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice(
    createMicroserviceOptions('orders', configService, 'TCP_PORT'),
  );

  app.use(cookieParser());
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useLogger(app.get(Logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('eSales Orders API')
    .setDescription('Order lifecycle management endpoints')
    .setVersion('1.0')
    .addCookieAuth('Authentication')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.startAllMicroservices();
  await app.listen(configService.get('PORT'));
}
bootstrap();

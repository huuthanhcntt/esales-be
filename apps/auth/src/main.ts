import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice(
    createMicroserviceOptions('auth', configService, 'TCP_PORT'),
  );
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useLogger(app.get(Logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('eSales Auth API')
    .setDescription('Authentication and user management endpoints')
    .setVersion('1.0')
    .addCookieAuth('Authentication')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.startAllMicroservices();
  await app.listen(configService.get('HTTP_PORT'));
}
bootstrap();

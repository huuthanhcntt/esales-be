import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  HealthModule,
  LoggerModule,
  MetricsModule,
  RedisCacheModule,
} from '@app/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // DATABASE_URL: Joi.string().required(),
        // JWT_SECRET: Joi.string().required(),
        // JWT_EXPIRATION: Joi.string().required(),
        // HTTP_PORT: Joi.number().required(),
        // TCP_PORT: Joi.number().required(),
      }),
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.get('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    MetricsModule,
    RedisCacheModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStategy,
    JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AuthModule {}

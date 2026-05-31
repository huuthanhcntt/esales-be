import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: isProduction ? 'info' : 'debug',
        // Generate correlation ID for request tracing
        genReqId: (req) =>
          (req.headers['x-correlation-id'] as string) || randomUUID(),
        // Add service metadata to every log entry
        mixin: () => ({
          service: process.env.SERVICE_NAME || 'esales',
          version: process.env.npm_package_version || '0.0.1',
          environment: process.env.NODE_ENV || 'development',
        }),
        ...(isProduction
          ? {
              // Production: structured JSON for Loki ingestion
              formatters: {
                level: (label: string) => ({ level: label }),
              },
              messageKey: 'msg',
            }
          : {
              // Development: pretty-printed for readability
              transport: {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              },
            }),
      },
    }),
  ],
})
export class LoggerModule {}

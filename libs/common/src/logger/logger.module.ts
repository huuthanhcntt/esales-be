import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: isProduction ? 'info' : 'debug',
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

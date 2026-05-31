import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (!request) return next.handle();

    const { method, url, body, user } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response?.statusCode;
          const duration = Date.now() - startTime;

          this.logger.log({
            action: `${method} ${url}`,
            userId: user?.id || null,
            userEmail: user?.email || null,
            method,
            path: url,
            statusCode,
            duration,
            payload: this.sanitizePayload(body),
            timestamp: new Date().toISOString(),
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn({
            action: `${method} ${url}`,
            userId: user?.id || null,
            userEmail: user?.email || null,
            method,
            path: url,
            statusCode: error.status || 500,
            duration,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        },
      }),
    );
  }

  private sanitizePayload(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'card', 'cvc', 'token', 'secret'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }
}

import { AuditLogInterceptor } from './audit-log.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const mockRequest = {
    method: 'POST',
    url: '/products',
    body: { name: 'Test', password: 'secret123', card: '4242' },
    user: { id: 1, email: 'test@test.com' },
  };

  const mockResponse = { statusCode: 201 };

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ExecutionContext;

  const mockNext: CallHandler = { handle: () => of({ id: 1 }) };

  beforeEach(() => {
    interceptor = new AuditLogInterceptor();
    logSpy = jest.spyOn((interceptor as any).logger, 'log').mockImplementation();
    warnSpy = jest.spyOn((interceptor as any).logger, 'warn').mockImplementation();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log successful requests with sanitized payload', (done) => {
    interceptor.intercept(mockContext, mockNext).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            path: '/products',
            userId: 1,
            userEmail: 'test@test.com',
            statusCode: 201,
            payload: expect.objectContaining({
              name: 'Test',
              password: '[REDACTED]',
              card: '[REDACTED]',
            }),
          }),
        );
        done();
      },
    });
  });

  it('should log errors with status code', (done) => {
    const errorNext: CallHandler = {
      handle: () => throwError(() => ({ status: 400, message: 'Bad request' })),
    };

    interceptor.intercept(mockContext, errorNext).subscribe({
      error: () => {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            path: '/products',
            statusCode: 400,
            error: 'Bad request',
          }),
        );
        done();
      },
    });
  });

  it('should handle null user gracefully', (done) => {
    const noUserContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/health', body: null }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    interceptor.intercept(noUserContext, mockNext).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({ userId: null, userEmail: null }),
        );
        done();
      },
    });
  });

  it('should return next.handle() when no request', (done) => {
    const noReqContext = {
      switchToHttp: () => ({
        getRequest: () => null,
        getResponse: () => null,
      }),
    } as unknown as ExecutionContext;

    interceptor.intercept(noReqContext, mockNext).subscribe({
      complete: done,
    });
  });

  it('should sanitize sensitive keys', () => {
    const result = (interceptor as any).sanitizePayload({
      name: 'visible',
      password: 'hidden',
      card: 'hidden',
      cvc: 'hidden',
      token: 'hidden',
      secret: 'hidden',
    });

    expect(result.name).toBe('visible');
    expect(result.password).toBe('[REDACTED]');
    expect(result.card).toBe('[REDACTED]');
    expect(result.cvc).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
  });

  it('should return undefined for null body', () => {
    expect((interceptor as any).sanitizePayload(null)).toBeUndefined();
  });
});

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let authClient: jest.Mocked<ClientProxy>;
  let reflector: jest.Mocked<Reflector>;

  const mockUser = { id: 1, email: 'test@test.com', password: 'hashed', roles: ['Admin'] };

  function createMockContext(overrides: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}): ExecutionContext {
    const request = {
      cookies: overrides.cookies || {},
      headers: overrides.headers || {},
      user: undefined,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
    } as any;
  }

  beforeEach(() => {
    authClient = {
      send: jest.fn(),
    } as any;
    reflector = {
      get: jest.fn(),
    } as any;
    guard = new JwtAuthGuard(authClient, reflector);
  });

  it('should return false when no JWT is provided', () => {
    const context = createMockContext();
    reflector.get.mockReturnValue(undefined);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should extract JWT from cookies', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(of(mockUser));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(true);
    expect(authClient.send).toHaveBeenCalledWith('authenticate', { Authentication: 'jwt-token' });
  });

  it('should extract JWT from headers', async () => {
    const context = createMockContext({ headers: { authentication: 'header-token' } });
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(of(mockUser));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(true);
    expect(authClient.send).toHaveBeenCalledWith('authenticate', { Authentication: 'header-token' });
  });

  it('should prefer cookies over headers', async () => {
    const context = createMockContext({
      cookies: { Authentication: 'cookie-token' },
      headers: { authentication: 'header-token' },
    });
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(of(mockUser));

    guard.canActivate(context);

    expect(authClient.send).toHaveBeenCalledWith('authenticate', { Authentication: 'cookie-token' });
  });

  it('should attach user to request on success', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    const request = context.switchToHttp().getRequest();
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(of(mockUser));

    const result = guard.canActivate(context);
    await firstValueFrom(result as any);

    expect(request.user).toEqual(mockUser);
  });

  it('should allow access when user has required role', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    reflector.get.mockReturnValue(['Admin']);
    authClient.send.mockReturnValue(of(mockUser));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(true);
  });

  it('should return false when user lacks required role', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    reflector.get.mockReturnValue(['SuperAdmin']);
    authClient.send.mockReturnValue(of({ ...mockUser, roles: ['User'] }));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(false);
  });

  it('should return false when auth service errors', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(throwError(() => new Error('auth down')));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(false);
  });

  it('should allow access when no roles required and user has no roles', async () => {
    const context = createMockContext({ cookies: { Authentication: 'jwt-token' } });
    reflector.get.mockReturnValue(undefined);
    authClient.send.mockReturnValue(of({ id: 2, email: 'a@b.com', password: 'x' }));

    const result = guard.canActivate(context);
    const allowed = await firstValueFrom(result as any);

    expect(allowed).toBe(true);
  });
});

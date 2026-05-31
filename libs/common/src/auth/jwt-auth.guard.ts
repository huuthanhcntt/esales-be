import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Reflector } from '@nestjs/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { AUTH_SERVICE } from '../constants/services';
import { User } from '../interfaces';

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    private readonly reflector: Reflector,
  ) {}

  async onModuleInit() {
    // Kafka requires subscribing to reply topics for request-response patterns
    if (typeof (this.authClient as any).subscribeToResponseOf === 'function') {
      (this.authClient as any).subscribeToResponseOf('authenticate');
    }
    await this.authClient.connect();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const jwt =
      context.switchToHttp().getRequest().cookies?.Authentication ||
      context.switchToHttp().getRequest().headers?.authentication;

    if (!jwt) {
      return false;
    }

    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    const permissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    this.logger.debug(`Sending authenticate request via ${this.authClient.constructor.name}`);

    return this.authClient
      .send<User>('authenticate', {
        Authentication: jwt,
      })
      .pipe(
        tap((res: User) => {
          // Check role-based access (coarse-grained)
          if (roles) {
            for (const role of roles) {
              if (!res.roles?.includes(role)) {
                this.logger.error('The user does not have valid roles.');
                throw new UnauthorizedException();
              }
            }
          }
          // Check permission-based access (fine-grained per-module)
          // Admin role bypasses permission checks
          if (permissions && !res.roles?.includes('Admin')) {
            const userPermissions = (res as any).permissions || [];
            for (const perm of permissions) {
              if (!this.hasPermission(userPermissions, perm)) {
                this.logger.error(
                  `User ${res.id} lacks permission: ${perm}`,
                );
                throw new ForbiddenException(
                  `Missing permission: ${perm}`,
                );
              }
            }
          }
          context.switchToHttp().getRequest().user = res;
        }),
        map(() => true),
        catchError((err) => {
          this.logger.error(err);
          return of(false);
        }),
      );
  }

  /**
   * Check if user has a specific permission.
   * Supports wildcard "module:manage" which grants all actions on that module.
   */
  private hasPermission(
    userPermissions: string[],
    required: string,
  ): boolean {
    if (userPermissions.includes(required)) return true;
    // Check for "manage" wildcard (e.g., "products:manage" grants "products:create")
    const [module] = required.split(':');
    return userPermissions.includes(`${module}:manage`);
  }
}

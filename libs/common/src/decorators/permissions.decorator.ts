import { SetMetadata } from '@nestjs/common';

/**
 * Fine-grained permission definition for RBAC.
 * Format: "module:action" (e.g., "products:create", "orders:read")
 *
 * Supported modules: products, orders, media, reservations, auth, payments, notifications
 * Supported actions: create, read, update, delete, manage (all actions)
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

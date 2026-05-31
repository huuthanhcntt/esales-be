import { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Creates a health indicator function that checks Prisma DB connectivity.
 * Pass the PrismaService instance from any service.
 */
export function createPrismaHealthIndicator(
  prisma: { $queryRawUnsafe: (query: string) => Promise<any> },
): () => Promise<HealthIndicatorResult> {
  return async () => {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return { database: { status: 'up' } };
    } catch {
      return { database: { status: 'down' } };
    }
  };
}

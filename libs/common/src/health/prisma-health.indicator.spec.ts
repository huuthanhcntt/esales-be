import { createPrismaHealthIndicator } from './prisma-health.indicator';

describe('createPrismaHealthIndicator', () => {
  it('should return up when DB query succeeds', async () => {
    const mockPrisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    const indicator = createPrismaHealthIndicator(mockPrisma);
    const result = await indicator();
    expect(result).toEqual({ database: { status: 'up' } });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
  });

  it('should return down when DB query fails', async () => {
    const mockPrisma = { $queryRawUnsafe: jest.fn().mockRejectedValue(new Error('Connection refused')) };
    const indicator = createPrismaHealthIndicator(mockPrisma);
    const result = await indicator();
    expect(result).toEqual({ database: { status: 'down' } });
  });
});

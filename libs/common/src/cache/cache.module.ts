import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          const { redisStore } = await import('cache-manager-redis-yet');
          return {
            store: redisStore,
            url: redisUrl,
            ttl: 30000,
          } as any;
        }

        // Fallback to in-memory cache when Redis is not configured
        return { ttl: 30000 };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class RedisCacheModule {}

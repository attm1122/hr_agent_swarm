/**
 * Unified Rate Limiter
 *
 * Uses Redis-backed rate limiting when REDIS_URL is configured and
 * NODE_ENV is 'production'. Falls back to in-memory rate limiting in
 * development / test environments only.
 *
 * SECURITY: In production without REDIS_URL, the in-memory store will
 * still function but logs a warning on every check because it does not
 * scale across containers.
 */

import type { Role } from '@/types';
import { createLogger } from '@/lib/observability/logger';
import {
  checkRateLimit as checkInMemoryRateLimit,
  getRateLimitStatus as getInMemoryRateLimitStatus,
  resetRateLimit as resetInMemoryRateLimit,
  RATE_LIMITS as IN_MEMORY_RATE_LIMITS,
  generateRateLimitKey,
  type RateLimitResult,
} from './rate-limit';
import { RedisRateLimiter, RATE_LIMITS as REDIS_RATE_LIMITS } from './rate-limit-redis';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';

const logger = createLogger('rate-limit:unified');

let redisLimiter: RedisRateLimiter | null = null;

function getRedisLimiter(): RedisRateLimiter | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!redisLimiter) {
    const cache = createCacheAdapter();
    redisLimiter = new RedisRateLimiter(cache);
    logger.info('Redis rate limiter initialized');
  }
  return redisLimiter;
}

function shouldUseRedis(): boolean {
  return process.env.NODE_ENV === 'production' && !!process.env.REDIS_URL;
}

/**
 * Check if a request is within rate limit.
 * Async because Redis backend is async.
 */
export async function checkRateLimit(
  key: string,
  tier: 'auth' | 'agent' | 'communication' | 'report' | 'file' | 'search',
  role: Role
): Promise<RateLimitResult> {
  const redis = getRedisLimiter();

  if (shouldUseRedis() && redis) {
    const redisConfig = REDIS_RATE_LIMITS[tier as keyof typeof REDIS_RATE_LIMITS];
    if (redisConfig) {
      const result = await redis.check(key, {
        windowMs: redisConfig.windowMs,
        maxRequests: redisConfig.maxRequests,
        keyPrefix: redisConfig.keyPrefix,
      });
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter,
      };
    }
  }

  if (process.env.NODE_ENV === 'production' && !redis) {
    logger.warn(
      'Running in-memory rate limiting in production without Redis. ' +
        'This does NOT scale across containers. Set REDIS_URL to enable distributed rate limiting.'
    );
  }

  return checkInMemoryRateLimit(key, tier, role);
}

/**
 * Get current rate limit status without incrementing.
 */
export async function getRateLimitStatus(
  key: string,
  tier: 'auth' | 'agent' | 'communication' | 'report' | 'file' | 'search',
  role: Role
): Promise<RateLimitResult> {
  const redis = getRedisLimiter();

  if (shouldUseRedis() && redis) {
    // Redis check is stateful (increments), so we can't truly "peek" without
    // a dedicated peek operation. For now, do a lightweight in-memory estimate
    // or skip. We'll fall back to in-memory for status checks in Redis mode.
    return getInMemoryRateLimitStatus(key, tier, role);
  }

  return getInMemoryRateLimitStatus(key, tier, role);
}

/**
 * Reset rate limit for a key.
 */
export async function resetRateLimit(key: string, tier?: string): Promise<void> {
  const redis = getRedisLimiter();

  if (shouldUseRedis() && redis && tier) {
    const cache = createCacheAdapter();
    await cache.delete(`${tier}:${key}`);
    return;
  }

  resetInMemoryRateLimit(key, tier);
}

export { generateRateLimitKey };
export { IN_MEMORY_RATE_LIMITS as RATE_LIMITS };

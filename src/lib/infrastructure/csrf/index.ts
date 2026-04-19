/**
 * Unified CSRF Module
 *
 * Uses Redis-backed CSRF token storage when REDIS_URL is configured and
 * NODE_ENV is 'production'. Falls back to in-memory storage in
 * development / test environments only.
 *
 * SECURITY: In production without Redis, the in-memory store will still
 * function but logs a warning on every operation because it does not
 * scale across containers.
 */

import { createLogger } from '@/lib/observability/logger';
import {
  generateCsrfToken as generateInMemoryToken,
  validateCsrfToken as validateInMemoryToken,
  extractCsrfToken,
  invalidateSessionTokens as invalidateInMemorySessionTokens,
  getTokenExpiry as getInMemoryTokenExpiry,
  rotateCsrfToken as rotateInMemoryToken,
  requiresCsrfProtection,
  createCsrfErrorResponse,
} from './csrf';
import { RedisCSRFProtection } from './csrf-redis';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';

const logger = createLogger('csrf:unified');

let redisCsrf: RedisCSRFProtection | null = null;

function getRedisCsrf(): RedisCSRFProtection | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!redisCsrf) {
    const cache = createCacheAdapter();
    redisCsrf = new RedisCSRFProtection(cache, {
      secret: process.env.CSRF_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fallback-secret',
      tokenTTLSeconds: 24 * 60 * 60, // 24 hours
    });
    logger.info('Redis CSRF store initialized');
  }
  return redisCsrf;
}

function shouldUseRedis(): boolean {
  return process.env.NODE_ENV === 'production' && !!process.env.REDIS_URL;
}

function logProductionFallback(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    logger.warn(
      'Running in-memory CSRF storage in production without Redis. ' +
        'This does NOT scale across containers. Set REDIS_URL to enable distributed CSRF storage.'
    );
  }
}

/**
 * Generate a new CSRF token for a session.
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  const redis = getRedisCsrf();
  if (shouldUseRedis() && redis) {
    return await redis.generateToken(sessionId);
  }
  logProductionFallback();
  return generateInMemoryToken(sessionId);
}

/**
 * Validate a CSRF token.
 */
export async function validateCsrfToken(token: string, sessionId: string): Promise<boolean> {
  const redis = getRedisCsrf();
  if (shouldUseRedis() && redis) {
    return await redis.validateToken(sessionId, token);
  }
  logProductionFallback();
  return validateInMemoryToken(token, sessionId);
}

/**
 * Invalidate all tokens for a session (e.g. logout).
 */
export async function invalidateSessionTokens(sessionId: string): Promise<void> {
  const redis = getRedisCsrf();
  if (shouldUseRedis() && redis) {
    await redis.revokeToken(sessionId);
    return;
  }
  invalidateInMemorySessionTokens(sessionId);
}

/**
 * Get remaining time for a token.
 */
export function getTokenExpiry(token: string): number | null {
  // Redis does not expose TTL for arbitrary tokens easily without a dedicated method;
  // fall back to in-memory for this helper.
  return getInMemoryTokenExpiry(token);
}

/**
 * Rotate CSRF token after a sensitive action.
 */
export async function rotateCsrfToken(oldToken: string, sessionId: string): Promise<string | null> {
  const redis = getRedisCsrf();
  if (shouldUseRedis() && redis) {
    const valid = await redis.validateToken(sessionId, oldToken);
    if (!valid) return null;
    await redis.revokeToken(sessionId);
    return await redis.generateToken(sessionId);
  }
  return rotateInMemoryToken(oldToken, sessionId);
}

export { extractCsrfToken, requiresCsrfProtection, createCsrfErrorResponse };

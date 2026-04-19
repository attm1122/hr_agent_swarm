/**
 * Redis-Backed Rate Limiting
 * 
 * Production-ready rate limiting that works across multiple instances.
 */

import type { CachePort } from '@/lib/ports';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RedisRateLimiter {
  constructor(private cache: CachePort) {}

  async check(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    
    const result = await this.cache.rateLimitCheck(
      key,
      config.maxRequests,
      windowSeconds
    );

    return {
      allowed: result.allowed,
      limit: config.maxRequests,
      remaining: result.remaining,
      resetTime: result.resetTime,
      retryAfter: result.allowed ? undefined : windowSeconds,
    };
  }
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // General API rate limiting
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'ratelimit:api',
  },
  
  // Swarm agent execution
  swarm: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'ratelimit:swarm',
  },
  
  // Export generation (expensive operation)
  export: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    keyPrefix: 'ratelimit:export',
  },
  
  // Login attempts
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'ratelimit:login',
  },
  
  // Health check (should be lenient)
  health: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:health',
  },
} as const;

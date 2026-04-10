/**
 * Rate Limiting Module
 * Sliding window counter implementation for API abuse prevention.
 * 
 * Tiers (per the security audit):
 * - Authentication: 5 per 15 min per IP
 * - Agent Execution: 30-60 per min (role-based)
 * - Communications: 50-100 per hour
 * - Reports/Exports: 2-10 per hour
 * - File Operations: 10-30 per min
 * - Search: 60 per min
 * 
 * Production: Replace with Redis for distributed rate limiting.
 */

import type { Role } from '@/types';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number;  // Allow short bursts
}

// In-memory store (POC). Production: Redis.
const rateLimitStore = new Map<string, RateLimitEntry>();

// Memory management constants
const MAX_STORE_SIZE = 10000; // Maximum entries before forced cleanup
const MEMORY_CHECK_INTERVAL = 30000; // Check every 30 seconds
const CLEANUP_THRESHOLD = 0.8; // Cleanup when 80% full

// Cleanup interval to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxWindowMs = 60 * 60 * 1000; // 1 hour - longest rate limit window
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxWindowMs) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  // Log cleanup in production
  if (process.env.NODE_ENV === 'production' && cleaned > 0) {
    // eslint-disable-next-line no-console
    console.log(`[RATE_LIMIT] Cleaned ${cleaned} expired entries`);
  }
}, 60000); // Clean every minute

// Memory pressure monitoring
const memoryCheckInterval = setInterval(() => {
  const storeSize = rateLimitStore.size;
  
  // Alert if store is too large
  if (storeSize > MAX_STORE_SIZE * CLEANUP_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn(`[RATE_LIMIT] Store size ${storeSize} approaching limit ${MAX_STORE_SIZE}. Consider migrating to Redis.`);
    
    // Emergency cleanup - remove oldest 20% of entries
    if (storeSize > MAX_STORE_SIZE) {
      const entries = Array.from(rateLimitStore.entries());
      const sortedByAge = entries.sort((a, b) => a[1].windowStart - b[1].windowStart);
      const toRemove = Math.floor(storeSize * 0.2); // Remove 20%
      
      for (let i = 0; i < toRemove; i++) {
        rateLimitStore.delete(sortedByAge[i][0]);
      }
      
      // eslint-disable-next-line no-console
      console.warn(`[RATE_LIMIT] Emergency cleanup removed ${toRemove} entries`);
    }
  }
}, MEMORY_CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  clearInterval(memoryCheckInterval);
});

/**
 * Get rate limiting memory stats
 */
export function getRateLimitMemoryStats(): {
  storeSize: number;
  maxSize: number;
  usage: number;
  recommendedAction: string;
} {
  const storeSize = rateLimitStore.size;
  const usage = storeSize / MAX_STORE_SIZE;
  
  let recommendedAction = 'None';
  if (usage > 0.9) {
    recommendedAction = 'URGENT: Migrate to Redis immediately';
  } else if (usage > 0.7) {
    recommendedAction = 'Plan Redis migration';
  } else if (usage > 0.5) {
    recommendedAction = 'Monitor closely';
  }
  
  return {
    storeSize,
    maxSize: MAX_STORE_SIZE,
    usage,
    recommendedAction,
  };
}

/**
 * Rate limit configurations by endpoint tier and role
 */
export const RATE_LIMITS: Record<string, Record<Role | 'default', RateLimitConfig>> = {
  // Tier 1: Authentication (strict)
  auth: {
    default: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 per 15 min
    admin: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    manager: { windowMs: 15 * 60 * 1000, maxRequests: 8 },
    team_lead: { windowMs: 15 * 60 * 1000, maxRequests: 7 },
    employee: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    payroll: { windowMs: 15 * 60 * 1000, maxRequests: 8 },
  },
  
  // Tier 2: Agent Execution (swarm API)
  agent: {
    default: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per min
    admin: { windowMs: 60 * 1000, maxRequests: 60 },
    manager: { windowMs: 60 * 1000, maxRequests: 45 },
    team_lead: { windowMs: 60 * 1000, maxRequests: 35 },
    employee: { windowMs: 60 * 1000, maxRequests: 30 },
    payroll: { windowMs: 60 * 1000, maxRequests: 45 },
  },
  
  // Tier 3: Communication Sending
  communication: {
    default: { windowMs: 60 * 60 * 1000, maxRequests: 50 }, // 50 per hour
    admin: { windowMs: 60 * 60 * 1000, maxRequests: 100 },
    manager: { windowMs: 60 * 60 * 1000, maxRequests: 75 },
    team_lead: { windowMs: 60 * 60 * 1000, maxRequests: 60 },
    employee: { windowMs: 60 * 60 * 1000, maxRequests: 20 },
    payroll: { windowMs: 60 * 60 * 1000, maxRequests: 30 },
  },
  
  // Tier 4: Reports & Exports (expensive operations)
  report: {
    default: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
    admin: { windowMs: 60 * 60 * 1000, maxRequests: 15 },
    manager: { windowMs: 60 * 60 * 1000, maxRequests: 8 },
    team_lead: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
    employee: { windowMs: 60 * 60 * 1000, maxRequests: 2 },
    payroll: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  },
  
  // Tier 5: File Operations
  file: {
    default: { windowMs: 60 * 1000, maxRequests: 15 }, // 15 per min
    admin: { windowMs: 60 * 1000, maxRequests: 30 },
    manager: { windowMs: 60 * 1000, maxRequests: 20 },
    team_lead: { windowMs: 60 * 1000, maxRequests: 15 },
    employee: { windowMs: 60 * 1000, maxRequests: 10 },
    payroll: { windowMs: 60 * 1000, maxRequests: 20 },
  },
  
  // Tier 6: Search Operations
  search: {
    default: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per min
    admin: { windowMs: 60 * 1000, maxRequests: 100 },
    manager: { windowMs: 60 * 1000, maxRequests: 80 },
    team_lead: { windowMs: 60 * 1000, maxRequests: 60 },
    employee: { windowMs: 60 * 1000, maxRequests: 40 },
    payroll: { windowMs: 60 * 1000, maxRequests: 60 },
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  key: string,
  tier: keyof typeof RATE_LIMITS,
  role: Role
): RateLimitResult {
  const now = Date.now();
  const config = RATE_LIMITS[tier][role] || RATE_LIMITS[tier].default;
  const fullKey = `${tier}:${key}`;
  
  const entry = rateLimitStore.get(fullKey);
  
  // New window or expired
  if (!entry || now - entry.windowStart > config.windowMs) {
    rateLimitStore.set(fullKey, {
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  // Within window
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.windowStart + config.windowMs,
      retryAfter,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.windowStart + config.windowMs,
  };
}

/**
 * Generate rate limit key from request
 */
export function generateRateLimitKey(
  userId: string,
  ip?: string,
  sessionId?: string
): string {
  // Prefer userId for authenticated users, IP for anonymous
  return userId || ip || sessionId || 'anonymous';
}

/**
 * Reset rate limit for a key (useful for testing or admin override)
 */
export function resetRateLimit(key: string, tier?: string): void {
  if (tier) {
    rateLimitStore.delete(`${tier}:${key}`);
  } else {
    // Clear all tiers for this key
    for (const keyName of rateLimitStore.keys()) {
      if (keyName.endsWith(`:${key}`)) {
        rateLimitStore.delete(keyName);
      }
    }
  }
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  key: string,
  tier: keyof typeof RATE_LIMITS,
  role: Role
): RateLimitResult {
  const now = Date.now();
  const config = RATE_LIMITS[tier][role] || RATE_LIMITS[tier].default;
  const fullKey = `${tier}:${key}`;
  
  const entry = rateLimitStore.get(fullKey);
  
  if (!entry || now - entry.windowStart > config.windowMs) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = remaining > 0;
  
  return {
    allowed,
    remaining,
    resetTime: entry.windowStart + config.windowMs,
    retryAfter: allowed ? undefined : Math.ceil((entry.windowStart + config.windowMs - now) / 1000),
  };
}

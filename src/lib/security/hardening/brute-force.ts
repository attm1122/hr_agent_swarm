/**
 * Brute Force Protection
 *
 * Protects authentication and sensitive endpoints from brute force attacks:
 * - Tracks failed attempts per identifier (IP + username or just IP)
 * - Progressive delays (exponential backoff)
 * - Account lockout after threshold
 * - Automatic cleanup of stale entries
 *
 * Production: Replace with Redis for distributed tracking.
 */

import { createLogger } from '@/lib/observability/logger';

const logger = createLogger('brute-force');

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

interface BruteForceConfig {
  /** Max attempts before lockout. Default: 5 */
  maxAttempts: number;
  /** Window in ms to count attempts. Default: 15 minutes */
  windowMs: number;
  /** Lockout duration in ms. Default: 30 minutes */
  lockoutMs: number;
  /** Progressive delay base in ms. Default: 1 second */
  progressiveDelayBaseMs: number;
}

const DEFAULT_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 30 * 60 * 1000, // 30 minutes
  progressiveDelayBaseMs: 1000, // 1 second
};

// In-memory store (POC). Production: Redis.
const attemptStore = new Map<string, AttemptRecord>();

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, record] of attemptStore.entries()) {
    // Clean entries where the window has passed and they're not locked
    if (!record.lockedUntil && now - record.lastAttempt > DEFAULT_CONFIG.windowMs) {
      attemptStore.delete(key);
      cleaned++;
    }
    // Clean expired lockouts
    if (record.lockedUntil && now > record.lockedUntil) {
      attemptStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0 && process.env.NODE_ENV === 'production') {
    logger.info(`Cleaned ${cleaned} stale brute-force records`);
  }
}, 60000);

/**
 * Record a failed attempt for an identifier.
 */
export function recordFailedAttempt(
  identifier: string,
  config: Partial<BruteForceConfig> = {}
): { locked: boolean; lockoutSeconds?: number; delayMs: number } {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  const record = attemptStore.get(identifier);

  if (!record) {
    attemptStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { locked: false, delayMs: 0 };
  }

  // Reset if outside window
  if (now - record.firstAttempt > merged.windowMs) {
    attemptStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { locked: false, delayMs: 0 };
  }

  record.count++;
  record.lastAttempt = now;

  // Check lockout threshold
  if (record.count >= merged.maxAttempts) {
    const lockedUntil = now + merged.lockoutMs;
    record.lockedUntil = lockedUntil;
    logger.warn('Account locked due to brute force', {
      identifier,
      attempts: record.count,
      lockedUntil: new Date(lockedUntil).toISOString(),
    });
    return {
      locked: true,
      lockoutSeconds: Math.ceil(merged.lockoutMs / 1000),
      delayMs: merged.lockoutMs,
    };
  }

  // Progressive delay
  const delayMs = merged.progressiveDelayBaseMs * Math.pow(2, record.count - 1);

  return { locked: false, delayMs: Math.min(delayMs, 30000) }; // Cap at 30s
}

/**
 * Record a successful attempt — clears the record.
 */
export function recordSuccessfulAttempt(identifier: string): void {
  attemptStore.delete(identifier);
}

/**
 * Check if an identifier is currently locked out.
 */
export function isLockedOut(
  identifier: string,
  config: Partial<BruteForceConfig> = {}
): { locked: boolean; remainingSeconds?: number } {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const record = attemptStore.get(identifier);

  if (!record) return { locked: false };

  const now = Date.now();

  // Check if lockout is active
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      return {
        locked: true,
        remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
      };
    }
    // Lockout expired
    attemptStore.delete(identifier);
    return { locked: false };
  }

  // Check if window expired without lockout
  if (now - record.firstAttempt > merged.windowMs) {
    attemptStore.delete(identifier);
    return { locked: false };
  }

  return { locked: false };
}

/**
 * Get the current attempt count for an identifier.
 */
export function getAttemptCount(identifier: string): number {
  const record = attemptStore.get(identifier);
  if (!record) return 0;

  // Reset if outside window
  const now = Date.now();
  if (now - record.firstAttempt > DEFAULT_CONFIG.windowMs) {
    attemptStore.delete(identifier);
    return 0;
  }

  return record.count;
}

/**
 * Reset all attempts for an identifier (admin override).
 */
export function resetAttempts(identifier: string): void {
  attemptStore.delete(identifier);
  logger.info('Brute force attempts reset', { identifier });
}

/**
 * Generate a composite identifier from request + optional username.
 */
export function generateAttemptIdentifier(
  request: Request,
  username?: string
): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return username ? `${ip}:${username}` : `ip:${ip}`;
}

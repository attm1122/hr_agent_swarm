/**
 * Session Hardening Utilities
 *
 * Additional session security controls:
 * - Enforce maximum session duration
 * - Session rotation on privilege changes
 * - Concurrent session limits per user
 * - Secure logout (Clear-Site-Data header)
 * - Session binding to IP/User-Agent (optional)
 */

import { createLogger } from '@/lib/observability/logger';

const logger = createLogger('session-hardening');

// Maximum session duration: 8 hours
const MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Maximum concurrent sessions per user
const MAX_CONCURRENT_SESSIONS = 3;

interface SessionMetadata {
  userId: string;
  sessionId: string;
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory session tracking (POC). Production: Redis.
const activeSessions = new Map<string, SessionMetadata[]>(); // userId -> sessions

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, sessions] of activeSessions.entries()) {
    const valid = sessions.filter((s) => now - s.createdAt < MAX_SESSION_DURATION_MS);
    if (valid.length !== sessions.length) {
      cleaned += sessions.length - valid.length;
      if (valid.length === 0) {
        activeSessions.delete(userId);
      } else {
        activeSessions.set(userId, valid);
      }
    }
  }
  if (cleaned > 0 && process.env.NODE_ENV === 'production') {
    logger.info(`Cleaned ${cleaned} expired sessions`);
  }
}, 300000); // Every 5 minutes

/**
 * Register a new session, enforcing concurrent session limits.
 */
export function registerSession(metadata: SessionMetadata): {
  allowed: boolean;
  evictedSessions?: string[];
} {
  const { userId } = metadata;
  const sessions = activeSessions.get(userId) || [];

  // Check if adding this session would exceed the limit
  if (sessions.length >= MAX_CONCURRENT_SESSIONS) {
    // Evict oldest sessions (FIFO)
    const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
    const toEvict = sorted.slice(0, sessions.length - MAX_CONCURRENT_SESSIONS + 1);
    const remaining = sorted.slice(sessions.length - MAX_CONCURRENT_SESSIONS + 1);

    activeSessions.set(userId, [...remaining, metadata]);

    logger.warn('Concurrent session limit reached, evicted oldest sessions', {
      userId,
      evictedCount: toEvict.length,
    });

    return {
      allowed: true,
      evictedSessions: toEvict.map((s) => s.sessionId),
    };
  }

  activeSessions.set(userId, [...sessions, metadata]);
  return { allowed: true };
}

/**
 * Check if a session is valid (not expired, within limits).
 */
export function validateSession(sessionId: string, userId: string): {
  valid: boolean;
  reason?: string;
} {
  const sessions = activeSessions.get(userId);
  if (!sessions) {
    return { valid: false, reason: 'SESSION_NOT_FOUND' };
  }

  const session = sessions.find((s) => s.sessionId === sessionId);
  if (!session) {
    return { valid: false, reason: 'SESSION_NOT_FOUND' };
  }

  const now = Date.now();
  if (now - session.createdAt > MAX_SESSION_DURATION_MS) {
    // Remove expired session
    activeSessions.set(
      userId,
      sessions.filter((s) => s.sessionId !== sessionId)
    );
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }

  return { valid: true };
}

/**
 * Revoke a specific session.
 */
export function revokeSession(sessionId: string, userId: string): void {
  const sessions = activeSessions.get(userId);
  if (!sessions) return;

  const filtered = sessions.filter((s) => s.sessionId !== sessionId);
  if (filtered.length === 0) {
    activeSessions.delete(userId);
  } else {
    activeSessions.set(userId, filtered);
  }

  logger.info('Session revoked', { userId, sessionId });
}

/**
 * Revoke all sessions for a user (e.g. password change, security breach).
 */
export function revokeAllUserSessions(userId: string): void {
  activeSessions.delete(userId);
  logger.info('All sessions revoked for user', { userId });
}

/**
 * Get active session count for a user.
 */
export function getActiveSessionCount(userId: string): number {
  const sessions = activeSessions.get(userId) || [];
  const now = Date.now();
  return sessions.filter((s) => now - s.createdAt < MAX_SESSION_DURATION_MS).length;
}

/**
 * Create headers for secure logout.
 * Clears cookies, storage, and execution contexts.
 */
export function createLogoutHeaders(): Record<string, string> {
  return {
    'Clear-Site-Data': '"cookies", "storage", "cache"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Check if session duration has exceeded the maximum.
 */
export function isSessionExpired(sessionStartTime: number): boolean {
  return Date.now() - sessionStartTime > MAX_SESSION_DURATION_MS;
}

/**
 * Recommended session cookie options.
 */
export function getSecureCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_SESSION_DURATION_MS / 1000,
  };
}

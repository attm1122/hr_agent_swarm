/**
 * Security Hardening Module
 *
 * Production-grade security controls that rival enterprise-grade applications.
 *
 * Exports:
 * - Error sanitization (zero information leakage)
 * - API route guards (validation, CORS, bot detection, size limits)
 * - Brute force protection (progressive delays, account lockout)
 * - Session hardening (duration limits, concurrent limits, secure logout)
 */

export {
  sanitizeError,
  createSecureErrorResponse,
  type SanitizedError,
} from './error-sanitizer';

export {
  withApiGuard,
  type ApiGuardConfig,
} from './api-guard';

export {
  recordFailedAttempt,
  recordSuccessfulAttempt,
  isLockedOut,
  getAttemptCount,
  resetAttempts,
  generateAttemptIdentifier,
} from './brute-force';

export {
  registerSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  getActiveSessionCount,
  createLogoutHeaders,
  isSessionExpired,
  getSecureCookieOptions,
} from './session-hardening';

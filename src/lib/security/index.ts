/**
 * Security Module Index — STRANGLER-FIG BARREL
 *
 * This file re-exports from the new canonical locations to avoid
 * breaking existing consumers during the architectural refactoring.
 *
 * New canonical locations:
 * - @/lib/infrastructure/audit/audit-logger
 * - @/lib/infrastructure/rate-limit/rate-limit
 * - @/lib/infrastructure/rate-limit/rate-limit-redis
 * - @/lib/infrastructure/csrf/csrf
 * - @/lib/infrastructure/csrf/csrf-redis
 * - @/lib/application/validation/sanitize
 * - @/lib/infrastructure/adapters/secure-adapter
 * - @/lib/infrastructure/security-middleware
 *
 * TODO: Migrate all consumers to canonical imports and remove this barrel.
 */

export {
  checkRateLimit,
  generateRateLimitKey,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
  type RateLimitResult,
} from '@/lib/infrastructure/rate-limit/rate-limit';

export {
  generateCsrfToken,
  validateCsrfToken,
  extractCsrfToken,
  invalidateSessionTokens,
  rotateCsrfToken,
  requiresCsrfProtection,
  createCsrfErrorResponse,
} from '@/lib/infrastructure/csrf/csrf';

export {
  encodeHtml,
  stripDangerousHtml,
  sanitizeInput,
  sanitizeObject,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeId,
  safeJsonStringify,
  containsXss,
  containsSqlInjection,
  logSanitizationEvent,
} from '@/lib/application/validation/sanitize';

export {
  secureFetch,
  sendSlackMessage,
  fetchBambooHREmployee,
  checkIntegrationHealth,
  type SecureResponse,
} from '@/lib/infrastructure/adapters/secure-adapter';

export {
  logAgentExecution,
  logDataAccess,
  logSecurityEvent,
  logSensitiveAction,
  queryAuditLogs,
  getAuditStats,
  verifyAuditIntegrity,
  type AuditLogEntry,
  type AuditEventType,
} from '@/lib/infrastructure/audit/audit-logger';

export {
  securityMiddleware,
  validateRequestBody,
  addSecurityHeaders,
  createSecurityErrorResponse,
  getSecurityHeaders,
} from '@/lib/infrastructure/security-middleware';

/**
 * Security Module Index
 * Central export for all security controls.
 * 
 * Modules:
 * - rate-limit: Request throttling and abuse prevention
 * - csrf: Token-based CSRF protection
 * - sanitize: Input validation and output encoding
 * - secure-adapter: Secure integration layer
 * - audit-logger: Security audit trail
 * - security-middleware: Combined security controls
 */

export {
  checkRateLimit,
  generateRateLimitKey,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
  type RateLimitResult,
} from './rate-limit';

export {
  generateCsrfToken,
  validateCsrfToken,
  extractCsrfToken,
  invalidateSessionTokens,
  rotateCsrfToken,
  requiresCsrfProtection,
  createCsrfErrorResponse,
} from './csrf';

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
} from './sanitize';

export {
  secureFetch,
  sendSlackMessage,
  fetchBambooHREmployee,
  checkIntegrationHealth,
  type SecureResponse,
} from './secure-adapter';

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
  type SecurityLogContext,
} from './audit-logger';

export {
  securityMiddleware,
  validateRequestBody,
  addSecurityHeaders,
  createSecurityErrorResponse,
  getSecurityHeaders,
  withRequestTimeout,
  generateRequestId,
} from './security-middleware';

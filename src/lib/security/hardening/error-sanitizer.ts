/**
 * Error Sanitizer — Production-Grade Error Handling
 *
 * Guarantees ZERO information leakage in production:
 * - Stack traces are never exposed
 * - Internal paths, file names, and module details are stripped
 * - Database errors are mapped to generic messages
 * - All errors get a correlation ID for internal tracing
 *
 * SECURITY PRINCIPLE: The client sees only what it needs to see.
 * Internal details go to structured logs only.
 */

import { createLogger } from '@/lib/observability/logger';

const logger = createLogger('error-sanitizer');

export interface SanitizedError {
  message: string;
  code: string;
  correlationId: string;
  timestamp: string;
  retryAfter?: number;
}

// Patterns that indicate internal information leakage
const INTERNAL_LEAKAGE_PATTERNS = [
  /at\s+\S+:\d+:\d+/g,          // Stack trace lines
  /\/(src|lib|node_modules)\//g, // Internal paths
  /process\.env\.\w+/g,          // Env var references
  /supabase|postgres|mongodb/gi, // Database names
  /jwt|secret|token|password/gi, // Sensitive keywords
  /Error:\s*/g,                  // Raw error prefixes
  /\[object\s+\w+\]/g,           // Object type leakage
];

/**
 * Check if a string contains internal information that should not be exposed
 */
function containsInternalInfo(message: string): boolean {
  return INTERNAL_LEAKAGE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Map known internal error types to safe client messages
 */
function mapErrorToSafeMessage(error: unknown, fallbackCode: string): { message: string; code: string } {
  if (error instanceof Error) {
    const name = error.name;
    const msg = error.message;

    // Database errors
    if (name === 'PostgrestError' || msg.includes('relation') || msg.includes('column')) {
      return { message: 'Data operation failed. Please try again.', code: 'DATABASE_ERROR' };
    }
    if (name === 'DatabaseError' || msg.includes('connection') || msg.includes('timeout')) {
      return { message: 'Service temporarily unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' };
    }

    // Auth errors
    if (name === 'AuthApiError' || name === 'AuthError' || msg.includes('auth')) {
      return { message: 'Authentication failed. Please sign in again.', code: 'AUTH_INVALID' };
    }

    // Network errors
    if (name === 'FetchError' || name === 'TypeError' || msg.includes('fetch') || msg.includes('network')) {
      return { message: 'Network error. Please check your connection.', code: 'NETWORK_ERROR' };
    }

    // Timeout errors
    if (name === 'AbortError' || msg.includes('timeout') || msg.includes('timed out')) {
      return { message: 'Request timed out. Please try again.', code: 'TIMEOUT' };
    }

    // Validation errors (Zod)
    if (name === 'ZodError') {
      return { message: 'Invalid input provided.', code: 'VALIDATION_ERROR' };
    }

    // Session errors
    if (msg.includes('session') || msg.includes('JWT')) {
      return { message: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' };
    }

    // JSON parsing errors
    if (name === 'SyntaxError' || msg.includes('JSON') || msg.includes('Unexpected token')) {
      return { message: 'Invalid request format.', code: 'VALIDATION_ERROR' };
    }

    // If message looks safe and short, we might use it
    if (!containsInternalInfo(msg) && msg.length < 120 && /^[\w\s.,!?-]+$/.test(msg)) {
      return { message: msg, code: fallbackCode };
    }
  }

  // Complete fallback for production
  return {
    message: 'An unexpected error occurred. Please try again later.',
    code: fallbackCode,
  };
}

/**
 * Sanitize any error into a client-safe response.
 *
 * In development, preserves more detail for debugging.
 * In production, strips everything internal.
 */
export function sanitizeError(
  error: unknown,
  options: {
    correlationId: string;
    fallbackCode?: string;
    status?: number;
    retryAfter?: number;
  }
): SanitizedError {
  const { correlationId, fallbackCode = 'INTERNAL_ERROR', retryAfter } = options;

  let result: SanitizedError;

  if (process.env.NODE_ENV === 'development') {
    // Development: expose more, but still sanitize dangerous patterns
    const devMessage = error instanceof Error ? error.message : String(error);
    const safeDevMessage = containsInternalInfo(devMessage)
      ? `[SANITIZED] ${fallbackCode}`
      : devMessage;

    result = {
      message: safeDevMessage,
      code: fallbackCode,
      correlationId,
      timestamp: new Date().toISOString(),
      retryAfter,
    };
  } else {
    // Production: maximum sanitization
    const mapped = mapErrorToSafeMessage(error, fallbackCode);
    result = {
      message: mapped.message,
      code: mapped.code,
      correlationId,
      timestamp: new Date().toISOString(),
      retryAfter,
    };
  }

  // Always log the full error internally with correlation ID
  logger.error('Sanitized error for client', {
    correlationId,
    originalError: error instanceof Error ? error.message : String(error),
    originalStack: error instanceof Error ? error.stack : undefined,
    sanitizedCode: result.code,
    sanitizedMessage: result.message,
  });

  return result;
}

/**
 * Create a standardized JSON error response with security headers.
 */
export function createSecureErrorResponse(
  error: unknown,
  status: number,
  correlationId: string,
  headers?: Record<string, string>
) {
  const sanitized = sanitizeError(error, {
    correlationId,
    fallbackCode: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    status,
  });

  return new Response(JSON.stringify({ error: sanitized }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...headers,
    },
  });
}

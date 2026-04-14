/**
 * Security Middleware
 * Combined security controls for API routes:
 * - Rate limiting
 * - CSRF protection
 * - Input validation
 * - Security headers
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Role } from '@/types';
import { checkRateLimit, checkRateLimitAsync, generateRateLimitKey } from './rate-limit';
import {
  validateCsrfToken,
  validateCsrfTokenAsync,
  extractCsrfToken,
  requiresCsrfProtection,
} from './csrf';
import { sanitizeObject, containsXss, containsSqlInjection } from './sanitize';
import { logSecurityEvent } from './audit-logger';

// Minimal context for security logging
interface SecurityContext {
  userId: string;
  role: Role | string;
  sessionId: string;
  scope?: string;
  sensitivityClearance?: string[];
  permissions?: string[];
  timestamp?: string;
}

/**
 * Generate unique request correlation ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

interface SecurityConfig {
  rateLimitTier?: 'auth' | 'agent' | 'communication' | 'report' | 'file' | 'search';
  requireCsrf?: boolean;
  validateInput?: boolean;
  maxBodySize?: number;
}

const DEFAULT_CONFIG: SecurityConfig = {
  rateLimitTier: 'agent',
  requireCsrf: true,
  validateInput: true,
  maxBodySize: 1024 * 1024, // 1MB
};

/**
 * Security middleware for API routes
 * Returns null if request passes all checks, or a Response if blocked
 */
export async function securityMiddleware(
  request: NextRequest,
  userContext: { userId: string; role: Role; sessionId: string },
  config: SecurityConfig = {}
): Promise<NextResponse | null> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const requestId = generateRequestId();
  const clientIp = getClientIp(request);
  
  // When REDIS_URL is set, use the KV-backed async variants so counters /
  // CSRF tokens are shared across Vercel instances. Otherwise the in-memory
  // sync path is slightly faster and perfectly correct for single-instance.
  const useDistributed = Boolean(process.env.REDIS_URL);

  // 1. Rate Limiting
  if (mergedConfig.rateLimitTier) {
    const rateLimitKey = generateRateLimitKey(userContext.userId, clientIp, userContext.sessionId);
    const rateLimit = useDistributed
      ? await checkRateLimitAsync(rateLimitKey, mergedConfig.rateLimitTier, userContext.role)
      : checkRateLimit(rateLimitKey, mergedConfig.rateLimitTier, userContext.role);
    
    if (!rateLimit.allowed) {
      logSecurityEvent(
        'rate_limit_hit',
        userContext,
        { reason: `Rate limit exceeded for ${mergedConfig.rateLimitTier}`, ipAddress: clientIp }
      );

      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetTime),
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }
  
  // 2. CSRF Protection (for state-changing methods)
  // NOTE: CSRF tokens are generated bound to userId (via GET /api/csrf),
  // not sessionId. After the session-rotation fix, sessionId is a random UUID
  // per request — using it here would always mismatch. We validate against
  // userId which is stable and matches the generation binding.
  if (mergedConfig.requireCsrf && requiresCsrfProtection(request.method)) {
    const csrfToken = extractCsrfToken(request.headers);

    const csrfValid = csrfToken
      ? useDistributed
        ? await validateCsrfTokenAsync(csrfToken, userContext.userId)
        : validateCsrfToken(csrfToken, userContext.userId)
      : false;

    if (!csrfValid) {
      logSecurityEvent(
        'csrf_violation',
        userContext,
        { reason: csrfToken ? 'Invalid CSRF token' : 'Missing CSRF token', ipAddress: clientIp }
      );

      return new NextResponse(
        JSON.stringify({
          error: 'CSRF token missing or invalid',
          code: 'CSRF_VIOLATION',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }
  
  // 3. Body Size Limit
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > mergedConfig.maxBodySize!) {
    return new NextResponse(
      JSON.stringify({
        error: 'Request body too large',
        maxSize: mergedConfig.maxBodySize,
      }),
      {
        status: 413,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      }
    );
  }
  
  // All checks passed
  return null;
}

/**
 * Validate and sanitize request body.
 *
 * Performs three layers of defense:
 * 1. XSS pattern detection on raw JSON string
 * 2. SQL injection pattern detection on raw JSON string
 * 3. Deep recursive sanitisation of the parsed object (strips dangerous
 *    HTML, blocks prototype-pollution keys, enforces depth limits)
 *
 * If a detection layer fires, the request is logged and rejected with a
 * generic error message (no information leakage about which pattern matched).
 */
export async function validateRequestBody(
  request: NextRequest,
  userContext: { userId: string; role: string; sessionId: string }
): Promise<{ success: boolean; body?: Record<string, unknown>; error?: string }> {
  try {
    // Read body as text first to validate raw content before parsing
    const rawText = await request.text();

    // Enforce actual body size (not just Content-Length header which can be spoofed)
    const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
    if (new TextEncoder().encode(rawText).length > MAX_BODY_BYTES) {
      return { success: false, error: 'Request body too large' };
    }

    // Parse JSON
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return { success: false, error: 'Invalid JSON in request body' };
    }

    // Check for XSS patterns in raw text (before any transformation)
    if (containsXss(rawText)) {
      logSecurityEvent(
        'security_blocked',
        userContext,
        { reason: 'XSS pattern detected in request body', ipAddress: getClientIp(request) }
      );
      return { success: false, error: 'Invalid content in request body' };
    }

    // Check for SQL injection patterns
    if (containsSqlInjection(rawText)) {
      logSecurityEvent(
        'security_blocked',
        userContext,
        { reason: 'SQL injection pattern detected', ipAddress: getClientIp(request) }
      );
      return { success: false, error: 'Invalid content in request body' };
    }

    // Deep sanitise the parsed object
    const sanitized = sanitizeObject(body);

    return { success: true, body: sanitized };
  } catch (error) {
    return { success: false, error: 'Invalid JSON in request body' };
  }
}

/**
 * Extract client IP from request
 */
function getClientIp(request: NextRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback - Next.js doesn't expose IP directly in all versions
  return 'unknown';
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
  
  // Content Security Policy (strict for API responses)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';"
  );
  
  return response;
}

/**
 * Create standardized security error response
 */
export function createSecurityErrorResponse(
  message: string,
  code: string,
  status: number = 400
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: message,
      code,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    }
  );
}

/**
 * Get security headers object (for spread usage)
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * Wrap an async operation with a timeout
 * Returns the result or throws a timeout error
 */
export async function withRequestTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = 30000,
  operationName: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout: ${operationName} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}

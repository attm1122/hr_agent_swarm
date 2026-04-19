/**
 * API Route Security Guard
 *
 * Higher-order function that wraps API route handlers with comprehensive
 * security controls:
 * - Content-Type validation (reject non-JSON for mutating methods)
 * - Body size limit enforcement
 * - Method allowlist
 * - CORS preflight handling
 * - Automatic error sanitization
 * - Standard security headers on all responses
 * - Cache-Control for authenticated responses
 * - Request fingerprinting (basic bot detection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/observability/logger';
import { getCorrelationId } from '@/lib/observability/correlation';
import { sanitizeError } from './error-sanitizer';

const logger = createLogger('api-guard');

export interface ApiGuardConfig {
  /** Allowed HTTP methods. Defaults to all. */
  allowedMethods?: string[];
  /** Maximum request body size in bytes. Default: 1MB */
  maxBodySize?: number;
  /** Require Content-Type: application/json for mutating methods. Default: true */
  requireJsonContentType?: boolean;
  /** Add cache-busting headers to response. Default: true for authenticated routes */
  noCache?: boolean;
  /** CORS origin allowlist. Default: same-origin only */
  allowedOrigins?: string[];
  /** Enable basic bot detection. Default: true */
  botDetection?: boolean;
}

const DEFAULT_CONFIG: Required<ApiGuardConfig> = {
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  maxBodySize: 1024 * 1024, // 1MB
  requireJsonContentType: true,
  noCache: true,
  allowedOrigins: [], // Empty = same-origin only
  botDetection: true,
};

// Simple bot detection patterns
const BOT_PATTERNS = [
  /^$/,                          // Empty user-agent
  /curl\/|wget\/|python-requests|axios\/|node-fetch|urllib/gi,
  /bot|crawler|spider|scraper/gi, // Known bot indicators (but not all bots are bad)
];

// Known good bots that we allow
const GOOD_BOT_PATTERNS = [
  /googlebot|bingbot|slackbot|twitterbot|facebookexternalhit/gi,
];

function isSuspiciousBot(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') || '';
  // Allow known good bots
  if (GOOD_BOT_PATTERNS.some((p) => p.test(ua))) return false;
  // Flag suspicious patterns
  return BOT_PATTERNS.some((p) => p.test(ua));
}

function isOriginAllowed(request: NextRequest, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('origin');
  // Same-origin requests have no origin header
  if (!origin) return true;
  // Check allowlist
  if (allowedOrigins.includes(origin)) return true;
  // Check if origin matches the request host
  const host = request.headers.get('host');
  if (host && origin.includes(host)) return true;
  return false;
}

function createGuardError(
  message: string,
  code: string,
  status: number,
  correlationId: string
) {
  const sanitized = sanitizeError(new Error(message), {
    correlationId,
    fallbackCode: code,
  });

  return NextResponse.json(
    { error: sanitized },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    }
  );
}

/**
 * Wrap an API route handler with comprehensive security guards.
 *
 * Usage:
 *   export const POST = withApiGuard(async (req) => { ... }, {
 *     allowedMethods: ['POST'],
 *     maxBodySize: 512 * 1024,
 *   });
 */
export function withApiGuard<
  T extends (request: NextRequest, ...args: unknown[]) => Promise<NextResponse> | NextResponse
>(
  handler: T,
  config: ApiGuardConfig = {}
): (request: NextRequest, ...args: unknown[]) => Promise<NextResponse> {
  const merged = { ...DEFAULT_CONFIG, ...config };

  return async (request: NextRequest, ...args: unknown[]) => {
    const correlationId = getCorrelationId(request.headers);

    try {
      // 1. Method validation
      const method = request.method;
      if (!merged.allowedMethods.includes(method)) {
        return createGuardError(
          `Method ${method} not allowed`,
          'METHOD_NOT_ALLOWED',
          405,
          correlationId
        );
      }

      // 2. Handle CORS preflight
      if (method === 'OPTIONS') {
        const headers = new Headers();
        headers.set('Access-Control-Allow-Methods', merged.allowedMethods.join(', '));
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Request-ID, Idempotency-Key');
        headers.set('Access-Control-Max-Age', '86400');
        if (merged.allowedOrigins.length > 0) {
          const origin = request.headers.get('origin') || '';
          if (merged.allowedOrigins.includes(origin)) {
            headers.set('Access-Control-Allow-Origin', origin);
            headers.set('Access-Control-Allow-Credentials', 'true');
          }
        }
        return new NextResponse(null, { status: 204, headers });
      }

      // 3. Origin validation for cross-origin requests
      if (!isOriginAllowed(request, merged.allowedOrigins)) {
        logger.warn('CORS violation blocked', { correlationId, origin: request.headers.get('origin') });
        return createGuardError('Origin not allowed', 'FORBIDDEN', 403, correlationId);
      }

      // 4. Content-Type validation for mutating methods
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (merged.requireJsonContentType && mutatingMethods.includes(method)) {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return createGuardError(
            'Content-Type must be application/json',
            'UNSUPPORTED_MEDIA_TYPE',
            415,
            correlationId
          );
        }
      }

      // 5. Body size validation
      const contentLength = parseInt(request.headers.get('content-length') || '0');
      if (contentLength > merged.maxBodySize) {
        return createGuardError(
          `Request body exceeds ${merged.maxBodySize} bytes`,
          'PAYLOAD_TOO_LARGE',
          413,
          correlationId
        );
      }

      // 6. Bot detection (non-blocking log for now)
      if (merged.botDetection && isSuspiciousBot(request)) {
        logger.warn('Suspicious bot detected', {
          correlationId,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        });
        // We don't block yet — just log. In the future, this could trigger CAPTCHA.
      }

      // 7. Execute handler
      const response = await handler(request, ...args);

      // 8. Add security headers to successful responses
      if (merged.noCache) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return response;
    } catch (error) {
      logger.error('API guard caught unhandled error', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      const sanitized = sanitizeError(error, {
        correlationId,
        fallbackCode: 'INTERNAL_ERROR',
      });

      return NextResponse.json(
        { error: sanitized },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
          },
        }
      );
    }
  };
}

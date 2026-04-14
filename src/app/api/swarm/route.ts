/**
 * Swarm API Route - Agent Orchestration Endpoint
 * 
 * Production-ready with:
 * - Zod validation
 * - Rate limiting
 * - Idempotency support
 * - Structured error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { SwarmRequestSchema } from '@/lib/validation/schemas';
import { IdempotencyStore } from '@/lib/validation/idempotency';
import { getCoordinator } from '@/lib/agents/coordinator';
import { requireSession } from '@/lib/auth/session';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter, RATE_LIMITS } from '@/lib/security/rate-limit-redis';
import { extractCsrfToken, validateCsrfToken } from '@/lib/security/csrf';
import { securityLog } from '@/lib/security/logger';
import { z } from 'zod';

// Initialize infrastructure
const cache = createCacheAdapter();
const idempotencyStore = new IdempotencyStore(cache);
const rateLimiter = new RedisRateLimiter(cache);

// Error response helper
function createErrorResponse(
  message: string,
  code: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Authentication
    const session = await requireSession();
    if (!session) {
      return createErrorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }

    // CSRF validation
    const csrfToken = extractCsrfToken(req.headers);
    const strictCsrf = process.env.STRICT_CSRF === 'true';
    if (csrfToken) {
      if (!validateCsrfToken(csrfToken, session.userId)) {
        securityLog.warn('csrf', 'Invalid CSRF token on /api/swarm', { userId: session.userId });
        return createErrorResponse('CSRF token invalid or expired', 'CSRF_VIOLATION', 403);
      }
    } else if (strictCsrf) {
      securityLog.warn('csrf', 'Missing CSRF token on /api/swarm (strict mode)', { userId: session.userId });
      return createErrorResponse('CSRF token required', 'CSRF_VIOLATION', 403);
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(
      session.userId,
      RATE_LIMITS.swarm
    );

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Parse and validate body
    const rawBody = await req.json();
    const validationResult = SwarmRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return createErrorResponse(
        'Invalid request body',
        'VALIDATION_ERROR',
        400,
        validationResult.error.issues
      );
    }

    const body = validationResult.data;

    // Idempotency check
    const rawIdempotencyKey = req.headers.get('Idempotency-Key');
    // SECURITY: Validate idempotency key format — prevent memory exhaustion
    // via arbitrarily long keys and cache pollution via malformed keys.
    const idempotencyKey = rawIdempotencyKey && rawIdempotencyKey.length <= 128 && /^[\w\-]+$/.test(rawIdempotencyKey)
      ? rawIdempotencyKey
      : null;
    if (rawIdempotencyKey && !idempotencyKey) {
      return createErrorResponse(
        'Invalid Idempotency-Key: must be 1-128 alphanumeric/hyphen/underscore characters',
        'INVALID_IDEMPOTENCY_KEY',
        400,
      );
    }
    if (idempotencyKey) {
      const existing = await idempotencyStore.check(idempotencyKey);
      
      if (existing.exists) {
        if (existing.status === 'processing') {
          return createErrorResponse(
            'Request is already being processed',
            'IDEMPOTENCY_PROCESSING',
            409
          );
        }
        
        if (existing.status === 'completed' && existing.response) {
          // Return cached response
          return NextResponse.json(existing.response, {
            headers: {
              'X-Idempotency-Replay': 'true',
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            },
          });
        }
      }
    }

    // Get coordinator
    const coordinator = getCoordinator();

    // Execute agent
    const result = await coordinator.route({
      intent: body.intent,
      query: body.query || '',
      payload: body.payload || {},
      context: {
        userId: session.userId,
        employeeId: session.employeeId,
        tenantId: session.tenantId,
        role: session.role,
        scope: session.scope,
        sensitivityClearance: session.sensitivityClearance,
        permissions: session.permissions,
        sessionId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    // Track idempotency
    if (idempotencyKey) {
      await idempotencyStore.complete(idempotencyKey, result);
    }

    // Return response
    return NextResponse.json(result, {
      headers: {
        'X-Request-ID': result.auditId,
        'X-Execution-Time': `${Math.round(performance.now() - startTime)}ms`,
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
      },
    });

  } catch (error) {
    securityLog.error('integration', 'Swarm API error', { error: error instanceof Error ? error.message : error });
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'Validation error',
        'VALIDATION_ERROR',
        400,
        error.issues
      );
    }
    
    return createErrorResponse(
      'An internal error occurred. Please try again.',
      'INTERNAL_ERROR',
      500
    );
  }
}

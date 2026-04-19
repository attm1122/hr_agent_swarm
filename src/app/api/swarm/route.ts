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
import { createRequestLogger } from '@/lib/observability/logger';
import { getCorrelationId } from '@/lib/observability/correlation';
import { sanitizeError } from '@/lib/security/hardening/error-sanitizer';
import { SwarmRequestSchema, type AgentIntent } from '@/lib/validation/schemas';
import { IdempotencyStore } from '@/lib/validation/idempotency';
import { createCoordinator } from '@/lib/agents/factory';
import { requireSession } from '@/lib/auth/session';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter, RATE_LIMITS } from '@/lib/infrastructure/rate-limit/rate-limit-redis';
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
  const correlationId = getCorrelationId(req.headers);
  const routeLogger = createRequestLogger('api:swarm', correlationId);
  
  try {
    // Authentication
    const session = await requireSession();
    if (!session) {
      return createErrorResponse('Authentication required', 'AUTH_REQUIRED', 401);
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
    const idempotencyKey = req.headers.get('Idempotency-Key');
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

    // Create coordinator with explicit dependencies
    const coordinator = createCoordinator();

    // Execute agent
    const result = await coordinator.route({
      intent: body.intent as AgentIntent,
      query: body.query,
      payload: body.payload,
      context: {
        userId: session.userId,
        employeeId: session.employeeId,
        tenantId: session.tenantId,
        role: session.role,
        permissions: session.permissions,
        sessionId: session.sessionId,
        timestamp: new Date().toISOString(),
        scope: session.scope,
        sensitivityClearance: session.sensitivityClearance,
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
    routeLogger.error('Swarm API error', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'Validation error',
        'VALIDATION_ERROR',
        400,
        error.issues
      );
    }
    
    const sanitized = sanitizeError(error, {
      correlationId,
      fallbackCode: 'INTERNAL_ERROR',
    });
    return NextResponse.json(
      { error: sanitized },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

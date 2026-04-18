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
import { SwarmRequestSchema, type AgentIntent } from '@/lib/validation/schemas';
import { IdempotencyStore } from '@/lib/validation/idempotency';
import { getCoordinator } from '@/lib/agents/coordinator';
import { requireSession } from '@/lib/auth/session';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter, RATE_LIMITS } from '@/lib/security/rate-limit-redis';
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

    // Get coordinator
    const coordinator = getCoordinator();

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
    console.error('Swarm API error:', error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'Validation error',
        'VALIDATION_ERROR',
        400,
        error.issues
      );
    }
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
}

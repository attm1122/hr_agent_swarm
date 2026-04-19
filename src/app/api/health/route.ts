/**
 * Health Check API — Hardened
 *
 * Provides endpoints for monitoring system health:
 * - GET /api/health — Basic health status (load balancer safe)
 * - HEAD /api/health — Lightweight check
 *
 * SECURITY:
 * - No version, uptime, or internal details exposed
 * - Rate limited to prevent info-gathering abuse
 * - Database check uses minimal query
 * - Errors are sanitized
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/infrastructure/database/client';
import { createRequestLogger } from '@/lib/observability/logger';
import { getCorrelationId } from '@/lib/observability/correlation';
import { sanitizeError } from '@/lib/security/hardening/error-sanitizer';
import { checkRateLimit, generateRateLimitKey } from '@/lib/infrastructure/rate-limit';

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
  };
}

/**
 * Check database connectivity (minimal query)
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('tenants').select('id').limit(1);
    const responseTime = Date.now() - start;

    if (error) {
      return { status: 'fail', responseTime };
    }

    return {
      status: responseTime > 1000 ? 'warn' : 'pass',
      responseTime,
    };
  } catch {
    return { status: 'fail' };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (usagePercent > 90) return { status: 'fail' };
  if (usagePercent > 75) return { status: 'warn' };
  return { status: 'pass' };
}

/**
 * GET /api/health
 * Basic health check for load balancers — NO internal details exposed
 */
export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req.headers);
  const logger = createRequestLogger('api:health', correlationId);

  try {
    // Rate limit: 60 requests per minute per IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rateLimit = await checkRateLimit(clientIp, 'search', 'employee');

    if (!rateLimit.allowed) {
      const sanitized = sanitizeError(new Error('Rate limit exceeded'), {
        correlationId,
        fallbackCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimit.retryAfter,
      });

      return NextResponse.json(
        { error: sanitized },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60),
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const [dbCheck, memoryCheck] = await Promise.all([
      checkDatabase(),
      checkMemory(),
    ]);

    let status: HealthStatus['status'] = 'healthy';
    if (dbCheck.status === 'fail' || memoryCheck.status === 'fail') {
      status = 'unhealthy';
    } else if (dbCheck.status === 'warn' || memoryCheck.status === 'warn') {
      status = 'degraded';
    }

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        memory: memoryCheck,
      },
    };

    const statusCode = status === 'unhealthy' ? 503 : 200;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    logger.error('Health check failed', { error: err instanceof Error ? err.message : String(err) });

    const sanitized = sanitizeError(err, {
      correlationId,
      fallbackCode: 'SERVICE_UNAVAILABLE',
    });

    return NextResponse.json(
      { error: sanitized },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}

/**
 * HEAD /api/health
 * Lightweight health check for load balancers
 */
export async function HEAD(req: NextRequest) {
  try {
    const dbCheck = await checkDatabase();
    const status = dbCheck.status === 'pass' ? 200 : 503;

    return new NextResponse(null, {
      status,
      headers: {
        'X-Health-Status': dbCheck.status,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}

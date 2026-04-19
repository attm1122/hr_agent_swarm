/**
 * Deep Health Check API — Admin Only
 *
 * Provides detailed system diagnostics for administrators:
 * - Database connectivity details
 * - Memory usage statistics
 * - Rate limiter status
 * - CSRF token store status
 * - Uptime and version
 *
 * SECURITY:
 * - Requires admin authentication
 * - Rate limited
 * - Not exposed to load balancers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/infrastructure/database/client';
import { createRequestLogger } from '@/lib/observability/logger';
import { getCorrelationId } from '@/lib/observability/correlation';
import { sanitizeError } from '@/lib/security/hardening/error-sanitizer';
import { checkRateLimit, generateRateLimitKey } from '@/lib/infrastructure/rate-limit';
import { requireSession, hasCapability } from '@/lib/auth/session';
import { getRateLimitMemoryStats } from '@/lib/infrastructure/rate-limit/rate-limit';

interface DeepHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  checks: {
    database: {
      status: 'pass' | 'fail' | 'warn';
      responseTime: number;
      message?: string;
    };
    memory: {
      status: 'pass' | 'fail' | 'warn';
      heapUsedMB: number;
      heapTotalMB: number;
      usagePercent: number;
    };
    rateLimiter: {
      storeSize: number;
      maxSize: number;
      usage: number;
      recommendedAction: string;
    };
  };
}

const startupTime = Date.now();

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req.headers);
  const logger = createRequestLogger('api:health:deep', correlationId);

  try {
    // Authentication
    const session = await requireSession();
    if (!session) {
      const sanitized = sanitizeError(new Error('Authentication required'), {
        correlationId,
        fallbackCode: 'AUTH_REQUIRED',
      });
      return NextResponse.json(
        { error: sanitized },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Authorization: admin only
    if (!hasCapability(session.role, 'admin')) {
      const sanitized = sanitizeError(new Error('Admin access required'), {
        correlationId,
        fallbackCode: 'FORBIDDEN',
      });
      return NextResponse.json(
        { error: sanitized },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Rate limiting
    const rateLimitKey = generateRateLimitKey(session.userId, undefined, session.sessionId);
    const rateLimit = await checkRateLimit(rateLimitKey, 'report', session.role);

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
            'Cache-Control': 'no-store',
            'Retry-After': String(rateLimit.retryAfter || 60),
          },
        }
      );
    }

    // Database check
    const dbStart = Date.now();
    let dbStatus: DeepHealthStatus['checks']['database'];
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from('tenants').select('id').limit(1);
      const responseTime = Date.now() - dbStart;

      if (error) {
        dbStatus = { status: 'fail', responseTime, message: error.message };
      } else {
        dbStatus = {
          status: responseTime > 1000 ? 'warn' : 'pass',
          responseTime,
          message: 'Database connection successful',
        };
      }
    } catch (err) {
      dbStatus = {
        status: 'fail',
        responseTime: Date.now() - dbStart,
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Memory check
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    let memoryStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (usagePercent > 90) memoryStatus = 'fail';
    else if (usagePercent > 75) memoryStatus = 'warn';

    // Rate limiter stats
    const rateLimiterStats = getRateLimitMemoryStats();

    const status: DeepHealthStatus['status'] =
      dbStatus.status === 'fail' || memoryStatus === 'fail' ? 'unhealthy' :
      dbStatus.status === 'warn' || memoryStatus === 'warn' ? 'degraded' : 'healthy';

    const health: DeepHealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Date.now() - startupTime,
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbStatus,
        memory: {
          status: memoryStatus,
          heapUsedMB,
          heapTotalMB,
          usagePercent,
        },
        rateLimiter: rateLimiterStats,
      },
    };

    const statusCode = status === 'unhealthy' ? 503 : 200;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    logger.error('Deep health check failed', { error: err instanceof Error ? err.message : String(err) });

    const sanitized = sanitizeError(err, {
      correlationId,
      fallbackCode: 'INTERNAL_ERROR',
    });

    return NextResponse.json(
      { error: sanitized },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}

/**
 * GET /api/admin/observability
 * 
 * Admin-only endpoint for platform observability data:
 * - Agent execution metrics
 * - Security event summary
 * - Performance metrics
 * - System health status
 * - Integration health
 * 
 * SECURITY:
 * - Admin-only access (admin:read capability required)
 * - Rate limited (report tier)
 * - No PII exposed in telemetry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAgentContext } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { securityMiddleware, addSecurityHeaders } from '@/lib/security';
import { logSecurityEvent } from '@/lib/security';
import {
  getAgentMetrics,
  getSecurityMetrics,
  getPerformanceReport,
  checkSystemHealth,
  getDashboardMetrics,
} from '@/lib/observability';
import {
  getIntegrationStatus,
  getIntegrationSummary,
  checkIntegrationHealth,
} from '@/lib/observability/integration-health';

export async function GET(req: NextRequest) {
  try {
    const session = getSession();
    const context = getAgentContext(session);

    // 1. Security middleware
    const securityContext = {
      userId: session.employeeId || 'unknown',
      role: session.role,
      sessionId: session.userId,
    };

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'report',
      requireCsrf: false,
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // 2. Admin-only authorization
    if (!hasCapability(session.role, 'admin:read')) {
      logSecurityEvent(
        'auth_failure',
        context,
        {
          reason: 'Non-admin attempted to access observability endpoint',
          resourceType: 'observability',
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden - admin access required' },
          { status: 403 }
        )
      );
    }

    // 3. Gather all observability data
    const timeWindowMinutes = 60;

    const [
      agentMetrics,
      securityMetrics,
      performanceReport,
      systemHealth,
      dashboardMetrics,
      integrationStatus,
      integrationSummary,
    ] = await Promise.all([
      Promise.resolve(getAgentMetrics(timeWindowMinutes)),
      Promise.resolve(getSecurityMetrics(timeWindowMinutes)),
      Promise.resolve(getPerformanceReport(timeWindowMinutes)),
      Promise.resolve(checkSystemHealth()),
      Promise.resolve(getDashboardMetrics()),
      Promise.resolve(getIntegrationStatus()),
      Promise.resolve(getIntegrationSummary()),
    ]);

    // 4. Return comprehensive observability report
    const response = NextResponse.json({
      timestamp: new Date().toISOString(),
      window: `${timeWindowMinutes}m`,
      
      // Agent execution metrics
      agents: {
        totalExecutions: agentMetrics.totalExecutions,
        successRate: Math.round(agentMetrics.successRate * 100),
        avgExecutionTime: Math.round(agentMetrics.avgExecutionTime),
        byAgent: agentMetrics.byAgent,
        topErrors: agentMetrics.errors.slice(0, 5),
      },

      // Security metrics
      security: {
        totalEvents: securityMetrics.totalEvents,
        byType: securityMetrics.byType,
        alertCount: securityMetrics.alertCount,
        topBlockedIps: securityMetrics.topBlockedIps.slice(0, 5),
      },

      // Performance metrics
      performance: {
        avgResponseTime: Math.round(performanceReport.avgResponseTime),
        p95ResponseTime: Math.round(performanceReport.p95ResponseTime),
        p99ResponseTime: Math.round(performanceReport.p99ResponseTime),
        cacheHitRate: Math.round(performanceReport.cacheHitRate * 100),
        slowOperations: (Object.entries(performanceReport.byOperation) as [string, { avg: number; count: number }][])
          .filter(([, data]) => data.avg > 1000)
          .sort(([, a], [, b]) => b.avg - a.avg)
          .slice(0, 5),
      },

      // System health
      health: {
        status: systemHealth.status,
        checks: systemHealth.checks,
        timestamp: systemHealth.timestamp,
      },

      // User activity
      activity: {
        activeUsers: dashboardMetrics.activeUsers,
        actionsLastHour: dashboardMetrics.actionsLastHour,
        topActions: dashboardMetrics.topActions,
      },

      // Integration health
      integrations: {
        summary: integrationSummary,
        details: integrationStatus,
      },
    });

    return addSecurityHeaders(response);

  } catch (error) {
    console.error('Observability endpoint error:', error);
    
    const errorResponse = NextResponse.json(
      {
        error: 'Failed to gather observability data',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(errorResponse);
  }
}

/**
 * POST /api/admin/observability/refresh
 * 
 * Trigger health check refresh
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSession();
    const context = getAgentContext(session);

    // Security middleware
    const securityContext = {
      userId: session.employeeId || 'unknown',
      role: session.role,
      sessionId: session.userId,
    };

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // Admin-only
    if (!hasCapability(session.role, 'admin:read')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    // Refresh integration health checks
    const integrationHealth = await checkIntegrationHealth();

    const response = NextResponse.json({
      message: 'Health checks refreshed',
      timestamp: new Date().toISOString(),
      integrations: integrationHealth.map(i => ({
        name: i.name,
        status: i.status,
        responseTime: Math.round(i.avgResponseTime),
      })),
    });

    return addSecurityHeaders(response);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

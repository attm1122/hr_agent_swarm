/**
 * POST /api/swarm
 * Single entry point for all agent interactions.
 * Client sends intent + payload only.
 * Server builds AgentContext from the authenticated session — never trust the client.
 *
 * SECURITY: Protected by:
 * - Rate limiting (agent tier: 60/min)
 * - CSRF token validation
 * - Input sanitization (XSS/SQL injection prevention)
 * - Request size limits (1MB)
 * - Security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCoordinator } from '@/lib/agents';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import { securityMiddleware, validateRequestBody, addSecurityHeaders } from '@/lib/security';
import { logSecurityEvent } from '@/lib/security';
import type { AgentIntent } from '@/types';

interface SwarmPostBody {
  intent: AgentIntent;
  query?: string;
  payload?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const { session, context, securityContext } = requireVerifiedSessionContext();

    // 1. Apply security middleware (rate limit, CSRF, size checks)
    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 1024 * 1024, // 1MB
    });

    if (securityCheck) {
      // Security check failed - return the error response with headers
      return addSecurityHeaders(securityCheck);
    }

    // 2. Validate and sanitize request body
    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      logSecurityEvent(
        'security_blocked',
        context,
        { reason: bodyValidation.error || 'Body validation failed' }
      );
      const response = NextResponse.json(
        { error: bodyValidation.error || 'Invalid request body' },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const body = bodyValidation.body as unknown as SwarmPostBody;

    if (!body || !body.intent) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Missing required field: intent' },
          { status: 400 }
        )
      );
    }

    // 3. Context is built server-side from the session — client cannot override role/permissions
    // 4. Route to coordinator with full security context
    const coordinator = getCoordinator();
    const response = await coordinator.route({
      intent: body.intent,
      query: body.query || '',
      payload: body.payload || {},
      context,
    });

    // 5. Add security headers to successful response
    const successResponse = NextResponse.json(response);
    return addSecurityHeaders(successResponse);
  } catch (err) {
    if (isSessionResolutionError(err)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status }
        )
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    const errorResponse = NextResponse.json(
      { error: message },
      { status: 500 }
    );
    return addSecurityHeaders(errorResponse);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { session, securityContext } = requireVerifiedSessionContext();

    // Auth-gate: only admin can see audit log (contains employee names & action summaries)
    if (session.role !== 'admin') {
      const response = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      return addSecurityHeaders(response);
    }

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'report', // Lower limit for audit access
      requireCsrf: false, // GET doesn't require CSRF
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    const coordinator = getCoordinator();
    const response = NextResponse.json({
      status: 'ok',
      agents: ['employee_profile', 'leave_milestones', 'document_compliance'],
      recentAudit: coordinator.getAuditLog().slice(-10),
    });

    return addSecurityHeaders(response);
  } catch (err) {
    if (isSessionResolutionError(err)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status }
        )
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

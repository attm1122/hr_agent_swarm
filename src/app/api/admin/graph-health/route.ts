/**
 * GET /api/admin/graph-health
 *
 * Verifies that the Microsoft Graph client-credentials flow works with the
 * configured AZURE_* env vars. Returns:
 *   - configured: whether AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET are present
 *   - tokenIssued: whether the token endpoint returned a valid access token
 *   - directoryReachable: whether /users?$top=1 succeeds (proves User.Read.All)
 *   - error: first error encountered, if any
 *
 * Admin-only. Useful during initial setup to confirm the app registration is
 * wired correctly before running a full directory sync.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import { addSecurityHeaders, securityMiddleware } from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import {
  isGraphConfigured,
  getGraphAccessToken,
  graphFetch,
  GraphApiError,
} from '@/lib/graph/client';

interface HealthResult {
  configured: boolean;
  tokenIssued: boolean;
  directoryReachable: boolean;
  tenantSampleUpn?: string;
  error?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { session, securityContext } = requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: false,
      validateInput: false,
    });
    if (securityCheck) return addSecurityHeaders(securityCheck);

    if (!hasCapability(session.role, 'admin:read')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }),
      );
    }

    const result: HealthResult = {
      configured: isGraphConfigured(),
      tokenIssued: false,
      directoryReachable: false,
    };

    if (!result.configured) {
      result.error =
        'AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET not set';
      return addSecurityHeaders(NextResponse.json(result, { status: 200 }));
    }

    try {
      await getGraphAccessToken();
      result.tokenIssued = true;
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      return addSecurityHeaders(NextResponse.json(result, { status: 200 }));
    }

    try {
      const probe = await graphFetch<{ value: Array<{ userPrincipalName: string }> }>(
        '/users?$top=1&$select=userPrincipalName',
      );
      result.directoryReachable = true;
      result.tenantSampleUpn = probe.value?.[0]?.userPrincipalName;
    } catch (err) {
      result.error =
        err instanceof GraphApiError
          ? `${err.message} (HTTP ${err.status})`
          : err instanceof Error
          ? err.message
          : String(err);
    }

    return addSecurityHeaders(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        ),
      );
    }
    const message = error instanceof Error ? error.message : 'Graph health check failed';
    return addSecurityHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

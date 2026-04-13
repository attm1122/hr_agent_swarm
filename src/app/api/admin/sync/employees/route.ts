/**
 * POST /api/admin/sync/employees
 *
 * Runs the Azure AD / Microsoft Graph → Supabase employee sync.
 *
 * Body (all optional):
 *   {
 *     "upnDomain": "leap.com.au",   // restrict to a single mail domain
 *     "includeDisabled": false,     // include disabled accounts
 *     "dryRun": false               // compute diff without writing
 *   }
 *
 * Admin-only. Returns a SyncResult with counts + per-user errors.
 *
 * Note: this is idempotent and safe to re-run. Users removed from Entra are
 * NOT automatically terminated — run a termination workflow separately.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import {
  addSecurityHeaders,
  securityMiddleware,
  validateRequestBody,
} from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import { isGraphConfigured } from '@/lib/graph/client';
import {
  syncEmployeesFromGraph,
  type EmployeeSyncOptions,
} from '@/lib/integrations/employee-sync';

export async function POST(req: NextRequest) {
  try {
    const { session, context, securityContext } = requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 32 * 1024,
    });
    if (securityCheck) return addSecurityHeaders(securityCheck);

    if (!hasCapability(session.role, 'admin:write')) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden — admin write access required' },
          { status: 403 },
        ),
      );
    }

    if (!isGraphConfigured()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error:
              'Microsoft Graph is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.',
          },
          { status: 503 },
        ),
      );
    }

    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: bodyValidation.error || 'Invalid request body' },
          { status: 400 },
        ),
      );
    }
    const body = (bodyValidation.body ?? {}) as {
      upnDomain?: string;
      includeDisabled?: boolean;
      dryRun?: boolean;
    };

    const syncOptions: EmployeeSyncOptions = {
      tenantId: context.tenantId || 'default',
      upnDomain: body.upnDomain?.trim() || undefined,
      includeDisabled: Boolean(body.includeDisabled),
      dryRun: Boolean(body.dryRun),
    };

    const result = await syncEmployeesFromGraph(syncOptions);

    return addSecurityHeaders(
      NextResponse.json({ success: true, result }, { status: 200 }),
    );
  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        ),
      );
    }
    const message = error instanceof Error ? error.message : 'Employee sync failed';
    return addSecurityHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

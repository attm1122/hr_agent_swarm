/**
 * POST /api/admin/sync/documents
 *
 * Walks each employee's OneDrive `/HR` folder and indexes the file metadata
 * into the `employee_documents` table so the Document Compliance agent can
 * surface missing / expiring documents.
 *
 * Body (all optional):
 *   {
 *     "folderPath": "/HR",
 *     "upnDomain": "leap.com.au",
 *     "employeeIds": ["emp-001"],  // subset — useful after onboarding
 *     "dryRun": false
 *   }
 *
 * Admin-only. Idempotent. Recommended schedule: daily at 02:00 UTC via the
 * Vercel Cron feature (see vercel.json).
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
  syncDocumentsFromOneDrive,
  type DocumentSyncOptions,
} from '@/lib/integrations/document-sync';

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
      folderPath?: string;
      upnDomain?: string;
      employeeIds?: string[];
      dryRun?: boolean;
    };

    const opts: DocumentSyncOptions = {
      tenantId: context.tenantId || 'default',
      folderPath: body.folderPath?.trim() || undefined,
      upnDomain: body.upnDomain?.trim() || undefined,
      employeeIds: Array.isArray(body.employeeIds) ? body.employeeIds : undefined,
      dryRun: Boolean(body.dryRun),
    };

    const result = await syncDocumentsFromOneDrive(opts);

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
    const message = error instanceof Error ? error.message : 'Document sync failed';
    return addSecurityHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

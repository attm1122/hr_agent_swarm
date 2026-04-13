/**
 * GET /api/cron/sync-documents
 *
 * Daily OneDrive → Supabase employee_documents sync. Invoked by Vercel Cron.
 * Only indexes file metadata (no bytes copied).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { syncDocumentsFromOneDrive } from '@/lib/integrations/document-sync';
import { isGraphConfigured } from '@/lib/graph/client';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isGraphConfigured()) {
    return NextResponse.json(
      { error: 'Microsoft Graph is not configured' },
      { status: 503 },
    );
  }

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || 'default';
    const upnDomain = process.env.DEFAULT_UPN_DOMAIN || undefined;
    const result = await syncDocumentsFromOneDrive({
      tenantId,
      upnDomain,
      folderPath: process.env.DEFAULT_DOCUMENT_FOLDER || '/HR',
      dryRun: false,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    console.error('[cron/sync-documents]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

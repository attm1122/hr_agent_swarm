/**
 * GET /api/cron/sync-employees
 *
 * Daily Azure AD → Supabase employee sync. Invoked by Vercel Cron (see
 * `vercel.json`). Vercel adds a signed `Authorization: Bearer <CRON_SECRET>`
 * header when it calls cron endpoints.
 *
 * Not intended for interactive use. For one-off runs, use
 * `POST /api/admin/sync/employees` via the admin UI instead.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { syncEmployeesFromGraph } from '@/lib/integrations/employee-sync';
import { isGraphConfigured } from '@/lib/graph/client';

/**
 * SECURITY: Constant-time comparison prevents timing attacks on CRON_SECRET.
 * A standard `===` leaks how many leading characters matched via response time.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
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
    const result = await syncEmployeesFromGraph({
      tenantId,
      upnDomain,
      includeDisabled: false,
      dryRun: false,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    console.error('[cron/sync-employees]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

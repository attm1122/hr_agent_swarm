/**
 * GET /api/admin/ai-os-traces
 *
 * Admin-only. Lists the last N rows from `ai_os_traces`, merging the
 * in-memory ring buffer (dev fallback) with the Supabase table.
 *
 * Query params:
 *   limit   — default 50, max 200
 *   mode    — filter by AUTO_COMPLETE | WORKSPACE | ESCALATE
 *   success — 'true' | 'false' to filter by success flag
 */

import { NextRequest } from 'next/server';
import { requireResolvedSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';
import { recentTraces } from '@/lib/ai-os/agents/audit-agent';
import {
  securityMiddleware,
  addSecurityHeaders,
} from '@/lib/security/security-middleware';

export const runtime = 'nodejs';

function jsonError(message: string, code: string, status: number) {
  return new Response(
    JSON.stringify({ error: { message, code } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }
  if (session.role !== 'admin') {
    return jsonError('Admin only', 'FORBIDDEN', 403);
  }

  // Rate limiting — prevent trace enumeration/dump attacks
  const securityCheck = await securityMiddleware(
    req,
    { userId: session.userId, role: session.role, sessionId: session.userId },
    { rateLimitTier: 'report', requireCsrf: false, validateInput: false },
  );
  if (securityCheck) return addSecurityHeaders(securityCheck);

  const url = new URL(req.url);
  const limit = Math.min(
    Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50,
    200,
  );
  const mode = url.searchParams.get('mode');
  const success = url.searchParams.get('success');

  const supabase = createServiceRoleClient();
  type Row = Record<string, unknown>;
  let rows: Row[] = [];

  if (supabase) {
    try {
      const client = supabase as unknown as {
        from: (t: 'ai_os_traces') => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
      const { data, error } = await client
        .from('ai_os_traces')
        .select(
          'id, tenant_id, user_id, conversation_id, mode, raw_input, intent, decision, duration_ms, success, error, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && Array.isArray(data)) rows = data;
    } catch {
      // fall through to memory-only
    }
  }

  if (rows.length === 0) {
    rows = recentTraces(limit).map((r) => ({
      id: r.id,
      tenant_id: r.tenantId,
      user_id: r.userId,
      conversation_id: r.conversationId,
      mode: r.decision.mode,
      raw_input: r.intent.rawInput,
      intent: r.intent,
      decision: r.decision,
      duration_ms: r.durationMs,
      success: r.success,
      error: r.error,
      created_at: r.createdAt,
      source: 'memory',
    }));
  }

  if (mode) {
    rows = rows.filter((r) => r.mode === mode);
  }
  if (success === 'true' || success === 'false') {
    rows = rows.filter((r) => Boolean(r.success) === (success === 'true'));
  }

  const response = new Response(JSON.stringify({ rows, total: rows.length }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
      'x-content-type-options': 'nosniff',
    },
  });
  return response;
}

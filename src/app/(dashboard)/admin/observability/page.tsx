/**
 * /admin/observability — AI-OS trace feed.
 *
 * Server-rendered page that calls the admin API and renders the most recent
 * pipeline traces. Admins can see every intent, mode, risk level, duration,
 * success/failure, and the (PII-redacted) rawInput. Non-admins see 403.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireResolvedSession } from '@/lib/auth/session';

// Always rendered per-request: reads auth cookies + live trace feed.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';
import { recentTraces } from '@/lib/ai-os/agents/audit-agent';
import type { Intent } from '@/lib/ai-os/intent/types';
import type { DecisionTrace } from '@/lib/ai-os/decision/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TraceRow = {
  id: string;
  mode: string | null;
  raw_input?: string | null;
  intent?: Intent | null;
  decision?: DecisionTrace | null;
  duration_ms: number | null;
  success: boolean | null;
  error?: string | null;
  created_at: string;
  source?: string;
};

async function loadTraces(): Promise<TraceRow[]> {
  const supabase = createServiceRoleClient();
  if (supabase) {
    try {
      const client = supabase as unknown as {
        from: (t: 'ai_os_traces') => {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{ data: TraceRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
      const { data } = await client
        .from('ai_os_traces')
        .select(
          'id, mode, raw_input, intent, decision, duration_ms, success, error, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(50);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      // fall through
    }
  }
  return recentTraces(50).map((r) => ({
    id: r.id,
    mode: r.decision.mode,
    raw_input: r.intent.rawInput,
    intent: r.intent,
    decision: r.decision,
    duration_ms: r.durationMs,
    success: r.success,
    error: r.error ?? null,
    created_at: r.createdAt,
    source: 'memory',
  }));
}

function modeClass(mode: string | null | undefined) {
  switch (mode) {
    case 'AUTO_COMPLETE': return 'bg-emerald-100 text-emerald-800';
    case 'WORKSPACE':     return 'bg-blue-100 text-blue-800';
    case 'ESCALATE':      return 'bg-amber-100 text-amber-800';
    default:              return 'bg-slate-100 text-slate-700';
  }
}

function riskClass(level: string | undefined) {
  switch (level) {
    case 'low':    return 'bg-slate-100 text-slate-700';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high':   return 'bg-red-100 text-red-800';
    default:       return 'bg-slate-100 text-slate-700';
  }
}

export default async function ObservabilityPage() {
  const session = await requireResolvedSession();
  if (session.role !== 'admin') {
    redirect('/hr');
  }

  const rows = await loadTraces();
  const totals = {
    total: rows.length,
    auto: rows.filter((r) => r.mode === 'AUTO_COMPLETE').length,
    workspace: rows.filter((r) => r.mode === 'WORKSPACE').length,
    escalate: rows.filter((r) => r.mode === 'ESCALATE').length,
    failures: rows.filter((r) => r.success === false).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI-OS observability</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Last 50 pipeline runs. Raw inputs are PII-redacted before persistence.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900">{totals.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Auto-complete</p>
          <p className="text-2xl font-semibold text-emerald-700">{totals.auto}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Workspace</p>
          <p className="text-2xl font-semibold text-blue-700">{totals.workspace}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Escalate</p>
          <p className="text-2xl font-semibold text-amber-700">{totals.escalate}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Failures</p>
          <p className="text-2xl font-semibold text-red-700">{totals.failures}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trace feed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Mode</th>
                <th className="text-left px-4 py-2">Intent</th>
                <th className="text-left px-4 py-2">Risk</th>
                <th className="text-left px-4 py-2">Input</th>
                <th className="text-right px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-4 py-2"><span className="sr-only">Detail</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No traces yet. Run a request on <span className="font-mono">/hr</span> to populate.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50 group">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                    <Link
                      href={`/admin/observability/${r.id}`}
                      className="hover:underline hover:text-slate-900 transition-colors"
                    >
                      {new Date(r.created_at).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={cn('px-2 py-0.5', modeClass(r.mode))}>
                      {r.mode ?? '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">
                    {r.intent?.action ?? '—'}·{r.intent?.entity ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={cn('px-2 py-0.5', riskClass(r.decision?.risk.value))}>
                      {r.decision?.risk.value ?? '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 max-w-sm truncate text-slate-700">
                    {r.raw_input ?? r.intent?.rawInput ?? ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {r.duration_ms ?? 0}ms
                  </td>
                  <td className="px-4 py-2">
                    {r.success === false ? (
                      <Badge className="bg-red-100 text-red-700">error</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">ok</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/observability/${r.id}`}
                      className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-700"
                      title="View trace detail"
                    >
                      &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

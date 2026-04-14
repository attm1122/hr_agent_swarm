/**
 * /admin/observability/[id] — Per-decision audit trail detail page.
 *
 * Shows the full decision trace for a single AI-OS pipeline run:
 * intent, decision, agent calls, emitted blocks, and errors.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireResolvedSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';
import { recentTraces } from '@/lib/ai-os/agents/audit-agent';
import type { Intent } from '@/lib/ai-os/intent/types';
import type { DecisionTrace } from '@/lib/ai-os/decision/types';
import type { UIBlock } from '@/lib/ai-os/ui-composer/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TraceDetail = {
  id: string;
  mode: string | null;
  raw_input?: string | null;
  intent?: Intent | null;
  decision?: DecisionTrace | null;
  agent_calls?: unknown[] | null;
  blocks?: UIBlock[] | null;
  artifact_ids?: string[] | null;
  duration_ms: number | null;
  success: boolean | null;
  error?: string | null;
  created_at: string;
  source?: string;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */

async function loadTrace(id: string): Promise<TraceDetail | null> {
  // Try Supabase first
  const supabase = createServiceRoleClient();
  if (supabase) {
    try {
      const client = supabase as unknown as {
        from: (t: 'ai_os_traces') => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              single: () => Promise<{
                data: TraceDetail | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      const { data } = await client
        .from('ai_os_traces')
        .select(
          'id, mode, raw_input, intent, decision, agent_calls, blocks, artifact_ids, duration_ms, success, error, created_at',
        )
        .eq('id', id)
        .single();
      if (data) return data;
    } catch {
      // fall through to memory
    }
  }

  // Fall back to in-memory ring buffer
  const mem = recentTraces(500).find((r) => r.id === id);
  if (!mem) return null;

  return {
    id: mem.id,
    mode: mem.decision.mode,
    raw_input: mem.intent.rawInput,
    intent: mem.intent,
    decision: mem.decision,
    agent_calls: mem.agentCalls,
    blocks: mem.blocks,
    artifact_ids: mem.artifactIds,
    duration_ms: mem.durationMs,
    success: mem.success,
    error: mem.error ?? null,
    created_at: mem.createdAt,
    source: 'memory',
  };
}

/* ------------------------------------------------------------------ */
/*  Style helpers (same palette as list page)                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Collapsible JSON section (details/summary — no client JS needed)   */
/* ------------------------------------------------------------------ */

function CollapsibleJson({ label, data }: { label: string; data: unknown }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 select-none">
        {label}
      </summary>
      <pre className="mt-1 rounded bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto max-h-64 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function TraceDetailPage({ params }: PageProps) {
  const session = await requireResolvedSession();
  if (session.role !== 'admin') {
    redirect('/hr');
  }

  const { id } = await params;
  const trace = await loadTrace(id);
  if (!trace) {
    notFound();
  }

  const intent = trace.intent;
  const decision = trace.decision;
  const agentCalls = (trace.agent_calls ?? []) as Array<Record<string, unknown>>;
  const blocks = (trace.blocks ?? []) as UIBlock[];

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/observability"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            &larr; Back to traces
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            Trace{' '}
            <span className="font-mono text-base text-slate-600">{trace.id}</span>
          </h1>
          <p className="text-sm text-slate-500">
            {new Date(trace.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-100 text-slate-700 px-2 py-0.5">
            {trace.duration_ms ?? 0}ms
          </Badge>
          {trace.success === false ? (
            <Badge className="bg-red-100 text-red-700 px-2 py-0.5">error</Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700 px-2 py-0.5">ok</Badge>
          )}
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {trace.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Error</p>
          <p className="mt-1 text-sm text-red-700">{trace.error}</p>
        </div>
      )}

      {/* ---- Intent card ---- */}
      {intent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Action</p>
                <p className="font-medium text-slate-900">{intent.action}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Entity</p>
                <p className="font-medium text-slate-900">{intent.entity}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Target scope</p>
                <p className="font-medium text-slate-900">{intent.target.scope}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
                <p className="font-medium text-slate-900">
                  {(intent.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Output format</p>
                <p className="font-medium text-slate-900">{intent.outputFormat}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Raw input (redacted)</p>
              <p className="mt-0.5 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700 font-mono">
                {intent.rawInput || '(empty)'}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Rationale</p>
              <p className="mt-0.5 text-sm text-slate-700">{intent.rationale}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Decision card ---- */}
      {decision && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('px-2 py-0.5', modeClass(decision.mode))}>
                {decision.mode}
              </Badge>
              <Badge className={cn('px-2 py-0.5', riskClass(decision.risk.value))}>
                risk: {decision.risk.value}
              </Badge>
            </div>

            {/* Permission checks */}
            {decision.permissionChecks.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Permission checks
                </p>
                <ul className="space-y-1">
                  {decision.permissionChecks.map((pc, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                          pc.granted
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700',
                        )}
                      >
                        {pc.granted ? '\u2713' : '\u2717'}
                      </span>
                      <span className="font-mono text-slate-700">{pc.capability}</span>
                      {pc.reason && (
                        <span className="text-slate-500">— {pc.reason}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Decision reasons */}
            {decision.reasons.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Decision reasons
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-slate-700">
                  {decision.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Policy refs */}
            {decision.risk.policyRefs.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Policy references
                </p>
                <div className="flex flex-wrap gap-1">
                  {decision.risk.policyRefs.map((ref, i) => (
                    <Badge key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 font-mono text-xs">
                      {ref}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers */}
            {decision.blockers && decision.blockers.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Blockers</p>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-red-700">
                  {decision.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Agent calls timeline ---- */}
      {agentCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Agent calls{' '}
              <span className="text-sm font-normal text-slate-500">
                ({agentCalls.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentCalls.map((call, i) => {
              const toolName = (call.tool ?? call.toolName ?? call.agent ?? 'unknown') as string;
              const callIntent = (call.intent ?? call.action ?? '') as string;
              const execMs = (call.durationMs ?? call.executionMs ?? call.duration_ms ?? null) as number | null;
              const callSuccess = call.success !== false;
              const summary = (call.summary ?? call.result ?? '') as string;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-slate-900">
                      {toolName}
                    </span>
                    {callIntent && (
                      <span className="text-xs text-slate-500">{callIntent}</span>
                    )}
                    {execMs !== null && (
                      <Badge className="bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">
                        {execMs}ms
                      </Badge>
                    )}
                    {callSuccess ? (
                      <Badge className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-xs">
                        ok
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 px-1.5 py-0.5 text-xs">
                        failed
                      </Badge>
                    )}
                  </div>
                  {summary && (
                    <p className="text-sm text-slate-700">{String(summary)}</p>
                  )}
                  <CollapsibleJson label="Show input / data" data={call} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ---- Blocks emitted ---- */}
      {blocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Blocks emitted{' '}
              <span className="text-sm font-normal text-slate-500">
                ({blocks.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {blocks.map((block, i) => (
                <li key={block.id ?? i} className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-mono">
                    {block.kind}
                  </Badge>
                  <span className="text-slate-700">
                    {'title' in block && block.title ? String(block.title) : `Block #${i + 1}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

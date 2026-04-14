'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Intent, DecisionTrace } from '@/lib/ai-os';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';

export interface AuditTrailProps {
  intent?: Intent;
  decision?: DecisionTrace;
  agentCalls: ToolCallTrace[];
}

export default function AuditTrail({
  intent,
  decision,
  agentCalls,
}: AuditTrailProps) {
  const [open, setOpen] = useState(false);

  if (!intent && !decision && agentCalls.length === 0) return null;

  return (
    <div className="rounded-xl border bg-muted/20 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span className="font-medium">Audit trail</span>
        <span className="ml-auto text-[11px]">
          {agentCalls.length} agent call{agentCalls.length === 1 ? '' : 's'}
          {decision ? ` · ${decision.mode}` : ''}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t bg-background px-4 py-3">
          {intent && (
            <section>
              <h4 className="mb-1 font-semibold text-foreground">Intent</h4>
              <pre className="overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed">
                {JSON.stringify(intent, null, 2)}
              </pre>
            </section>
          )}

          {decision && (
            <section>
              <h4 className="mb-1 font-semibold text-foreground">Decision</h4>
              <ul className="list-inside list-disc text-muted-foreground">
                {decision.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {decision.permissionChecks.length > 0 && (
                <div className="mt-2">
                  <h5 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Permission checks
                  </h5>
                  <ul className="space-y-0.5">
                    {decision.permissionChecks.map((p) => (
                      <li
                        key={p.capability}
                        className={
                          p.granted ? 'text-emerald-600' : 'text-red-600'
                        }
                      >
                        {p.granted ? '✓' : '✗'} {p.capability}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {agentCalls.length > 0 && (
            <section>
              <h4 className="mb-1 font-semibold text-foreground">
                Agent calls
              </h4>
              <ul className="space-y-1.5">
                {agentCalls.map((c, i) => (
                  <li
                    key={`${c.auditId}-${i}`}
                    className="flex items-start justify-between gap-3 rounded border bg-muted/20 p-2"
                  >
                    <div>
                      <div className="font-mono text-[11px] text-foreground">
                        {c.toolName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.summary}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <div>{c.executionTimeMs}ms</div>
                      <div className={c.success ? 'text-emerald-600' : 'text-red-600'}>
                        {c.success ? 'ok' : 'failed'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

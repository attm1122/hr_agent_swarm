'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, FileText, Shield, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [devMode, setDevMode] = useState(false);

  if (!intent && !decision && agentCalls.length === 0) return null;

  const allChecksPassed = decision?.permissionChecks.every((p) => p.granted) ?? true;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--muted-surface)] text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">How this answer was built</span>
        <span className="ml-auto text-[11px] text-[var(--text-disabled)]">
          {agentCalls.length} step{agentCalls.length === 1 ? '' : 's'}
          {decision && ` · ${allChecksPassed ? 'All checks passed' : 'Review required'}`}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--border-default)] bg-white px-4 py-3">
          {/* Human-friendly summary */}
          {!devMode && (
            <div className="space-y-2">
              {intent && (
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 mt-0.5 text-[var(--info)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Understood your request</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Action: {intent.action} · Target: {intent.entity} · Confidence: {Math.round(intent.confidence * 100)}%
                    </p>
                  </div>
                </div>
              )}

              {decision && decision.reasons.length > 0 && (
                <div className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 mt-0.5 text-[var(--primary)]" />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Decision</p>
                    <ul className="mt-1 space-y-1">
                      {decision.reasons.map((r, i) => (
                        <li key={i} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                          <span className="text-[var(--primary)] mt-0.5">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {decision && decision.permissionChecks.length > 0 && (
                <div className="flex items-start gap-2">
                  {allChecksPassed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-[var(--success)]" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 text-[var(--danger)]" />
                  )}
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {allChecksPassed ? 'All permission checks passed' : 'Some permissions missing'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {decision.permissionChecks.map((p) => (
                        <span
                          key={p.capability}
                          className={cn(
                            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
                            p.granted
                              ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                              : 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
                          )}
                        >
                          {p.granted ? '✓' : '✗'} {p.capability}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {agentCalls.length > 0 && (
                <div className="flex items-start gap-2">
                  <Wrench className="h-3.5 w-3.5 mt-0.5 text-[var(--text-tertiary)]" />
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">
                      {agentCalls.length} tool call{agentCalls.length === 1 ? '' : 's'} executed
                    </p>
                    <div className="mt-1 space-y-1">
                      {agentCalls.map((c, i) => (
                        <div
                          key={`${c.auditId}-${i}`}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {c.toolName} — {c.summary}
                          </span>
                          <span className="text-[var(--text-disabled)] shrink-0">
                            {c.executionTimeMs}ms · {c.success ? 'OK' : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dev mode: raw JSON */}
          {devMode && (
            <div className="space-y-3">
              {intent && (
                <section>
                  <h4 className="mb-1 font-semibold text-[var(--text-primary)]">Intent (raw)</h4>
                  <pre className="overflow-auto rounded bg-[var(--muted-surface)] p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(intent, null, 2)}
                  </pre>
                </section>
              )}
              {decision && (
                <section>
                  <h4 className="mb-1 font-semibold text-[var(--text-primary)]">Decision (raw)</h4>
                  <pre className="overflow-auto rounded bg-[var(--muted-surface)] p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(decision, null, 2)}
                  </pre>
                </section>
              )}
              {agentCalls.length > 0 && (
                <section>
                  <h4 className="mb-1 font-semibold text-[var(--text-primary)]">Agent calls (raw)</h4>
                  <pre className="overflow-auto rounded bg-[var(--muted-surface)] p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(agentCalls, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          )}

          {/* Dev mode toggle */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setDevMode((d) => !d)}
              className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
            >
              {devMode ? 'Show simplified view' : 'Show developer details'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

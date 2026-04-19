'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetricItem } from './types';
import { ExpandableDetailPanel } from './ExpandableDetailPanel';

interface MetricsRowProps {
  metrics: MetricItem[];
}

export function MetricsRow({ metrics }: MetricsRowProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (metrics.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {metrics.map((m) => (
        <button
          key={m.id}
          onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
          className="group relative flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3.5 py-2 text-left transition-all hover:border-[var(--border-default)] hover:shadow-sm hover:bg-[var(--surface-interactive)]"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              {m.label}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {m.value}
              </span>
              {m.delta && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                    m.delta.direction === 'up'
                      ? 'text-[var(--success)]'
                      : m.delta.direction === 'down'
                        ? 'text-[var(--danger)]'
                        : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {m.delta.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                  {m.delta.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                  {m.delta.direction === 'flat' && <Minus className="w-3 h-3" />}
                  {m.delta.value}
                </span>
              )}
            </div>
            {m.context && (
              <p className="text-[11px] text-[var(--text-tertiary)] truncate max-w-[140px]">
                {m.context}
              </p>
            )}
          </div>
        </button>
      ))}

      {expandedId && (
        <ExpandableDetailPanel
          title={metrics.find((m) => m.id === expandedId)?.label ?? ''}
          onClose={() => setExpandedId(null)}
        >
          <p className="text-sm text-[var(--text-secondary)]">
            Detailed view for {metrics.find((m) => m.id === expandedId)?.label} would appear here.
            Clicking this metric navigates to the relevant deep-dive page.
          </p>
        </ExpandableDetailPanel>
      )}
    </div>
  );
}

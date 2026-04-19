'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { InsightItem } from './types';
import { ExpandableDetailPanel } from './ExpandableDetailPanel';

interface InsightPanelProps {
  insights: InsightItem[];
  onAskAi?: (question: string) => void;
}

const severityConfig = {
  danger: { icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger-bg)]', border: 'border-[var(--danger-border)]' },
  warning: { icon: AlertCircle, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-bg)]', border: 'border-[var(--warning-border)]' },
  info: { icon: Info, color: 'text-[var(--info)]', bg: 'bg-[var(--info-bg)]', border: 'border-[var(--info-border)]' },
  neutral: { icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[var(--success-bg)]', border: 'border-[var(--success-border)]' },
};

export function InsightPanel({ insights, onAskAi }: InsightPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
        <span className="text-sm text-[var(--success-text)]">All clear — nothing needs attention right now.</span>
      </div>
    );
  }

  const hero = insights[0];
  const rest = insights.slice(1);
  const heroConfig = severityConfig[hero.severity];
  const HeroIcon = heroConfig.icon;

  return (
    <div className="space-y-3">
      {/* Hero insight */}
      <button
        onClick={() => setExpandedId(expandedId === hero.id ? null : hero.id)}
        className={`w-full text-left rounded-xl border ${heroConfig.border} ${heroConfig.bg} p-4 transition-all hover:shadow-sm`}
      >
        <div className="flex items-start gap-3">
          <HeroIcon className={`w-5 h-5 mt-0.5 shrink-0 ${heroConfig.color}`} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{hero.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{hero.narrative}</p>
            {hero.ctaLabel && (
              <div className="flex items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
                  {hero.ctaLabel}
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Secondary insights */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((item) => {
            const cfg = severityConfig[item.severity];
            const Icon = cfg.icon;
            return (
              <button
                key={item.id}
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full text-left flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2.5 transition-all hover:border-[var(--border-default)] hover:bg-[var(--surface-interactive)]"
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{item.narrative}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded detail */}
      {expandedId && (
        <ExpandableDetailPanel
          title={insights.find((i) => i.id === expandedId)?.title ?? ''}
          onClose={() => setExpandedId(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {insights.find((i) => i.id === expandedId)?.narrative}
            </p>
            {onAskAi && (
              <button
                onClick={() => onAskAi(`Explain ${insights.find((i) => i.id === expandedId)?.title}`)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask AI to explain this
              </button>
            )}
          </div>
        </ExpandableDetailPanel>
      )}
    </div>
  );
}

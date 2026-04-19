'use client';

import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  confidence: number; // 0-1
  sources?: string[];
  className?: string;
}

export function ConfidenceBadge({ confidence, sources, className }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100);

  const config =
    confidence >= 0.85
      ? {
          icon: CheckCircle2,
          label: 'High confidence',
          color: 'text-[var(--success-text)] bg-[var(--success-bg)] border-[var(--success-border)]',
        }
      : confidence >= 0.6
        ? {
            icon: AlertCircle,
            label: 'Medium confidence',
            color: 'text-[var(--warning-text)] bg-[var(--warning-bg)] border-[var(--warning-border)]',
          }
        : {
            icon: AlertTriangle,
            label: 'Low confidence',
            color: 'text-[var(--danger-text)] bg-[var(--danger-bg)] border-[var(--danger-border)]',
          };

  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          config.color
        )}
      >
        <Icon className="w-3 h-3" aria-hidden="true" />
        {config.label} · {pct}%
      </span>
      {sources && sources.length > 0 && (
        <span className="ds-meta">
          Based on {sources.length} source{sources.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

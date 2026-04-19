'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Circle,
} from 'lucide-react';
import type { WorkflowItem } from './types';
import { ExpandableDetailPanel } from './ExpandableDetailPanel';

interface WorkflowListProps {
  items: WorkflowItem[];
  onAction?: (intent: string) => void;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger-bg)]', border: 'border-[var(--danger-border)]' },
  warning: { icon: AlertCircle, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-bg)]', border: 'border-[var(--warning-border)]' },
  info: { icon: Clock, color: 'text-[var(--info)]', bg: 'bg-[var(--info-bg)]', border: 'border-[var(--info-border)]' },
  success: { icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[var(--success-bg)]', border: 'border-[var(--success-border)]' },
};

const variantStyles = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
  secondary: 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-interactive)]',
  ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]',
  danger: 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]',
};

export function WorkflowList({ items, onAction }: WorkflowListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2">
        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
        <span className="text-sm text-[var(--success-text)]">No pending actions</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Actions
        </h3>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {items.filter((i) => i.severity === 'critical' || i.severity === 'warning').length} urgent
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => {
          const cfg = severityConfig[item.severity];
          const Icon = cfg.icon;

          return (
            <div
              key={item.id}
              className={`group rounded-lg border ${cfg.border} ${cfg.bg} p-3 transition-all hover:shadow-sm`}
            >
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {item.title}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-[var(--surface-base)] text-[var(--text-secondary)]">
                        {item.status}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-tertiary)]">
                      {item.dueDate && <span>Due {item.dueDate}</span>}
                      {item.assignee && (
                        <>
                          <span className="text-[var(--border-default)]">·</span>
                          <span>{item.assignee}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>

              {/* Inline actions */}
              {item.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pl-6">
                  {item.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (action.intent && onAction) onAction(action.intent);
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        variantStyles[action.variant ?? 'secondary']
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedId && (
        <ExpandableDetailPanel
          title={items.find((i) => i.id === expandedId)?.title ?? ''}
          onClose={() => setExpandedId(null)}
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {items.find((i) => i.id === expandedId)?.description}
          </p>
        </ExpandableDetailPanel>
      )}
    </div>
  );
}

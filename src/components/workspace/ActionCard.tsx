'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  actions: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    onClick?: () => void;
  }>;
  severity?: 'neutral' | 'warning' | 'critical';
}

const severityBorder = {
  neutral: 'border-[var(--border-default)]',
  warning: 'border-[var(--warning-border)]',
  critical: 'border-[var(--danger-border)]',
};

const severityBg = {
  neutral: 'bg-white',
  warning: 'bg-[var(--warning-bg)]',
  critical: 'bg-[var(--danger-bg)]',
};

const btnVariant = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
  secondary: 'bg-white text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--muted-surface)]',
  ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--muted-surface)]',
};

export function ActionCard({ title, description, assignee, dueDate, actions, severity = 'neutral' }: ActionCardProps) {
  return (
    <div className={cn('rounded-xl border p-3 transition-all hover:shadow-sm', severityBorder[severity], severityBg[severity])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
          {description && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{description}</p>
          )}
          {(assignee || dueDate) && (
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
              {assignee && <span>{assignee}</span>}
              {assignee && dueDate && <span className="mx-1 text-[var(--border-strong)]">·</span>}
              {dueDate && <span>{dueDate}</span>}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors', btnVariant[a.variant ?? 'secondary'])}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

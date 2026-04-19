'use client';

import { Loader2, CheckCircle2, Search, FileText, Wrench, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  className?: string;
}

const stepIcons: Record<string, typeof Search> = {
  understand: Search,
  decide: FileText,
  execute: Wrench,
  compose: Sparkles,
};

export function ProgressIndicator({ steps, className }: ProgressIndicatorProps) {
  const activeIndex = steps.findIndex((s) => s.status === 'active');

  return (
    <div className={cn('flex items-center gap-1', className)} aria-live="polite" aria-atomic="false">
      {steps.map((step, index) => {
        const Icon = stepIcons[step.id] || Loader2;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all',
                step.status === 'active' && 'bg-[var(--info-bg)] text-[var(--info-text)]',
                step.status === 'complete' && 'text-[var(--success-text)]',
                step.status === 'pending' && 'text-[var(--text-disabled)]',
                step.status === 'error' && 'text-[var(--danger-text)]',
              )}
            >
              {step.status === 'active' && (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              )}
              {step.status === 'complete' && (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              )}
              {step.status === 'pending' && (
                <Icon className="w-3 h-3 opacity-50" aria-hidden="true" />
              )}
              {step.status === 'error' && (
                <span className="w-3 h-3 rounded-full bg-[var(--danger)]" aria-hidden="true" />
              )}
              <span className={step.status === 'active' ? 'font-semibold' : ''}>
                {step.label}
              </span>
            </span>
            {!isLast && (
              <span className="text-[var(--border-strong)] text-[10px]">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

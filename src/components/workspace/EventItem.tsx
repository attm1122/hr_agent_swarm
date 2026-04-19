'use client';

import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/domain/shared/date-value';

interface EventItemProps {
  time?: string;
  title: string;
  description?: string;
  type: 'sync' | 'policy' | 'leave' | 'review' | 'deadline';
  date?: string;
  isLast?: boolean;
}

const typeDot = {
  sync: 'bg-[var(--primary)]',
  policy: 'bg-[var(--warning)]',
  leave: 'bg-[var(--accent-blue)]',
  review: 'bg-[var(--success)]',
  deadline: 'bg-[var(--danger)]',
};

export function EventItem({ time, title, description, type, date, isLast }: EventItemProps) {
  return (
    <div className="group relative flex gap-3 py-1">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[5px] top-3 bottom-0 w-px bg-[var(--border-default)]" />
      )}

      {/* Dot */}
      <div className={cn('relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', typeDot[type])} />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2">
          {time && (
            <span className="text-[11px] font-medium text-[var(--text-tertiary)] tabular-nums">
              {time}
            </span>
          )}
          {date && !time && (
            <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
              {formatDateOnly(date)}
            </span>
          )}
        </div>
        <p className="text-[13px] font-medium text-[var(--text-primary)] mt-0.5">
          {title}
        </p>
        {description && (
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

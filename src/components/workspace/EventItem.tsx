'use client';

import { cn } from '@/lib/utils';

interface EventItemProps {
  time?: string;
  title: string;
  description?: string;
  isLast?: boolean;
  dotColor?: 'green' | 'amber' | 'blue' | 'red' | 'teal';
}

const dotColors = {
  green: 'bg-[#65A30D]',
  amber: 'bg-[#F59E0B]',
  blue: 'bg-[#3B82F6]',
  red: 'bg-[#EF4444]',
  teal: 'bg-[#0D9488]',
};

export function EventItem({ time, title, description, isLast, dotColor = 'teal' }: EventItemProps) {
  return (
    <div className="group relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[5px] top-4 bottom-0 w-px bg-[#E5E2DD]" />
      )}

      {/* Dot */}
      <div
        className={cn(
          'relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white shrink-0',
          dotColors[dotColor]
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        {time && (
          <span className="text-[11px] font-medium text-[#9C9C9C] tabular-nums">
            {time}
          </span>
        )}
        <p className="text-[13px] font-medium text-[#1A1A1A] mt-0.5">{title}</p>
        {description && (
          <p className="text-[11px] text-[#6B6B6B] truncate">{description}</p>
        )}
      </div>
    </div>
  );
}

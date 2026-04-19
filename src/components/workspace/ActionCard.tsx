'use client';

import { ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  description?: string;
  assignee?: string;
  assigneeInitials?: string;
  dueDate?: string;
  isUrgent?: boolean;
  actions: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    onClick?: () => void;
  }>;
}

const btnStyles = {
  primary: 'bg-[#0D9488] text-white hover:bg-[#0F766E]',
  secondary: 'bg-white text-[#1A1A1A] border border-[#E5E2DD] hover:bg-[#F8F6F3]',
  ghost: 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F8F6F3]',
};

export function ActionCard({
  title,
  description,
  assignee,
  assigneeInitials,
  dueDate,
  isUrgent,
  actions,
}: ActionCardProps) {
  return (
    <div
      className={cn(
        'group rounded-xl border bg-white p-4 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
        isUrgent ? 'border-[#FDE68A] bg-[#FFF8E1]' : 'border-[#E5E2DD]'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isUrgent && (
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            )}
            <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{title}</p>
          </div>
          {description && (
            <p className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">{description}</p>
          )}

          {/* Meta row: avatar + name + date */}
          {(assignee || dueDate) && (
            <div className="flex items-center gap-2 mt-1.5">
              {assigneeInitials && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F0EDE8] text-[10px] font-semibold text-[#6B6B6B]">
                  {assigneeInitials}
                </div>
              )}
              {assignee && (
                <span className="text-[11px] text-[#6B6B6B]">{assignee}</span>
              )}
              {assignee && dueDate && (
                <span className="text-[#E5E2DD]">·</span>
              )}
              {dueDate && (
                <span className="text-[11px] text-[#9C9C9C]">{dueDate}</span>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-[#9C9C9C] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                btnStyles[a.variant ?? 'secondary']
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

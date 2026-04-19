'use client';

import { ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  isUrgent?: boolean;
  actions: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    onClick?: () => void;
  }>;
}

const btnStyles = {
  primary: 'bg-[#1A1A1A] text-white hover:bg-[#333333]',
  secondary: 'bg-white text-[#1A1A1A] border border-[#E5E2DD] hover:bg-[#F8F6F3]',
  ghost: 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F8F6F3]',
};

export function ActionCard({ title, isUrgent, actions }: ActionCardProps) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-3 rounded-xl border bg-white p-3.5 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
        isUrgent ? 'border-[#FDE68A] bg-[#FFF8E1]' : 'border-[#E5E2DD]'
      )}
    >
      {/* Left: icon + title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isUrgent && (
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
        )}
        <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{title}</p>
      </div>

      {/* Right: buttons + chevron */}
      <div className="flex items-center gap-2 shrink-0">
        {actions.length > 0 && (
          <div className="flex items-center gap-1.5">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                  btnStyles[a.variant ?? 'secondary']
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-[#9C9C9C] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

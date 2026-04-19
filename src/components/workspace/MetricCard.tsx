'use client';

import {
  Users,
  ClipboardList,
  Plane,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  valueContext?: string;
  change?: string;
  changeDirection?: 'up' | 'down' | 'flat';
  subtext?: string;
  icon: 'users' | 'clipboard' | 'plane' | 'shield';
  isUrgent?: boolean;
  onClick?: () => void;
}

const iconMap = {
  users: Users,
  clipboard: ClipboardList,
  plane: Plane,
  shield: ShieldAlert,
};

const colorMap = {
  users: { text: 'text-[#65A30D]', bg: 'bg-[#F4FCE8]' },
  clipboard: { text: 'text-[#F59E0B]', bg: 'bg-[#FFF8E1]' },
  plane: { text: 'text-[#3B82F6]', bg: 'bg-[#EFF6FF]' },
  shield: { text: 'text-[#EF4444]', bg: 'bg-[#FEF2F2]' },
};

export function MetricCard({
  title,
  value,
  valueContext,
  change,
  changeDirection,
  subtext,
  icon,
  isUrgent,
  onClick,
}: MetricCardProps) {
  const Icon = iconMap[icon];
  const cfg = colorMap[icon];

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left rounded-xl border bg-white p-4 transition-all duration-200',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5',
        'active:scale-[0.98]',
        'border-[#E5E2DD]'
      )}
    >
      {/* Top row: small icon + label */}
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9C9C9C]">
          {title}
        </span>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-[30px] font-bold leading-none tracking-tight text-[#1A1A1A] tabular-nums">
          {value}
        </span>
        {valueContext && (
          <span className="text-[13px] font-medium text-[#6B6B6B]">{valueContext}</span>
        )}
      </div>

      {/* Subtext / change row */}
      {(change || subtext) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {change && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-medium',
                changeDirection === 'up' && 'text-[#65A30D]',
                changeDirection === 'down' && 'text-[#EF4444]',
                changeDirection === 'flat' && 'text-[#9C9C9C]'
              )}
            >
              {changeDirection === 'up' && <ArrowUpRight className="w-3 h-3" />}
              {changeDirection === 'down' && <ArrowDownRight className="w-3 h-3" />}
              {changeDirection === 'flat' && <Minus className="w-3 h-3" />}
              {change}
            </span>
          )}
          {change && subtext && <span className="text-[#E5E2DD]">·</span>}
          {subtext && <span className="text-[11px] text-[#9C9C9C] truncate">{subtext}</span>}
        </div>
      )}
    </button>
  );
}

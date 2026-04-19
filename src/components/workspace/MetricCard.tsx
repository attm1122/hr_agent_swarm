'use client';

import { useState } from 'react';
import {
  Users,
  ClipboardList,
  Plane,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  id: string;
  icon: 'users' | 'clipboard' | 'plane' | 'shield';
  color: 'green' | 'amber' | 'blue' | 'red';
  label: string;
  value: string | number;
  valueContext?: string;
  subtext: string;
  changeText?: string;
  changeDirection?: 'up' | 'down' | 'flat';
  onClick?: () => void;
}

const iconMap = {
  users: Users,
  clipboard: ClipboardList,
  plane: Plane,
  shield: ShieldAlert,
};

const colorMap = {
  green: {
    bg: 'bg-[#F4FCE8]',
    text: 'text-[#65A30D]',
    border: 'border-[#D4F7A6]',
  },
  amber: {
    bg: 'bg-[#FFF8E1]',
    text: 'text-[#F59E0B]',
    border: 'border-[#FDE68A]',
  },
  blue: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#3B82F6]',
    border: 'border-[#BFDBFE]',
  },
  red: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#EF4444]',
    border: 'border-[#FECACA]',
  },
};

export function MetricCard({
  icon,
  color,
  label,
  value,
  valueContext,
  subtext,
  changeText,
  changeDirection,
  onClick,
}: MetricCardProps) {
  const [pressed, setPressed] = useState(false);
  const Icon = iconMap[icon];
  const cfg = colorMap[color];

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={cn(
        'relative w-full text-left rounded-xl border bg-white p-4 transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5',
        pressed && 'scale-[0.98] shadow-sm',
        'border-[var(--border-default)]'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon circle */}
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cfg.bg, cfg.border, 'border')}>
          <Icon className={cn('h-4 w-4', cfg.text)} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Label */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>

          {/* Value + context inline */}
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-[26px] font-bold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
              {value}
            </span>
            {valueContext && (
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                {valueContext}
              </span>
            )}
          </div>

          {/* Change indicator row */}
          {(changeText || subtext) && (
            <div className="flex items-center gap-1.5 mt-1">
              {changeText && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[11px] font-medium',
                    changeDirection === 'up' && 'text-[var(--success)]',
                    changeDirection === 'down' && 'text-[var(--danger)]',
                    changeDirection === 'flat' && 'text-[var(--text-tertiary)]'
                  )}
                >
                  {changeDirection === 'up' && <ArrowUpRight className="w-3 h-3" />}
                  {changeDirection === 'down' && <TrendingDown className="w-3 h-3" />}
                  {changeDirection === 'flat' && <Minus className="w-3 h-3" />}
                  {changeText}
                </span>
              )}
              {changeText && subtext && (
                <span className="text-[var(--border-strong)]">·</span>
              )}
              {subtext && (
                <span className="text-[11px] text-[var(--text-tertiary)] truncate">
                  {subtext}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

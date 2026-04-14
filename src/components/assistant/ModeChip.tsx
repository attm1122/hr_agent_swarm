'use client';

import { Badge } from '@/components/ui/badge';
import { Bot, ShieldAlert, Sparkles } from 'lucide-react';
import type { ExecutionMode } from '@/lib/ai-os';

export interface ModeChipProps {
  mode: ExecutionMode;
}

const modeStyle: Record<
  ExecutionMode,
  { label: string; cls: string; Icon: typeof Bot }
> = {
  AUTO_COMPLETE: {
    label: 'Auto-completed',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    Icon: Sparkles,
  },
  WORKSPACE: {
    label: 'Workspace',
    cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    Icon: Bot,
  },
  ESCALATE: {
    label: 'Escalated',
    cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    Icon: ShieldAlert,
  },
};

export default function ModeChip({ mode }: ModeChipProps) {
  const { label, cls, Icon } = modeStyle[mode];
  return (
    <Badge variant="outline" className={`gap-1.5 ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

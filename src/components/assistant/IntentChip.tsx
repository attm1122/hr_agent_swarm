'use client';

import { Badge } from '@/components/ui/badge';
import type { Intent } from '@/lib/ai-os';

export interface IntentChipProps {
  intent: Intent;
}

export default function IntentChip({ intent }: IntentChipProps) {
  const conf = Math.round(intent.confidence * 100);
  const tone =
    intent.confidence >= 0.85
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
      : intent.confidence >= 0.6
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900';

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="outline" className={tone}>
        {intent.action} · {intent.entity}
      </Badge>
      <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
        scope: {intent.target.scope}
      </Badge>
      {intent.outputFormat && (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
          {intent.outputFormat}
        </Badge>
      )}
      <Badge variant="outline" className={tone}>
        {conf}% confident
      </Badge>
    </div>
  );
}

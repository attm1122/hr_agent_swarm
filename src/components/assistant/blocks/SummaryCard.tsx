'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LucideIcon from '@/components/assistant/LucideIcon';
import type { UIAction } from '@/lib/ai-os';
import type { SummaryCardBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const toneBorderMap: Record<NonNullable<SummaryCardBlock['tone']>, string> = {
  neutral: 'border-l-4 border-l-gray-400 dark:border-l-gray-500',
  positive: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
  warning: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
  danger: 'border-l-4 border-l-red-500 dark:border-l-red-400',
};

export default function SummaryCard({
  block,
}: BlockComponentProps<SummaryCardBlock>) {
  const borderClass = block.tone
    ? toneBorderMap[block.tone]
    : toneBorderMap.neutral;

  return (
    <Card
      className={`rounded-xl border bg-white shadow-sm dark:bg-gray-900 ${borderClass}`}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          {block.icon && (
            <LucideIcon name={block.icon} className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {block.body && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {block.body}
          </p>
        )}

        {block.metrics && block.metrics.length > 0 && (
          <div className="flex flex-wrap gap-4 pt-2">
            {block.metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex flex-col gap-0.5 min-w-[80px]"
              >
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {metric.label}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold text-foreground">
                    {metric.value}
                  </span>
                  {metric.delta && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {metric.delta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

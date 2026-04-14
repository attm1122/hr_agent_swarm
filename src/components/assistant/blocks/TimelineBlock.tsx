'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type {
  TimelineBlock as TimelineBlockType,
  TimelineEvent,
} from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const toneDot: Record<NonNullable<TimelineEvent['tone']>, string> = {
  neutral: 'bg-gray-400 dark:bg-gray-500',
  positive: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
};

export default function TimelineBlock({
  block,
}: BlockComponentProps<TimelineBlockType>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="relative flex flex-col gap-0">
          {block.events.map((event, idx) => {
            const isLast = idx === block.events.length - 1;
            const dotClass = toneDot[event.tone ?? 'neutral'];

            return (
              <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[7px] top-4 h-full w-px bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Dot */}
                <span
                  className={`relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 border-white dark:border-gray-900 ${dotClass}`}
                  aria-hidden="true"
                />

                {/* Content */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {event.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                  {event.detail && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {event.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

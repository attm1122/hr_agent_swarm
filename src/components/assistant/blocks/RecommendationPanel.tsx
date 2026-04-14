'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { RecommendationPanelBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const severityDot: Record<string, string> = {
  info: 'bg-blue-500 dark:bg-blue-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  critical: 'bg-red-500 dark:bg-red-400',
};

export default function RecommendationPanel({
  block,
}: BlockComponentProps<RecommendationPanelBlock>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col gap-3">
          {block.recommendations.map((rec) => {
            const dotClass =
              severityDot[rec.severity ?? 'info'] ?? severityDot.info;
            return (
              <li key={rec.id} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dotClass}`}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {rec.title}
                  </span>
                  {rec.detail && (
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {rec.detail}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { ConfirmationCardBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  return new Date(iso).toISOString();
}

export default function ConfirmationCard({
  block,
}: BlockComponentProps<ConfirmationCardBlock>) {
  return (
    <Card className="rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            {block.title}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          {block.message}
        </p>

        {block.changedFields &&
          block.changedFields.length > 0 &&
          block.before &&
          block.after && (
            <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-gray-900">
              {block.changedFields.map((field) => {
                const oldVal = block.before?.[field];
                const newVal = block.after?.[field];
                return (
                  <div key={field} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {field}
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-600 line-through dark:text-red-400">
                        {oldVal != null ? String(oldVal) : '\u2014'}
                      </span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        {newVal != null ? String(newVal) : '\u2014'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(block.timestamp)}
        </span>
      </CardContent>
    </Card>
  );
}

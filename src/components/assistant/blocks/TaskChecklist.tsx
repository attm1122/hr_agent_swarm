'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { TaskChecklistBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

export default function TaskChecklist({
  block,
}: BlockComponentProps<TaskChecklistBlock>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col gap-3">
          {block.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              {/* Checkbox visual */}
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                  item.done
                    ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400'
                    : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                }`}
                aria-hidden="true"
              >
                {item.done && (
                  <svg
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      item.done
                        ? 'text-muted-foreground line-through'
                        : 'font-medium text-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.blocker && !item.done && (
                    <Badge variant="destructive" className="text-[10px]">
                      Blocker
                    </Badge>
                  )}
                </div>
                {item.detail && (
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {item.detail}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

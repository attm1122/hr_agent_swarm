'use client';

import { Button } from '@/components/ui/button';
import type { UIAction } from '@/lib/ai-os';
import type { ActionBarBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

function variantMap(
  v?: UIAction['variant'],
): 'default' | 'outline' | 'destructive' | 'ghost' {
  switch (v) {
    case 'primary':
      return 'default';
    case 'secondary':
      return 'outline';
    case 'destructive':
      return 'destructive';
    case 'ghost':
      return 'ghost';
    default:
      return 'default';
  }
}

function variantClass(v?: UIAction['variant']): string | undefined {
  if (v === 'primary') {
    return 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600';
  }
  return undefined;
}

export default function ActionBar({
  block,
  onAction,
}: BlockComponentProps<ActionBarBlock>) {
  const actions = block.actions ?? [];

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={variantMap(action.variant)}
          className={variantClass(action.variant)}
          onClick={() => onAction?.(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

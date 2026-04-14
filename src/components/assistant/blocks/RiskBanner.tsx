'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UIAction } from '@/lib/ai-os';
import type { RiskBannerBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const severityStyles: Record<
  RiskBannerBlock['severity'],
  { bg: string; border: string; text: string; icon: string }
> = {
  low: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-900 dark:text-amber-100',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  medium: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-900 dark:text-orange-100',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  high: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-900 dark:text-red-100',
    icon: 'text-red-600 dark:text-red-400',
  },
};

export default function RiskBanner({
  block,
}: BlockComponentProps<RiskBannerBlock>) {
  const styles = severityStyles[block.severity];
  const Icon = block.severity === 'high' ? ShieldAlert : AlertTriangle;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-5 ${styles.bg} ${styles.border}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`size-5 mt-0.5 shrink-0 ${styles.icon}`} />
        <div className="flex flex-col gap-1">
          <h3 className={`text-base font-semibold ${styles.text}`}>
            {block.title}
          </h3>
          <p className={`text-sm ${styles.text} opacity-90`}>{block.message}</p>
        </div>
      </div>

      {block.references && block.references.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-8">
          {block.references.map((ref, i) =>
            ref.href ? (
              <a key={i} href={ref.href} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="cursor-pointer text-xs">
                  {ref.label}
                </Badge>
              </a>
            ) : (
              <Badge key={i} variant="outline" className="text-xs">
                {ref.label}
              </Badge>
            ),
          )}
        </div>
      )}
    </div>
  );
}

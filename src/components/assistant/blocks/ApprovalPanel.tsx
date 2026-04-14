'use client';

import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { ApprovalPanelBlock } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const riskChip: Record<ApprovalPanelBlock['riskLevel'], string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  medium:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

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

export default function ApprovalPanel({
  block,
  onAction,
}: BlockComponentProps<ApprovalPanelBlock>) {
  return (
    <Card className="rounded-xl border-2 border-amber-300 bg-white shadow-sm dark:border-amber-700 dark:bg-gray-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-base font-semibold">
            {block.title || 'Requires human approval'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {block.reason}
        </p>

        {/* Risk level chip */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Risk:
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${riskChip[block.riskLevel]}`}
          >
            {block.riskLevel}
          </span>
        </div>

        {/* Required approvers */}
        {block.requiredApprovers.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Required approvers
            </span>
            <div className="flex flex-wrap gap-2">
              {block.requiredApprovers.map((approver) => (
                <Badge key={approver} variant="secondary">
                  {approver}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {block.actions && block.actions.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {block.actions.map((action) => (
              <Button
                key={action.id}
                variant={variantMap(action.variant)}
                onClick={() => onAction?.(action)}
                className={
                  action.variant === 'primary'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                    : undefined
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

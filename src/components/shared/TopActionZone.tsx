import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';

export interface ActionItem {
  id: string;
  label: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface TopActionZoneProps {
  items?: ActionItem[];
  className?: string;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-[var(--danger-text)] bg-[var(--danger-bg)] border-[var(--danger-border)]' },
  warning: { icon: AlertCircle, color: 'text-[var(--warning-text)] bg-[var(--warning-bg)] border-[var(--warning-border)]' },
  info: { icon: Clock, color: 'text-[var(--info-text)] bg-[var(--info-bg)] border-[var(--info-border)]' },
  success: { icon: CheckCircle2, color: 'text-[var(--success-text)] bg-[var(--success-bg)] border-[var(--success-border)]' },
};

export function TopActionZone({ items, className }: TopActionZoneProps) {
  if (!items || items.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)]', className)}>
        <CheckCircle2 className="w-4 h-4 text-[var(--success-text)]" aria-hidden="true" />
        <span className="text-sm text-[var(--success-text)]">All caught up — nothing needs your attention right now.</span>
      </div>
    );
  }

  const criticalCount = items.filter(i => i.severity === 'critical').length;
  const warningCount = items.filter(i => i.severity === 'warning').length;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)]">
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <Badge className="bg-[var(--danger)] text-white border-0 text-[11px]">
              {criticalCount} critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-[var(--warning)] text-white border-0 text-[11px]">
              {warningCount} warning
            </Badge>
          )}
          <span className="text-sm text-[var(--warning-text)]">
            {items.length} item{items.length !== 1 ? 's' : ''} need{items.length === 1 ? 's' : ''} attention
          </span>
        </div>
      </div>

      {/* Individual items */}
      {items.map((item) => {
        const config = severityConfig[item.severity];
        const Icon = config.icon;
        return (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg border',
              config.color
            )}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              {item.description && (
                <p className="text-xs opacity-80 mt-0.5">{item.description}</p>
              )}
            </div>
            {item.action && (
              <Button
                size="sm"
                className="h-7 text-xs shrink-0 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                onClick={item.action.onClick}
              >
                {item.action.label}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, AlertCircle, HelpCircle, MinusCircle, Info } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  // Positive states
  active: { label: 'Active', icon: CheckCircle2 },
  approved: { label: 'Approved', icon: CheckCircle2 },
  completed: { label: 'Completed', icon: CheckCircle2 },
  paid: { label: 'Paid', icon: CheckCircle2 },

  // Pending / warning states
  pending: { label: 'Pending', icon: Clock },
  on_leave: { label: 'On Leave', icon: Clock },
  expiring: { label: 'Expiring', icon: AlertCircle },
  warning: { label: 'Warning', icon: AlertCircle },
  draft: { label: 'Draft', icon: MinusCircle },

  // Negative states
  rejected: { label: 'Rejected', icon: XCircle },
  terminated: { label: 'Terminated', icon: XCircle },
  expired: { label: 'Expired', icon: XCircle },
  missing: { label: 'Missing', icon: XCircle },
  failed: { label: 'Failed', icon: XCircle },

  // Info states
  info: { label: 'Info', icon: Info },
  sent: { label: 'Sent', icon: CheckCircle2 },
};

const statusToSeverity: Record<string, string> = {
  active: 'status-active',
  approved: 'status-active',
  completed: 'status-active',
  paid: 'status-active',
  sent: 'status-active',
  pending: 'status-pending',
  on_leave: 'status-pending',
  draft: 'status-neutral',
  expiring: 'status-warning',
  warning: 'status-warning',
  rejected: 'status-danger',
  terminated: 'status-danger',
  expired: 'status-danger',
  missing: 'status-danger',
  failed: 'status-danger',
  info: 'status-info',
};

export function StatusBadge({ status, className, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    icon: HelpCircle,
  };

  const severityClass = statusToSeverity[status] || 'status-neutral';
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize gap-1',
        size === 'sm' ? 'text-[11px] px-1.5 py-0 h-5' : 'text-xs px-2 py-0.5 h-6',
        severityClass,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

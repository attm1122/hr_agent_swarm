import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  inactive: { label: 'Inactive', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
  on_leave: { label: 'On Leave', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  terminated: { label: 'Terminated', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  pending: { label: 'Pending', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  expiring: { label: 'Expiring', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  missing: { label: 'Missing', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: HelpCircle,
  };

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium capitalize gap-1 px-2 py-0.5', config.color, className)}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

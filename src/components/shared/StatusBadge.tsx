'use client';

import { Badge } from '@/components/ui/badge';
import type { Employee } from '@/types';

const styles: Record<Employee['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-700 border-slate-200',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
};

const labels: Record<Employee['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
  terminated: 'Terminated',
  pending: 'Pending',
};

export function StatusBadge({ status }: { status: Employee['status'] }) {
  return (
    <Badge variant="outline" className={`${styles[status]} text-xs capitalize`}>
      {labels[status]}
    </Badge>
  );
}

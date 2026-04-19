export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckSquare, Clock, AlertTriangle, Calendar, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { actionQueue, getEmployeeById, leaveRequests } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';

export default function ApprovalsPage() {
  const pendingItems = actionQueue;
  const pendingLeave = leaveRequests.filter(lr => lr.status === 'pending');

  // Separate into quick wins and needs review
  const quickWins = pendingLeave.filter(lr => lr.daysRequested <= 2);
  const needsReview = pendingLeave.filter(lr => lr.daysRequested > 2);
  const otherItems = pendingItems.filter(item => item.type !== 'leave_request');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Actions</h1>
          <p className="ds-meta mt-1">{pendingItems.length} items requiring attention</p>
        </div>
      </div>

      {/* Copilot */}
      <ContextualCopilot
        context="pending approvals"
        placeholder="Summarize pending items, approve low-risk requests, or check for conflicts..."
        suggestions={[
          'Approve all low-risk leave requests',
          'Which approvals conflict with team deadlines?',
          'Summarize my pending actions',
        ]}
      />

      {/* Action Zone */}
      <TopActionZone
        items={[
          ...(quickWins.length > 0 ? [{
            id: 'quick-wins',
            label: `${quickWins.length} quick win${quickWins.length !== 1 ? 's' : ''}`,
            severity: 'info' as const,
            description: 'Low-risk leave requests with no conflicts',
            action: { label: 'Approve All' },
          }] : []),
          ...(needsReview.length > 0 ? [{
            id: 'needs-review',
            label: `${needsReview.length} request${needsReview.length !== 1 ? 's' : ''} need${needsReview.length === 1 ? 's' : ''} review`,
            severity: 'warning' as const,
            description: 'Longer leave or potential conflicts detected',
            action: { label: 'Review' },
          }] : []),
        ]}
      />

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="space-y-2">
          <h2 className="ds-heading flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            Quick Wins
          </h2>
          <div className="bg-white rounded-lg border border-[var(--border-default)] divide-y divide-[var(--border-subtle)]">
            {quickWins.map(lr => {
              const emp = getEmployeeById(lr.employeeId);
              return (
                <div key={lr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[10px]">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                    <p className="ds-meta">
                      {lr.leaveType.replace('_', ' ')} · {formatDateOnly(lr.startDate)} – {formatDateOnly(lr.endDate)} · {lr.daysRequested} day{lr.daysRequested !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <StatusBadge status="pending" size="sm" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-[var(--danger-text)] border-[var(--danger-border)] hover:bg-[var(--danger-bg)]">
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Needs Review */}
      {needsReview.length > 0 && (
        <div className="space-y-2">
          <h2 className="ds-heading flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
            Needs Review
          </h2>
          <div className="bg-white rounded-lg border border-[var(--border-default)] divide-y divide-[var(--border-subtle)]">
            {needsReview.map(lr => {
              const emp = getEmployeeById(lr.employeeId);
              return (
                <div key={lr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--warning-bg)] text-[var(--warning-text)] text-[10px]">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                    <p className="ds-meta">
                      {lr.leaveType.replace('_', ' ')} · {formatDateOnly(lr.startDate)} – {formatDateOnly(lr.endDate)} · {lr.daysRequested} day{lr.daysRequested !== 1 ? 's' : ''}
                    </p>
                    {lr.reason && <p className="ds-meta mt-0.5">{lr.reason}</p>}
                  </div>
                  <StatusBadge status="pending" size="sm" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-[var(--danger-text)] border-[var(--danger-border)] hover:bg-[var(--danger-bg)]">
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Items */}
      {otherItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="ds-heading">Other Items</h2>
          <div className="bg-white rounded-lg border border-[var(--border-default)] divide-y divide-[var(--border-subtle)]">
            {otherItems.map(item => {
              const priorityStyle = {
                critical: 'bg-[var(--danger-bg)] text-[var(--danger-text)]',
                high: 'bg-[var(--warning-bg)] text-[var(--warning-text)]',
                medium: 'bg-[var(--info-bg)] text-[var(--info-text)]',
                low: 'bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
              }[item.priority];

              return (
                <div key={item.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${priorityStyle}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{item.title}</p>
                    <p className="ds-meta">{item.description}</p>
                    {item.dueDate && <p className="ds-meta">Due: {formatDateOnly(item.dueDate)}</p>}
                  </div>
                  <Badge variant="outline" className={`${priorityStyle} text-[11px] capitalize`}>
                    {item.priority}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    Review
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

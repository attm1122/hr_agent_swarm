import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BarChart3, Clock, CheckCircle2, AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { employees, milestones, getEmployeeById, getPositionById } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { getDerivedMilestoneState, getMilestoneDayOffset } from '@/lib/milestones';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';

export default function ReviewsPage() {
  const probationReviews = milestones.filter(
    (m) => m.milestoneType === 'probation_end' && ['upcoming', 'due'].includes(getDerivedMilestoneState(m))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Reviews</h1>
          <p className="ds-meta mt-1">{probationReviews.length} probation reviews pending</p>
        </div>
        <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <Plus className="w-4 h-4 mr-2" />
          Start Cycle
        </Button>
      </div>

      <ContextualCopilot
        context="performance reviews"
        placeholder="Check review progress, find overdue reviews, or draft feedback..."
        suggestions={[
          'Who has not started their self-review?',
          'Show me reviews due this month',
          'Draft probation feedback for David Park',
        ]}
      />

      <TopActionZone
        items={probationReviews.length > 0 ? [{
          id: 'probation-reviews',
          label: `${probationReviews.length} probation review${probationReviews.length !== 1 ? 's' : ''} due`,
          severity: 'warning' as const,
          description: 'Complete before deadline to avoid policy violation',
          action: { label: 'Review All', onClick: () => {} },
        }] : undefined}
      />

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="ds-meta">{probationReviews.length} Probation Due</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--info)]" />
          <span className="ds-meta">0 Active Cycles</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="ds-meta">1 Completed This Quarter</span>
        </div>
      </div>

      {/* Probation Reviews */}
      <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--warning)]" />
          <span className="ds-caption">Probation Reviews Due</span>
        </div>
        {probationReviews.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle2 className="w-10 h-10 text-[var(--success)] mb-2" />
            <p className="ds-body">No probation reviews due</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {probationReviews.map(ms => {
              const emp = getEmployeeById(ms.employeeId);
              const pos = emp?.positionId ? getPositionById(emp.positionId) : null;
              const daysLeft = getMilestoneDayOffset(ms);
              return (
                <div key={ms.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[10px]">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                    <p className="ds-meta">{pos?.title} · Due {formatDateOnly(ms.milestoneDate)}</p>
                  </div>
                  <StatusBadge status={daysLeft === 0 || daysLeft < 14 ? 'expiring' : 'pending'} size="sm" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">Start</Button>
                    {emp && (
                      <Link href={`/employees/${emp.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

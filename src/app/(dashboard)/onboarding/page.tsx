import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, CheckCircle2, Clock, ArrowRight, Plus, Laptop, FileCheck, Users } from 'lucide-react';
import { employees, getPositionById, getTeamById } from '@/lib/data/mock-data';
import { compareDateOnly, formatDateOnly } from '@/lib/domain/shared/date-value';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function OnboardingPage() {
  const pendingOnboard = employees.filter(e => e.status === 'pending');
  const recentHires = employees
    .filter(e => e.status === 'active')
    .sort((a, b) => compareDateOnly(b.hireDate, a.hireDate))
    .slice(0, 5);

  const tasks = [
    { id: 't1', label: 'IT Equipment Setup', icon: Laptop, status: 'complete' as const },
    { id: 't2', label: 'HR Paperwork', icon: FileCheck, status: 'complete' as const },
    { id: 't3', label: 'Team Introduction', icon: Users, status: 'pending' as const },
    { id: 't4', label: '30-Day Check-in', icon: Clock, status: 'pending' as const },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Onboarding</h1>
          <p className="ds-meta mt-1">{pendingOnboard.length} new joiner{pendingOnboard.length !== 1 ? 's' : ''} pending</p>
        </div>
        <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <Plus className="w-4 h-4 mr-2" />
          New Plan
        </Button>
      </div>

      <ContextualCopilot
        context="onboarding"
        placeholder="Check progress, find missing tasks, or schedule introductions..."
        suggestions={[
          'What does Jessica still need to complete?',
          'Show me all pending onboarding plans',
          'Who is starting next week?',
        ]}
      />

      <TopActionZone
        items={pendingOnboard.length > 0 ? [{
          id: 'pending-onboarding',
          label: `${pendingOnboard.length} onboarding plan${pendingOnboard.length !== 1 ? 's' : ''} pending`,
          severity: 'info' as const,
          description: 'Complete setup before start date',
          action: { label: 'Review' },
        }] : undefined}
      />

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--info)]" />
          <span className="ds-meta">{pendingOnboard.length} Pending Start</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="ds-meta">1 In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="ds-meta">3 Completed (YTD)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New Joiners */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[var(--info)]" />
            <span className="ds-caption">New Joiners</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {pendingOnboard.map(emp => {
              const pos = emp.positionId ? getPositionById(emp.positionId) : null;
              const team = emp.teamId ? getTeamById(emp.teamId) : null;
              return (
                <div key={emp.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--info-bg)] text-[var(--info-text)] text-[10px]">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp.firstName} {emp.lastName}</p>
                    <p className="ds-meta">{pos?.title} · {team?.name} · Starts {formatDateOnly(emp.hireDate)}</p>
                  </div>
                  <StatusBadge status="pending" size="sm" />
                  <Link href={`/employees/${emp.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
              );
            })}
            {recentHires.map(emp => {
              const pos = emp.positionId ? getPositionById(emp.positionId) : null;
              return (
                <div key={emp.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[10px]">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp.firstName} {emp.lastName}</p>
                    <p className="ds-meta">{pos?.title} · Joined {formatDateOnly(emp.hireDate)}</p>
                  </div>
                  <StatusBadge status="active" size="sm" />
                  <Link href={`/employees/${emp.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)]">
            <span className="ds-caption">Onboarding Checklist — Jessica Wong</span>
          </div>
          <div className="p-4 space-y-2">
            {tasks.map(task => {
              const TaskIcon = task.icon;
              return (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-md bg-[var(--muted-surface)]">
                  <TaskIcon className={`w-4 h-4 ${task.status === 'complete' ? 'text-[var(--success)]' : 'text-[var(--text-disabled)]'}`} />
                  <span className={`flex-1 text-sm ${task.status === 'complete' ? 'text-[var(--text-disabled)] line-through' : 'text-[var(--text-primary)] font-medium'}`}>
                    {task.label}
                  </span>
                  {task.status === 'complete' ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                  ) : (
                    <Badge variant="outline" className="status-pending text-[10px]">Pending</Badge>
                  )}
                </div>
              );
            })}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-1">
                <span>Progress</span>
                <span>50%</span>
              </div>
              <div className="w-full bg-[var(--muted-surface)] rounded-full h-1.5">
                <div className="bg-[var(--primary)] rounded-full h-1.5 w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

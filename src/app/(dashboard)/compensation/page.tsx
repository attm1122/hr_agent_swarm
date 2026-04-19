import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, TrendingUp, Users, BarChart3, ArrowRight } from 'lucide-react';
import { employees, teams, getTeamById, getPositionById } from '@/lib/data/mock-data';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { TopActionZone } from '@/components/shared/TopActionZone';

export default function CompensationPage() {
  const teamSummary = teams.map(team => {
    const members = employees.filter(e => e.teamId === team.id && e.status === 'active');
    return { team, headcount: members.length };
  }).filter(t => t.headcount > 0).sort((a, b) => b.headcount - a.headcount);

  const activeCount = employees.filter(e => e.status === 'active').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Compensation</h1>
          <p className="ds-meta mt-1">Salary and benefits across {teams.length} teams</p>
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <BarChart3 className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <ContextualCopilot
        context="compensation and payroll"
        placeholder="Analyze salary distribution, check pay equity, or review budget..."
        suggestions={[
          'Show salary distribution by tenure',
          'What is our gender pay gap?',
          'Who is due for a compensation review?',
        ]}
      />

      <TopActionZone items={undefined} />

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div>
          <p className="ds-display">{activeCount}</p>
          <p className="ds-meta">Active Employees</p>
        </div>
        <div>
          <p className="ds-display">$2.8M</p>
          <p className="ds-meta">Annual Payroll</p>
        </div>
        <div>
          <p className="ds-display">4.2%</p>
          <p className="ds-meta">Avg Increase (YoY)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Team Breakdown */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)]">
            <span className="ds-caption">Team Headcount</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {teamSummary.map(({ team, headcount }) => (
              <div key={team.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                <div>
                  <p className="ds-title">{team.name}</p>
                  <p className="ds-meta">{team.department} · {team.code}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-[var(--muted-surface)] rounded-full h-1.5">
                    <div className="bg-[var(--primary)] rounded-full h-1.5" style={{ width: `${(headcount / activeCount) * 100}%` }} />
                  </div>
                  <Badge variant="secondary" className="text-[11px] min-w-[2rem] justify-center">{headcount}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Changes */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)]">
            <span className="ds-caption">Recent Salary Changes</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {employees.slice(0, 5).map(emp => {
              const pos = emp.positionId ? getPositionById(emp.positionId) : null;
              return (
                <Link key={emp.id} href={`/employees/${emp.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[10px]">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="ds-title">{emp.firstName} {emp.lastName}</p>
                    <p className="ds-meta">{pos?.title}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

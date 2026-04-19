import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, FileText, Clock, Plus } from 'lucide-react';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { TopActionZone } from '@/components/shared/TopActionZone';

const reports = [
  { id: 'r-1', name: 'Headcount Report', category: 'hr', lastRun: '2025-04-01', frequency: 'Monthly' },
  { id: 'r-2', name: 'Payroll Summary', category: 'finance', lastRun: '2025-03-31', frequency: 'Monthly' },
  { id: 'r-3', name: 'Leave Utilization', category: 'leave', lastRun: '2025-03-30', frequency: 'Quarterly' },
  { id: 'r-4', name: 'Attrition Analysis', category: 'hr', lastRun: '2025-03-15', frequency: 'Quarterly' },
  { id: 'r-5', name: 'Compliance Audit', category: 'compliance', lastRun: '2025-03-01', frequency: 'Monthly' },
  { id: 'r-6', name: 'Team Performance', category: 'performance', lastRun: '2025-02-28', frequency: 'Quarterly' },
];

const recentRuns = [
  { id: 'rr-1', report: 'Headcount Report', status: 'completed' as const, rows: 23, date: '2025-04-01T10:30:00Z' },
  { id: 'rr-2', report: 'Payroll Summary', status: 'completed' as const, rows: 23, date: '2025-03-31T14:00:00Z' },
  { id: 'rr-3', report: 'Leave Utilization', status: 'completed' as const, rows: 45, date: '2025-03-30T09:15:00Z' },
];

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Insights</h1>
          <p className="ds-meta mt-1">{reports.length} reports available</p>
        </div>
        <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <Plus className="w-4 h-4 mr-2" />
          Custom Report
        </Button>
      </div>

      <ContextualCopilot
        context="reports and analytics"
        placeholder="Generate a report, analyze trends, or find insights..."
        suggestions={[
          'Show headcount trend over 6 months',
          'What is our current attrition rate?',
          'Generate a compliance summary',
        ]}
      />

      <TopActionZone items={undefined} />

      {/* Stats — flat */}
      <div className="flex items-center gap-8 py-2">
        <div>
          <p className="ds-display">{reports.length}</p>
          <p className="ds-meta">Available Reports</p>
        </div>
        <div>
          <p className="ds-display">{recentRuns.length}</p>
          <p className="ds-meta">Runs This Month</p>
        </div>
        <div>
          <p className="ds-display">12</p>
          <p className="ds-meta">Total Downloads</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Report Library */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)]">
            <span className="ds-caption">Report Library</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {reports.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                <div className="p-1.5 rounded-md bg-[var(--muted-surface)]"><BarChart3 className="w-4 h-4 text-[var(--text-tertiary)]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="ds-title">{r.name}</p>
                  <p className="ds-meta capitalize">{r.category} · {r.frequency} · Last: {formatDateOnly(r.lastRun)}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs">Generate</Button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Runs */}
        <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="ds-caption">Recent Runs</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {recentRuns.map(run => (
              <div key={run.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="ds-title">{run.report}</p>
                  <p className="ds-meta">{run.rows} rows · {new Date(run.date).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="status-active text-[11px]">{run.status}</Badge>
                <Button size="sm" variant="ghost" className="h-7 text-xs"><Download className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

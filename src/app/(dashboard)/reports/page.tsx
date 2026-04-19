import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, FileText, Clock, Plus, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { formatDateOnly } from '@/lib/domain/shared/date-value';

const reports = [
  { id: 'r-1', name: 'Headcount Report', category: 'hr', icon: Users, lastRun: '2025-04-01', frequency: 'Monthly' },
  { id: 'r-2', name: 'Payroll Summary', category: 'finance', icon: DollarSign, lastRun: '2025-03-31', frequency: 'Monthly' },
  { id: 'r-3', name: 'Leave Utilization', category: 'leave', icon: Calendar, lastRun: '2025-03-30', frequency: 'Quarterly' },
  { id: 'r-4', name: 'Attrition Analysis', category: 'hr', icon: TrendingUp, lastRun: '2025-03-15', frequency: 'Quarterly' },
  { id: 'r-5', name: 'Compliance Audit', category: 'compliance', icon: FileText, lastRun: '2025-03-01', frequency: 'Monthly' },
  { id: 'r-6', name: 'Team Performance', category: 'performance', icon: BarChart3, lastRun: '2025-02-28', frequency: 'Quarterly' },
];

const recentRuns = [
  { id: 'rr-1', report: 'Headcount Report', status: 'completed' as const, rows: 23, date: '2025-04-01T10:30:00Z' },
  { id: 'rr-2', report: 'Payroll Summary', status: 'completed' as const, rows: 23, date: '2025-03-31T14:00:00Z' },
  { id: 'rr-3', report: 'Leave Utilization', status: 'completed' as const, rows: 45, date: '2025-03-30T09:15:00Z' },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">{reports.length} reports available</p>
        </div>
        <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Custom Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><BarChart3 className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{reports.length}</p><p className="text-xs text-slate-500">Available Reports</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><Clock className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{recentRuns.length}</p><p className="text-xs text-slate-500">Runs This Month</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Download className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">12</p><p className="text-xs text-slate-500">Total Downloads</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Library */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Report Library</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {reports.map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                    <div className="p-2 rounded-lg bg-slate-100"><Icon className="w-4 h-4 text-slate-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{r.category} · {r.frequency} · Last: {formatDateOnly(r.lastRun)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Generate</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Runs */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Recent Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentRuns.map(run => (
                <div key={run.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{run.report}</p>
                    <p className="text-xs text-slate-500">{run.rows} rows · {new Date(run.date).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{run.status}</Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"><Download className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

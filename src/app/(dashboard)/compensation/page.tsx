import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DollarSign, TrendingUp, Users, BarChart3, ArrowRight } from 'lucide-react';
import { employees, teams, getTeamById, getPositionById } from '@/lib/data/mock-data';

export default function CompensationPage() {
  const teamSummary = teams.map(team => {
    const members = employees.filter(e => e.teamId === team.id && e.status === 'active');
    return { team, headcount: members.length };
  }).filter(t => t.headcount > 0).sort((a, b) => b.headcount - a.headcount);

  const activeCount = employees.filter(e => e.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Compensation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Salary and benefits overview across {teams.length} teams</p>
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <BarChart3 className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><Users className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{activeCount}</p><p className="text-xs text-slate-500">Active Employees</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><DollarSign className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">$2.8M</p><p className="text-xs text-slate-500">Total Annual Payroll</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><TrendingUp className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">4.2%</p><p className="text-xs text-slate-500">Avg Increase (YoY)</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Team Headcount</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {teamSummary.map(({ team, headcount }) => (
                <div key={team.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{team.name}</p>
                    <p className="text-xs text-slate-500">{team.department} · {team.code}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-slate-100 rounded-full h-2">
                      <div className="bg-emerald-500 rounded-full h-2" style={{ width: `${(headcount / activeCount) * 100}%` }} />
                    </div>
                    <Badge variant="secondary" className="text-xs min-w-[2rem] justify-center">{headcount}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Earners placeholder */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Recent Salary Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {employees.slice(0, 5).map(emp => {
                const pos = emp.positionId ? getPositionById(emp.positionId) : null;
                return (
                  <Link key={emp.id} href={`/employees/${emp.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-slate-50 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-slate-500">{pos?.title}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

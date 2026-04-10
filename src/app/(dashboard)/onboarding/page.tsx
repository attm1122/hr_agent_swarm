import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, CheckCircle2, Clock, ArrowRight, Plus, Laptop, FileCheck, Users } from 'lucide-react';
import { employees, getPositionById, getTeamById } from '@/lib/data/mock-data';

export default function OnboardingPage() {
  const pendingOnboard = employees.filter(e => e.status === 'pending');
  const recentHires = employees
    .filter(e => e.status === 'active')
    .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
    .slice(0, 5);

  const tasks = [
    { id: 't1', label: 'IT Equipment Setup', icon: Laptop, status: 'complete' as const },
    { id: 't2', label: 'HR Paperwork', icon: FileCheck, status: 'complete' as const },
    { id: 't3', label: 'Team Introduction', icon: Users, status: 'pending' as const },
    { id: 't4', label: '30-Day Check-in', icon: Clock, status: 'pending' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Onboarding</h1>
          <p className="text-sm text-slate-500 mt-0.5">{pendingOnboard.length} new joiner{pendingOnboard.length !== 1 ? 's' : ''} pending onboarding</p>
        </div>
        <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Onboarding Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm bg-blue-50/50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><UserPlus className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{pendingOnboard.length}</p><p className="text-xs text-slate-500">Pending Start</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">1</p><p className="text-xs text-slate-500">In Progress</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">3</p><p className="text-xs text-slate-500">Completed (YTD)</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Employees */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              New Joiners
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {pendingOnboard.map(emp => {
                const pos = emp.positionId ? getPositionById(emp.positionId) : null;
                const team = emp.teamId ? getTeamById(emp.teamId) : null;
                return (
                  <div key={emp.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-slate-500">{pos?.title} · {team?.name} · Starts {new Date(emp.hireDate).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Pending</Badge>
                    <Link href={`/employees/${emp.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                    </Link>
                  </div>
                );
              })}
              {recentHires.map(emp => {
                const pos = emp.positionId ? getPositionById(emp.positionId) : null;
                return (
                  <div key={emp.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-slate-500">{pos?.title} · Joined {new Date(emp.hireDate).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Active</Badge>
                    <Link href={`/employees/${emp.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Checklist */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Onboarding Checklist — Jessica Wong</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map(task => {
                const TaskIcon = task.icon;
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-md bg-slate-50">
                    <TaskIcon className={`w-4 h-4 ${task.status === 'complete' ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span className={`flex-1 text-sm ${task.status === 'complete' ? 'text-slate-500 line-through' : 'text-slate-900 font-medium'}`}>
                      {task.label}
                    </span>
                    {task.status === 'complete' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>50%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 rounded-full h-2 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BarChart3, Clock, CheckCircle2, AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { employees, milestones, getEmployeeById, getPositionById } from '@/lib/data/mock-data';

export default function ReviewsPage() {
  const probationReviews = milestones.filter(m => m.milestoneType === 'probation_end' && m.status !== 'completed');
  const performanceReviews = milestones.filter(m => m.milestoneType === 'performance_review');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reviews</h1>
          <p className="text-sm text-slate-500 mt-0.5">{probationReviews.length} probation reviews pending</p>
        </div>
        <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Start Review Cycle
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{probationReviews.length}</p><p className="text-xs text-slate-500">Probation Due</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><BarChart3 className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">0</p><p className="text-xs text-slate-500">Active Cycles</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">1</p><p className="text-xs text-slate-500">Completed This Quarter</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Probation Reviews */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Probation Reviews Due
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {probationReviews.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              <p className="text-sm text-slate-500">No probation reviews due</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {probationReviews.map(ms => {
                const emp = getEmployeeById(ms.employeeId);
                const pos = emp?.positionId ? getPositionById(emp.positionId) : null;
                const daysLeft = Math.ceil((new Date(ms.milestoneDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={ms.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                        {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{pos?.title} · Due {new Date(ms.milestoneDate).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={
                      daysLeft < 14 ? 'bg-red-100 text-red-700 border-red-200 text-xs' : 'bg-amber-100 text-amber-700 border-amber-200 text-xs'
                    }>{daysLeft}d left</Badge>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Start Review</Button>
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
        </CardContent>
      </Card>
    </div>
  );
}

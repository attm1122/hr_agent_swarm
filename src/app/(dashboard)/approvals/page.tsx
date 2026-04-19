import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckSquare, Clock, AlertTriangle, Calendar, FileText, Shield } from 'lucide-react';
import { actionQueue, getEmployeeById, leaveRequests } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/domain/shared/date-value';

export default function ApprovalsPage() {
  const pendingItems = actionQueue;
  const pendingLeave = leaveRequests.filter(lr => lr.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">{pendingItems.length} items requiring your attention</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{pendingLeave.length}</p><p className="text-xs text-slate-500">Leave Requests</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-red-50/50 border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">1</p><p className="text-xs text-slate-500">Expiring Documents</p></div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Shield className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">2</p><p className="text-xs text-slate-500">Milestones Due</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">Pending Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {pendingItems.map(item => {
              const priorityStyle = {
                critical: 'bg-red-100 text-red-700 border-red-200',
                high: 'bg-amber-100 text-amber-700 border-amber-200',
                medium: 'bg-blue-100 text-blue-700 border-blue-200',
                low: 'bg-slate-100 text-slate-700 border-slate-200',
              }[item.priority];

              const typeIcon = {
                leave_request: Calendar,
                expiring_document: FileText,
                milestone: Clock,
              }[item.type] || CheckSquare;
              const TypeIcon = typeIcon;

              return (
                <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${priorityStyle}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    {item.dueDate && <p className="text-xs text-slate-400 mt-0.5">Due: {formatDateOnly(item.dueDate)}</p>}
                  </div>
                  <Badge variant="outline" className={`${priorityStyle} text-xs capitalize`}>{item.priority}</Badge>
                  {item.type === 'leave_request' ? (
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">Reject</Button>
                    </div>
                  ) : (
                    <Link href={item.entityType === 'document' ? '/compliance' : item.entityType === 'milestone' ? '/compliance' : '/hr'}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">Review</Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

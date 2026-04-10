import { Suspense } from 'react';
import Link from 'next/link';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActionQueue } from '@/components/dashboard/ActionQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, Calendar, CheckSquare, FileText, AlertCircle, 
  Gift, GraduationCap, Shield, Sparkles, ArrowRight, CheckSquare as CheckIcon
} from 'lucide-react';
import { 
  employees, actionQueue, milestones, documents, leaveRequests,
  getEmployeeById 
} from '@/lib/data/mock-data';

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-100 animate-pulse rounded-lg" />
        <div className="space-y-6">
          <div className="h-48 bg-slate-100 animate-pulse rounded-lg" />
          <div className="h-40 bg-slate-100 animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Dashboard Data
function getDashboardMetrics() {
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const pendingLeave = leaveRequests.filter(lr => lr.status === 'pending').length;
  const expiringDocs = documents.filter(d => d.status === 'expiring').length;
  
  return {
    totalEmployees: activeEmployees,
    pendingApprovals: actionQueue.length,
    pendingLeaveRequests: pendingLeave,
    expiringDocsCount: expiringDocs,
  };
}

function getUpcomingAnniversaries() {
  return milestones
    .filter(m => m.milestoneType === 'service_anniversary' && m.status === 'upcoming')
    .map(m => {
      const emp = getEmployeeById(m.employeeId);
      return {
        id: m.id,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        date: m.milestoneDate,
        description: m.description,
      };
    });
}

function getProbationDue() {
  const now = new Date();
  return milestones
    .filter(m => m.milestoneType === 'probation_end' && (m.status === 'upcoming' || m.status === 'due'))
    .map(m => {
      const emp = getEmployeeById(m.employeeId);
      const daysRemaining = Math.ceil((new Date(m.milestoneDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: m.id,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        date: m.milestoneDate,
        daysRemaining,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Dashboard Content
async function DashboardContent() {
  const metrics = getDashboardMetrics();
  const upcomingAnniversaries = getUpcomingAnniversaries();
  const probationDue = getProbationDue();
  const expiringDocs = documents.filter(d => d.status === 'expiring');
  const missingDocs = documents.filter(d => d.status === 'missing');
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">HR Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back. Here's what's happening across your organization.
          </p>
        </div>
        <Link href="/reports">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Employees" value={metrics.totalEmployees} change={5.2} trend="up" description="vs last month" icon={Users} />
        <MetricCard title="Pending Approvals" value={metrics.pendingApprovals} change={-12} trend="down" description="2 urgent" icon={CheckSquare} variant="amber" />
        <MetricCard title="Leave Requests" value={metrics.pendingLeaveRequests} description="Awaiting approval" icon={Calendar} />
        <MetricCard title="Expiring Documents" value={metrics.expiringDocsCount} description="Action required" icon={FileText} variant={metrics.expiringDocsCount > 0 ? 'amber' : 'default'} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActionQueue items={actionQueue} />
        </div>

        <div className="space-y-6">
          {/* Anniversaries */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  Anniversaries
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">{upcomingAnniversaries.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-44">
                <div className="divide-y divide-slate-100">
                  {upcomingAnniversaries.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.employeeName}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  ))}
                  {upcomingAnniversaries.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-500">No upcoming anniversaries</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Probation */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-500" />
                  Probation Reviews
                </CardTitle>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">{probationDue.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-36">
                <div className="divide-y divide-slate-100">
                  {probationDue.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.employeeName}</p>
                        <p className="text-xs text-slate-500">Due {new Date(item.date).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className={item.daysRemaining < 7 ? 'border-red-200 text-red-600 text-xs' : 'border-amber-200 text-amber-600 text-xs'}>{item.daysRemaining}d</Badge>
                    </div>
                  ))}
                  {probationDue.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-500">No probation reviews due</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Compliance */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-500" />
                  Compliance
                </CardTitle>
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">{expiringDocs.length + missingDocs.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringDocs.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-slate-700">{expiringDocs.length} documents expiring</span>
                  </div>
                )}
                {missingDocs.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-slate-700">{missingDocs.length} documents missing</span>
                  </div>
                )}
                {expiringDocs.length === 0 && missingDocs.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckIcon className="w-4 h-4 text-emerald-500" />
                    <span>All compliance items current</span>
                  </div>
                )}
              </div>
              <Link href="/compliance">
                <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-xs">
                  View Compliance
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function HRDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

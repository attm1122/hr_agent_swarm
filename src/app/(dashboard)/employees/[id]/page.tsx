import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Mail, MapPin, Briefcase, Calendar, Users,
  FileText, Clock, DollarSign, Star, Edit, MoreHorizontal,
} from 'lucide-react';
import {
  employees, getEmployeeById, getTeamById, getPositionById,
  getManagerForEmployee, getDirectReports, leaveRequests,
  milestones, documents,
} from '@/lib/data/mock-data';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Employee } from '@/types';

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = getEmployeeById(id);
  if (!employee) notFound();

  const team = employee.teamId ? getTeamById(employee.teamId) : null;
  const position = employee.positionId ? getPositionById(employee.positionId) : null;
  const manager = getManagerForEmployee(employee);
  const reports = getDirectReports(employee.id);
  const empLeave = leaveRequests.filter(lr => lr.employeeId === employee.id);
  const empMilestones = milestones.filter(m => m.employeeId === employee.id);
  const empDocs = documents.filter(d => d.employeeId === employee.id);
  const tenure = Math.floor((Date.now() - new Date(employee.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8">
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            Edit Profile
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-semibold">
                {employee.firstName[0]}{employee.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-slate-900">
                  {employee.firstName} {employee.lastName}
                </h1>
                <StatusBadge status={employee.status} />
              </div>
              <p className="text-sm text-slate-600 mt-0.5">{position?.title || 'No position'}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{employee.email}</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{team?.name || 'No team'}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{employee.workLocation || 'Not set'}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{tenure} year{tenure !== 1 ? 's' : ''} tenure</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow icon={Briefcase} label="Employee Number" value={employee.employeeNumber} />
              <InfoRow icon={Calendar} label="Hire Date" value={new Date(employee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              <InfoRow icon={Briefcase} label="Employment Type" value={employee.employmentType.replace('_', ' ')} />
              <InfoRow icon={Star} label="Level" value={position?.level || 'N/A'} />
              <InfoRow icon={MapPin} label="Work Location" value={employee.workLocation || 'Not set'} />
            </CardContent>
          </Card>

          {manager && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">Reports To</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/employees/${manager.id}`} className="flex items-center gap-3 p-2 -m-2 rounded-md hover:bg-slate-50 transition-colors">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                      {manager.firstName[0]}{manager.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{manager.firstName} {manager.lastName}</p>
                    <p className="text-xs text-slate-500">{getPositionById(manager.positionId || '')?.title || ''}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {reports.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    Direct Reports
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">{reports.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {reports.map(r => (
                  <Link key={r.id} href={`/employees/${r.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-slate-50 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                        {r.firstName[0]}{r.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-slate-500 truncate">{getPositionById(r.positionId || '')?.title || ''}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leave Requests */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Leave Requests
                </CardTitle>
                <Link href="/leave">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {empLeave.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No leave requests</p>
              ) : (
                <div className="space-y-3">
                  {empLeave.map(lr => (
                    <div key={lr.id} className="flex items-center justify-between p-3 rounded-md bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">{lr.leaveType.replace('_', ' ')} Leave</p>
                        <p className="text-xs text-slate-500">
                          {new Date(lr.startDate).toLocaleDateString()} – {new Date(lr.endDate).toLocaleDateString()} ({lr.daysRequested} day{lr.daysRequested !== 1 ? 's' : ''})
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        lr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                        lr.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs' :
                        lr.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                        'text-xs'
                      }>
                        {lr.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {empMilestones.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No milestones tracked</p>
              ) : (
                <div className="space-y-3">
                  {empMilestones.map(ms => (
                    <div key={ms.id} className="flex items-center justify-between p-3 rounded-md bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{ms.description}</p>
                        <p className="text-xs text-slate-500">{new Date(ms.milestoneDate).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className={
                        ms.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                        ms.status === 'overdue' ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                        'bg-amber-100 text-amber-700 border-amber-200 text-xs'
                      }>
                        {ms.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Documents
                </CardTitle>
                <Link href="/compliance">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {empDocs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No documents on file</p>
              ) : (
                <div className="space-y-3">
                  {empDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-md bg-slate-50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{doc.fileName}</p>
                          <p className="text-xs text-slate-500 capitalize">{doc.category} · {(doc.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={
                        doc.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                        doc.status === 'expiring' ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs' :
                        doc.status === 'expired' ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                        'text-xs'
                      }>
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Shield, FileText, AlertTriangle, Clock, CheckCircle2,
  AlertCircle, Calendar, ArrowRight,
} from 'lucide-react';
import { documents, milestones, getEmployeeById } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/date-only';
import { compareMilestonesByDate, getDerivedMilestoneState, getMilestoneDayOffset } from '@/lib/milestones';

export default function CompliancePage() {
  const expiringDocs = documents.filter(d => d.status === 'expiring');
  const missingDocs = documents.filter(d => d.status === 'missing');
  const expiredDocs = documents.filter(d => d.status === 'expired');
  const activeDocs = documents.filter(d => d.status === 'active');

  const visaExpiries = milestones.filter(
    (milestone) =>
      milestone.milestoneType === 'visa_expiry' &&
      getDerivedMilestoneState(milestone) !== 'completed'
  );
  const certExpiries = milestones.filter(
    (milestone) =>
      milestone.milestoneType === 'certification_expiry' &&
      getDerivedMilestoneState(milestone) !== 'completed'
  );
  const probations = milestones.filter(
    (milestone) =>
      milestone.milestoneType === 'probation_end' &&
      getDerivedMilestoneState(milestone) !== 'completed'
  );
  const allAlerts = [...visaExpiries, ...certExpiries, ...probations].sort(compareMilestonesByDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Compliance & Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expiringDocs.length + missingDocs.length + expiredDocs.length + allAlerts.length} items requiring attention
          </p>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm bg-red-50/50 border-red-200">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-900">{expiredDocs.length + missingDocs.length}</p>
            <p className="text-xs text-slate-500">Expired / Missing</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-900">{expiringDocs.length}</p>
            <p className="text-xs text-slate-500">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-900">{activeDocs.length}</p>
            <p className="text-xs text-slate-500">Active Documents</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 text-center">
            <Shield className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-900">{allAlerts.length}</p>
            <p className="text-xs text-slate-500">Upcoming Alerts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No documents tracked</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map(doc => {
                  const emp = getEmployeeById(doc.employeeId);
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'} · {doc.category}
                          {doc.expiresAt && ` · Expires ${formatDateOnly(doc.expiresAt)}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        doc.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                        doc.status === 'expiring' ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs' :
                        doc.status === 'expired' ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                        'bg-red-100 text-red-700 border-red-200 text-xs'
                      }>{doc.status}</Badge>
                      {emp && (
                        <Link href={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts Timeline */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Upcoming Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {allAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500">No upcoming compliance alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {allAlerts.map(ms => {
                  const emp = getEmployeeById(ms.employeeId);
                  const state = getDerivedMilestoneState(ms);
                  const dayOffset = getMilestoneDayOffset(ms);
                  return (
                    <div key={ms.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                          {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{ms.description}</p>
                        <p className="text-xs text-slate-500">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'} · {formatDateOnly(ms.milestoneDate)}
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        state === 'overdue' || dayOffset === 0 ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                        dayOffset < 60 ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs' :
                        'text-xs'
                      }>
                        {state === 'overdue'
                          ? `Overdue ${Math.abs(dayOffset)}d`
                          : dayOffset === 0
                            ? 'Due today'
                            : `${dayOffset}d left`}
                      </Badge>
                      {emp && (
                        <Link href={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs"><ArrowRight className="w-3 h-3" /></Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

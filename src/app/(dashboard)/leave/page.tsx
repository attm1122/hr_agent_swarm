'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { leaveRequests, getEmployeeById } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/date-only';
import type { LeaveRequest } from '@/types';

async function callSwarm(intent: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/swarm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, payload }),
  });
  return res.json();
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>(() => [...leaveRequests]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleAction = useCallback(async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    setLastAction(null);
    try {
      const response = await callSwarm('leave_request', { requestId, action });
      if (response.result?.success) {
        setRequests(prev => prev.map(lr =>
          lr.id === requestId
            ? { ...lr, status: action === 'approve' ? 'approved' as const : 'rejected' as const, approvedAt: new Date().toISOString() }
            : lr
        ));
        setLastAction(response.result.summary);
      }
    } finally {
      setProcessing(null);
    }
  }, []);

  const pending = requests.filter(lr => lr.status === 'pending');
  const approved = requests.filter(lr => lr.status === 'approved');
  const rejected = requests.filter(lr => lr.status === 'rejected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{pending.length} pending requests</p>
        </div>
        <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Leave Request
        </Button>
      </div>

      {lastAction && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {lastAction}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm bg-amber-50/50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pending.length}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{approved.length}</p>
              <p className="text-xs text-slate-500">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><XCircle className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{rejected.length}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request List */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">All Leave Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {requests.map(lr => {
              const emp = getEmployeeById(lr.employeeId);
              const isProcessing = processing === lr.id;
              return (
                <div key={lr.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {lr.leaveType.replace('_', ' ')} · {formatDateOnly(lr.startDate)} – {formatDateOnly(lr.endDate)} · {lr.daysRequested} day{lr.daysRequested !== 1 ? 's' : ''}
                    </p>
                    {lr.reason && <p className="text-xs text-slate-400 mt-0.5">{lr.reason}</p>}
                  </div>
                  <Badge variant="outline" className={
                    lr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs' :
                    lr.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200 text-xs' :
                    lr.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200 text-xs' :
                    'text-xs'
                  }>{lr.status}</Badge>
                  {lr.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isProcessing}
                        onClick={() => handleAction(lr.id, 'approve')}
                      >
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        disabled={isProcessing}
                        onClick={() => handleAction(lr.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {lr.status !== 'pending' && emp && (
                    <Link href={`/employees/${emp.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        <ArrowRight className="w-3 h-3" />
                      </Button>
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

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TopActionZone } from '@/components/shared/TopActionZone';
import { ContextualCopilot } from '@/components/shared/ContextualCopilot';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { leaveRequests, getEmployeeById } from '@/lib/data/mock-data';
import { formatDateOnly } from '@/lib/domain/shared/date-value';
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-display">Leave</h1>
          <p className="ds-meta mt-1">{pending.length} pending · {approved.length} approved · {rejected.length} rejected</p>
        </div>
        <Button size="sm" className="h-9 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Copilot */}
      <ContextualCopilot
        context="leave management"
        placeholder="Check team coverage, review trends, or find policy details..."
        suggestions={[
          'Who is on leave next week?',
          'Show leave utilization by team',
          'What is the sick leave policy?',
        ]}
      />

      {/* Action Zone */}
      <TopActionZone
        items={pending.length > 0 ? [{
          id: 'pending-leave',
          label: `${pending.length} leave request${pending.length !== 1 ? 's' : ''} pending approval`,
          severity: 'warning' as const,
          description: 'Review and approve or reject pending requests',
          action: { label: 'Review All', onClick: () => {} },
        }] : undefined}
      />

      {/* Stats — flat, not cards */}
      <div className="flex items-center gap-6 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
          <span className="ds-meta">{pending.length} Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="ds-meta">{approved.length} Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--danger)]" />
          <span className="ds-meta">{rejected.length} Rejected</span>
        </div>
      </div>

      {/* Request List */}
      <div className="bg-white rounded-lg border border-[var(--border-default)] overflow-hidden">
        <div className="px-4 py-2.5 bg-[var(--muted-surface)] border-b border-[var(--border-default)] flex items-center justify-between">
          <span className="ds-caption">All Requests</span>
          <span className="ds-meta">{requests.length} total</span>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No leave requests"
            description="There are no leave requests to display."
            action={{ label: 'New Request', onClick: () => {} }}
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {requests.map(lr => {
              const emp = getEmployeeById(lr.employeeId);
              const isProcessing = processing === lr.id;
              return (
                <div key={lr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted-surface)] transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[10px]">
                      {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="ds-title">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                    <p className="ds-meta">
                      {lr.leaveType.replace('_', ' ')} · {formatDateOnly(lr.startDate)} – {formatDateOnly(lr.endDate)} · {lr.daysRequested} day{lr.daysRequested !== 1 ? 's' : ''}
                    </p>
                    {lr.reason && <p className="ds-meta mt-0.5">{lr.reason}</p>}
                  </div>
                  <StatusBadge status={lr.status} size="sm" />
                  {lr.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                        disabled={isProcessing}
                        onClick={() => handleAction(lr.id, 'approve')}
                      >
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-[var(--danger-text)] border-[var(--danger-border)] hover:bg-[var(--danger-bg)]"
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
        )}
      </div>
    </div>
  );
}

/**
 * composeCommandWorkspace — role-aware zone data for the CommandWorkspace surface.
 *
 * Maps the same underlying signal projection + mock data into the 6-zone
 * contract expected by the AI-native command center.
 */

import type { Role, Employee, Milestone, LeaveRequest } from '@/types';
import type { CommandWorkspaceData } from '@/components/workspace/types';
import type { ProjectedSignalSet, RiskSignal } from '../signals/types';
import {
  employees as mockEmployees,
  milestones as mockMilestones,
  documents as mockDocuments,
  leaveRequests as mockLeaveRequests,
  getEmployeeById,
  getDirectReports,
} from '@/lib/data/mock-data';
import { getLeaveStore } from '@/lib/data/leave-store';

export interface CommandWorkspaceOptions {
  userName?: string;
  userRole?: Role | string;
  employeeId?: string;
}

const KNOWN_ROLES = ['admin', 'payroll', 'manager', 'team_lead', 'employee'] as const;

function normaliseRole(role: Role | string | undefined): Role {
  const r = role ?? 'employee';
  return (KNOWN_ROLES as readonly string[]).includes(r) ? (r as Role) : 'employee';
}

async function safeLoadBalances(employeeId: string | undefined) {
  if (!employeeId) return null;
  try {
    const balances = await getLeaveStore().listBalances(employeeId, 'default');
    const annual = balances.find((b) => b.leaveType === 'annual');
    return annual?.remainingDays ?? null;
  } catch {
    return null;
  }
}

/* ───────────────────────────────────────── helpers */

function signalToInsight(signal: RiskSignal, index: number) {
  return {
    id: `sig-${index}`,
    title: signal.title,
    severity: signal.severity === 'critical' ? 'danger' as const :
              signal.severity === 'high' ? 'warning' as const :
              signal.severity === 'medium' ? 'info' as const : 'neutral' as const,
    narrative: `${signal.summary} — ${signal.recommendation}`,
    ctaLabel: signal.action_options[0]?.label,
    ctaIntent: signal.action_options[0]?.intent?.rawInput,
    meta: { kind: signal.kind, policyBasis: signal.policy_basis },
  };
}

function leaveToTimelineEvent(lr: LeaveRequest, index: number): CommandWorkspaceData['timeline'][number] {
  const emp = getEmployeeById(lr.employeeId);
  return {
    id: `leave-${lr.id}`,
    title: `${emp ? `${emp.firstName} ${emp.lastName}` : lr.employeeId} — ${lr.leaveType.replace('_', ' ')}`,
    date: lr.startDate,
    type: 'leave' as const,
    status: lr.status === 'pending' ? 'upcoming' :
            lr.startDate <= new Date().toISOString().slice(0, 10) ? 'today' : 'upcoming',
    assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
    actionLabel: lr.status === 'pending' ? 'Review' : undefined,
    actionIntent: `Review leave request from ${emp ? `${emp.firstName} ${emp.lastName}` : lr.employeeId}`,
  };
}

function milestoneToTimelineEvent(ms: Milestone, index: number): CommandWorkspaceData['timeline'][number] {
  const emp = getEmployeeById(ms.employeeId);
  return {
    id: `ms-${ms.id}`,
    title: ms.description ?? ms.milestoneType,
    date: ms.milestoneDate,
    type: ms.milestoneType.includes('review') ? 'review' :
          ms.milestoneType.includes('visa') ? 'deadline' : 'milestone',
    status: ms.status === 'upcoming' ? 'upcoming' : 'completed',
    assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
  };
}

function leaveToWorkflow(lr: LeaveRequest, index: number): CommandWorkspaceData['workflows'][number] {
  const emp = getEmployeeById(lr.employeeId);
  const isUrgent = lr.daysRequested >= 5;
  return {
    id: `wf-leave-${lr.id}`,
    title: `Approve ${lr.leaveType.replace('_', ' ')} leave`,
    description: `${emp ? `${emp.firstName} ${emp.lastName}` : lr.employeeId} · ${lr.startDate} → ${lr.endDate} · ${lr.daysRequested} days`,
    severity: isUrgent ? 'warning' : 'info',
    status: 'Pending approval',
    dueDate: lr.startDate,
    assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
    actions: [
      { label: 'Approve', variant: 'primary' as const, intent: `Approve leave request ${lr.id}` },
      { label: 'Review', variant: 'secondary' as const, intent: `Review leave request from ${emp ? `${emp.firstName} ${emp.lastName}` : lr.employeeId}` },
    ],
  };
}

/* ───────────────────────────────────────── role composers */

async function composeEmployee(opts: CommandWorkspaceOptions): Promise<CommandWorkspaceData> {
  const me = opts.employeeId ? getEmployeeById(opts.employeeId) : undefined;
  const firstName = opts.userName?.split(' ')[0] ?? 'there';
  const leaveBalanceDays = await safeLoadBalances(opts.employeeId);
  const myPendingLeave = mockLeaveRequests.filter(
    (r) => r.employeeId === opts.employeeId && r.status === 'pending',
  );

  return {
    identity: {
      name: opts.userName ?? firstName,
      role: 'employee',
      roleLabel: 'Employee view',
      avatarFallback: me ? `${me.firstName[0]}${me.lastName[0]}` : 'ME',
    },
    metrics: [
      { id: 'headcount', label: 'Headcount', value: '1', context: 'you', delta: { direction: 'flat' as const, value: '—' } },
      { id: 'approvals', label: 'Pending approvals', value: myPendingLeave.length, context: 'your requests' },
      { id: 'leave', label: 'On leave today', value: 0, context: 'sick' },
      { id: 'risk', label: 'Risk indicators', value: 0, context: 'active' },
    ],
    insights: [],
    timeline: [
      ...myPendingLeave.map(leaveToTimelineEvent),
      ...mockMilestones
        .filter((m) => m.employeeId === opts.employeeId && m.status === 'upcoming')
        .map(milestoneToTimelineEvent),
    ],
    workflows: [
      ...myPendingLeave.map(leaveToWorkflow),
    ],
    aiSuggestions: [
      'Update my address',
      'How much leave do I have left?',
      'Request annual leave next month',
      'Show my personal details',
    ],
  };
}

async function composeManager(opts: CommandWorkspaceOptions): Promise<CommandWorkspaceData> {
  const manager = opts.employeeId ? getEmployeeById(opts.employeeId) : undefined;
  const firstName = opts.userName?.split(' ')[0] ?? 'Manager';
  const teamMembers = opts.employeeId ? getDirectReports(opts.employeeId) : [];
  const teamPendingLeave = mockLeaveRequests.filter(
    (r) => r.status === 'pending' && teamMembers.some((m) => m.id === r.employeeId),
  );
  const teamMilestones = mockMilestones.filter(
    (m) => m.status === 'upcoming' && teamMembers.some((tm) => tm.id === m.employeeId),
  );

  return {
    identity: {
      name: opts.userName ?? firstName,
      role: 'manager',
      roleLabel: 'Manager view',
      avatarFallback: manager ? `${manager.firstName[0]}${manager.lastName[0]}` : 'M',
      scope: teamMembers.length > 0 ? `${teamMembers.length} direct reports` : undefined,
    },
    metrics: [
      { id: 'headcount', label: 'Headcount', value: teamMembers.length, context: 'active', delta: { direction: 'up' as const, value: `+${teamMembers.length}` } },
      { id: 'approvals', label: 'Pending approvals', value: teamPendingLeave.length, context: 'from your team', delta: teamPendingLeave.length > 0 ? { direction: 'up' as const, value: `${teamPendingLeave.length} urgent` } : undefined },
      { id: 'leave', label: 'On leave today', value: 0, context: 'sick' },
      { id: 'risk', label: 'Risk indicators', value: 0, context: 'this week' },
    ],
    insights: [
      {
        id: 'team-health',
        title: 'Team health',
        severity: teamPendingLeave.length > 0 ? 'info' : 'neutral',
        narrative: teamPendingLeave.length > 0
          ? `${teamPendingLeave.length} leave request${teamPendingLeave.length > 1 ? 's' : ''} awaiting your decision. Review coverage before approving.`
          : 'Your team is fully staffed with no pending decisions.',
        ctaLabel: teamPendingLeave.length > 0 ? 'Review all' : undefined,
        ctaIntent: 'Show all pending leave requests for my team',
      },
    ],
    timeline: [
      ...teamPendingLeave.map(leaveToTimelineEvent),
      ...teamMilestones.map(milestoneToTimelineEvent),
    ],
    workflows: [
      ...teamPendingLeave.map(leaveToWorkflow),
      ...teamMilestones.map((ms) => {
        const emp = getEmployeeById(ms.employeeId);
        return {
          id: `wf-ms-${ms.id}`,
          title: ms.description ?? ms.milestoneType,
          description: `${emp ? `${emp.firstName} ${emp.lastName}` : ms.employeeId} · Due ${ms.milestoneDate}`,
          severity: (ms.milestoneType.includes('visa') ? 'critical' :
                    ms.milestoneType.includes('probation') ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
          status: 'Upcoming',
          dueDate: ms.milestoneDate,
          assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          actions: [{ label: 'Review', variant: 'secondary' as const, intent: `Review ${ms.description} for ${emp ? `${emp.firstName} ${emp.lastName}` : ms.employeeId}` }],
        };
      }),
    ],
    aiSuggestions: [
      'Summarise my team this week',
      'Who has reviews due next 30 days?',
      'Who is on leave next month?',
      'Approve all low-risk leave requests',
    ],
  };
}

async function composeHr(opts: CommandWorkspaceOptions): Promise<CommandWorkspaceData> {
  const firstName = opts.userName?.split(' ')[0] ?? 'HR';
  const activeEmployees = mockEmployees.filter((e) => e.status === 'active').length;
  const pendingApprovals = mockLeaveRequests.filter((l) => l.status === 'pending').length;
  const docsExpiring = mockDocuments.filter((d) => d.status === 'expiring').length;
  const upcomingMilestones = mockMilestones
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => a.milestoneDate.localeCompare(b.milestoneDate));

  const visaMilestones = upcomingMilestones.filter((m) => m.milestoneType === 'visa_expiry');
  const probationMilestones = upcomingMilestones.filter((m) => m.milestoneType === 'probation_end');

  return {
    identity: {
      name: opts.userName ?? firstName,
      role: 'admin',
      roleLabel: 'HR view',
      avatarFallback: 'HR',
      scope: 'Organisation',
    },
    metrics: [
      { id: 'headcount', label: 'Headcount', value: activeEmployees, context: 'active', delta: { direction: 'up' as const, value: '+2' } },
      { id: 'approvals', label: 'Pending approvals', value: pendingApprovals, context: 'leave & docs', delta: pendingApprovals > 0 ? { direction: 'up' as const, value: `${pendingApprovals} urgent` } : undefined },
      { id: 'leave', label: 'On leave today', value: mockEmployees.filter((e) => e.status === 'on_leave').length, context: 'sick' },
      { id: 'risk', label: 'Risk indicators', value: docsExpiring + visaMilestones.length, context: 'active expiry reports', delta: docsExpiring + visaMilestones.length > 0 ? { direction: 'up' as const, value: 'urgent' } : undefined },
    ],
    insights: [
      {
        id: 'approval-workload',
        title: 'Approval workload',
        severity: pendingApprovals > 2 ? 'warning' : 'info',
        narrative: pendingApprovals > 0
          ? `${pendingApprovals} item${pendingApprovals > 1 ? 's' : ''} need approval. ${docsExpiring > 0 ? `${docsExpiring} document${docsExpiring > 1 ? 's' : ''} expiring soon.` : ''}`
          : 'No pending approvals. All leave and document requests are current.',
        ctaLabel: pendingApprovals > 0 ? 'Process queue' : undefined,
        ctaIntent: 'Show all pending approvals',
      },
      {
        id: 'compliance-status',
        title: 'Compliance status',
        severity: docsExpiring > 0 || visaMilestones.length > 0 ? 'warning' : 'neutral',
        narrative: docsExpiring > 0
          ? `${docsExpiring} document${docsExpiring > 1 ? 's' : ''} expiring. ${visaMilestones.length > 0 ? `${visaMilestones.length} visa renewal${visaMilestones.length > 1 ? 's' : ''} approaching.` : ''}`
          : 'All compliance documents are current. No visa renewals due in the next 90 days.',
      },
    ],
    timeline: [
      ...mockLeaveRequests
        .filter((r) => r.status === 'pending')
        .map(leaveToTimelineEvent),
      ...upcomingMilestones.slice(0, 6).map(milestoneToTimelineEvent),
    ],
    workflows: [
      ...mockLeaveRequests.filter((r) => r.status === 'pending').map(leaveToWorkflow),
      ...(docsExpiring > 0 ? mockDocuments.filter((d) => d.status === 'expiring').map((doc) => {
        const emp = getEmployeeById(doc.employeeId);
        return {
          id: `wf-doc-${doc.id}`,
          title: `Renew document: ${doc.fileName}`,
          description: `${emp ? `${emp.firstName} ${emp.lastName}` : doc.employeeId} · Expires ${doc.expiresAt ?? 'soon'}`,
          severity: 'warning' as const,
          status: 'Expiring',
          dueDate: doc.expiresAt ?? undefined,
          assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          actions: [
            { label: 'Remind', variant: 'secondary' as const, intent: `Remind ${emp ? `${emp.firstName} ${emp.lastName}` : doc.employeeId} to renew ${doc.fileName}` },
          ],
        };
      }) : []),
      ...probationMilestones.map((ms, i) => {
        const emp = getEmployeeById(ms.employeeId);
        return {
          id: `wf-prob-${ms.id}`,
          title: `Probation review: ${emp ? `${emp.firstName} ${emp.lastName}` : ms.employeeId}`,
          description: `Ends ${ms.milestoneDate}. Schedule review meeting and gather 360° feedback.`,
          severity: 'info' as const,
          status: 'Upcoming',
          dueDate: ms.milestoneDate,
          assignee: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          actions: [{ label: 'Schedule', variant: 'secondary' as const, intent: `Schedule probation review for ${emp ? `${emp.firstName} ${emp.lastName}` : ms.employeeId}` }],
        };
      }),
    ],
    aiSuggestions: [
      'Summarise org-wide risk',
      'Anniversaries next month (XLSX)',
      'Can I terminate a probation employee?',
      'Approve all low-risk leave requests',
    ],
  };
}

/* ───────────────────────────────────────── public API */

export async function composeCommandWorkspace(
  opts: CommandWorkspaceOptions = {},
): Promise<CommandWorkspaceData> {
  const role = normaliseRole(opts.userRole);

  if (role === 'employee') {
    return composeEmployee(opts);
  }
  if (role === 'manager' || role === 'team_lead') {
    return composeManager(opts);
  }
  return composeHr(opts);
}

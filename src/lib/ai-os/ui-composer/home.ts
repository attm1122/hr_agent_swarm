/**
 * composeHomeWorkspace — role-aware idle-state block stream for the
 * AssistantWorkspace. Acts as the dispatcher over three role surfaces:
 *
 *   employee → composeEmployeeHome
 *   manager / team_lead → composeManagerHome
 *   admin / payroll → composeHrHome
 *
 * The same underlying intelligence layer (generateSignals + projectSignals)
 * feeds all three — so one event in the world produces three different,
 * role-appropriate projections. That is the point of the whole system.
 */

import type { Role } from '@/types';
import {
  employees as mockEmployees,
  milestones as mockMilestones,
  documents as mockDocuments,
  leaveRequests as mockLeaveRequests,
  getEmployeeById,
  getDirectReports,
} from '@/lib/data/mock-data';
import { getLeaveStore } from '@/lib/data/leave-store';
import type { ComposedWorkspace } from './types';
import { generateSignals } from '../signals/generator';
import { buildProjectionContext, projectSignals } from '../signals/projection';
import { composeEmployeeHome } from './home-employee';
import { composeManagerHome } from './home-manager';
import { composeHrHome } from './home-hr';

export interface HomeWorkspaceOptions {
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

export async function composeHomeWorkspace(
  opts: HomeWorkspaceOptions = {},
): Promise<ComposedWorkspace> {
  const role = normaliseRole(opts.userRole);
  const employeeId = opts.employeeId;

  const signalSet = await generateSignals();
  const ctx = buildProjectionContext(role, employeeId);
  const projection = projectSignals(signalSet, ctx);

  if (role === 'employee') {
    const me = employeeId ? getEmployeeById(employeeId) : undefined;
    const leaveBalanceDays = await safeLoadBalances(employeeId);
    const myPendingLeave = mockLeaveRequests.filter(
      (r) => r.employeeId === employeeId && r.status === 'pending',
    );
    const onboardingOpen = projection.visible.some(
      (s) => s.kind === 'incomplete_onboarding',
    );

    return composeEmployeeHome({
      userName: opts.userName,
      employee: me,
      projection,
      myPendingLeave,
      leaveBalanceDays: leaveBalanceDays ?? undefined,
      onboardingOpen,
    });
  }

  if (role === 'manager' || role === 'team_lead') {
    const manager = employeeId ? getEmployeeById(employeeId) : undefined;
    const teamMembers = employeeId ? getDirectReports(employeeId) : [];
    const teamIds = new Set(teamMembers.map((e) => e.id));
    const teamPendingLeave = mockLeaveRequests.filter(
      (r) => r.status === 'pending' && teamIds.has(r.employeeId),
    );

    // Team balances — resolve in parallel.
    const teamBalances = await Promise.all(
      teamMembers.map(async (emp) => {
        const annualRemaining = await safeLoadBalances(emp.id);
        return { employee: emp, annualRemaining };
      }),
    );

    return composeManagerHome({
      userName: opts.userName,
      manager,
      teamMembers,
      teamPendingLeave,
      teamBalances,
      projection,
    });
  }

  // admin / payroll → HR surface.
  const activeEmployees = mockEmployees.filter((e) => e.status === 'active').length;
  const pendingApprovals = mockLeaveRequests.filter((l) => l.status === 'pending').length;
  const docsExpiring = mockDocuments.filter((d) => d.status === 'expiring').length;
  const openEscalations = projection.visible.filter((s) => s.escalation_required).length;
  const upcomingMilestones = mockMilestones
    .filter((m) => m.status === 'upcoming')
    .slice()
    .sort((a, b) => a.milestoneDate.localeCompare(b.milestoneDate));

  return composeHrHome({
    userName: opts.userName,
    activeEmployees,
    pendingApprovals,
    openEscalations,
    docsExpiring,
    upcomingMilestones,
    employees: mockEmployees,
    projection,
  });
}

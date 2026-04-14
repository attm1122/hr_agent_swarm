/**
 * Signal projection.
 *
 * The generator produces a full SignalSet unconditionally. Projection is the
 * layer that decides **which** signals a given viewer actually sees, and
 * optionally re-phrases them for the viewer's angle (so an employee sees
 * "You have 23 days of leave" while their manager sees "Sofia Garcia has 23
 * days of leave").
 *
 * Rules (enforced in order):
 *   1. `role` must appear in `signal.visibility_roles`.
 *   2. Sensitivity gate: employees cannot see `confidential`/`restricted`
 *      signals about other employees.
 *   3. Scope gate:
 *      - `employee` viewers only see signals where `subjectEmployeeId` is
 *        their own employeeId (or signals with no subject that target their
 *        role — e.g. update_personal_details).
 *      - `manager` / `team_lead` viewers see signals about themselves,
 *        their direct reports, and their team, plus unscoped team-level
 *        signals.
 *      - `admin` sees everything.
 *   4. Returned signals are re-labelled where appropriate (first-person for
 *      self, third-person for reports).
 */

import type { Role } from '@/types';
import { employees as mockEmployees } from '@/lib/data/mock-data';
import type {
  RiskSignal,
  SignalSet,
  ProjectionContext,
  ProjectedSignalSet,
} from './types';

/** Build a projection context from the viewing user. */
export function buildProjectionContext(
  role: Role,
  employeeId?: string,
  allEmployees = mockEmployees,
): ProjectionContext {
  // Employees and admins don't need the reports graph — skip the walk.
  const needsReports =
    !!employeeId && (role === 'manager' || role === 'team_lead');
  if (!needsReports) {
    return { role, employeeId };
  }

  // Single pass: partition into direct reports of `employeeId`, then reuse
  // that set to collect indirect reports without a second O(n²) scan.
  const directReportIds: string[] = [];
  const directReportIdSet = new Set<string>();
  const managedTeamIds = new Set<string>();
  for (const e of allEmployees) {
    if (e.managerId === employeeId) {
      directReportIds.push(e.id);
      directReportIdSet.add(e.id);
      if (e.teamId) managedTeamIds.add(e.teamId);
    }
  }

  const indirectReportIds: string[] = [];
  for (const e of allEmployees) {
    if (e.managerId && directReportIdSet.has(e.managerId)) {
      indirectReportIds.push(e.id);
    }
  }

  return {
    role,
    employeeId,
    directReportIds,
    indirectReportIds,
    managedTeamIds: Array.from(managedTeamIds),
  };
}

function isAdminLike(role: Role): boolean {
  return role === 'admin' || role === 'payroll';
}

function sensitivityAllowed(
  viewerRole: Role,
  subjectEmployeeId: string | undefined,
  viewerEmployeeId: string | undefined,
  sensitivity: RiskSignal['sensitivity'],
): boolean {
  if (isAdminLike(viewerRole)) return true;
  if (viewerRole === 'manager' || viewerRole === 'team_lead') {
    return sensitivity !== 'restricted' || !!subjectEmployeeId;
  }
  // employee
  if (sensitivity === 'public' || sensitivity === 'internal') return true;
  // confidential / restricted: only if it's literally about them.
  return !!subjectEmployeeId && subjectEmployeeId === viewerEmployeeId;
}

function scopeAllowed(
  signal: RiskSignal,
  ctx: ProjectionContext,
): boolean {
  if (isAdminLike(ctx.role)) return true;

  if (ctx.role === 'employee') {
    if (!signal.subjectEmployeeId) {
      // Unscoped but visible to employees only if they're in visibility_roles.
      return signal.visibility_roles.includes('employee');
    }
    return signal.subjectEmployeeId === ctx.employeeId;
  }

  if (ctx.role === 'manager' || ctx.role === 'team_lead') {
    if (!signal.subjectEmployeeId && !signal.subjectTeamId) return true;
    if (signal.subjectEmployeeId === ctx.employeeId) return true;
    if (
      signal.subjectEmployeeId &&
      (ctx.directReportIds?.includes(signal.subjectEmployeeId) ||
        ctx.indirectReportIds?.includes(signal.subjectEmployeeId))
    ) {
      return true;
    }
    if (
      signal.subjectTeamId &&
      ctx.managedTeamIds?.includes(signal.subjectTeamId)
    ) {
      return true;
    }
    return false;
  }

  return false;
}

function relabelForViewer(signal: RiskSignal, ctx: ProjectionContext): RiskSignal {
  // Self-addressed copy tweaks so employees see first-person language.
  if (
    ctx.role === 'employee' &&
    signal.subjectEmployeeId &&
    signal.subjectEmployeeId === ctx.employeeId
  ) {
    if (signal.kind === 'high_leave_balance') {
      return {
        ...signal,
        title: 'You have a high leave balance',
        summary: signal.summary.replace(/^\d+/, (m) => `${m} of your`),
        recommendation:
          'Plan some time off in the next 90 days to protect your wellbeing and reduce accrued liability.',
      };
    }
    if (signal.kind === 'incomplete_onboarding') {
      return {
        ...signal,
        title: 'Finish your onboarding',
        recommendation:
          'Complete the remaining onboarding tasks on your plan.',
      };
    }
    if (signal.kind === 'pending_leave_request') {
      return {
        ...signal,
        title: 'Your leave request is pending',
        recommendation: 'Your manager has been notified; you will get a decision within 3 business days.',
        // Employees can view but not approve their own leave.
        action_options: signal.action_options.filter((a) => a.id !== 'approve' && a.id !== 'reject'),
      };
    }
  }
  return signal;
}

export function projectSignals(
  signalSet: SignalSet,
  ctx: ProjectionContext,
): ProjectedSignalSet {
  const visible: RiskSignal[] = [];
  let hiddenCount = 0;

  for (const s of signalSet.signals) {
    const roleOk = isAdminLike(ctx.role) || s.visibility_roles.includes(ctx.role);
    if (!roleOk) {
      hiddenCount++;
      continue;
    }
    if (!sensitivityAllowed(ctx.role, s.subjectEmployeeId, ctx.employeeId, s.sensitivity)) {
      hiddenCount++;
      continue;
    }
    if (!scopeAllowed(s, ctx)) {
      hiddenCount++;
      continue;
    }
    visible.push(relabelForViewer(s, ctx));
  }

  return {
    viewer: ctx,
    visible,
    hiddenCount,
  };
}

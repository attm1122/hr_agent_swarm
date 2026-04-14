/**
 * Signal generator + projection tests.
 *
 * The core guarantee is: a single underlying event (e.g. "probation for
 * emp-021 ends in ~17 days") produces different, role-appropriate
 * projections — the employee home does not show it, the manager home does,
 * the HR home does, and sensitivity tags are respected.
 */

import { describe, it, expect } from 'vitest';
import { generateSignals } from './generator';
import { buildProjectionContext, projectSignals } from './projection';
import type { Employee, LeaveRequest, Milestone } from '@/types';

// --- Deterministic inputs ---------------------------------------------------

const NOW = new Date('2026-04-14T00:00:00.000Z');

const teamLead: Employee = {
  id: 'mgr-1',
  email: 'mgr@co.com',
  firstName: 'Mia',
  lastName: 'Manager',
  employeeNumber: 'MGR1',
  hireDate: '2020-01-01',
  terminationDate: null,
  status: 'active',
  teamId: 'team-a',
  positionId: 'pos-1',
  managerId: null,
  workLocation: 'hybrid',
  employmentType: 'full_time',
  createdAt: '2020-01-01',
  updatedAt: '2024-01-01',
};

const report: Employee = {
  id: 'emp-1',
  email: 'rep@co.com',
  firstName: 'Rob',
  lastName: 'Report',
  employeeNumber: 'REP1',
  hireDate: '2026-02-01',
  terminationDate: null,
  status: 'active',
  teamId: 'team-a',
  positionId: 'pos-2',
  managerId: 'mgr-1',
  workLocation: 'remote',
  employmentType: 'full_time',
  createdAt: '2026-02-01',
  updatedAt: '2026-02-01',
};

const outsider: Employee = {
  id: 'emp-2',
  email: 'out@co.com',
  firstName: 'Olivia',
  lastName: 'Outsider',
  employeeNumber: 'OUT1',
  hireDate: '2023-01-01',
  terminationDate: null,
  status: 'active',
  teamId: 'team-b',
  positionId: 'pos-2',
  managerId: 'someone-else',
  workLocation: 'remote',
  employmentType: 'full_time',
  createdAt: '2023-01-01',
  updatedAt: '2023-01-01',
};

const probationMilestone: Milestone = {
  id: 'ms-probation-1',
  employeeId: 'emp-1',
  milestoneType: 'probation_end',
  milestoneDate: '2026-05-01',
  description: 'Probation Period Ends',
  alertDaysBefore: 14,
  status: 'upcoming',
  acknowledgedAt: null,
  acknowledgedBy: null,
  createdAt: '2026-02-01',
  updatedAt: '2026-02-01',
};

const anniversaryMilestone: Milestone = {
  id: 'ms-ann-1',
  employeeId: 'emp-2',
  milestoneType: 'service_anniversary',
  milestoneDate: '2026-06-01',
  description: '3 Year Service Anniversary',
  alertDaysBefore: 30,
  status: 'upcoming',
  acknowledgedAt: null,
  acknowledgedBy: null,
  createdAt: '2025-06-01',
  updatedAt: '2026-01-01',
};

async function loadBalancesHigh(_id: string) {
  return [
    {
      id: 'b-' + _id,
      employeeId: _id,
      leaveType: 'annual' as const,
      entitlementDays: 20,
      takenDays: 0,
      pendingDays: 0,
      remainingDays: 28,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
  ];
}

async function buildSet() {
  return generateSignals({
    now: NOW,
    employees: [teamLead, report, outsider],
    milestones: [probationMilestone, anniversaryMilestone],
    documents: [],
    leaveRequests: [],
    loadBalances: loadBalancesHigh,
  });
}

// --- Tests ------------------------------------------------------------------

describe('generateSignals', () => {
  it('emits a probation signal with policy + legal basis and confidential sensitivity', async () => {
    const { signals } = await buildSet();
    const prob = signals.find((s) => s.kind === 'probation_review_due');
    expect(prob).toBeDefined();
    expect(prob!.subjectEmployeeId).toBe('emp-1');
    expect(prob!.policy_basis.length).toBeGreaterThan(0);
    expect(prob!.legal_basis.length).toBeGreaterThan(0);
    expect(prob!.sensitivity).toBe('confidential');
    // 17 days until end → medium or high severity, not info
    expect(['medium', 'high']).toContain(prob!.severity);
    // Must carry at least one concrete action_option with an intent
    expect(prob!.action_options.length).toBeGreaterThan(0);
    expect(prob!.action_options[0].intent?.rawInput).toMatch(/probation|review/i);
  });

  it('emits a high-leave-balance signal per active employee', async () => {
    const { signals } = await buildSet();
    const balances = signals.filter((s) => s.kind === 'high_leave_balance');
    expect(balances.length).toBe(3); // all three active employees are over 20 days
  });

  it('produces deterministic ids', async () => {
    const a = await buildSet();
    const b = await buildSet();
    const aIds = a.signals.map((s) => s.id).sort();
    const bIds = b.signals.map((s) => s.id).sort();
    expect(aIds).toEqual(bIds);
  });
});

describe('projectSignals — role projection', () => {
  it('employee sees their own probation ONLY if it is about them, but here employee is NOT the probation subject', async () => {
    const set = await buildSet();
    // teamLead viewing as an employee role — should NOT see probation about Rob.
    const ctx = buildProjectionContext('employee', 'mgr-1', [teamLead, report, outsider]);
    const projection = projectSignals(set, ctx);
    expect(projection.visible.some((s) => s.kind === 'probation_review_due')).toBe(false);
    expect(projection.hiddenCount).toBeGreaterThan(0);
  });

  it('employee sees their own self-service and balance signals, re-labelled first-person', async () => {
    const set = await buildSet();
    const ctx = buildProjectionContext('employee', 'emp-1', [teamLead, report, outsider]);
    const projection = projectSignals(set, ctx);

    const selfService = projection.visible.find((s) => s.kind === 'update_personal_details');
    expect(selfService).toBeDefined();
    expect(selfService!.subjectEmployeeId).toBe('emp-1');

    const balance = projection.visible.find(
      (s) => s.kind === 'high_leave_balance' && s.subjectEmployeeId === 'emp-1',
    );
    expect(balance).toBeDefined();
    // Re-labelled first-person
    expect(balance!.title.toLowerCase()).toContain('you ');

    // Must NOT see anyone else's signals
    const othersBalance = projection.visible.find(
      (s) => s.kind === 'high_leave_balance' && s.subjectEmployeeId !== 'emp-1',
    );
    expect(othersBalance).toBeUndefined();
  });

  it('manager sees signals about direct reports but NOT outsiders', async () => {
    const set = await buildSet();
    const ctx = buildProjectionContext('manager', 'mgr-1', [teamLead, report, outsider]);
    const projection = projectSignals(set, ctx);

    // Direct report probation — visible
    expect(
      projection.visible.some(
        (s) => s.kind === 'probation_review_due' && s.subjectEmployeeId === 'emp-1',
      ),
    ).toBe(true);

    // Outsider anniversary — not visible (different team, not a report)
    expect(
      projection.visible.some(
        (s) => s.kind === 'upcoming_anniversary' && s.subjectEmployeeId === 'emp-2',
      ),
    ).toBe(false);

    expect(projection.hiddenCount).toBeGreaterThan(0);
  });

  it('admin sees everything including outsiders', async () => {
    const set = await buildSet();
    const ctx = buildProjectionContext('admin', undefined, [teamLead, report, outsider]);
    const projection = projectSignals(set, ctx);
    // All three balance signals visible to admin
    expect(
      projection.visible.filter((s) => s.kind === 'high_leave_balance').length,
    ).toBe(3);
    // Confidential probation visible to admin
    expect(projection.visible.some((s) => s.kind === 'probation_review_due')).toBe(true);
  });

  it('the SAME underlying probation event projects to three different surfaces', async () => {
    const set = await buildSet();
    const empCtx = buildProjectionContext('employee', 'mgr-1', [teamLead, report, outsider]);
    const mgrCtx = buildProjectionContext('manager', 'mgr-1', [teamLead, report, outsider]);
    const hrCtx = buildProjectionContext('admin', undefined, [teamLead, report, outsider]);

    const empProj = projectSignals(set, empCtx);
    const mgrProj = projectSignals(set, mgrCtx);
    const hrProj = projectSignals(set, hrCtx);

    const hasProbation = (p: ReturnType<typeof projectSignals>) =>
      p.visible.some((s) => s.kind === 'probation_review_due');

    expect(hasProbation(empProj)).toBe(false);
    expect(hasProbation(mgrProj)).toBe(true);
    expect(hasProbation(hrProj)).toBe(true);
  });

  it('employees do not see confidential signals about other employees even if role matches visibility', async () => {
    const set = await buildSet();
    // Viewing as report — confidential probation about THEM should still be
    // visible to the subject themselves? In our policy: probation is owner=manager
    // and visibility_roles=[manager, admin, team_lead] — employees are NOT in
    // that list, so even subjects can't see it via the employee surface. That
    // is the conservative and correct default.
    const ctx = buildProjectionContext('employee', 'emp-1', [teamLead, report, outsider]);
    const projection = projectSignals(set, ctx);
    expect(projection.visible.some((s) => s.kind === 'probation_review_due')).toBe(false);
  });
});

describe('signal completion loop', () => {
  it('pending_leave_request disappears once the request is approved', async () => {
    // Use emp-008 (Priya Sharma) because buildPendingLeaveSignals calls
    // getEmployeeById from mock-data, so the employeeId must exist there.
    const leaveReq: LeaveRequest = {
      id: 'lr-test-loop',
      employeeId: 'emp-008',
      leaveType: 'annual',
      startDate: '2026-04-20',
      endDate: '2026-04-22',
      daysRequested: 3,
      reason: 'Family trip',
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z',
    };

    // Step 1 — pending request generates a signal
    const { signals: before } = await generateSignals({
      now: NOW,
      employees: [teamLead, report, outsider],
      milestones: [],
      documents: [],
      leaveRequests: [leaveReq],
      loadBalances: loadBalancesHigh,
    });

    const pendingBefore = before.filter((s) => s.kind === 'pending_leave_request');
    expect(pendingBefore.length).toBe(1);
    expect(pendingBefore[0].id).toBe('leave-req-lr-test-loop');

    // Step 2 — simulate approval (what the leave-write-adapter does)
    leaveReq.status = 'approved';
    leaveReq.approvedBy = 'mgr-1';
    leaveReq.approvedAt = NOW.toISOString();
    leaveReq.updatedAt = NOW.toISOString();

    // Step 3 — re-generate: the signal must be gone
    const { signals: after } = await generateSignals({
      now: NOW,
      employees: [teamLead, report, outsider],
      milestones: [],
      documents: [],
      leaveRequests: [leaveReq],
      loadBalances: loadBalancesHigh,
    });

    const pendingAfter = after.filter((s) => s.kind === 'pending_leave_request');
    expect(pendingAfter.length).toBe(0);
  });
});

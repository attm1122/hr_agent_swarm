import { describe, expect, it } from 'vitest';
import { documents, employees, leaveRequests, milestones } from '@/lib/data/mock-data';
import {
  getDashboardMetrics,
  getProbationDue,
  getUpcomingAnniversaries,
  selectProbationDue,
} from './dashboard-data';

describe('HR dashboard data helpers', () => {
  it('returns dashboard metrics from the shared module', () => {
    expect(getDashboardMetrics()).toEqual({
      totalEmployees: employees.filter((employee) => employee.status === 'active').length,
      pendingApprovals: 6,
      pendingLeaveRequests: leaveRequests.filter((leaveRequest) => leaveRequest.status === 'pending').length,
      expiringDocsCount: documents.filter((document) => document.status === 'expiring').length,
    });
  });

  it('returns only upcoming or due anniversaries from the real module logic', () => {
    const anniversaries = getUpcomingAnniversaries(new Date('2026-04-10T12:00:00Z'));

    expect(anniversaries.length).toBeGreaterThan(0);
    anniversaries.forEach((anniversary) => {
      expect(milestones.find((milestone) => milestone.id === anniversary.id)?.milestoneType).toBe('work_anniversary');
      expect(['upcoming', 'due']).toContain(anniversary.state);
    });
  });

  it('derives probation reviews from milestone dates instead of trusting stale static status flags', () => {
    const stalePastMilestone = {
      id: 'ms-stale',
      employeeId: 'emp-021',
      milestoneType: 'probation_end' as const,
      milestoneDate: '2025-05-01',
      description: 'Stale probation review',
      alertDaysBefore: 14,
      status: 'upcoming' as const,
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: '2025-02-01',
      updatedAt: '2025-02-01',
    };

    const probationDue = selectProbationDue([stalePastMilestone], new Date('2026-04-10T12:00:00Z'));

    expect(probationDue).toEqual([]);
  });

  it('never produces negative upcoming day badges for probation reviews', () => {
    const probationDue = getProbationDue(new Date('2026-04-10T12:00:00Z'));

    expect(probationDue.length).toBeGreaterThan(0);
    probationDue.forEach((item) => {
      expect(item.daysRemaining).toBeGreaterThanOrEqual(0);
      expect(['upcoming', 'due']).toContain(item.state);
    });
  });
});

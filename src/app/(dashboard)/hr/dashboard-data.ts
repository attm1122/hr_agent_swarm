import {
  employees,
  actionQueue,
  milestones,
  documents,
  leaveRequests,
  getEmployeeById,
} from '@/lib/data/mock-data';
import type { Milestone } from '@/types';
import { compareDateOnly } from '@/lib/domain/shared/date-value';
import { getDerivedMilestoneState, getMilestoneDayOffset } from '@/lib/milestones';

export function getDashboardMetrics() {
  const activeEmployees = employees.filter((employee) => employee.status === 'active').length;
  const pendingLeave = leaveRequests.filter((leaveRequest) => leaveRequest.status === 'pending').length;
  const expiringDocs = documents.filter((document) => document.status === 'expiring').length;

  return {
    totalEmployees: activeEmployees,
    pendingApprovals: actionQueue.length,
    pendingLeaveRequests: pendingLeave,
    expiringDocsCount: expiringDocs,
  };
}

export function selectUpcomingAnniversaries(
  sourceMilestones: Milestone[],
  referenceDate: Date = new Date(),
) {
  return sourceMilestones
    .filter((milestone) => milestone.milestoneType === 'work_anniversary')
    .map((milestone) => ({
      milestone,
      state: getDerivedMilestoneState(milestone, referenceDate),
    }))
    .filter(({ state }) => state === 'upcoming' || state === 'due')
    .sort((left, right) => compareDateOnly(left.milestone.milestoneDate, right.milestone.milestoneDate))
    .map(({ milestone, state }) => {
      const employee = getEmployeeById(milestone.employeeId);
      return {
        id: milestone.id,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
        date: milestone.milestoneDate,
        description: milestone.description,
        state,
      };
    });
}

export function getUpcomingAnniversaries(referenceDate: Date = new Date()) {
  return selectUpcomingAnniversaries(milestones, referenceDate);
}

export function selectProbationDue(
  sourceMilestones: Milestone[],
  referenceDate: Date = new Date(),
) {
  return sourceMilestones
    .filter((milestone) => milestone.milestoneType === 'probation_end')
    .map((milestone) => ({
      milestone,
      state: getDerivedMilestoneState(milestone, referenceDate),
      dayOffset: getMilestoneDayOffset(milestone, referenceDate),
    }))
    .filter(({ state }) => state === 'upcoming' || state === 'due')
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .map(({ milestone, state, dayOffset }) => {
      const employee = getEmployeeById(milestone.employeeId);
      return {
        id: milestone.id,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
        date: milestone.milestoneDate,
        daysRemaining: dayOffset,
        state,
      };
    });
}

export function getProbationDue(referenceDate: Date = new Date()) {
  return selectProbationDue(milestones, referenceDate);
}

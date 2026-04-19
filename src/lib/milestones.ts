import type { Milestone } from '@/types';
import {
  compareDateOnly,
  differenceFromTodayInDateOnlyDays,
  getDateOnlyRelativeState,
} from '@/lib/domain/shared/date-value';

export type DerivedMilestoneState = 'upcoming' | 'due' | 'overdue' | 'completed';

export function isMilestoneCompleted(milestone: Pick<Milestone, 'status' | 'acknowledgedAt' | 'acknowledgedBy'>): boolean {
  return (
    milestone.status === 'completed' ||
    milestone.status === 'acknowledged' ||
    Boolean(milestone.acknowledgedAt) ||
    Boolean(milestone.acknowledgedBy)
  );
}

export function getDerivedMilestoneState(
  milestone: Pick<Milestone, 'milestoneDate' | 'status' | 'acknowledgedAt' | 'acknowledgedBy'>,
  referenceDate: Date = new Date(),
  timeZone?: string,
): DerivedMilestoneState {
  if (isMilestoneCompleted(milestone)) {
    return 'completed';
  }

  const relativeState = getDateOnlyRelativeState(milestone.milestoneDate, referenceDate, timeZone);
  if (relativeState === 'past') {
    return 'overdue';
  }
  if (relativeState === 'today') {
    return 'due';
  }
  return 'upcoming';
}

export function getMilestoneDayOffset(
  milestone: Pick<Milestone, 'milestoneDate'>,
  referenceDate: Date = new Date(),
  timeZone?: string,
): number {
  return differenceFromTodayInDateOnlyDays(milestone.milestoneDate, referenceDate, timeZone);
}

export function compareMilestonesByDate(
  left: Pick<Milestone, 'milestoneDate'>,
  right: Pick<Milestone, 'milestoneDate'>,
): number {
  return compareDateOnly(left.milestoneDate, right.milestoneDate);
}

export function matchesDerivedMilestoneState(
  milestone: Pick<Milestone, 'milestoneDate' | 'status' | 'acknowledgedAt' | 'acknowledgedBy'>,
  state: DerivedMilestoneState,
  referenceDate: Date = new Date(),
  timeZone?: string,
): boolean {
  return getDerivedMilestoneState(milestone, referenceDate, timeZone) === state;
}

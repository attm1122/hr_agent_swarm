import { describe, expect, it } from 'vitest';
import { compareMilestonesByDate, getDerivedMilestoneState, getMilestoneDayOffset } from './milestones';

describe('milestone derivation', () => {
  const baseMilestone = {
    id: 'ms-test',
    employeeId: 'emp-001',
    milestoneType: 'probation_end' as const,
    milestoneDate: '2026-04-10',
    description: 'Probation review',
    alertDaysBefore: 14,
    status: 'upcoming' as const,
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('marks stale past milestones as overdue even when the stored status says upcoming', () => {
    expect(
      getDerivedMilestoneState(
        { ...baseMilestone, milestoneDate: '2026-04-01', status: 'upcoming' },
        new Date('2026-04-10T12:00:00Z'),
      )
    ).toBe('overdue');
  });

  it('treats completed or acknowledged milestones as completed regardless of date', () => {
    expect(
      getDerivedMilestoneState(
        {
          ...baseMilestone,
          milestoneDate: '2026-04-01',
          status: 'completed',
          acknowledgedAt: '2026-04-01T00:00:00Z',
        },
        new Date('2026-04-10T12:00:00Z'),
      )
    ).toBe('completed');
  });

  it('returns positive, zero, and negative day offsets by calendar date', () => {
    expect(
      getMilestoneDayOffset(
        { ...baseMilestone, milestoneDate: '2026-04-12' },
        new Date('2026-04-10T12:00:00Z'),
      )
    ).toBe(2);
    expect(
      getMilestoneDayOffset(
        { ...baseMilestone, milestoneDate: '2026-04-10' },
        new Date('2026-04-10T12:00:00Z'),
      )
    ).toBe(0);
    expect(
      getMilestoneDayOffset(
        { ...baseMilestone, milestoneDate: '2026-04-01' },
        new Date('2026-04-10T12:00:00Z'),
      )
    ).toBe(-9);
  });

  it('sorts milestones by date-only order', () => {
    expect(
      compareMilestonesByDate(
        { milestoneDate: '2026-04-01' },
        { milestoneDate: '2026-04-12' },
      )
    ).toBeLessThan(0);
  });
});

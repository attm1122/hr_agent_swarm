/**
 * Characterization tests for employee status transition rules.
 *
 * These tests pin the current behaviour of canTransitionStatus so that
 * future refactors cannot accidentally change business rules.
 */

import { describe, it, expect } from 'vitest';
import { canTransitionStatus, type EmployeeStatus, type StatusTransitionContext } from './employee-status';

const cleanContext: StatusTransitionContext = {
  hasOpenLeaveRequests: false,
  hasIncompleteOnboarding: false,
};

const withOpenLeave: StatusTransitionContext = {
  hasOpenLeaveRequests: true,
  hasIncompleteOnboarding: false,
};

const withIncompleteOnboarding: StatusTransitionContext = {
  hasOpenLeaveRequests: false,
  hasIncompleteOnboarding: true,
};

const withBothBlockers: StatusTransitionContext = {
  hasOpenLeaveRequests: true,
  hasIncompleteOnboarding: true,
};

const allStatuses: EmployeeStatus[] = ['active', 'inactive', 'on_leave', 'terminated', 'pending'];

describe('canTransitionStatus', () => {
  describe('no-op transitions (same status)', () => {
    it.each(allStatuses)('allows %s → %s', (status) => {
      const result = canTransitionStatus(status, status, cleanContext);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('pending → active (new hire completion)', () => {
    it('allows pending → active', () => {
      const result = canTransitionStatus('pending', 'active', cleanContext);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('transitions to terminated', () => {
    const terminatingTransitions: [EmployeeStatus, EmployeeStatus][] = [
      ['active', 'terminated'],
      ['on_leave', 'terminated'],
      ['inactive', 'terminated'],
      ['pending', 'terminated'],
    ];

    it.each(terminatingTransitions)(
      'allows %s → %s when clean',
      (from, to) => {
        const result = canTransitionStatus(from, to, cleanContext);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    );

    it.each(terminatingTransitions)(
      'blocks %s → %s when open leave requests exist',
      (from, to) => {
        const result = canTransitionStatus(from, to, withOpenLeave);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('open leave requests');
      }
    );

    it.each(terminatingTransitions)(
      'blocks %s → %s when onboarding is incomplete',
      (from, to) => {
        const result = canTransitionStatus(from, to, withIncompleteOnboarding);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('incomplete onboarding');
      }
    );

    it.each(terminatingTransitions)(
      'blocks %s → %s when both blockers exist',
      (from, to) => {
        const result = canTransitionStatus(from, to, withBothBlockers);
        expect(result.allowed).toBe(false);
      }
    );
  });

  describe('terminated → active (rehire)', () => {
    it('allows terminated → active with a warning', () => {
      const result = canTransitionStatus('terminated', 'active', cleanContext);
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Warning');
      expect(result.reason).toContain('reinstating');
    });
  });

  describe('simple allowed transitions', () => {
    const allowed: [EmployeeStatus, EmployeeStatus][] = [
      ['active', 'inactive'],
      ['inactive', 'active'],
      ['active', 'on_leave'],
      ['on_leave', 'active'],
      ['pending', 'inactive'],
      ['inactive', 'on_leave'],
      ['on_leave', 'inactive'],
    ];

    it.each(allowed)('allows %s → %s', (from, to) => {
      const result = canTransitionStatus(from, to, cleanContext);
      expect(result.allowed).toBe(true);
    });
  });

  describe('disallowed transitions', () => {
    const disallowed: [EmployeeStatus, EmployeeStatus][] = [
      ['active', 'pending'],
      ['terminated', 'inactive'],
      ['terminated', 'on_leave'],
      ['terminated', 'pending'],
      ['pending', 'on_leave'],
    ];

    it.each(disallowed)('blocks %s → %s', (from, to) => {
      const result = canTransitionStatus(from, to, cleanContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not supported');
    });
  });

  describe('blocker priority for termination', () => {
    it('reports leave blocker even when onboarding is also incomplete', () => {
      const result = canTransitionStatus('active', 'terminated', withBothBlockers);
      expect(result.allowed).toBe(false);
      // Leave check happens first in the implementation
      expect(result.reason).toContain('open leave requests');
    });
  });
});

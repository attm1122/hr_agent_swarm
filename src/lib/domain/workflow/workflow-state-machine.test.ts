/**
 * Characterization tests for workflow step transition rules.
 *
 * These tests pin the current behaviour of canTransitionStep,
 * getNextStepState and getWorkflowStateFromAction so that future
 * refactors cannot accidentally change business rules.
 */

import { describe, it, expect } from 'vitest';
import {
  canTransitionStep,
  getNextStepState,
  getWorkflowStateFromAction,
  type StepTransitionContext,
  type StepState,
} from './workflow-state-machine';

const baseContext: StepTransitionContext = {
  approverId: 'user-001',
  stepApproverId: 'user-001',
  stepApproverRole: 'manager',
  userRole: 'manager',
};

const adminContext: StepTransitionContext = {
  approverId: 'admin-001',
  stepApproverId: 'user-001',
  stepApproverRole: 'manager',
  userRole: 'admin',
};

const unassignedContext: StepTransitionContext = {
  approverId: 'user-001',
  stepApproverId: null,
  stepApproverRole: 'manager',
  userRole: 'manager',
};

const wrongApproverContext: StepTransitionContext = {
  approverId: 'user-002',
  stepApproverId: 'user-001',
  stepApproverRole: 'manager',
  userRole: 'manager',
};

const allStepStates: StepState[] = ['pending', 'approved', 'rejected', 'delegated', 'skipped'];
const allActions: Array<'approve' | 'reject' | 'delegate' | 'skip'> = [
  'approve',
  'reject',
  'delegate',
  'skip',
];

// ---------------------------------------------------------------------------
// canTransitionStep
// ---------------------------------------------------------------------------

describe('canTransitionStep', () => {
  describe('only pending steps can transition', () => {
    it.each(
      allStepStates
        .filter(s => s !== 'pending')
        .flatMap(s => allActions.map(a => [s, a] as [StepState, typeof a]))
    )('blocks %s → %s', (current, action) => {
      const result = canTransitionStep(current, action, baseContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot');
    });
  });

  describe('pending step with matching approver', () => {
    it.each(allActions)('allows %s when approver matches', (action) => {
      const result = canTransitionStep('pending', action, baseContext);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('pending step with no assigned approver', () => {
    it.each(allActions)('allows %s when stepApproverId is null', (action) => {
      const result = canTransitionStep('pending', action, unassignedContext);
      expect(result.allowed).toBe(true);
    });
  });

  describe('pending step with mismatched approver', () => {
    it.each(allActions)('blocks %s for non-admin when approver mismatches', (action) => {
      const result = canTransitionStep('pending', action, wrongApproverContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Access denied');
    });

    it.each(allActions)('allows %s for admin override', (action) => {
      const result = canTransitionStep('pending', action, adminContext);
      expect(result.allowed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getNextStepState
// ---------------------------------------------------------------------------

describe('getNextStepState', () => {
  it('returns complete=true when all steps are approved', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'approved' as StepState },
    ];
    const result = getNextStepState(steps, 2);
    expect(result.complete).toBe(true);
    expect(result.nextStepNumber).toBeUndefined();
  });

  it('returns complete=true when all steps are skipped', () => {
    const steps = [
      { stepNumber: 1, status: 'skipped' as StepState },
      { stepNumber: 2, status: 'skipped' as StepState },
    ];
    const result = getNextStepState(steps, 2);
    expect(result.complete).toBe(true);
  });

  it('returns complete=true for mixed approved/skipped', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'skipped' as StepState },
    ];
    const result = getNextStepState(steps, 2);
    expect(result.complete).toBe(true);
  });

  it('returns complete=false with nextStepNumber when some steps remain pending', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'pending' as StepState },
    ];
    const result = getNextStepState(steps, 1);
    expect(result.complete).toBe(false);
    expect(result.nextStepNumber).toBe(2);
  });

  it('advances currentStepNumber by 1 even if next step is already approved', () => {
    // This pins the *current* blind-advance behaviour from the codebase.
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'approved' as StepState },
      { stepNumber: 3, status: 'pending' as StepState },
    ];
    const result = getNextStepState(steps, 2);
    expect(result.complete).toBe(false);
    expect(result.nextStepNumber).toBe(3);
  });

  it('handles a single-step workflow', () => {
    const steps = [{ stepNumber: 1, status: 'approved' as StepState }];
    const result = getNextStepState(steps, 1);
    expect(result.complete).toBe(true);
  });

  it('handles empty steps array as complete', () => {
    const result = getNextStepState([], 0);
    expect(result.complete).toBe(true);
  });

  it('returns complete=false when any step is rejected', () => {
    const steps = [
      { stepNumber: 1, status: 'rejected' as StepState },
      { stepNumber: 2, status: 'approved' as StepState },
    ];
    const result = getNextStepState(steps, 1);
    expect(result.complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getWorkflowStateFromAction
// ---------------------------------------------------------------------------

describe('getWorkflowStateFromAction', () => {
  it('reject → workflow rejected regardless of step state', () => {
    const steps = [
      { stepNumber: 1, status: 'pending' as StepState },
      { stepNumber: 2, status: 'pending' as StepState },
    ];
    const result = getWorkflowStateFromAction('reject', steps, 1);
    expect(result.workflowState).toBe('rejected');
    expect(result.completedAt).toBeUndefined();
  });

  it('approve with all steps complete → workflow approved', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'approved' as StepState },
    ];
    const result = getWorkflowStateFromAction('approve', steps, 2);
    expect(result.workflowState).toBe('approved');
    expect(result.completedAt).toBeDefined();
  });

  it('skip with all steps complete → workflow approved', () => {
    const steps = [
      { stepNumber: 1, status: 'skipped' as StepState },
      { stepNumber: 2, status: 'skipped' as StepState },
    ];
    const result = getWorkflowStateFromAction('skip', steps, 2);
    expect(result.workflowState).toBe('approved');
  });

  it('approve with remaining steps → workflow in_progress', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'pending' as StepState },
    ];
    const result = getWorkflowStateFromAction('approve', steps, 1);
    expect(result.workflowState).toBe('in_progress');
    expect(result.completedAt).toBeUndefined();
  });

  it('delegate always → workflow in_progress', () => {
    const steps = [
      { stepNumber: 1, status: 'approved' as StepState },
      { stepNumber: 2, status: 'approved' as StepState },
    ];
    const result = getWorkflowStateFromAction('delegate', steps, 2);
    expect(result.workflowState).toBe('in_progress');
    expect(result.completedAt).toBeUndefined();
  });
});

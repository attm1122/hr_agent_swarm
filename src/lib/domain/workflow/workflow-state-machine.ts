/**
 * Workflow State Machine
 *
 * Pure business logic for workflow step transitions and workflow completion.
 * No data access — callers supply all context.
 */

export type WorkflowState = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
export type StepState = 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';

export interface StepTransitionContext {
  approverId: string;
  stepApproverId: string | null;
  stepApproverRole: string | null;
  userRole: string;
}

export interface StepTransitionResult {
  allowed: boolean;
  reason?: string;
}

export interface NextStepResult {
  complete: boolean;
  nextStepNumber?: number;
}

export interface WorkflowStateResult {
  workflowState: WorkflowState;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

/**
 * Determine whether a step state transition is allowed.
 *
 * Rules (derived from codebase):
 * 1. Step must be in 'pending' state to transition via any action.
 * 2. If step has a specific approverId, only that approver can act.
 * 3. Admins (role === 'admin') can override step-level assignment.
 * 4. If step has no approverId, any user with matching role can act
 *    (role check is delegated to caller; state machine only validates
 *     that an approverId exists when enforcing assignment).
 */
export function canTransitionStep(
  current: StepState,
  action: 'approve' | 'reject' | 'delegate' | 'skip',
  context: StepTransitionContext
): StepTransitionResult {
  // Rule 1: only pending steps can transition
  if (current !== 'pending') {
    return {
      allowed: false,
      reason: `Cannot ${action} a step that is already "${current}"`,
    };
  }

  // Rule 2 + 3: approver assignment check
  if (context.stepApproverId && context.stepApproverId !== context.approverId) {
    if (context.userRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Access denied: not assigned to act on this step',
      };
    }
  }

  // Reject action always requires a reason to be supplied at the call site;
  // the state machine does not validate payload, only state.

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Workflow progression
// ---------------------------------------------------------------------------

/**
 * Determine the next step state after a step action.
 *
 * Rules (derived from codebase):
 * 1. If all steps are 'approved' or 'skipped', the workflow is complete.
 * 2. Otherwise, advance to the step immediately after the current one.
 *
 * NOTE: The current codebase advances currentStep blindly by +1.
 *       This preserves that exact behaviour.
 */
export function getNextStepState(
  steps: Array<{ stepNumber: number; status: StepState }>,
  currentStepNumber: number
): NextStepResult {
  const allCompleted = steps.every(
    s => s.status === 'approved' || s.status === 'skipped'
  );

  if (allCompleted) {
    return { complete: true };
  }

  return {
    complete: false,
    nextStepNumber: currentStepNumber + 1,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level state from step action
// ---------------------------------------------------------------------------

/**
 * Determine the resulting workflow state after a step action.
 *
 * Rules (derived from codebase):
 * - approve  → 'approved' if all steps complete, otherwise 'in_progress'
 * - skip     → 'approved' if all steps complete, otherwise 'in_progress'
 * - delegate → 'in_progress' (workflow stays active)
 * - reject   → 'rejected'
 */
export function getWorkflowStateFromAction(
  action: 'approve' | 'reject' | 'delegate' | 'skip',
  steps: Array<{ stepNumber: number; status: StepState }>,
  currentStepNumber: number
): WorkflowStateResult {
  if (action === 'reject') {
    return { workflowState: 'rejected' };
  }

  if (action === 'delegate') {
    return { workflowState: 'in_progress' };
  }

  const { complete } = getNextStepState(steps, currentStepNumber);

  if (complete) {
    return {
      workflowState: 'approved',
      completedAt: new Date().toISOString(),
    };
  }

  return { workflowState: 'in_progress' };
}

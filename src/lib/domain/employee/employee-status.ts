/**
 * Employee Status Transition Domain Rules
 *
 * Pure business logic for determining whether an employee's status
 * can transition from one state to another.
 *
 * NOTE: This models the actual statuses used in the codebase:
 *   'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending'
 *
 * The task mentioned 'probation', but the codebase uses 'pending'
 * for new hires (see mock data: emp-023).
 */

export type EmployeeStatus =
  | 'active'
  | 'inactive'
  | 'on_leave'
  | 'terminated'
  | 'pending';

export interface StatusTransitionContext {
  hasOpenLeaveRequests: boolean;
  hasIncompleteOnboarding: boolean;
}

export interface StatusTransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Determine whether an employee status transition is allowed.
 *
 * Rules (derived from codebase analysis + minimal modelling):
 * 1. Same status → always allowed (no-op).
 * 2. pending → active: allowed (new hire completing onboarding).
 * 3. active → terminated: allowed ONLY if no open leave and no incomplete onboarding.
 * 4. on_leave → terminated: allowed ONLY if no open leave and no incomplete onboarding.
 * 5. inactive → terminated: allowed ONLY if no open leave and no incomplete onboarding.
 * 6. pending → terminated: allowed ONLY if no open leave and no incomplete onboarding.
 * 7. terminated → active: allowed, but generates a warning (rehire).
 * 8. active → inactive: allowed.
 * 9. inactive → active: allowed.
 * 10. active → on_leave: allowed.
 * 11. on_leave → active: allowed.
 * 12. pending → inactive: allowed.
 * 13. Any other transition: not allowed.
 */
export function canTransitionStatus(
  from: EmployeeStatus,
  to: EmployeeStatus,
  context: StatusTransitionContext
): StatusTransitionResult {
  // Rule 1: same status is always a no-op
  if (from === to) {
    return { allowed: true };
  }

  // Rule 2: pending → active (new hire completion)
  if (from === 'pending' && to === 'active') {
    return { allowed: true };
  }

  // Rules 3-6: transitions TO terminated require no open leave / incomplete onboarding
  if (to === 'terminated') {
    if (context.hasOpenLeaveRequests) {
      return {
        allowed: false,
        reason: 'Cannot terminate employee with open leave requests',
      };
    }
    if (context.hasIncompleteOnboarding) {
      return {
        allowed: false,
        reason: 'Cannot terminate employee with incomplete onboarding',
      };
    }
    return { allowed: true };
  }

  // Rule 7: terminated → active (rehire)
  if (from === 'terminated' && to === 'active') {
    return {
      allowed: true,
      reason: 'Warning: reinstating a previously terminated employee',
    };
  }

  // Rules 8-12: straightforward state transitions
  const allowedSimpleTransitions: [EmployeeStatus, EmployeeStatus][] = [
    ['active', 'inactive'],
    ['inactive', 'active'],
    ['active', 'on_leave'],
    ['on_leave', 'active'],
    ['pending', 'inactive'],
    ['inactive', 'on_leave'],
    ['on_leave', 'inactive'],
  ];

  if (
    allowedSimpleTransitions.some(
      ([f, t]) => f === from && t === to
    )
  ) {
    return { allowed: true };
  }

  // Rule 13: everything else is blocked
  return {
    allowed: false,
    reason: `Transition from "${from}" to "${to}" is not supported`,
  };
}

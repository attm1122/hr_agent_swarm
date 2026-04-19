/**
 * Leave Balance Domain Calculation
 *
 * Pure functions for computing leave balance and validating requests.
 * Business rule: remaining = entitlement - taken - pending (± carryOver).
 */

/**
 * Calculate the remaining leave balance.
 *
 * @param entitlement - Total days entitled
 * @param taken       - Days already taken
 * @param pending     - Days awaiting approval
 * @param carryOver   - Unused days carried from previous period (default 0)
 * @returns Remaining days (never negative)
 */
export function calculateLeaveBalance(
  entitlement: number,
  taken: number,
  pending: number,
  carryOver: number = 0
): number {
  return Math.max(0, entitlement + carryOver - taken - pending);
}

/**
 * Validate whether a leave request can be granted.
 *
 * @param requestedDays - Days being requested
 * @param currentBalance- Current remaining balance
 * @returns Validation result with optional reason
 */
export function validateLeaveRequest(
  requestedDays: number,
  currentBalance: number
): { valid: boolean; reason?: string } {
  if (requestedDays <= 0) {
    return { valid: false, reason: 'Requested days must be greater than 0' };
  }

  if (currentBalance <= 0) {
    return { valid: false, reason: 'No leave balance remaining' };
  }

  if (requestedDays > currentBalance) {
    return {
      valid: false,
      reason: `Insufficient balance: requested ${requestedDays} days, but only ${currentBalance} days remaining`,
    };
  }

  return { valid: true };
}

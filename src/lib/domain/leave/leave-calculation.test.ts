import { describe, it, expect } from 'vitest';
import { calculateLeaveBalance, validateLeaveRequest } from './leave-calculation';

describe('calculateLeaveBalance', () => {
  it('calculates remaining from entitlement, taken and pending', () => {
    expect(calculateLeaveBalance(20, 5, 2)).toBe(13);
  });

  it('returns zero when all entitlement is consumed', () => {
    expect(calculateLeaveBalance(20, 15, 5)).toBe(0);
  });

  it('returns zero when taken exceeds entitlement', () => {
    expect(calculateLeaveBalance(20, 25, 0)).toBe(0);
  });

  it('never returns a negative number', () => {
    expect(calculateLeaveBalance(10, 20, 5)).toBe(0);
  });

  it('includes carry-over days', () => {
    expect(calculateLeaveBalance(20, 5, 2, 5)).toBe(18);
  });

  it('defaults carry-over to zero', () => {
    expect(calculateLeaveBalance(20, 5, 2)).toBe(13);
    expect(calculateLeaveBalance(20, 5, 2, 0)).toBe(13);
  });

  it('handles zero values', () => {
    expect(calculateLeaveBalance(0, 0, 0)).toBe(0);
  });

  it('handles decimal days', () => {
    expect(calculateLeaveBalance(20.5, 5.25, 2.25)).toBeCloseTo(13, 5);
  });
});

describe('validateLeaveRequest', () => {
  it('approves request when balance is sufficient', () => {
    const result = validateLeaveRequest(5, 13);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects request when balance is insufficient', () => {
    const result = validateLeaveRequest(10, 5);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('rejects request when balance is zero', () => {
    const result = validateLeaveRequest(1, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No leave balance remaining');
  });

  it('rejects request when balance is negative (treated as zero)', () => {
    const result = validateLeaveRequest(1, -3);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No leave balance remaining');
  });

  it('rejects non-positive requested days', () => {
    expect(validateLeaveRequest(0, 10).valid).toBe(false);
    expect(validateLeaveRequest(0, 10).reason).toBe('Requested days must be greater than 0');
    expect(validateLeaveRequest(-1, 10).valid).toBe(false);
    expect(validateLeaveRequest(-1, 10).reason).toBe('Requested days must be greater than 0');
  });

  it('approves request for exactly the remaining balance', () => {
    const result = validateLeaveRequest(13, 13);
    expect(result.valid).toBe(true);
  });
});

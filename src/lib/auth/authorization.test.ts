/**
 * Authorization Policy Service — Comprehensive Unit Tests
 *
 * Coverage:
 *  1. Role → Capability matrix (exhaustive per-role)
 *  2. Scope evaluation (self/team/all/payroll, edge cases)
 *  3. Sensitivity clearance (exhaustive role × sensitivity level)
 *  4. Domain policy helpers — all 16 helpers, all 5 roles
 *  5. MANAGER vs TEAM_LEAD salary visibility (dedicated)
 *  6. PAYROLL leave + pay edit rights (dedicated)
 *  7. EMPLOYEE self-service boundaries (dedicated)
 *  8. Field stripping for sensitivity
 *  9. Negative / unauthorized access tests
 * 10. Regression / contract stability tests
 */

import { describe, it, expect } from 'vitest';
import {
  hasCapability,
  hasAllCapabilities,
  hasSensitivityClearance,
  getScopeForRole,
  isInScope,
  canViewEmployee,
  canEditEmployee,
  canViewDocument,
  canViewCompensation,
  canEditCompensation,
  canViewLeave,
  canEditLeave,
  canViewMilestone,
  canViewReview,
  canEditReview,
  canViewPerformance,
  canViewReport,
  canSendCommunication,
  canAccessAdmin,
  canRunAgent,
  canViewAudit,
  stripSensitiveFields,
  ROLE_CAPABILITIES,
  ROLE_SCOPE,
  ROLE_SENSITIVITY,
} from './authorization';
import type { AgentContext, Role, DataSensitivity } from '@/types';

// ============================================
// Test data factory
// ============================================

function makeContext(overrides: Partial<AgentContext> & { role: Role }): AgentContext {
  const { role, ...rest } = overrides;
  return {
    userId: 'user-test',
    role,
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
    employeeId: 'emp-test',
    permissions: ROLE_CAPABILITIES[role],
    sessionId: 'session-test',
    timestamp: new Date().toISOString(),
    ...rest,
  };
}

const ADMIN = () => makeContext({ role: 'admin', employeeId: 'emp-001' });
const MANAGER = () => makeContext({ role: 'manager', employeeId: 'emp-003' });
const TEAM_LEAD = () => makeContext({ role: 'team_lead', employeeId: 'emp-005' });
const EMPLOYEE = () => makeContext({ role: 'employee', employeeId: 'emp-008' });
const PAYROLL = () => makeContext({ role: 'payroll', employeeId: 'emp-019' });

const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];
const TEAM_IDS = ['emp-006', 'emp-007', 'emp-010', 'emp-022'];

// ============================================
// 1. Role → Capability mapping (exhaustive)
// ============================================

describe('Role capabilities', () => {
  it('admin has every capability defined in the system', () => {
    const adminCaps = ROLE_CAPABILITIES['admin'];
    expect(adminCaps.length).toBeGreaterThan(25);
    for (const cap of [
      'employee:read', 'employee:write', 'leave:read', 'leave:write', 'leave:approve',
      'document:read', 'document:write', 'compensation:read', 'compensation:write',
      'report:read', 'report:generate', 'compliance:read', 'compliance:write',
      'communication:read', 'communication:send', 'review:read', 'review:write',
      'performance:read', 'performance:write', 'onboarding:read', 'onboarding:write',
      'milestone:read', 'milestone:write', 'admin:read', 'admin:write',
      'integration:read', 'integration:write', 'audit:read', 'agent:execute',
    ]) {
      expect(hasCapability('admin', cap)).toBe(true);
    }
  });

  it('employee has self-service capabilities', () => {
    const allowed = ['employee:read', 'leave:read', 'document:read', 'review:read',
      'performance:read', 'milestone:read', 'communication:read', 'workflow:read',
      'policy:read', 'agent:execute'];
    const denied = ['leave:write', 'leave:approve', 'document:write', 'compensation:read',
      'compensation:write', 'report:generate', 'compliance:read', 'compliance:write',
      'communication:send', 'review:write', 'performance:write', 'onboarding:write',
      'admin:read', 'admin:write', 'integration:read', 'audit:read', 'milestone:write'];
    for (const cap of allowed) expect(hasCapability('employee', cap)).toBe(true);
    for (const cap of denied) expect(hasCapability('employee', cap)).toBe(false);
  });

  it('manager has team management capabilities', () => {
    const allowed = ['employee:read', 'leave:read', 'leave:approve', 'document:read',
      'compensation:read', 'report:read', 'communication:read', 'review:read', 'review:write',
      'performance:read', 'milestone:read', 'onboarding:read', 'agent:execute'];
    const denied = ['employee:write', 'leave:write', 'document:write', 'compensation:write',
      'report:generate', 'compliance:read', 'communication:send', 'admin:read', 'audit:read',
      'integration:read'];
    for (const cap of allowed) expect(hasCapability('manager', cap)).toBe(true);
    for (const cap of denied) expect(hasCapability('manager', cap)).toBe(false);
  });

  it('team_lead lacks compensation:read and review:write vs manager', () => {
    expect(hasCapability('team_lead', 'compensation:read')).toBe(false);
    expect(hasCapability('team_lead', 'review:write')).toBe(false);
    expect(hasCapability('manager', 'compensation:read')).toBe(true);
    expect(hasCapability('manager', 'review:write')).toBe(true);
  });

  it('team_lead shares leave:approve with manager', () => {
    expect(hasCapability('team_lead', 'leave:approve')).toBe(true);
    expect(hasCapability('manager', 'leave:approve')).toBe(true);
  });

  it('payroll has leave + compensation focus, excludes review/admin/document', () => {
    const allowed = ['employee:read', 'leave:read', 'leave:write', 'compensation:read',
      'compensation:write', 'report:read', 'report:generate', 'agent:execute'];
    const denied = ['leave:approve', 'document:read', 'review:read', 'performance:read',
      'milestone:read', 'admin:read', 'audit:read', 'compliance:read', 'communication:read'];
    for (const cap of allowed) expect(hasCapability('payroll', cap)).toBe(true);
    for (const cap of denied) expect(hasCapability('payroll', cap)).toBe(false);
  });

  it('hasAllCapabilities returns false when any single capability is missing', () => {
    expect(hasAllCapabilities('admin', ['employee:read', 'admin:write', 'audit:read'])).toBe(true);
    expect(hasAllCapabilities('employee', ['employee:read', 'admin:write'])).toBe(false);
    expect(hasAllCapabilities('payroll', ['compensation:read', 'document:read'])).toBe(false);
  });

  it('every role has agent:execute', () => {
    for (const role of ALL_ROLES) {
      expect(hasCapability(role, 'agent:execute')).toBe(true);
    }
  });
});

// ============================================
// 2. Scope evaluation (exhaustive + edge cases)
// ============================================

describe('Record scope', () => {
  it('assigns correct scopes per role', () => {
    expect(getScopeForRole('admin')).toBe('all');
    expect(getScopeForRole('manager')).toBe('team');
    expect(getScopeForRole('team_lead')).toBe('team');
    expect(getScopeForRole('employee')).toBe('self');
    expect(getScopeForRole('payroll')).toBe('payroll_scope');
  });

  it('self scope only matches own employee', () => {
    expect(isInScope('self', 'emp-008', { employeeId: 'emp-008' })).toBe(true);
    expect(isInScope('self', 'emp-009', { employeeId: 'emp-008' })).toBe(false);
  });

  it('self scope returns false when employeeId is undefined', () => {
    expect(isInScope('self', 'emp-008', {})).toBe(false);
    expect(isInScope('self', 'emp-008', { employeeId: undefined })).toBe(false);
  });

  it('team scope matches self and team members', () => {
    const ctx = { employeeId: 'emp-003', teamEmployeeIds: ['emp-005', 'emp-011'] };
    expect(isInScope('team', 'emp-003', ctx)).toBe(true);
    expect(isInScope('team', 'emp-005', ctx)).toBe(true);
    expect(isInScope('team', 'emp-011', ctx)).toBe(true);
    expect(isInScope('team', 'emp-020', ctx)).toBe(false);
  });

  it('team scope with empty teamEmployeeIds only matches self', () => {
    expect(isInScope('team', 'emp-003', { employeeId: 'emp-003', teamEmployeeIds: [] })).toBe(true);
    expect(isInScope('team', 'emp-005', { employeeId: 'emp-003', teamEmployeeIds: [] })).toBe(false);
  });

  it('team scope with undefined teamEmployeeIds only matches self', () => {
    expect(isInScope('team', 'emp-003', { employeeId: 'emp-003' })).toBe(true);
    expect(isInScope('team', 'emp-005', { employeeId: 'emp-003' })).toBe(false);
  });

  it('all scope matches any employee regardless of context', () => {
    expect(isInScope('all', 'emp-999', {})).toBe(true);
    expect(isInScope('all', 'emp-001', { employeeId: 'emp-002' })).toBe(true);
  });

  it('payroll_scope matches any employee regardless of context', () => {
    expect(isInScope('payroll_scope', 'emp-999', {})).toBe(true);
    expect(isInScope('payroll_scope', 'emp-001', { employeeId: 'emp-019' })).toBe(true);
  });
});

// ============================================
// 3. Sensitivity clearance (exhaustive matrix)
// ============================================

describe('Sensitivity clearance', () => {
  const LEVELS: DataSensitivity[] = ['self_visible', 'team_visible', 'pay_sensitive', 'hr_admin_sensitive', 'confidential'];

  it('admin has ALL clearance levels', () => {
    for (const level of LEVELS) {
      expect(hasSensitivityClearance('admin', level)).toBe(true);
    }
  });

  it('manager has self_visible + team_visible + pay_sensitive', () => {
    expect(hasSensitivityClearance('manager', 'self_visible')).toBe(true);
    expect(hasSensitivityClearance('manager', 'team_visible')).toBe(true);
    expect(hasSensitivityClearance('manager', 'pay_sensitive')).toBe(true);
    expect(hasSensitivityClearance('manager', 'hr_admin_sensitive')).toBe(false);
    expect(hasSensitivityClearance('manager', 'confidential')).toBe(false);
  });

  it('team_lead has self_visible + team_visible only', () => {
    expect(hasSensitivityClearance('team_lead', 'self_visible')).toBe(true);
    expect(hasSensitivityClearance('team_lead', 'team_visible')).toBe(true);
    expect(hasSensitivityClearance('team_lead', 'pay_sensitive')).toBe(false);
    expect(hasSensitivityClearance('team_lead', 'hr_admin_sensitive')).toBe(false);
    expect(hasSensitivityClearance('team_lead', 'confidential')).toBe(false);
  });

  it('employee has self_visible only', () => {
    expect(hasSensitivityClearance('employee', 'self_visible')).toBe(true);
    expect(hasSensitivityClearance('employee', 'team_visible')).toBe(false);
    expect(hasSensitivityClearance('employee', 'pay_sensitive')).toBe(false);
    expect(hasSensitivityClearance('employee', 'hr_admin_sensitive')).toBe(false);
    expect(hasSensitivityClearance('employee', 'confidential')).toBe(false);
  });

  it('payroll has self_visible + pay_sensitive (NOT team_visible)', () => {
    expect(hasSensitivityClearance('payroll', 'self_visible')).toBe(true);
    expect(hasSensitivityClearance('payroll', 'pay_sensitive')).toBe(true);
    expect(hasSensitivityClearance('payroll', 'team_visible')).toBe(false);
    expect(hasSensitivityClearance('payroll', 'hr_admin_sensitive')).toBe(false);
    expect(hasSensitivityClearance('payroll', 'confidential')).toBe(false);
  });
});

// ============================================
// 4. Domain policy helpers — exhaustive all roles
// ============================================

describe('canViewEmployee', () => {
  it('admin can view any employee without teamIds', () => {
    expect(canViewEmployee(ADMIN(), 'emp-999')).toBe(true);
  });

  it('employee can view only self', () => {
    const ctx = EMPLOYEE();
    expect(canViewEmployee(ctx, ctx.employeeId!)).toBe(true);
    expect(canViewEmployee(ctx, 'emp-003')).toBe(false);
    expect(canViewEmployee(ctx, 'emp-999')).toBe(false);
  });

  it('manager can view self and team, not outside', () => {
    const ctx = MANAGER();
    const teamIds = ['emp-005', 'emp-011'];
    expect(canViewEmployee(ctx, 'emp-003', teamIds)).toBe(true); // self
    expect(canViewEmployee(ctx, 'emp-005', teamIds)).toBe(true); // team
    expect(canViewEmployee(ctx, 'emp-020', teamIds)).toBe(false); // outside
    expect(canViewEmployee(ctx, 'emp-008', teamIds)).toBe(false); // skip-level
  });

  it('team_lead can view self and direct reports', () => {
    const ctx = TEAM_LEAD();
    expect(canViewEmployee(ctx, 'emp-005', TEAM_IDS)).toBe(true); // self
    expect(canViewEmployee(ctx, 'emp-006', TEAM_IDS)).toBe(true); // report
    expect(canViewEmployee(ctx, 'emp-003', TEAM_IDS)).toBe(false); // boss
    expect(canViewEmployee(ctx, 'emp-008', TEAM_IDS)).toBe(false); // skip-level
  });

  it('payroll can view any employee', () => {
    expect(canViewEmployee(PAYROLL(), 'emp-001')).toBe(true);
    expect(canViewEmployee(PAYROLL(), 'emp-999')).toBe(true);
  });
});

describe('canEditEmployee', () => {
  it('admin can edit any employee', () => {
    expect(canEditEmployee(ADMIN(), 'emp-005')).toBe(true);
    expect(canEditEmployee(ADMIN(), 'emp-999')).toBe(true);
  });

  it('employee can only edit self', () => {
    const ctx = EMPLOYEE();
    expect(canEditEmployee(ctx, ctx.employeeId!)).toBe(true);
    expect(canEditEmployee(ctx, 'emp-003')).toBe(false);
  });

  it('manager can only edit self', () => {
    const ctx = MANAGER();
    expect(canEditEmployee(ctx, ctx.employeeId!)).toBe(true);
    expect(canEditEmployee(ctx, 'emp-005')).toBe(false); // can't edit report
  });

  it('team_lead can only edit self', () => {
    const ctx = TEAM_LEAD();
    expect(canEditEmployee(ctx, ctx.employeeId!)).toBe(true);
    expect(canEditEmployee(ctx, 'emp-006')).toBe(false);
  });

  it('payroll cannot edit any employee record', () => {
    expect(canEditEmployee(PAYROLL(), 'emp-001')).toBe(false);
    expect(canEditEmployee(PAYROLL(), PAYROLL().employeeId!)).toBe(false);
  });
});

describe('canViewCompensation — MANAGER vs TEAM_LEAD salary visibility', () => {
  it('admin can view any employees compensation', () => {
    expect(canViewCompensation(ADMIN(), 'emp-005')).toBe(true);
    expect(canViewCompensation(ADMIN(), 'emp-999')).toBe(true);
  });

  it('MANAGER CAN view team compensation (has compensation:read + pay_sensitive)', () => {
    const ctx = MANAGER();
    const teamIds = ['emp-005', 'emp-011'];
    expect(canViewCompensation(ctx, 'emp-005', teamIds)).toBe(true);
    expect(canViewCompensation(ctx, 'emp-011', teamIds)).toBe(true);
  });

  it('MANAGER cannot view compensation outside team', () => {
    const ctx = MANAGER();
    expect(canViewCompensation(ctx, 'emp-020', ['emp-005', 'emp-011'])).toBe(false);
  });

  it('MANAGER CAN view own compensation', () => {
    const ctx = MANAGER();
    expect(canViewCompensation(ctx, ctx.employeeId!, ['emp-005'])).toBe(true);
  });

  it('TEAM_LEAD CANNOT view team compensation (lacks pay_sensitive)', () => {
    const ctx = TEAM_LEAD();
    expect(canViewCompensation(ctx, 'emp-006', TEAM_IDS)).toBe(false);
    expect(canViewCompensation(ctx, 'emp-007', TEAM_IDS)).toBe(false);
  });

  it('TEAM_LEAD CANNOT view even own compensation (lacks compensation:read)', () => {
    const ctx = TEAM_LEAD();
    expect(canViewCompensation(ctx, ctx.employeeId!, TEAM_IDS)).toBe(false);
  });

  it('employee cannot view any compensation', () => {
    expect(canViewCompensation(EMPLOYEE(), EMPLOYEE().employeeId!)).toBe(false);
    expect(canViewCompensation(EMPLOYEE(), 'emp-001')).toBe(false);
  });

  it('PAYROLL can view all employees compensation (payroll_scope + pay_sensitive)', () => {
    expect(canViewCompensation(PAYROLL(), 'emp-001')).toBe(true);
    expect(canViewCompensation(PAYROLL(), 'emp-020')).toBe(true);
    expect(canViewCompensation(PAYROLL(), 'emp-999')).toBe(true);
  });
});

describe('canEditCompensation', () => {
  it('admin and payroll can edit', () => {
    expect(canEditCompensation(ADMIN())).toBe(true);
    expect(canEditCompensation(PAYROLL())).toBe(true);
  });

  it('manager, team_lead, employee cannot edit', () => {
    expect(canEditCompensation(MANAGER())).toBe(false);
    expect(canEditCompensation(TEAM_LEAD())).toBe(false);
    expect(canEditCompensation(EMPLOYEE())).toBe(false);
  });
});

describe('canViewDocument', () => {
  it('admin can view any doc at any sensitivity', () => {
    for (const s of ['self_visible', 'team_visible', 'pay_sensitive', 'hr_admin_sensitive', 'confidential'] as DataSensitivity[]) {
      expect(canViewDocument(ADMIN(), 'emp-005', s)).toBe(true);
    }
  });

  it('employee can only see own self_visible docs', () => {
    const ctx = EMPLOYEE();
    expect(canViewDocument(ctx, ctx.employeeId!, 'self_visible')).toBe(true);
    expect(canViewDocument(ctx, ctx.employeeId!, 'team_visible')).toBe(false);
    expect(canViewDocument(ctx, ctx.employeeId!, 'pay_sensitive')).toBe(false);
    expect(canViewDocument(ctx, 'emp-003', 'self_visible')).toBe(false); // other emp
  });

  it('manager can see team_visible docs for team, not confidential', () => {
    const ctx = MANAGER();
    const teamIds = ['emp-005'];
    expect(canViewDocument(ctx, 'emp-005', 'self_visible', teamIds)).toBe(true);
    expect(canViewDocument(ctx, 'emp-005', 'team_visible', teamIds)).toBe(true);
    expect(canViewDocument(ctx, 'emp-005', 'pay_sensitive', teamIds)).toBe(true);
    expect(canViewDocument(ctx, 'emp-005', 'confidential', teamIds)).toBe(false);
    expect(canViewDocument(ctx, 'emp-005', 'hr_admin_sensitive', teamIds)).toBe(false);
  });

  it('team_lead can see team_visible but not pay_sensitive docs', () => {
    const ctx = TEAM_LEAD();
    expect(canViewDocument(ctx, 'emp-006', 'team_visible', TEAM_IDS)).toBe(true);
    expect(canViewDocument(ctx, 'emp-006', 'pay_sensitive', TEAM_IDS)).toBe(false);
  });

  it('payroll cannot see any documents (no document:read)', () => {
    expect(canViewDocument(PAYROLL(), 'emp-005', 'self_visible')).toBe(false);
    expect(canViewDocument(PAYROLL(), 'emp-005', 'pay_sensitive')).toBe(false);
  });
});

describe('canViewLeave (all 5 roles)', () => {
  it('employee can view own, not others', () => {
    const ctx = EMPLOYEE();
    expect(canViewLeave(ctx, ctx.employeeId!)).toBe(true);
    expect(canViewLeave(ctx, 'emp-003')).toBe(false);
  });

  it('manager can view team leave', () => {
    const ctx = MANAGER();
    expect(canViewLeave(ctx, 'emp-005', ['emp-005', 'emp-011'])).toBe(true);
    expect(canViewLeave(ctx, 'emp-020', ['emp-005', 'emp-011'])).toBe(false);
  });

  it('team_lead can view team leave', () => {
    const ctx = TEAM_LEAD();
    expect(canViewLeave(ctx, 'emp-006', TEAM_IDS)).toBe(true);
    expect(canViewLeave(ctx, 'emp-020', TEAM_IDS)).toBe(false);
  });

  it('admin can view all leave', () => {
    expect(canViewLeave(ADMIN(), 'emp-999')).toBe(true);
  });

  it('payroll can view all leave (payroll_scope)', () => {
    expect(canViewLeave(PAYROLL(), 'emp-001')).toBe(true);
    expect(canViewLeave(PAYROLL(), 'emp-999')).toBe(true);
  });
});

describe('canEditLeave — PAYROLL edit rights', () => {
  it('admin can edit leave (has leave:approve + leave:write)', () => {
    expect(canEditLeave(ADMIN())).toBe(true);
  });

  it('manager can approve leave (has leave:approve)', () => {
    expect(canEditLeave(MANAGER())).toBe(true);
  });

  it('team_lead can approve leave (has leave:approve)', () => {
    expect(canEditLeave(TEAM_LEAD())).toBe(true);
  });

  it('PAYROLL can edit leave (has leave:write)', () => {
    expect(canEditLeave(PAYROLL())).toBe(true);
  });

  it('employee cannot approve or edit leave', () => {
    expect(canEditLeave(EMPLOYEE())).toBe(false);
    expect(hasCapability('employee', 'leave:approve')).toBe(false);
    expect(hasCapability('employee', 'leave:write')).toBe(false);
  });
});

describe('canViewMilestone', () => {
  it('admin sees all', () => {
    expect(canViewMilestone(ADMIN(), 'emp-999')).toBe(true);
  });

  it('employee sees only own', () => {
    const ctx = EMPLOYEE();
    expect(canViewMilestone(ctx, ctx.employeeId!)).toBe(true);
    expect(canViewMilestone(ctx, 'emp-003')).toBe(false);
  });

  it('manager sees team', () => {
    const ctx = MANAGER();
    expect(canViewMilestone(ctx, 'emp-005', ['emp-005'])).toBe(true);
    expect(canViewMilestone(ctx, 'emp-020', ['emp-005'])).toBe(false);
  });

  it('payroll cannot see milestones (no milestone:read)', () => {
    expect(canViewMilestone(PAYROLL(), 'emp-005')).toBe(false);
  });
});

describe('canViewReview + canEditReview', () => {
  it('admin can view and edit', () => {
    expect(canViewReview(ADMIN(), 'emp-005')).toBe(true);
    expect(canEditReview(ADMIN())).toBe(true);
  });

  it('manager can view team reviews and edit (has review:write)', () => {
    const ctx = MANAGER();
    expect(canViewReview(ctx, 'emp-005', ['emp-005'])).toBe(true);
    expect(canEditReview(ctx)).toBe(true);
  });

  it('team_lead can view team reviews but NOT edit', () => {
    const ctx = TEAM_LEAD();
    expect(canViewReview(ctx, 'emp-006', TEAM_IDS)).toBe(true);
    expect(canEditReview(ctx)).toBe(false);
  });

  it('employee can view only own review', () => {
    const ctx = EMPLOYEE();
    expect(canViewReview(ctx, ctx.employeeId!)).toBe(true);
    expect(canViewReview(ctx, 'emp-003')).toBe(false);
    expect(canEditReview(ctx)).toBe(false);
  });

  it('payroll cannot view or edit reviews', () => {
    expect(canViewReview(PAYROLL(), 'emp-005')).toBe(false);
    expect(canEditReview(PAYROLL())).toBe(false);
  });
});

describe('canViewPerformance', () => {
  it('admin can view any', () => {
    expect(canViewPerformance(ADMIN(), 'emp-005')).toBe(true);
  });

  it('manager can view team performance', () => {
    expect(canViewPerformance(MANAGER(), 'emp-005', ['emp-005'])).toBe(true);
    expect(canViewPerformance(MANAGER(), 'emp-020', ['emp-005'])).toBe(false);
  });

  it('employee can view own performance', () => {
    const ctx = EMPLOYEE();
    expect(canViewPerformance(ctx, ctx.employeeId!)).toBe(true);
    expect(canViewPerformance(ctx, 'emp-003')).toBe(false);
  });

  it('payroll CANNOT view performance (no performance:read)', () => {
    expect(canViewPerformance(PAYROLL(), 'emp-005')).toBe(false);
  });
});

describe('canViewReport', () => {
  it('admin, manager, team_lead, payroll can view reports', () => {
    expect(canViewReport(ADMIN())).toBe(true);
    expect(canViewReport(MANAGER())).toBe(true);
    expect(canViewReport(TEAM_LEAD())).toBe(true);
    expect(canViewReport(PAYROLL())).toBe(true);
  });

  it('employee cannot view reports', () => {
    expect(canViewReport(EMPLOYEE())).toBe(false);
  });
});

describe('Admin-only helpers', () => {
  it('only admin can access admin panel', () => {
    for (const role of ALL_ROLES) {
      expect(canAccessAdmin(makeContext({ role }))).toBe(role === 'admin');
    }
  });

  it('only admin can view audit logs', () => {
    for (const role of ALL_ROLES) {
      expect(canViewAudit(makeContext({ role }))).toBe(role === 'admin');
    }
  });

  it('only admin can send communications', () => {
    for (const role of ALL_ROLES) {
      expect(canSendCommunication(makeContext({ role }))).toBe(role === 'admin');
    }
  });
});

describe('canRunAgent', () => {
  it('all 5 roles can execute agents', () => {
    for (const role of ALL_ROLES) {
      expect(canRunAgent(makeContext({ role }))).toBe(true);
    }
  });
});

// ============================================
// 5. MANAGER vs TEAM_LEAD salary visibility (dedicated)
// ============================================

describe('Salary visibility: MANAGER vs TEAM_LEAD', () => {
  const teamIds = ['emp-006', 'emp-007'];

  it('MANAGER has pay_sensitive clearance', () => {
    expect(ROLE_SENSITIVITY['manager']).toContain('pay_sensitive');
  });

  it('TEAM_LEAD does NOT have pay_sensitive clearance', () => {
    expect(ROLE_SENSITIVITY['team_lead']).not.toContain('pay_sensitive');
  });

  it('MANAGER has compensation:read capability', () => {
    expect(hasCapability('manager', 'compensation:read')).toBe(true);
  });

  it('TEAM_LEAD does NOT have compensation:read capability', () => {
    expect(hasCapability('team_lead', 'compensation:read')).toBe(false);
  });

  it('MANAGER can view team member compensation', () => {
    const ctx = makeContext({ role: 'manager', employeeId: 'emp-003' });
    expect(canViewCompensation(ctx, 'emp-006', teamIds)).toBe(true);
  });

  it('TEAM_LEAD CANNOT view team member compensation', () => {
    const ctx = makeContext({ role: 'team_lead', employeeId: 'emp-005' });
    expect(canViewCompensation(ctx, 'emp-006', teamIds)).toBe(false);
  });

  it('stripSensitiveFields preserves salary for MANAGER', () => {
    const record = { id: '1', salary: 100000, bonus: 5000, name: 'Test' };
    const result = stripSensitiveFields(record, ROLE_SENSITIVITY['manager']);
    expect(result.salary).toBe(100000);
    expect(result.bonus).toBe(5000);
  });

  it('stripSensitiveFields removes salary for TEAM_LEAD', () => {
    const record = { id: '1', salary: 100000, bonus: 5000, name: 'Test' };
    const result = stripSensitiveFields(record, ROLE_SENSITIVITY['team_lead']);
    expect(result.salary).toBeUndefined();
    expect(result.bonus).toBeUndefined();
    expect(result.name).toBe('Test');
  });
});

// ============================================
// 6. PAYROLL leave + pay edit rights (dedicated)
// ============================================

describe('PAYROLL leave + pay edit rights', () => {
  it('payroll can read all leave (payroll_scope)', () => {
    expect(canViewLeave(PAYROLL(), 'emp-001')).toBe(true);
    expect(canViewLeave(PAYROLL(), 'emp-020')).toBe(true);
  });

  it('payroll can edit leave (has leave:write)', () => {
    expect(canEditLeave(PAYROLL())).toBe(true);
    expect(hasCapability('payroll', 'leave:write')).toBe(true);
  });

  it('payroll can read compensation (has compensation:read + pay_sensitive)', () => {
    expect(canViewCompensation(PAYROLL(), 'emp-001')).toBe(true);
  });

  it('payroll can write compensation (has compensation:write)', () => {
    expect(canEditCompensation(PAYROLL())).toBe(true);
    expect(hasCapability('payroll', 'compensation:write')).toBe(true);
  });

  it('payroll can generate reports', () => {
    expect(hasCapability('payroll', 'report:generate')).toBe(true);
    expect(canViewReport(PAYROLL())).toBe(true);
  });

  it('payroll CANNOT access reviews or performance', () => {
    expect(hasCapability('payroll', 'review:read')).toBe(false);
    expect(hasCapability('payroll', 'performance:read')).toBe(false);
  });

  it('payroll CANNOT access documents', () => {
    expect(hasCapability('payroll', 'document:read')).toBe(false);
  });

  it('payroll CANNOT access admin', () => {
    expect(canAccessAdmin(PAYROLL())).toBe(false);
  });
});

// ============================================
// 7. EMPLOYEE self-service boundaries (dedicated)
// ============================================

describe('EMPLOYEE self-service boundaries', () => {
  const emp = () => EMPLOYEE();

  it('can read own employee profile', () => {
    expect(canViewEmployee(emp(), emp().employeeId!)).toBe(true);
  });

  it('cannot read another employees profile', () => {
    expect(canViewEmployee(emp(), 'emp-003')).toBe(false);
    expect(canViewEmployee(emp(), 'emp-001')).toBe(false);
  });

  it('can edit own employee profile', () => {
    expect(canEditEmployee(emp(), emp().employeeId!)).toBe(true);
  });

  it('cannot edit another employees profile', () => {
    expect(canEditEmployee(emp(), 'emp-003')).toBe(false);
  });

  it('can view own leave', () => {
    expect(canViewLeave(emp(), emp().employeeId!)).toBe(true);
  });

  it('cannot view others leave', () => {
    expect(canViewLeave(emp(), 'emp-003')).toBe(false);
  });

  it('cannot approve or edit leave', () => {
    expect(canEditLeave(emp())).toBe(false);
  });

  it('can view own document (self_visible only)', () => {
    expect(canViewDocument(emp(), emp().employeeId!, 'self_visible')).toBe(true);
  });

  it('cannot view own document at higher sensitivity', () => {
    expect(canViewDocument(emp(), emp().employeeId!, 'team_visible')).toBe(false);
    expect(canViewDocument(emp(), emp().employeeId!, 'pay_sensitive')).toBe(false);
  });

  it('cannot view compensation', () => {
    expect(canViewCompensation(emp(), emp().employeeId!)).toBe(false);
  });

  it('cannot edit compensation', () => {
    expect(canEditCompensation(emp())).toBe(false);
  });

  it('can view own review', () => {
    expect(canViewReview(emp(), emp().employeeId!)).toBe(true);
  });

  it('cannot edit review', () => {
    expect(canEditReview(emp())).toBe(false);
  });

  it('can view own performance', () => {
    expect(canViewPerformance(emp(), emp().employeeId!)).toBe(true);
  });

  it('cannot view reports', () => {
    expect(canViewReport(emp())).toBe(false);
  });

  it('cannot access admin', () => {
    expect(canAccessAdmin(emp())).toBe(false);
  });

  it('cannot view audit logs', () => {
    expect(canViewAudit(emp())).toBe(false);
  });

  it('cannot send communications', () => {
    expect(canSendCommunication(emp())).toBe(false);
  });

  it('can execute agents (for self-service queries)', () => {
    expect(canRunAgent(emp())).toBe(true);
  });
});

// ============================================
// 8. Field stripping
// ============================================

describe('stripSensitiveFields', () => {
  const record = {
    id: 'emp-001',
    name: 'Test',
    salary: 150000,
    baseSalary: 140000,
    bonus: 10000,
    compensation: { base: 140000 },
    payGrade: 'L5',
    stockOptions: 5000,
    totalCompensation: 200000,
    department: 'Engineering',
    email: 'test@co.com',
  };

  it('with pay_sensitive clearance: all fields preserved', () => {
    const result = stripSensitiveFields(record, ['self_visible', 'team_visible', 'pay_sensitive']);
    expect(result.salary).toBe(150000);
    expect(result.baseSalary).toBe(140000);
    expect(result.bonus).toBe(10000);
    expect(result.compensation).toEqual({ base: 140000 });
    expect(result.payGrade).toBe('L5');
    expect(result.stockOptions).toBe(5000);
    expect(result.totalCompensation).toBe(200000);
  });

  it('without pay_sensitive: all 7 pay fields removed, non-pay preserved', () => {
    const result = stripSensitiveFields(record, ['self_visible', 'team_visible']);
    expect(result.salary).toBeUndefined();
    expect(result.baseSalary).toBeUndefined();
    expect(result.bonus).toBeUndefined();
    expect(result.compensation).toBeUndefined();
    expect(result.payGrade).toBeUndefined();
    expect(result.stockOptions).toBeUndefined();
    expect(result.totalCompensation).toBeUndefined();
    expect(result.department).toBe('Engineering');
    expect(result.email).toBe('test@co.com');
    expect(result.name).toBe('Test');
    expect(result.id).toBe('emp-001');
  });

  it('employee (self_visible only): pay fields removed', () => {
    const result = stripSensitiveFields(record, ['self_visible']);
    expect(result.salary).toBeUndefined();
    expect(result.bonus).toBeUndefined();
    expect(result.department).toBe('Engineering');
  });

  it('does not mutate the original record', () => {
    const copy = { ...record };
    stripSensitiveFields(record, ['self_visible']);
    expect(record.salary).toBe(150000); // original untouched
    expect(record).toEqual(copy);
  });

  it('works on records with no pay fields (no-op)', () => {
    const simple = { id: '1', name: 'Foo', department: 'HR' };
    const result = stripSensitiveFields(simple, ['self_visible']);
    expect(result).toEqual(simple);
  });
});

// ============================================
// 9. Negative / unauthorized access tests
// ============================================

describe('Negative tests — unauthorized access', () => {
  it('EMPLOYEE cannot access another employees record', () => {
    expect(canViewEmployee(EMPLOYEE(), 'emp-001')).toBe(false);
    expect(canViewEmployee(EMPLOYEE(), 'emp-003')).toBe(false);
    expect(canViewEmployee(EMPLOYEE(), 'emp-999')).toBe(false);
  });

  it('TEAM_LEAD cannot see team salary', () => {
    const ctx = TEAM_LEAD();
    expect(canViewCompensation(ctx, 'emp-006', TEAM_IDS)).toBe(false);
    expect(canViewCompensation(ctx, 'emp-007', TEAM_IDS)).toBe(false);
    expect(canViewCompensation(ctx, ctx.employeeId!, TEAM_IDS)).toBe(false);
  });

  it('PAYROLL cannot access performance content', () => {
    expect(hasCapability('payroll', 'performance:read')).toBe(false);
    expect(canViewPerformance(PAYROLL(), 'emp-005')).toBe(false);
  });

  it('MANAGER cannot access non-team employees', () => {
    const ctx = MANAGER();
    expect(canViewEmployee(ctx, 'emp-020', ['emp-005', 'emp-011'])).toBe(false);
    expect(canViewEmployee(ctx, 'emp-008', ['emp-005', 'emp-011'])).toBe(false);
  });

  it('EMPLOYEE cannot approve leave', () => {
    expect(canEditLeave(EMPLOYEE())).toBe(false);
  });

  it('PAYROLL cannot view documents', () => {
    expect(canViewDocument(PAYROLL(), 'emp-005', 'self_visible')).toBe(false);
    expect(canViewDocument(PAYROLL(), 'emp-005', 'pay_sensitive')).toBe(false);
  });

  it('TEAM_LEAD cannot write reviews', () => {
    expect(canEditReview(TEAM_LEAD())).toBe(false);
  });

  it('no non-admin role can access admin panel', () => {
    for (const role of ['manager', 'team_lead', 'employee', 'payroll'] as Role[]) {
      expect(canAccessAdmin(makeContext({ role }))).toBe(false);
    }
  });

  it('EMPLOYEE cannot edit compensation', () => {
    expect(canEditCompensation(EMPLOYEE())).toBe(false);
  });

  it('MANAGER cannot edit compensation', () => {
    expect(canEditCompensation(MANAGER())).toBe(false);
  });

  it('TEAM_LEAD cannot edit compensation', () => {
    expect(canEditCompensation(TEAM_LEAD())).toBe(false);
  });

  it('EMPLOYEE cannot view confidential or hr_admin_sensitive docs', () => {
    const ctx = EMPLOYEE();
    expect(canViewDocument(ctx, ctx.employeeId!, 'confidential')).toBe(false);
    expect(canViewDocument(ctx, ctx.employeeId!, 'hr_admin_sensitive')).toBe(false);
  });

  it('MANAGER cannot view confidential docs even for team members', () => {
    const ctx = MANAGER();
    expect(canViewDocument(ctx, 'emp-005', 'confidential', ['emp-005'])).toBe(false);
  });
});

// ============================================
// 10. Regression / contract stability
// ============================================

describe('Regression tests — RBAC contract stability', () => {
  it('ROLE_CAPABILITIES covers all 5 roles', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_CAPABILITIES[role]).toBeDefined();
      expect(ROLE_CAPABILITIES[role].length).toBeGreaterThan(0);
    }
  });

  it('ROLE_SCOPE covers all 5 roles', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_SCOPE[role]).toBeDefined();
    }
  });

  it('ROLE_SENSITIVITY covers all 5 roles with at least self_visible', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_SENSITIVITY[role]).toBeDefined();
      expect(ROLE_SENSITIVITY[role]).toContain('self_visible');
    }
  });

  it('admin always has a superset of all other roles capabilities', () => {
    const adminCaps = new Set(ROLE_CAPABILITIES['admin']);
    for (const role of ['manager', 'team_lead', 'employee', 'payroll'] as Role[]) {
      for (const cap of ROLE_CAPABILITIES[role]) {
        expect(adminCaps.has(cap)).toBe(true);
      }
    }
  });

  it('admin always has a superset of all sensitivity levels', () => {
    const adminSens = new Set(ROLE_SENSITIVITY['admin']);
    for (const role of ['manager', 'team_lead', 'employee', 'payroll'] as Role[]) {
      for (const s of ROLE_SENSITIVITY[role]) {
        expect(adminSens.has(s)).toBe(true);
      }
    }
  });
});

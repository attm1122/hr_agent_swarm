/**
 * Authorization Policy Service
 * Central, deterministic, unit-testable authorization layer.
 *
 * Every authorization decision flows through: Role → Capabilities → Scope → Sensitivity
 * UI, API, agents, and coordinator all call these helpers — no inline role checks.
 */

import type { Role, RecordScope, DataSensitivity, AgentContext } from '@/types';

// ============================================
// Role → Capabilities mapping
// ============================================

export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  admin: [
    'employee:read', 'employee:write',
    'leave:read', 'leave:write', 'leave:approve',
    'document:read', 'document:write',
    'compensation:read', 'compensation:write',
    'report:read', 'report:generate',
    'compliance:read', 'compliance:write',
    'communication:read', 'communication:send',
    'review:read', 'review:write',
    'performance:read', 'performance:write',
    'onboarding:read', 'onboarding:write', 'onboarding:admin',
    'offboarding:read', 'offboarding:write', 'offboarding:admin',
    'workflow:read', 'workflow:write', 'workflow:approve', 'workflow:admin',
    'policy:read', 'policy:write', 'policy:admin',
    'milestone:read', 'milestone:write',
    'admin:read', 'admin:write',
    'integration:read', 'integration:write',
    'audit:read',
    'agent:execute',
  ],
  manager: [
    'employee:read',
    'leave:read', 'leave:approve',
    'document:read',
    'compensation:read',
    'report:read',
    'communication:read',
    'review:read', 'review:write',
    'performance:read',
    'milestone:read',
    'onboarding:read', 'onboarding:write',
    'offboarding:read', 'offboarding:write',
    'workflow:read', 'workflow:approve',
    'policy:read',
    'agent:execute',
  ],
  team_lead: [
    'employee:read',
    'leave:read', 'leave:approve',
    'document:read',
    'report:read',
    'communication:read',
    'review:read',
    'performance:read',
    'milestone:read',
    'onboarding:read',
    'offboarding:read',
    'workflow:read', 'workflow:approve',
    'policy:read',
    'agent:execute',
  ],
  employee: [
    'employee:read',
    'leave:read',
    'document:read',
    'review:read',
    'performance:read',
    'milestone:read',
    'communication:read',
    // Note: employee does NOT have onboarding:read - that's HR/manager function
    'offboarding:read',  // Employee can see their own offboarding status
    'workflow:read',
    'policy:read',
    'agent:execute',
  ],
  payroll: [
    'employee:read',
    'leave:read', 'leave:write',
    'compensation:read', 'compensation:write',
    'report:read', 'report:generate',
    'offboarding:read', 'offboarding:write',
    'workflow:read',
    'policy:read',
    'agent:execute',
  ],
};

// ============================================
// Role → Scope mapping
// ============================================

export const ROLE_SCOPE: Record<Role, RecordScope> = {
  admin: 'all',
  manager: 'team',
  team_lead: 'team',
  employee: 'self',
  payroll: 'payroll_scope',
};

// ============================================
// Role → Sensitivity clearance
// ============================================

export const ROLE_SENSITIVITY: Record<Role, DataSensitivity[]> = {
  admin: ['self_visible', 'team_visible', 'pay_sensitive', 'hr_admin_sensitive', 'confidential'],
  manager: ['self_visible', 'team_visible', 'pay_sensitive'],
  team_lead: ['self_visible', 'team_visible'],
  employee: ['self_visible'],
  payroll: ['self_visible', 'pay_sensitive'],
};

// ============================================
// Capability checks
// ============================================

export function hasCapability(role: Role, capability: string): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function hasAllCapabilities(role: Role, capabilities: string[]): boolean {
  return capabilities.every(c => hasCapability(role, c));
}

export function hasSensitivityClearance(role: Role, sensitivity: DataSensitivity): boolean {
  return ROLE_SENSITIVITY[role]?.includes(sensitivity) ?? false;
}

export function getScopeForRole(role: Role): RecordScope {
  return ROLE_SCOPE[role];
}

// ============================================
// Record scope helpers
// ============================================

export function isInScope(
  scope: RecordScope,
  recordEmployeeId: string,
  ctx: { employeeId?: string; teamEmployeeIds?: string[] }
): boolean {
  switch (scope) {
    case 'self':
      return recordEmployeeId === ctx.employeeId;
    case 'team':
      return recordEmployeeId === ctx.employeeId ||
        (ctx.teamEmployeeIds?.includes(recordEmployeeId) ?? false);
    case 'all':
    case 'payroll_scope':
      return true;
    default:
      return false;
  }
}

// ============================================
// Domain policy helpers
// ============================================

export function canViewEmployee(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'employee:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canEditEmployee(ctx: AgentContext, targetEmployeeId: string): boolean {
  if (ctx.role === 'admin') return true;
  if (ctx.role === 'employee' || ctx.role === 'manager' || ctx.role === 'team_lead') {
    return targetEmployeeId === ctx.employeeId;
  }
  return false;
}

export function canViewDocument(ctx: AgentContext, docEmployeeId: string, docSensitivity: DataSensitivity, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'document:read')) return false;
  if (!hasSensitivityClearance(ctx.role, docSensitivity)) return false;
  return isInScope(ctx.scope, docEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canViewCompensation(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'compensation:read')) return false;
  if (!hasSensitivityClearance(ctx.role, 'pay_sensitive')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canEditCompensation(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'compensation:write');
}

export function canViewLeave(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'leave:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canEditLeave(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'leave:approve') || hasCapability(ctx.role, 'leave:write');
}

export function canViewMilestone(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'milestone:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canViewReview(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'review:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canEditReview(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'review:write');
}

export function canViewPerformance(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'performance:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canViewReport(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'report:read');
}

export function canSendCommunication(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'communication:send');
}

export function canAccessAdmin(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'admin:read');
}

export function canRunAgent(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'agent:execute');
}

export function canViewAudit(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'audit:read');
}

// ============================================
// Onboarding domain policy helpers
// ============================================

export function canViewOnboarding(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'onboarding:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canCreateOnboarding(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'onboarding:write');
}

export function canManageOnboarding(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'onboarding:admin') || hasCapability(ctx.role, 'onboarding:write');
}

// ============================================
// Offboarding domain policy helpers
// ============================================

export function canViewOffboarding(ctx: AgentContext, targetEmployeeId: string, teamIds?: string[]): boolean {
  if (!hasCapability(ctx.role, 'offboarding:read')) return false;
  return isInScope(ctx.scope, targetEmployeeId, {
    employeeId: ctx.employeeId,
    teamEmployeeIds: teamIds,
  });
}

export function canCreateOffboarding(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'offboarding:write');
}

export function canManageOffboarding(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'offboarding:admin') || hasCapability(ctx.role, 'offboarding:write');
}

// ============================================
// Workflow / Approvals domain policy helpers
// ============================================

export function canViewWorkflow(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'workflow:read');
}

export function canCreateWorkflow(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'workflow:write');
}

export function canApproveWorkflow(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'workflow:approve') || hasCapability(ctx.role, 'workflow:admin');
}

export function canManageWorkflow(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'workflow:admin');
}

// ============================================
// Knowledge / Policy domain policy helpers
// ============================================

export function canViewPolicy(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'policy:read');
}

export function canManagePolicy(ctx: AgentContext): boolean {
  return hasCapability(ctx.role, 'policy:admin') || hasCapability(ctx.role, 'policy:write');
}

// ============================================
// Field stripping for sensitivity
// ============================================

const PAY_SENSITIVE_FIELDS = ['salary', 'baseSalary', 'bonus', 'compensation', 'payGrade', 'stockOptions', 'totalCompensation', 'ssn', 'dateOfBirth', 'bankAccount', 'taxId'];

export function stripSensitiveFields<T extends Record<string, unknown>>(
  record: T,
  clearance: DataSensitivity[]
): T {
  if (clearance.includes('pay_sensitive')) return record;

  const stripped = { ...record };
  for (const field of PAY_SENSITIVE_FIELDS) {
    if (field in stripped) {
      delete stripped[field];
    }
  }
  // Recurse into nested plain objects so wrapped structures (e.g. employee_summary)
  // have sensitive fields stripped at every depth.
  for (const key of Object.keys(stripped)) {
    const val = stripped[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      (stripped as Record<string, unknown>)[key] = stripSensitiveFields(
        val as Record<string, unknown>,
        clearance,
      );
    }
  }
  return stripped;
}

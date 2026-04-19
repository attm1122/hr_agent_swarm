/**
 * Employee Service Layer
 * 
 * Provides RBAC-aware employee data access.
 * All employee data operations flow through this service.
 * 
 * Architecture:
 * - Pages/UI call this service, not data layer directly
 * - Service enforces: scope filtering, field stripping, pagination
 * - Service calls agents for complex operations
 */

import type { Employee } from '@/lib/domain/employee/types';
import type { AgentContext } from '@/types';
import { employees, getEmployeeById, getTeamById, getPositionById, getManagerForEmployee, leaveRequests } from '@/lib/data/mock-data';
import { onboardingPlans } from '@/lib/data/onboarding-store';
import { stripSensitiveFields, isInScope } from '@/lib/auth/authorization';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';
import { canTransitionStatus, type EmployeeStatus } from '@/lib/domain/employee/employee-status';

export interface EmployeeListOptions {
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending' | 'all';
  teamId?: string;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeListResult {
  employees: Partial<Employee>[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get list of employees with RBAC filtering
 * 
 * - ADMIN: All employees, all fields
 * - MANAGER: Team employees only, sensitive fields based on pay_sensitive
 * - TEAM_LEAD: Team employees only, no salary fields
 * - EMPLOYEE: Self only, limited fields
 * - PAYROLL: All employees, compensation fields only
 */
export async function getEmployeeList(
  context: AgentContext,
  options: EmployeeListOptions = {}
): Promise<EmployeeListResult> {
  const { scope, sensitivityClearance } = context;
  const { status = 'active', searchQuery, page = 1, limit = 50 } = options;
  const scopeContext = buildRecordScopeContext(context);

  // Get base dataset based on scope
  let filteredEmployees = employees;

  if (scope === 'self' || scope === 'team') {
    filteredEmployees = employees.filter((employee) =>
      isInScope(scope, employee.id, scopeContext)
    );
  }
  // scope === 'all' or 'payroll_scope' - no filtering (ADMIN/PAYROLL)

  // Apply status filter
  if (status && status !== 'all') {
    filteredEmployees = filteredEmployees.filter(e => e.status === status);
  }

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredEmployees = filteredEmployees.filter(e => 
      e.firstName.toLowerCase().includes(query) ||
      e.lastName.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query)
    );
  }

  const total = filteredEmployees.length;

  // Apply pagination
  const start = (page - 1) * limit;
  const paginatedEmployees = filteredEmployees.slice(start, start + limit);

  // Apply field-level security
  const sanitizedEmployees = paginatedEmployees.map(emp => {
    const baseRecord = { ...emp } as Record<string, unknown>;
    return stripSensitiveFields(baseRecord, sensitivityClearance);
  });

  return {
    employees: sanitizedEmployees,
    total,
    page,
    limit,
  };
}

/**
 * Get single employee with RBAC enforcement
 * 
 * Throws/returns error if user cannot access this employee
 */
export async function getEmployee(
  context: AgentContext,
  targetEmployeeId: string
): Promise<Partial<Employee> | null> {
  const { scope, sensitivityClearance } = context;
  const scopeContext = buildRecordScopeContext(context);

  // Check scope authorization
  const hasAccess = isInScope(scope, targetEmployeeId, { 
    employeeId: scopeContext.employeeId,
    teamEmployeeIds: scopeContext.teamEmployeeIds,
  });

  if (!hasAccess) {
    return null; // Return null instead of throwing to allow graceful handling
  }

  const employee = getEmployeeById(targetEmployeeId);
  if (!employee) {
    return null;
  }

  // Apply field-level security
  const baseRecord = { ...employee } as Record<string, unknown>;
  return stripSensitiveFields(baseRecord, sensitivityClearance) as Partial<Employee>;
}

/**
 * Get employee count for dashboard metrics
 * 
 * Returns count based on user's scope
 */
export async function getEmployeeCount(
  context: AgentContext,
  options: { status?: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending' | 'all' } = {}
): Promise<number> {
  const { status = 'active' } = options;
  const result = await getEmployeeList(context, { status, limit: 1000 });
  return result.total;
}

/**
 * Get employee with full details (for profile page)
 * 
 * Includes: employee data, team, position, manager info
 */
export async function getEmployeeProfile(
  context: AgentContext,
  targetEmployeeId: string
): Promise<{
  employee: Partial<Employee> | null;
  team: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; name: string } | null;
}> {
  const employee = await getEmployee(context, targetEmployeeId);
  
  if (!employee) {
    return { employee: null, team: null, position: null, manager: null };
  }

  const fullEmployee = getEmployeeById(targetEmployeeId);
  
  const team = fullEmployee?.teamId ? getTeamById(fullEmployee.teamId) : null;
  const position = fullEmployee?.positionId ? getPositionById(fullEmployee.positionId) : null;
  const manager = fullEmployee ? getManagerForEmployee(fullEmployee) : null;

  return {
    employee,
    team: team ? { id: team.id, name: team.name } : null,
    position: position ? { id: position.id, title: position.title } : null,
    manager: manager ? { 
      id: manager.id, 
      name: `${manager.firstName} ${manager.lastName}` 
    } : null,
  };
}

export interface UpdateEmployeeStatusResult {
  success: boolean;
  previousStatus?: EmployeeStatus;
  newStatus?: EmployeeStatus;
  reason?: string;
}

/**
 * Update an employee's status with domain-rule validation.
 *
 * Enforces:
 * - RBAC scope check
 * - Status transition business rules (via domain layer)
 * - Context-aware blocking (open leave, incomplete onboarding)
 */
export async function updateEmployeeStatus(
  context: AgentContext,
  targetEmployeeId: string,
  newStatus: EmployeeStatus
): Promise<UpdateEmployeeStatusResult> {
  const { scope } = context;
  const scopeContext = buildRecordScopeContext(context);

  // RBAC check
  const hasAccess = isInScope(scope, targetEmployeeId, {
    employeeId: scopeContext.employeeId,
    teamEmployeeIds: scopeContext.teamEmployeeIds,
  });

  if (!hasAccess) {
    return { success: false, reason: 'Access denied' };
  }

  const employee = getEmployeeById(targetEmployeeId);
  if (!employee) {
    return { success: false, reason: 'Employee not found' };
  }

  const currentStatus = employee.status as EmployeeStatus;

  // Build transition context
  const hasOpenLeaveRequests = leaveRequests.some(
    (lr) => lr.employeeId === targetEmployeeId && lr.status === 'pending'
  );
  const hasIncompleteOnboarding = onboardingPlans.some(
    (p) => p.employeeId === targetEmployeeId && p.status !== 'completed'
  );

  const transitionResult = canTransitionStatus(currentStatus, newStatus, {
    hasOpenLeaveRequests,
    hasIncompleteOnboarding,
  });

  if (!transitionResult.allowed) {
    return {
      success: false,
      previousStatus: currentStatus,
      newStatus,
      reason: transitionResult.reason,
    };
  }

  // Apply the update
  employee.status = newStatus;
  employee.updatedAt = new Date().toISOString();

  return {
    success: true,
    previousStatus: currentStatus,
    newStatus,
    reason: transitionResult.reason,
  };
}

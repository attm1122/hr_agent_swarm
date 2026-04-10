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

import type { Employee, Role, AgentContext } from '@/types';
import { employees, getEmployeeById, getTeamById, getPositionById, getManagerForEmployee } from '@/lib/data/mock-data';
import { ROLE_SCOPE, ROLE_SENSITIVITY, stripSensitiveFields, isInScope } from '@/lib/auth/authorization';
import { getCoordinator } from '@/lib/agents';

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
  const { role, scope, sensitivityClearance, employeeId } = context;
  const { status = 'active', searchQuery, page = 1, limit = 50 } = options;

  // Get base dataset based on scope
  let filteredEmployees = employees;

  if (scope === 'self' && employeeId) {
    // Employee sees only self
    filteredEmployees = employees.filter(e => e.id === employeeId);
  } else if (scope === 'team' && employeeId) {
    // Manager/Team Lead see their team
    // Get team members including self
    const manager = getManagerForEmployee(getEmployeeById(employeeId)!);
    const teamId = getEmployeeById(employeeId)?.teamId;
    
    if (teamId) {
      filteredEmployees = employees.filter(e => 
        e.teamId === teamId || e.id === employeeId
      );
    } else if (manager) {
      // Fallback: if no team, show manager's direct reports
      filteredEmployees = employees.filter(e => 
        e.managerId === employeeId || e.id === employeeId
      );
    } else {
      // No team, no reports - just self
      filteredEmployees = employees.filter(e => e.id === employeeId);
    }
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
  const { role, scope, sensitivityClearance, employeeId } = context;

  // Check scope authorization
  const hasAccess = isInScope(scope, targetEmployeeId, { 
    employeeId: employeeId || '',
    teamEmployeeIds: getTeamEmployeeIds(context)
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

// Helper: Get team member IDs for scope checking
function getTeamEmployeeIds(context: AgentContext): string[] {
  const { employeeId } = context;
  if (!employeeId) return [];

  const employee = getEmployeeById(employeeId);
  if (!employee) return [];

  // Get direct reports
  const directReports = employees.filter(e => e.managerId === employeeId);
  
  // Get team members
  const teamMembers = employee.teamId 
    ? employees.filter(e => e.teamId === employee.teamId && e.id !== employeeId)
    : [];

  return [
    ...directReports.map(e => e.id),
    ...teamMembers.map(e => e.id),
  ];
}

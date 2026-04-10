/**
 * Employee Service Tests
 * 
 * Tests RBAC enforcement in the employee service layer:
 * - Role-based data access
 * - Scope filtering (self/team/all)
 * - Field-level security (sensitive field stripping)
 * - Pagination and filtering
 * 
 * Security Focus:
 * - No data leakage across role boundaries
 * - Sensitive fields properly stripped
 * - Scope restrictions enforced
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmployeeList, getEmployee, getEmployeeCount, getEmployeeProfile } from './employee.service';
import type { AgentContext, Employee, Role, DataSensitivity } from '@/types';

// Mock the mock-data module
vi.mock('@/lib/data/mock-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/mock-data')>('@/lib/data/mock-data');
  return {
    ...actual,
    employees: [
      {
        id: 'emp-1',
        firstName: 'John',
        lastName: 'Admin',
        email: 'john@company.com',
        status: 'active',
        hireDate: '2020-01-01',
        salary: 150000,
        teamId: 'team-1',
        positionId: 'pos-1',
        managerId: null,
      },
      {
        id: 'emp-2',
        firstName: 'Jane',
        lastName: 'Manager',
        email: 'jane@company.com',
        status: 'active',
        hireDate: '2021-03-15',
        salary: 120000,
        teamId: 'team-1',
        positionId: 'pos-2',
        managerId: 'emp-1',
      },
      {
        id: 'emp-3',
        firstName: 'Bob',
        lastName: 'Employee',
        email: 'bob@company.com',
        status: 'active',
        hireDate: '2022-06-01',
        salary: 80000,
        teamId: 'team-1',
        positionId: 'pos-3',
        managerId: 'emp-2',
      },
      {
        id: 'emp-4',
        firstName: 'Alice',
        lastName: 'Other',
        email: 'alice@other.com',
        status: 'active',
        hireDate: '2022-08-15',
        salary: 85000,
        teamId: 'team-2',
        positionId: 'pos-3',
        managerId: null,
      },
    ] as Employee[],
    teams: [
      { id: 'team-1', name: 'Engineering', managerId: 'emp-2' },
      { id: 'team-2', name: 'Marketing', managerId: 'emp-4' },
    ],
    positions: [
      { id: 'pos-1', title: 'CEO', level: 'executive' },
      { id: 'pos-2', title: 'Engineering Manager', level: 'manager' },
      { id: 'pos-3', title: 'Developer', level: 'individual' },
    ],
    getEmployeeById: vi.fn((id: string) => {
      const employees = [
        { id: 'emp-1', firstName: 'John', lastName: 'Admin', email: 'john@company.com', status: 'active', hireDate: '2020-01-01', salary: 150000, teamId: 'team-1', positionId: 'pos-1', managerId: null },
        { id: 'emp-2', firstName: 'Jane', lastName: 'Manager', email: 'jane@company.com', status: 'active', hireDate: '2021-03-15', salary: 120000, teamId: 'team-1', positionId: 'pos-2', managerId: 'emp-1' },
        { id: 'emp-3', firstName: 'Bob', lastName: 'Employee', email: 'bob@company.com', status: 'active', hireDate: '2022-06-01', salary: 80000, teamId: 'team-1', positionId: 'pos-3', managerId: 'emp-2' },
        { id: 'emp-4', firstName: 'Alice', lastName: 'Other', email: 'alice@other.com', status: 'active', hireDate: '2022-08-15', salary: 85000, teamId: 'team-2', positionId: 'pos-3', managerId: null },
      ];
      return employees.find(e => e.id === id) || null;
    }),
    getTeamById: vi.fn((id: string) => {
      const teams = [
        { id: 'team-1', name: 'Engineering', managerId: 'emp-2' },
        { id: 'team-2', name: 'Marketing', managerId: 'emp-4' },
      ];
      return teams.find(t => t.id === id) || null;
    }),
    getPositionById: vi.fn((id: string) => {
      const positions = [
        { id: 'pos-1', title: 'CEO', level: 'executive' },
        { id: 'pos-2', title: 'Engineering Manager', level: 'manager' },
        { id: 'pos-3', title: 'Developer', level: 'individual' },
      ];
      return positions.find(p => p.id === id) || null;
    }),
    getManagerForEmployee: vi.fn((employee: Employee) => {
      if (!employee.managerId) return null;
      const managers = [
        { id: 'emp-1', firstName: 'John', lastName: 'Admin', email: 'john@company.com' },
        { id: 'emp-2', firstName: 'Jane', lastName: 'Manager', email: 'jane@company.com' },
      ];
      return managers.find(m => m.id === employee.managerId) || null;
    }),
  };
});

// Helper to create test contexts
function createTestContext(
  role: Role,
  employeeId: string,
  scope: 'self' | 'team' | 'all' | 'payroll_scope' = 'self',
  sensitivityClearance: DataSensitivity[] = ['self_visible']
): AgentContext {
  return {
    userId: employeeId,
    role,
    permissions: [],
    scope,
    employeeId,
    sessionId: `session-${employeeId}`,
    timestamp: new Date().toISOString(),
    sensitivityClearance,
  };
}

describe('Employee Service - RBAC Security', () => {
  describe('ADMIN role', () => {
    it('sees all employees with full scope', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible', 'team_visible', 'pay_sensitive', 'hr_admin_sensitive', 'confidential']);
      
      const result = await getEmployeeList(context);
      
      expect(result.employees).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it('sees salary fields with high sensitivity clearance', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible', 'team_visible', 'pay_sensitive', 'hr_admin_sensitive', 'confidential']);
      
      const result = await getEmployeeList(context);
      const firstEmployee = result.employees[0] as Record<string, unknown>;
      
      // Admin with high clearance should see salary
      expect(firstEmployee.salary).toBeDefined();
    });

    it('can access any employee by ID', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible', 'team_visible', 'pay_sensitive']);
      
      const employee = await getEmployee(context, 'emp-4'); // Different team
      
      expect(employee).not.toBeNull();
      expect(employee?.firstName).toBe('Alice');
    });
  });

  describe('EMPLOYEE role (self-service)', () => {
    it('sees only self with self scope', async () => {
      const context = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      const result = await getEmployeeList(context);
      
      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].id).toBe('emp-3');
    });

    it('does NOT see salary field with low sensitivity clearance', async () => {
      const context = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      const result = await getEmployeeList(context);
      const employee = result.employees[0] as Record<string, unknown>;
      
      // Employee with low clearance should NOT see salary
      expect(employee.salary).toBeUndefined();
    });

    it('cannot access other employees by ID', async () => {
      const context = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      const employee = await getEmployee(context, 'emp-1');
      
      expect(employee).toBeNull();
    });

    it('profile includes team and position info for self', async () => {
      const context = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      const profile = await getEmployeeProfile(context, 'emp-3');
      
      expect(profile.employee).not.toBeNull();
      expect(profile.team).not.toBeNull();
      expect(profile.team?.name).toBe('Engineering');
      expect(profile.position?.title).toBe('Developer');
      expect(profile.manager).not.toBeNull();
    });
  });

  describe('MANAGER role (team scope)', () => {
    it('sees team members with team scope', async () => {
      const context = createTestContext('manager', 'emp-2', 'team', ['self_visible', 'team_visible']);
      
      const result = await getEmployeeList(context);
      
      // Manager should see self + team members in same team
      // emp-2 (Jane) is in team-1, so should see emp-1, emp-2, emp-3
      expect(result.employees.length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT see employees from other teams', async () => {
      const context = createTestContext('manager', 'emp-2', 'team', ['self_visible', 'team_visible']);
      
      const result = await getEmployeeList(context);
      const employeeIds = result.employees.map(e => e.id);
      
      // emp-4 is in team-2, manager in team-1 should not see them
      expect(employeeIds).not.toContain('emp-4');
    });

    it('does NOT see salary fields without high sensitivity clearance', async () => {
      const context = createTestContext('manager', 'emp-2', 'team', ['self_visible', 'team_visible']);
      
      const result = await getEmployeeList(context);
      const firstEmployee = result.employees[0] as Record<string, unknown>;
      
      // Manager without high clearance should NOT see salary
      expect(firstEmployee.salary).toBeUndefined();
    });
  });

  describe('PAYROLL role (payroll scope)', () => {
    it('sees all employees for payroll processing', async () => {
      const context = createTestContext('payroll', 'emp-payroll', 'payroll_scope', ['self_visible', 'team_visible', 'pay_sensitive']);
      
      const result = await getEmployeeList(context);
      
      // Payroll sees all employees
      expect(result.employees.length).toBeGreaterThanOrEqual(4);
    });

    it('sees salary fields for payroll processing', async () => {
      const context = createTestContext('payroll', 'emp-payroll', 'payroll_scope', ['self_visible', 'team_visible', 'pay_sensitive']);
      
      const result = await getEmployeeList(context);
      const firstEmployee = result.employees[0] as Record<string, unknown>;
      
      // Payroll should see salary
      expect(firstEmployee.salary).toBeDefined();
    });
  });

  describe('Pagination and Filtering', () => {
    it('respects limit parameter', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible']);
      
      const result = await getEmployeeList(context, { limit: 2 });
      
      expect(result.employees.length).toBeLessThanOrEqual(2);
      expect(result.limit).toBe(2);
    });

    it('respects page parameter', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible']);
      
      const page1 = await getEmployeeList(context, { page: 1, limit: 2 });
      const page2 = await getEmployeeList(context, { page: 2, limit: 2 });
      
      // Page 2 should have different employees than page 1
      const page1Ids = page1.employees.map(e => e.id);
      const page2Ids = page2.employees.map(e => e.id);
      
      // No overlap between pages
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('filters by status', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible']);
      
      const result = await getEmployeeList(context, { status: 'active' });
      
      // All mocked employees are active
      expect(result.employees.length).toBeGreaterThanOrEqual(1);
    });

    it('searches by name', async () => {
      const context = createTestContext('admin', 'emp-1', 'all', ['self_visible']);
      
      const result = await getEmployeeList(context, { searchQuery: 'Jane' });
      
      expect(result.employees.length).toBe(1);
      expect(result.employees[0].firstName).toBe('Jane');
    });
  });

  describe('Employee Count', () => {
    it('returns count respecting scope', async () => {
      const adminContext = createTestContext('admin', 'emp-1', 'all', ['self_visible']);
      const employeeContext = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      const adminCount = await getEmployeeCount(adminContext);
      const employeeCount = await getEmployeeCount(employeeContext);
      
      expect(adminCount).toBe(4); // Admin sees all
      expect(employeeCount).toBe(1); // Employee sees only self
    });
  });

  describe('CRITICAL: Data Leakage Prevention', () => {
    it('CRITICAL: Employee cannot see manager salary', async () => {
      const context = createTestContext('employee', 'emp-3', 'self', ['self_visible']);
      
      // Even if we tried to access manager data, salary should be stripped
      // Note: getEmployee should return null for other employees anyway
      const manager = await getEmployee(context, 'emp-2');
      expect(manager).toBeNull();
    });

    it('CRITICAL: Manager cannot see other team salaries', async () => {
      const context = createTestContext('manager', 'emp-2', 'team', ['self_visible', 'team_visible']);
      
      const result = await getEmployeeList(context);
      
      // Check no employee has salary field
      for (const emp of result.employees) {
        const record = emp as Record<string, unknown>;
        expect(record.salary).toBeUndefined();
      }
    });

    it('CRITICAL: Cross-team access is blocked', async () => {
      // Manager of team-1 tries to access employee from team-2
      const context = createTestContext('manager', 'emp-2', 'team', ['self_visible', 'team_visible']);
      
      const otherTeamEmployee = await getEmployee(context, 'emp-4');
      
      expect(otherTeamEmployee).toBeNull();
    });
  });
});

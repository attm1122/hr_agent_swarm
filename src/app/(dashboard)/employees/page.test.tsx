import { describe, it, expect } from 'vitest';
import { employees, teams, positions, getTeamById, getPositionById, getManagerForEmployee } from '@/lib/data/mock-data';
import type { Employee } from '@/types';
import { getFullYearsSinceDateOnly, toDateOnlyString } from '@/lib/domain/shared/date-value';

// Test the data logic used by the employees page

describe('Employee Directory - data logic', () => {
  it('filters out terminated employees', () => {
    const activeEmployees = employees.filter(e => e.status !== 'terminated');
    expect(activeEmployees.length).toBeGreaterThan(0);
    activeEmployees.forEach(e => {
      expect(e.status).not.toBe('terminated');
    });
  });

  it('active employee count matches expectations', () => {
    const activeEmployees = employees.filter(e => e.status !== 'terminated');
    expect(activeEmployees.length).toBe(employees.length); // no terminated in mock data
  });

  it('teams array is available for filter options', () => {
    expect(teams.length).toBeGreaterThan(0);
    teams.forEach(team => {
      expect(team.id).toBeTruthy();
      expect(team.name).toBeTruthy();
    });
  });

  it('positions are resolvable for each employee', () => {
    employees.forEach(emp => {
      if (emp.positionId) {
        const pos = getPositionById(emp.positionId);
        expect(pos).toBeDefined();
        expect(pos!.title).toBeTruthy();
      }
    });
  });

  it('teams are resolvable for each employee', () => {
    employees.forEach(emp => {
      if (emp.teamId) {
        const team = getTeamById(emp.teamId);
        expect(team).toBeDefined();
        expect(team!.name).toBeTruthy();
      }
    });
  });

  it('manager names are resolvable', () => {
    employees.forEach(emp => {
      const manager = getManagerForEmployee(emp);
      if (emp.managerId) {
        expect(manager).toBeDefined();
        expect(manager!.firstName).toBeTruthy();
        expect(manager!.lastName).toBeTruthy();
      } else {
        expect(manager).toBeUndefined();
      }
    });
  });
});

describe('Employee Directory - StatusBadge logic', () => {
  const styles: Record<Employee['status'], string> = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-700 border-slate-200',
    on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
    terminated: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const labels: Record<Employee['status'], string> = {
    active: 'Active',
    inactive: 'Inactive',
    on_leave: 'On Leave',
    terminated: 'Terminated',
    pending: 'Pending',
  };

  it('all statuses have a style mapping', () => {
    const allStatuses: Employee['status'][] = ['active', 'inactive', 'on_leave', 'terminated', 'pending'];
    allStatuses.forEach(status => {
      expect(styles[status]).toBeTruthy();
      expect(labels[status]).toBeTruthy();
    });
  });

  it('all statuses have readable labels', () => {
    expect(labels.active).toBe('Active');
    expect(labels.inactive).toBe('Inactive');
    expect(labels.on_leave).toBe('On Leave');
    expect(labels.terminated).toBe('Terminated');
    expect(labels.pending).toBe('Pending');
  });
});

describe('Employee Directory - tenure calculation', () => {
  it('computes years of service correctly', () => {
    const hireDate = '2020-01-01';
    const years = getFullYearsSinceDateOnly(hireDate, new Date('2026-04-10T12:00:00Z'), 'UTC');
    expect(years).toBeGreaterThanOrEqual(5);
  });

  it('computes zero years for recent hire', () => {
    const now = new Date('2026-04-10T12:00:00Z');
    const recentHire = toDateOnlyString(now, 'UTC');
    const years = getFullYearsSinceDateOnly(recentHire, now, 'UTC');
    expect(years).toBe(0);
  });
});

describe('Employee Directory - initials', () => {
  it('generates correct initials from employee names', () => {
    employees.forEach(emp => {
      const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
      expect(initials.length).toBe(2);
      expect(initials).toMatch(/^[A-Z]{2}$/);
    });
  });
});

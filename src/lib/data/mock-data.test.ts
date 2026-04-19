import { describe, it, expect } from 'vitest';
import {
  employees,
  teams,
  positions,
  documents,
  leaveRequests,
  milestones,
  actionQueue,
  getEmployeeFullName,
  getEmployeeById,
  getTeamById,
  getPositionById,
  getManagerForEmployee,
  getDirectReports,
} from './mock-data';

// ============================================
// Data Integrity Tests
// ============================================

describe('teams', () => {
  it('has expected number of teams', () => {
    expect(teams.length).toBe(8);
  });

  it('has unique team IDs', () => {
    const ids = teams.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique team codes', () => {
    const codes = teams.map(t => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all teams have required fields', () => {
    teams.forEach(team => {
      expect(team.id).toBeTruthy();
      expect(team.name).toBeTruthy();
      expect(team.code).toBeTruthy();
      expect(team.department).toBeTruthy();
      expect(team.createdAt).toBeTruthy();
      expect(team.updatedAt).toBeTruthy();
    });
  });

  it('parent team references are valid', () => {
    const teamIds = new Set(teams.map(t => t.id));
    teams.forEach(team => {
      if (team.parentTeamId) {
        expect(teamIds.has(team.parentTeamId)).toBe(true);
      }
    });
  });
});

describe('positions', () => {
  it('has expected number of positions', () => {
    expect(positions.length).toBe(15);
  });

  it('has unique position IDs', () => {
    const ids = positions.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all positions have required fields', () => {
    positions.forEach(pos => {
      expect(pos.id).toBeTruthy();
      expect(pos.title).toBeTruthy();
      expect(pos.level).toBeTruthy();
      expect(pos.department).toBeTruthy();
      expect(pos.jobFamily).toBeTruthy();
    });
  });
});

describe('employees', () => {
  it('has expected number of employees', () => {
    expect(employees.length).toBe(23);
  });

  it('has unique employee IDs', () => {
    const ids = employees.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique employee emails', () => {
    const emails = employees.map(e => e.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('has unique employee numbers', () => {
    const nums = employees.map(e => e.employeeNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('all employees have required fields', () => {
    employees.forEach(emp => {
      expect(emp.id).toBeTruthy();
      expect(emp.email).toBeTruthy();
      expect(emp.firstName).toBeTruthy();
      expect(emp.lastName).toBeTruthy();
      expect(emp.employeeNumber).toBeTruthy();
      expect(emp.hireDate).toBeTruthy();
      expect(emp.status).toBeTruthy();
      expect(emp.employmentType).toBeTruthy();
      expect(emp.createdAt).toBeTruthy();
      expect(emp.updatedAt).toBeTruthy();
    });
  });

  it('all employee statuses are valid', () => {
    const validStatuses = ['active', 'inactive', 'on_leave', 'terminated', 'pending'];
    employees.forEach(emp => {
      expect(validStatuses).toContain(emp.status);
    });
  });

  it('all employment types are valid', () => {
    const validTypes = ['full_time', 'part_time', 'contract', 'intern'];
    employees.forEach(emp => {
      expect(validTypes).toContain(emp.employmentType);
    });
  });

  it('all team references are valid', () => {
    const teamIds = new Set(teams.map(t => t.id));
    employees.forEach(emp => {
      if (emp.teamId) {
        expect(teamIds.has(emp.teamId)).toBe(true);
      }
    });
  });

  it('all position references are valid', () => {
    const posIds = new Set(positions.map(p => p.id));
    employees.forEach(emp => {
      if (emp.positionId) {
        expect(posIds.has(emp.positionId)).toBe(true);
      }
    });
  });

  it('all manager references are valid', () => {
    const empIds = new Set(employees.map(e => e.id));
    employees.forEach(emp => {
      if (emp.managerId) {
        expect(empIds.has(emp.managerId)).toBe(true);
      }
    });
  });

  it('no employee manages themselves', () => {
    employees.forEach(emp => {
      expect(emp.managerId).not.toBe(emp.id);
    });
  });

  it('has mix of statuses', () => {
    const statuses = new Set(employees.map(e => e.status));
    expect(statuses.has('active')).toBe(true);
    expect(statuses.has('on_leave')).toBe(true);
    expect(statuses.has('pending')).toBe(true);
  });

  it('work locations are valid when set', () => {
    const validLocations = ['onsite', 'remote', 'hybrid', null];
    employees.forEach(emp => {
      expect(validLocations).toContain(emp.workLocation);
    });
  });

  it('hire dates are valid date strings', () => {
    employees.forEach(emp => {
      expect(new Date(emp.hireDate).toString()).not.toBe('Invalid Date');
    });
  });
});

describe('documents', () => {
  it('has at least one document', () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it('all documents reference valid employees', () => {
    const empIds = new Set(employees.map(e => e.id));
    documents.forEach(doc => {
      expect(empIds.has(doc.employeeId)).toBe(true);
    });
  });

  it('all documents have valid categories', () => {
    const validCategories = ['contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other'];
    documents.forEach(doc => {
      expect(validCategories).toContain(doc.category);
    });
  });

  it('all documents have valid statuses', () => {
    const validStatuses = ['active', 'expired', 'expiring', 'missing'];
    documents.forEach(doc => {
      expect(validStatuses).toContain(doc.status);
    });
  });

  it('expiring documents have expiry dates', () => {
    documents.filter(d => d.status === 'expiring').forEach(doc => {
      expect(doc.expiresAt).toBeTruthy();
    });
  });

  it('file sizes are positive', () => {
    documents.forEach(doc => {
      expect(doc.fileSize).toBeGreaterThan(0);
    });
  });
});

describe('leaveRequests', () => {
  it('has leave requests', () => {
    expect(leaveRequests.length).toBeGreaterThan(0);
  });

  it('all leave requests reference valid employees', () => {
    const empIds = new Set(employees.map(e => e.id));
    leaveRequests.forEach(lr => {
      expect(empIds.has(lr.employeeId)).toBe(true);
    });
  });

  it('all leave types are valid', () => {
    const validTypes = ['annual', 'sick', 'personal', 'parental', 'bereavement', 'unpaid', 'other'];
    leaveRequests.forEach(lr => {
      expect(validTypes).toContain(lr.leaveType);
    });
  });

  it('all statuses are valid', () => {
    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'cancelled'];
    leaveRequests.forEach(lr => {
      expect(validStatuses).toContain(lr.status);
    });
  });

  it('days requested is positive', () => {
    leaveRequests.forEach(lr => {
      expect(lr.daysRequested).toBeGreaterThan(0);
    });
  });

  it('end date is after or equal to start date', () => {
    leaveRequests.forEach(lr => {
      expect(new Date(lr.endDate).getTime()).toBeGreaterThanOrEqual(new Date(lr.startDate).getTime());
    });
  });

  it('approved requests have approver info', () => {
    leaveRequests.filter(lr => lr.status === 'approved').forEach(lr => {
      expect(lr.approvedBy).toBeTruthy();
      expect(lr.approvedAt).toBeTruthy();
    });
  });

  it('pending requests have no approver', () => {
    leaveRequests.filter(lr => lr.status === 'pending').forEach(lr => {
      expect(lr.approvedBy).toBeNull();
      expect(lr.approvedAt).toBeNull();
    });
  });
});

describe('milestones', () => {
  it('has milestones', () => {
    expect(milestones.length).toBeGreaterThan(0);
  });

  it('all milestones reference valid employees', () => {
    const empIds = new Set(employees.map(e => e.id));
    milestones.forEach(ms => {
      expect(empIds.has(ms.employeeId)).toBe(true);
    });
  });

  it('all milestone types are valid', () => {
    const validTypes = ['work_anniversary', 'probation_end', 'visa_expiry', 'certification_expiry', 'contract_expiry', 'performance_review'];
    milestones.forEach(ms => {
      expect(validTypes).toContain(ms.milestoneType);
    });
  });

  it('all statuses are valid', () => {
    const validStatuses = ['upcoming', 'due', 'overdue', 'completed', 'acknowledged'];
    milestones.forEach(ms => {
      expect(validStatuses).toContain(ms.status);
    });
  });

  it('alert days before is positive', () => {
    milestones.forEach(ms => {
      expect(ms.alertDaysBefore).toBeGreaterThan(0);
    });
  });

  it('completed milestones have acknowledgement info', () => {
    milestones.filter(ms => ms.status === 'completed').forEach(ms => {
      expect(ms.acknowledgedAt).toBeTruthy();
      expect(ms.acknowledgedBy).toBeTruthy();
    });
  });

  it('has work anniversary milestones', () => {
    const anniversaries = milestones.filter(m => m.milestoneType === 'work_anniversary');
    expect(anniversaries.length).toBeGreaterThan(0);
  });

  it('has probation milestones', () => {
    const probation = milestones.filter(m => m.milestoneType === 'probation_end');
    expect(probation.length).toBeGreaterThan(0);
  });
});

describe('actionQueue', () => {
  it('has action items', () => {
    expect(actionQueue.length).toBeGreaterThan(0);
  });

  it('all action items have required fields', () => {
    actionQueue.forEach(item => {
      expect(item.id).toBeTruthy();
      expect(item.type).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.priority).toBeTruthy();
      expect(item.entityType).toBeTruthy();
      expect(item.entityId).toBeTruthy();
    });
  });

  it('all priorities are valid', () => {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    actionQueue.forEach(item => {
      expect(validPriorities).toContain(item.priority);
    });
  });

  it('has mix of action types', () => {
    const types = new Set(actionQueue.map(a => a.type));
    expect(types.size).toBeGreaterThan(1);
  });

  it('has a critical priority item', () => {
    const critical = actionQueue.filter(a => a.priority === 'critical');
    expect(critical.length).toBeGreaterThan(0);
  });
});

// ============================================
// Helper Function Tests
// ============================================

describe('getEmployeeFullName', () => {
  it('returns first and last name', () => {
    const emp = employees[0];
    expect(getEmployeeFullName(emp)).toBe(`${emp.firstName} ${emp.lastName}`);
  });

  it('returns correct name for Sarah Chen', () => {
    const sarah = employees.find(e => e.id === 'emp-001')!;
    expect(getEmployeeFullName(sarah)).toBe('Sarah Chen');
  });
});

describe('getEmployeeById', () => {
  it('returns the correct employee', () => {
    const result = getEmployeeById('emp-001');
    expect(result).toBeDefined();
    expect(result!.firstName).toBe('Sarah');
    expect(result!.lastName).toBe('Chen');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getEmployeeById('emp-999')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getEmployeeById('')).toBeUndefined();
  });

  it('finds all employees by their IDs', () => {
    employees.forEach(emp => {
      expect(getEmployeeById(emp.id)).toBe(emp);
    });
  });
});

describe('getTeamById', () => {
  it('returns the correct team', () => {
    const result = getTeamById('team-eng');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Engineering');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getTeamById('team-999')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getTeamById('')).toBeUndefined();
  });

  it('finds all teams by their IDs', () => {
    teams.forEach(team => {
      expect(getTeamById(team.id)).toBe(team);
    });
  });
});

describe('getPositionById', () => {
  it('returns the correct position', () => {
    const result = getPositionById('pos-001');
    expect(result).toBeDefined();
    expect(result!.title).toBe('Chief People Officer');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getPositionById('pos-999')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getPositionById('')).toBeUndefined();
  });

  it('finds all positions by their IDs', () => {
    positions.forEach(pos => {
      expect(getPositionById(pos.id)).toBe(pos);
    });
  });
});

describe('getManagerForEmployee', () => {
  it('returns the manager for an employee with a manager', () => {
    const emp = employees.find(e => e.id === 'emp-002')!;
    const manager = getManagerForEmployee(emp);
    expect(manager).toBeDefined();
    expect(manager!.id).toBe('emp-001');
  });

  it('returns undefined for employees without a manager', () => {
    const emp = employees.find(e => e.id === 'emp-001')!;
    expect(getManagerForEmployee(emp)).toBeUndefined();
  });

  it('returns undefined for employee with null managerId', () => {
    const emp = employees.find(e => e.managerId === null)!;
    expect(getManagerForEmployee(emp)).toBeUndefined();
  });
});

describe('getDirectReports', () => {
  it('returns direct reports for a manager', () => {
    const reports = getDirectReports('emp-001');
    expect(reports.length).toBeGreaterThan(0);
    reports.forEach(r => {
      expect(r.managerId).toBe('emp-001');
    });
  });

  it('returns empty array for non-manager', () => {
    const reports = getDirectReports('emp-999');
    expect(reports).toEqual([]);
  });

  it('excludes terminated employees', () => {
    const reports = getDirectReports('emp-001');
    reports.forEach(r => {
      expect(r.status).not.toBe('terminated');
    });
  });

  it('returns correct reports for CTO (emp-003)', () => {
    const reports = getDirectReports('emp-003');
    expect(reports.length).toBeGreaterThan(0);
    const reportIds = reports.map(r => r.id);
    expect(reportIds).toContain('emp-005');
    expect(reportIds).toContain('emp-011');
  });

  it('returns empty for employees with no reports', () => {
    const reports = getDirectReports('emp-008');
    expect(reports).toEqual([]);
  });
});

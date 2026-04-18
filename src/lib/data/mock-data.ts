/**
 * Mock Data - Premium POC Seed Data
 * Lightweight, type-safe, presentation-quality
 */

import type { 
  Employee, Team, Position, EmployeeDocument, LeaveBalance, 
  LeaveRequest, CompensationRecord, Milestone, ReviewCycle, 
  ReviewInstance, Goal, ActionItem 
} from '@/types';

// ============================================
// Teams
// ============================================

export const teams: Team[] = [
  { id: 'team-eng', name: 'Engineering', code: 'ENG', parentTeamId: null, department: 'Technology', costCenter: 'CC-100', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-prod', name: 'Product', code: 'PROD', parentTeamId: null, department: 'Product', costCenter: 'CC-200', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-dsgn', name: 'Design', code: 'DSGN', parentTeamId: 'team-prod', department: 'Product', costCenter: 'CC-200', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-sales', name: 'Sales', code: 'SALES', parentTeamId: null, department: 'Revenue', costCenter: 'CC-300', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-mkt', name: 'Marketing', code: 'MKT', parentTeamId: null, department: 'Revenue', costCenter: 'CC-300', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-hr', name: 'HR', code: 'HR', parentTeamId: null, department: 'People', costCenter: 'CC-400', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-fin', name: 'Finance', code: 'FIN', parentTeamId: null, department: 'Operations', costCenter: 'CC-500', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'team-cs', name: 'Customer Success', code: 'CS', parentTeamId: null, department: 'Revenue', costCenter: 'CC-300', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
];

// ============================================
// Positions
// ============================================

export const positions: Position[] = [
  { id: 'pos-001', title: 'Chief People Officer', level: 'L7', department: 'People', jobFamily: 'Executive', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-002', title: 'HR Manager', level: 'L5', department: 'People', jobFamily: 'HR', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-003', title: 'CTO', level: 'L7', department: 'Technology', jobFamily: 'Executive', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-004', title: 'VP of Sales', level: 'L6', department: 'Revenue', jobFamily: 'Executive', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-005', title: 'Staff Engineer', level: 'L5', department: 'Technology', jobFamily: 'Engineering', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-006', title: 'Senior Software Engineer', level: 'L4', department: 'Technology', jobFamily: 'Engineering', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-007', title: 'Software Engineer', level: 'L3', department: 'Technology', jobFamily: 'Engineering', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-008', title: 'Senior Product Manager', level: 'L5', department: 'Product', jobFamily: 'Product', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-009', title: 'Product Manager', level: 'L4', department: 'Product', jobFamily: 'Product', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-010', title: 'UX Designer', level: 'L3', department: 'Product', jobFamily: 'Design', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-011', title: 'Account Executive', level: 'L4', department: 'Revenue', jobFamily: 'Sales', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-012', title: 'Sales Representative', level: 'L3', department: 'Revenue', jobFamily: 'Sales', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-013', title: 'Marketing Manager', level: 'L4', department: 'Revenue', jobFamily: 'Marketing', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-014', title: 'Financial Analyst', level: 'L3', department: 'Operations', jobFamily: 'Finance', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
  { id: 'pos-015', title: 'Customer Success Manager', level: 'L4', department: 'Revenue', jobFamily: 'CS', createdAt: '2020-01-01', updatedAt: '2024-01-01' },
];

// ============================================
// Employees
// ============================================

export const employees: Employee[] = [
  { id: 'emp-001', email: 'sarah.chen@company.com', firstName: 'Sarah', lastName: 'Chen', employeeNumber: 'EMP001', hireDate: '2020-01-15', terminationDate: null, status: 'active', teamId: 'team-hr', positionId: 'pos-001', managerId: null, workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2020-01-15', updatedAt: '2024-01-01' },
  { id: 'emp-002', email: 'michael.rodriguez@company.com', firstName: 'Michael', lastName: 'Rodriguez', employeeNumber: 'EMP002', hireDate: '2021-03-01', terminationDate: null, status: 'active', teamId: 'team-hr', positionId: 'pos-002', managerId: 'emp-001', workLocation: 'onsite', employmentType: 'full_time', createdAt: '2021-03-01', updatedAt: '2024-01-01' },
  { id: 'emp-003', email: 'david.park@company.com', firstName: 'David', lastName: 'Park', employeeNumber: 'EMP003', hireDate: '2019-06-01', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-003', managerId: null, workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2019-06-01', updatedAt: '2024-01-01' },
  { id: 'emp-004', email: 'jennifer.walsh@company.com', firstName: 'Jennifer', lastName: 'Walsh', employeeNumber: 'EMP004', hireDate: '2020-08-15', terminationDate: null, status: 'active', teamId: 'team-sales', positionId: 'pos-004', managerId: null, workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2020-08-15', updatedAt: '2024-01-01' },
  { id: 'emp-005', email: 'alex.thompson@company.com', firstName: 'Alex', lastName: 'Thompson', employeeNumber: 'EMP005', hireDate: '2021-06-20', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-005', managerId: 'emp-003', workLocation: 'remote', employmentType: 'full_time', createdAt: '2021-06-20', updatedAt: '2024-01-01' },
  { id: 'emp-006', email: 'emily.nakamura@company.com', firstName: 'Emily', lastName: 'Nakamura', employeeNumber: 'EMP006', hireDate: '2022-02-14', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-006', managerId: 'emp-005', workLocation: 'remote', employmentType: 'full_time', createdAt: '2022-02-14', updatedAt: '2024-01-01' },
  { id: 'emp-007', email: 'james.wilson@company.com', firstName: 'James', lastName: 'Wilson', employeeNumber: 'EMP007', hireDate: '2022-09-05', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-005', workLocation: 'onsite', employmentType: 'full_time', createdAt: '2022-09-05', updatedAt: '2024-01-01' },
  { id: 'emp-008', email: 'priya.sharma@company.com', firstName: 'Priya', lastName: 'Sharma', employeeNumber: 'EMP008', hireDate: '2023-01-10', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-006', workLocation: 'remote', employmentType: 'full_time', createdAt: '2023-01-10', updatedAt: '2024-01-01' },
  { id: 'emp-009', email: 'marcus.johnson@company.com', firstName: 'Marcus', lastName: 'Johnson', employeeNumber: 'EMP009', hireDate: '2023-04-15', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-006', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2023-04-15', updatedAt: '2024-01-01' },
  { id: 'emp-010', email: 'sofia.garcia@company.com', firstName: 'Sofia', lastName: 'Garcia', employeeNumber: 'EMP010', hireDate: '2023-07-01', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-005', workLocation: 'remote', employmentType: 'full_time', createdAt: '2023-07-01', updatedAt: '2024-01-01' },
  { id: 'emp-011', email: 'rachel.kim@company.com', firstName: 'Rachel', lastName: 'Kim', employeeNumber: 'EMP011', hireDate: '2021-11-20', terminationDate: null, status: 'active', teamId: 'team-prod', positionId: 'pos-008', managerId: 'emp-003', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2021-11-20', updatedAt: '2024-01-01' },
  { id: 'emp-012', email: 'daniel.lee@company.com', firstName: 'Daniel', lastName: 'Lee', employeeNumber: 'EMP012', hireDate: '2022-05-16', terminationDate: null, status: 'active', teamId: 'team-prod', positionId: 'pos-009', managerId: 'emp-011', workLocation: 'onsite', employmentType: 'full_time', createdAt: '2022-05-16', updatedAt: '2024-01-01' },
  { id: 'emp-013', email: 'olivia.martinez@company.com', firstName: 'Olivia', lastName: 'Martinez', employeeNumber: 'EMP013', hireDate: '2023-03-01', terminationDate: null, status: 'active', teamId: 'team-dsgn', positionId: 'pos-010', managerId: 'emp-011', workLocation: 'remote', employmentType: 'full_time', createdAt: '2023-03-01', updatedAt: '2024-01-01' },
  { id: 'emp-014', email: 'ryan.taylor@company.com', firstName: 'Ryan', lastName: 'Taylor', employeeNumber: 'EMP014', hireDate: '2021-01-10', terminationDate: null, status: 'active', teamId: 'team-sales', positionId: 'pos-011', managerId: 'emp-004', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2021-01-10', updatedAt: '2024-01-01' },
  { id: 'emp-015', email: 'amanda.foster@company.com', firstName: 'Amanda', lastName: 'Foster', employeeNumber: 'EMP015', hireDate: '2022-08-22', terminationDate: null, status: 'active', teamId: 'team-sales', positionId: 'pos-011', managerId: 'emp-004', workLocation: 'onsite', employmentType: 'full_time', createdAt: '2022-08-22', updatedAt: '2024-01-01' },
  { id: 'emp-016', email: 'kevin.obrien@company.com', firstName: 'Kevin', lastName: 'OBrien', employeeNumber: 'EMP016', hireDate: '2023-05-15', terminationDate: null, status: 'active', teamId: 'team-sales', positionId: 'pos-012', managerId: 'emp-015', workLocation: 'remote', employmentType: 'full_time', createdAt: '2023-05-15', updatedAt: '2024-01-01' },
  { id: 'emp-017', email: 'laura.zhang@company.com', firstName: 'Laura', lastName: 'Zhang', employeeNumber: 'EMP017', hireDate: '2022-01-15', terminationDate: null, status: 'active', teamId: 'team-mkt', positionId: 'pos-013', managerId: 'emp-004', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2022-01-15', updatedAt: '2024-01-01' },
  { id: 'emp-018', email: 'chris.anderson@company.com', firstName: 'Chris', lastName: 'Anderson', employeeNumber: 'EMP018', hireDate: '2023-09-01', terminationDate: null, status: 'active', teamId: 'team-mkt', positionId: 'pos-013', managerId: 'emp-017', workLocation: 'remote', employmentType: 'full_time', createdAt: '2023-09-01', updatedAt: '2024-01-01' },
  { id: 'emp-019', email: 'nicole.brown@company.com', firstName: 'Nicole', lastName: 'Brown', employeeNumber: 'EMP019', hireDate: '2021-04-12', terminationDate: null, status: 'active', teamId: 'team-fin', positionId: 'pos-014', managerId: 'emp-001', workLocation: 'onsite', employmentType: 'full_time', createdAt: '2021-04-12', updatedAt: '2024-01-01' },
  { id: 'emp-020', email: 'brandon.davis@company.com', firstName: 'Brandon', lastName: 'Davis', employeeNumber: 'EMP020', hireDate: '2022-06-01', terminationDate: null, status: 'active', teamId: 'team-cs', positionId: 'pos-015', managerId: 'emp-004', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2022-06-01', updatedAt: '2024-01-01' },
  { id: 'emp-021', email: 'zara.patel@company.com', firstName: 'Zara', lastName: 'Patel', employeeNumber: 'EMP021', hireDate: '2025-02-01', terminationDate: null, status: 'active', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-006', workLocation: 'remote', employmentType: 'full_time', createdAt: '2025-02-01', updatedAt: '2024-01-01' },
  { id: 'emp-022', email: 'thomas.harris@company.com', firstName: 'Thomas', lastName: 'Harris', employeeNumber: 'EMP022', hireDate: '2020-11-01', terminationDate: null, status: 'on_leave', teamId: 'team-eng', positionId: 'pos-006', managerId: 'emp-005', workLocation: 'remote', employmentType: 'full_time', createdAt: '2020-11-01', updatedAt: '2024-01-01' },
  { id: 'emp-023', email: 'jessica.wong@company.com', firstName: 'Jessica', lastName: 'Wong', employeeNumber: 'EMP023', hireDate: '2025-04-01', terminationDate: null, status: 'pending', teamId: 'team-eng', positionId: 'pos-007', managerId: 'emp-006', workLocation: 'hybrid', employmentType: 'full_time', createdAt: '2025-04-01', updatedAt: '2024-01-01' },
];

// ============================================
// Documents
// ============================================

export const documents: EmployeeDocument[] = [
  { id: 'doc-001', employeeId: 'emp-021', sourceId: 'm365-001', sourcePath: '/employees/EMP021/AWS_Certification.pdf', fileName: 'AWS_Certification.pdf', fileType: 'application/pdf', fileSize: 1500000, category: 'certification', status: 'expiring', uploadedAt: '2022-01-15', expiresAt: '2026-05-09', extractedData: { certification_name: 'AWS Solutions Architect', level: 'Professional' }, createdAt: '2022-01-15', updatedAt: '2026-01-01' },
];

// ============================================
// Leave Requests
// ============================================

export const leaveRequests: LeaveRequest[] = [
  { id: 'lr-001', employeeId: 'emp-008', leaveType: 'annual', startDate: '2026-04-15', endDate: '2026-04-20', daysRequested: 5, reason: 'Family vacation', status: 'pending', approvedBy: null, approvedAt: null, rejectionReason: null, createdAt: '2026-03-20', updatedAt: '2026-03-20' },
  { id: 'lr-002', employeeId: 'emp-009', leaveType: 'annual', startDate: '2026-05-01', endDate: '2026-05-05', daysRequested: 4, reason: 'Personal trip', status: 'pending', approvedBy: null, approvedAt: null, rejectionReason: null, createdAt: '2026-03-25', updatedAt: '2026-03-25' },
  { id: 'lr-003', employeeId: 'emp-021', leaveType: 'sick', startDate: '2026-04-02', endDate: '2026-04-03', daysRequested: 2, reason: 'Not feeling well', status: 'pending', approvedBy: null, approvedAt: null, rejectionReason: null, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 'lr-004', employeeId: 'emp-016', leaveType: 'annual', startDate: '2026-04-10', endDate: '2026-04-14', daysRequested: 4, reason: 'Wedding', status: 'approved', approvedBy: 'emp-015', approvedAt: '2026-04-01T10:30:00Z', rejectionReason: null, createdAt: '2026-03-15', updatedAt: '2026-04-01' },
];

// ============================================
// Milestones
// ============================================

export const milestones: Milestone[] = [
  { id: 'ms-001', employeeId: 'emp-021', milestoneType: 'probation_end', milestoneDate: '2026-05-01', description: 'Probation Period Ends', alertDaysBefore: 14, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2026-02-01', updatedAt: '2026-02-01' },
  { id: 'ms-002', employeeId: 'emp-023', milestoneType: 'probation_end', milestoneDate: '2026-07-01', description: 'Probation Period Ends', alertDaysBefore: 14, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 'ms-003', employeeId: 'emp-023', milestoneType: 'visa_expiry', milestoneDate: '2026-06-01', description: 'Work Visa Expiry', alertDaysBefore: 60, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { id: 'ms-004', employeeId: 'emp-008', milestoneType: 'visa_expiry', milestoneDate: '2026-10-01', description: 'Work Visa Expiry', alertDaysBefore: 60, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2023-01-10', updatedAt: '2026-01-10' },
  { id: 'ms-005', employeeId: 'emp-003', milestoneType: 'work_anniversary', milestoneDate: '2026-06-01', description: '7 Year Service Anniversary', alertDaysBefore: 30, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2025-06-01', updatedAt: '2026-01-01' },
  { id: 'ms-006', employeeId: 'emp-001', milestoneType: 'work_anniversary', milestoneDate: '2026-01-15', description: '6 Year Service Anniversary', alertDaysBefore: 30, status: 'completed', acknowledgedAt: '2026-01-10', acknowledgedBy: 'emp-002', createdAt: '2025-01-15', updatedAt: '2026-01-10' },
  { id: 'ms-007', employeeId: 'emp-004', milestoneType: 'work_anniversary', milestoneDate: '2026-08-15', description: '6 Year Service Anniversary', alertDaysBefore: 30, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2025-08-15', updatedAt: '2026-01-15' },
  { id: 'ms-008', employeeId: 'emp-005', milestoneType: 'work_anniversary', milestoneDate: '2026-06-20', description: '5 Year Service Anniversary', alertDaysBefore: 30, status: 'upcoming', acknowledgedAt: null, acknowledgedBy: null, createdAt: '2025-06-20', updatedAt: '2026-01-20' },
];

// ============================================
// Dashboard Action Items
// ============================================

export const actionQueue: ActionItem[] = [
  { id: 'lr-001', type: 'leave_request', title: 'Leave request from Priya Sharma', description: 'Annual leave: Apr 15 to Apr 20 (5 days)', priority: 'medium', dueDate: '2026-04-15', assignee: 'priya.sharma@company.com', entityType: 'leave', entityId: 'lr-001' },
  { id: 'lr-002', type: 'leave_request', title: 'Leave request from Marcus Johnson', description: 'Annual leave: May 1 to May 5 (4 days)', priority: 'medium', dueDate: '2026-05-01', assignee: 'marcus.johnson@company.com', entityType: 'leave', entityId: 'lr-002' },
  { id: 'lr-003', type: 'leave_request', title: 'Leave request from Zara Patel', description: 'Sick leave: Apr 2 to Apr 3 (2 days)', priority: 'high', dueDate: '2026-04-02', assignee: 'zara.patel@company.com', entityType: 'leave', entityId: 'lr-003' },
  { id: 'doc-001', type: 'expiring_document', title: 'Document expiring: AWS_Certification.pdf', description: 'Zara Patel - expires 2026-05-09', priority: 'high', dueDate: '2026-05-09', entityType: 'document', entityId: 'doc-001' },
  { id: 'ms-001', type: 'milestone', title: 'Probation Period Ends', description: 'Zara Patel - 2026-05-01', priority: 'high', dueDate: '2026-05-01', entityType: 'milestone', entityId: 'ms-001' },
  { id: 'ms-003', type: 'milestone', title: 'Work Visa Expiry', description: 'Jessica Wong - 2026-06-01', priority: 'critical', dueDate: '2026-06-01', entityType: 'milestone', entityId: 'ms-003' },
];

// ============================================
// Helper Functions
// ============================================

export function getEmployeeFullName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`;
}

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find(e => e.id === id);
}

export function getTeamById(id: string): Team | undefined {
  return teams.find(t => t.id === id);
}

export function getPositionById(id: string): Position | undefined {
  return positions.find(p => p.id === id);
}

export function getManagerForEmployee(employee: Employee): Employee | undefined {
  return employee.managerId ? getEmployeeById(employee.managerId) : undefined;
}

export function getDirectReports(managerId: string): Employee[] {
  return employees.filter(e => e.managerId === managerId && e.status !== 'terminated');
}

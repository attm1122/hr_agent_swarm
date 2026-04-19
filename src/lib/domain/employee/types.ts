/**
 * Employee Domain Types
 */

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  hireDate: string;
  terminationDate: string | null;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending';
  teamId: string | null;
  positionId: string | null;
  managerId: string | null;
  workLocation: 'onsite' | 'remote' | 'hybrid' | null;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  parentTeamId: string | null;
  department: string;
  costCenter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  title: string;
  level: string;
  department: string;
  jobFamily: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  position: string;
  team: string;
  status: Employee['status'];
  hireDate: string;
  manager?: string;
}

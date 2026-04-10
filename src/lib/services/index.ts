/**
 * Services Layer Index
 * 
 * Central export for all domain services.
 * Services enforce RBAC and business logic between UI and data layers.
 */

export {
  getEmployeeList,
  getEmployee,
  getEmployeeCount,
  getEmployeeProfile,
  type EmployeeListOptions,
  type EmployeeListResult,
} from './employee.service';

// Future services:
// export * from './document.service';
// export * from './workflow.service';
// export * from './report.service';

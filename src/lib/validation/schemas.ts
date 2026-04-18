/**
 * Zod Validation Schemas for API Inputs
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid();

export const DateSchema = z.string().datetime();

export const TenantIdSchema = UUIDSchema;

export const RoleSchema = z.enum(['admin', 'manager', 'employee', 'hr', 'payroll']);

// ============================================================================
// Swarm API Schemas
// ============================================================================

export const AgentIntentSchema = z.enum([
  'employee_search',
  'employee_summary',
  'employee_profile',
  'team_directory',
  'leave_balance_check',
  'leave_balance',
  'leave_request_submit',
  'leave_request_status',
  'leave_request',
  'upcoming_milestones',
  'milestone_acknowledge',
  'milestone_list',
  'policy_lookup',
  'policy_compare',
  'policy_search',
  'policy_answer',
  'policy_citations',
  'compliance_check',
  'document_find',
  'document_list',
  'document_classify',
  'onboarding_create',
  'onboarding_progress',
  'onboarding_status',
  'onboarding_task_list',
  'onboarding_task_complete',
  'onboarding_blockers',
  'onboarding_missing_docs',
  'offboarding_create',
  'offboarding_progress',
  'offboarding_status',
  'offboarding_task_list',
  'offboarding_task_complete',
  'offboarding_assets',
  'offboarding_access',
  'offboarding_exit_summary',
  'workflow_status',
  'workflow_create',
  'workflow_approve',
  'workflow_reject',
  'workflow_history',
  'approval_inbox',
  'knowledge_search',
  'knowledge_summary',
  'report_generate',
  'dashboard_summary',
  'manager_team_overview',
  'manager_team_summary',
  'manager_employee_brief',
  'manager_action_items',
  'manager_dashboard',
  'manager_status_check',
  'employee_document_list',
  'pending_leave_requests',
  'pending_workflows',
]);

export const SwarmRequestSchema = z.object({
  intent: AgentIntentSchema,
  query: z.string().max(1000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type AgentIntent = z.infer<typeof AgentIntentSchema>;
export type SwarmRequestInput = z.infer<typeof SwarmRequestSchema>;

// ============================================================================
// Export API Schemas
// ============================================================================

export const ExportFiltersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive', 'on_leave', 'terminated', 'pending']).optional(),
  department: z.string().optional(),
  teamId: UUIDSchema.optional(),
});

export const ExportFormatSchema = z.enum(['csv', 'json', 'xlsx']);

export const ExportRequestSchema = z.object({
  fields: z.array(z.string()).min(1).max(50),
  format: ExportFormatSchema,
  filters: ExportFiltersSchema.optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export type ExportRequestInput = z.infer<typeof ExportRequestSchema>;

export const ExportApprovalActionSchema = z.enum(['approve', 'reject']);

export const ExportApprovalRequestSchema = z.object({
  approvalId: UUIDSchema,
  action: ExportApprovalActionSchema,
  reason: z.string().max(500).optional(),
});

export type ExportApprovalInput = z.infer<typeof ExportApprovalRequestSchema>;

// ============================================================================
// Employee Schemas
// ============================================================================

export const EmployeeIdSchema = z.object({
  employeeId: UUIDSchema,
});

export const EmployeeSearchSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.object({
    teamId: UUIDSchema.optional(),
    department: z.string().optional(),
    status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional(),
  }).optional(),
});

export type EmployeeSearchInput = z.infer<typeof EmployeeSearchSchema>;

// ============================================================================
// Leave Schemas
// ============================================================================

export const LeaveTypeSchema = z.enum([
  'annual',
  'sick',
  'personal',
  'parental',
  'bereavement',
  'unpaid',
  'other',
]);

export const LeaveRequestSchema = z.object({
  employeeId: UUIDSchema,
  leaveType: LeaveTypeSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysRequested: z.number().positive().max(365),
  reason: z.string().max(500).optional(),
});

export type LeaveRequestInput = z.infer<typeof LeaveRequestSchema>;

export const LeaveApprovalSchema = z.object({
  requestId: UUIDSchema,
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

export type LeaveApprovalInput = z.infer<typeof LeaveApprovalSchema>;

// ============================================================================
// Workflow Schemas
// ============================================================================

export const WorkflowTypeSchema = z.enum([
  'leave_approval',
  'salary_change',
  'promotion',
  'termination',
  'onboarding',
  'offboarding',
  'document_approval',
  'review',
]);

export const WorkflowCreateSchema = z.object({
  workflowType: WorkflowTypeSchema,
  referenceId: UUIDSchema,
  referenceType: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowCreateInput = z.infer<typeof WorkflowCreateSchema>;

export const WorkflowStepActionSchema = z.object({
  workflowId: UUIDSchema,
  stepId: UUIDSchema,
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

export type WorkflowStepActionInput = z.infer<typeof WorkflowStepActionSchema>;

// ============================================================================
// Onboarding/Offboarding Schemas
// ============================================================================

export const OnboardingCreateSchema = z.object({
  employeeId: UUIDSchema,
  templateId: z.string().optional(),
  customTasks: z.array(z.object({
    name: z.string(),
    description: z.string(),
    assignedTo: UUIDSchema.optional(),
    dueDays: z.number().positive(),
  })).optional(),
});

export type OnboardingCreateInput = z.infer<typeof OnboardingCreateSchema>;

export const TaskCompleteSchema = z.object({
  taskId: UUIDSchema,
  notes: z.string().max(500).optional(),
});

export type TaskCompleteInput = z.infer<typeof TaskCompleteSchema>;

// ============================================================================
// Policy/Knowledge Schemas
// ============================================================================

export const PolicySearchSchema = z.object({
  query: z.string().min(1).max(500),
  zone: z.enum([
    'authoritative_policy',
    'legal_playbook',
    'templates_precedents',
    'workflow_sop',
    'system_help',
    'private_case_data',
  ]).optional(),
  jurisdiction: z.string().optional(),
  audience: z.enum(['all_employees', 'managers', 'hr_only', 'executives']).optional(),
});

export type PolicySearchInput = z.infer<typeof PolicySearchSchema>;

// ============================================================================
// Document Upload Schemas
// ============================================================================

export const DocumentUploadSchema = z.object({
  employeeId: UUIDSchema,
  category: z.enum(['contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other']),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type DocumentUploadInput = z.infer<typeof DocumentUploadSchema>;

// ============================================================================
// Idempotency Key Schema
// ============================================================================

export const IdempotencyKeySchema = z.string().uuid().optional();

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateUUID(id: string): boolean {
  return UUIDSchema.safeParse(id).success;
}

export function validateDateRange(from: string, to: string): boolean {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return fromDate <= toDate;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000);
}

/**
 * Row mappers: snake_case (Postgres/Supabase) <-> camelCase (domain types).
 *
 * The Supabase types in `src/types/database.ts` use snake_case (to match the
 * actual table columns), while our domain types in `src/types/index.ts` use
 * camelCase. Every repository read/write must cross this boundary, so we
 * centralize it here rather than scattering field renames across agents.
 *
 * Keep this file purely a translation layer — no business logic, no defaults
 * beyond what the schema allows.
 */

import type {
  Employee,
  Team,
  Position,
  EmployeeDocument,
  LeaveBalance,
  LeaveRequest,
  Milestone,
  OnboardingPlan,
  OnboardingTask,
  OffboardingPlan,
  OffboardingTask,
  OffboardingAsset,
  OffboardingAccess,
  WorkflowInstance,
  WorkflowStep,
} from '@/types';
import type {
  Employee as DbEmployee,
  Team as DbTeam,
  Position as DbPosition,
  EmployeeDocument as DbEmployeeDocument,
  LeaveBalance as DbLeaveBalance,
  LeaveRequest as DbLeaveRequest,
  Milestone as DbMilestone,
  OnboardingPlan as DbOnboardingPlan,
  OnboardingTask as DbOnboardingTask,
  OffboardingPlan as DbOffboardingPlan,
  OffboardingTask as DbOffboardingTask,
  OffboardingAsset as DbOffboardingAsset,
  OffboardingAccess as DbOffboardingAccess,
  Workflow as DbWorkflow,
  ApprovalStep as DbApprovalStep,
} from '@/types/database';

// ----- Employee -----

export function employeeFromRow(row: DbEmployee): Employee {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    employeeNumber: row.employee_number,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    status: row.status,
    teamId: row.team_id,
    positionId: row.position_id,
    managerId: row.manager_id,
    workLocation: row.work_location,
    employmentType: row.employment_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function employeeToRow(
  e: Partial<Employee> & { id?: string },
): Partial<DbEmployee> {
  const row: Partial<DbEmployee> = {};
  if (e.id !== undefined) row.id = e.id;
  if (e.email !== undefined) row.email = e.email;
  if (e.firstName !== undefined) row.first_name = e.firstName;
  if (e.lastName !== undefined) row.last_name = e.lastName;
  if (e.employeeNumber !== undefined) row.employee_number = e.employeeNumber;
  if (e.hireDate !== undefined) row.hire_date = e.hireDate;
  if (e.terminationDate !== undefined) row.termination_date = e.terminationDate;
  if (e.status !== undefined) row.status = e.status;
  if (e.teamId !== undefined) row.team_id = e.teamId;
  if (e.positionId !== undefined) row.position_id = e.positionId;
  if (e.managerId !== undefined) row.manager_id = e.managerId;
  if (e.workLocation !== undefined) row.work_location = e.workLocation;
  if (e.employmentType !== undefined) row.employment_type = e.employmentType;
  return row;
}

// ----- Team -----

export function teamFromRow(row: DbTeam): Team {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parentTeamId: row.parent_team_id,
    department: row.department,
    costCenter: row.cost_center,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function teamToRow(t: Partial<Team> & { id?: string }): Partial<DbTeam> {
  const row: Partial<DbTeam> = {};
  if (t.id !== undefined) row.id = t.id;
  if (t.name !== undefined) row.name = t.name;
  if (t.code !== undefined) row.code = t.code;
  if (t.parentTeamId !== undefined) row.parent_team_id = t.parentTeamId;
  if (t.department !== undefined) row.department = t.department;
  if (t.costCenter !== undefined) row.cost_center = t.costCenter;
  return row;
}

// ----- Position -----

export function positionFromRow(row: DbPosition): Position {
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    department: row.department,
    jobFamily: row.job_family,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function positionToRow(
  p: Partial<Position> & { id?: string },
): Partial<DbPosition> {
  const row: Partial<DbPosition> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.title !== undefined) row.title = p.title;
  if (p.level !== undefined) row.level = p.level;
  if (p.department !== undefined) row.department = p.department;
  if (p.jobFamily !== undefined) row.job_family = p.jobFamily;
  return row;
}

// ----- EmployeeDocument -----

export function documentFromRow(row: DbEmployeeDocument): EmployeeDocument {
  return {
    id: row.id,
    employeeId: row.employee_id,
    sourceId: row.onedrive_id,
    sourcePath: row.onedrive_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    category: row.category,
    status: row.status,
    uploadedAt: row.uploaded_at,
    expiresAt: row.expires_at,
    extractedData: row.extracted_data as Record<string, unknown> | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function documentToRow(
  d: Partial<EmployeeDocument>,
): Partial<DbEmployeeDocument> {
  const row: Partial<DbEmployeeDocument> = {};
  if (d.id !== undefined) row.id = d.id;
  if (d.employeeId !== undefined) row.employee_id = d.employeeId;
  if (d.sourceId !== undefined) row.onedrive_id = d.sourceId;
  if (d.sourcePath !== undefined) row.onedrive_path = d.sourcePath;
  if (d.fileName !== undefined) row.file_name = d.fileName;
  if (d.fileType !== undefined) row.file_type = d.fileType;
  if (d.fileSize !== undefined) row.file_size = d.fileSize;
  if (d.category !== undefined) row.category = d.category;
  if (d.status !== undefined) row.status = d.status;
  if (d.uploadedAt !== undefined) row.uploaded_at = d.uploadedAt;
  if (d.expiresAt !== undefined) row.expires_at = d.expiresAt;
  return row;
}

// ----- LeaveBalance -----

export function leaveBalanceFromRow(row: DbLeaveBalance): LeaveBalance {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    leaveType: r.leave_type as LeaveBalance['leaveType'],
    entitlementDays: Number(r.entitlement_days),
    takenDays: Number(r.taken_days),
    pendingDays: Number(r.pending_days),
    remainingDays: Number(r.remaining_days),
    periodStart: String(r.period_start),
    periodEnd: String(r.period_end ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- LeaveRequest -----

export function leaveRequestFromRow(row: DbLeaveRequest): LeaveRequest {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    leaveType: r.leave_type as LeaveRequest['leaveType'],
    startDate: String(r.start_date),
    endDate: String(r.end_date),
    daysRequested: Number(r.days_requested ?? r.total_days ?? 0),
    reason: (r.reason as string | null) ?? null,
    status: r.status as LeaveRequest['status'],
    approvedBy: (r.approved_by as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    rejectionReason: (r.rejection_reason as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

export function leaveRequestToRow(
  r: Partial<LeaveRequest>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (r.id !== undefined) row.id = r.id;
  if (r.employeeId !== undefined) row.employee_id = r.employeeId;
  if (r.leaveType !== undefined) row.leave_type = r.leaveType;
  if (r.startDate !== undefined) row.start_date = r.startDate;
  if (r.endDate !== undefined) row.end_date = r.endDate;
  if (r.daysRequested !== undefined) row.days_requested = r.daysRequested;
  if (r.status !== undefined) row.status = r.status;
  if (r.reason !== undefined) row.reason = r.reason;
  if (r.approvedBy !== undefined) row.approved_by = r.approvedBy;
  if (r.approvedAt !== undefined) row.approved_at = r.approvedAt;
  if (r.rejectionReason !== undefined) row.rejection_reason = r.rejectionReason;
  return row;
}

// ----- Milestone -----

export function milestoneFromRow(row: DbMilestone): Milestone {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    milestoneType: r.milestone_type as Milestone['milestoneType'],
    milestoneDate: String(r.milestone_date),
    description: String(r.description ?? ''),
    alertDaysBefore: Number(r.alert_days_before ?? 0),
    status: r.status as Milestone['status'],
    acknowledgedAt: (r.acknowledged_at as string | null) ?? null,
    acknowledgedBy: (r.acknowledged_by as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OnboardingPlan -----

export function onboardingPlanFromRow(row: DbOnboardingPlan): OnboardingPlan {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    assignedTo: String(r.assigned_to ?? r.employee_id ?? ''),
    templateName: String(r.template_name),
    startDate: String(r.start_date),
    targetCompletionDate: String(r.target_completion_date),
    actualCompletionDate: (r.actual_completion_date as string | null) ?? null,
    status: r.status as OnboardingPlan['status'],
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OnboardingTask -----

export function onboardingTaskFromRow(row: DbOnboardingTask): OnboardingTask {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    planId: String(r.plan_id),
    taskName: String(r.task_name),
    description: (r.description as string | null) ?? null,
    category: r.category as OnboardingTask['category'],
    assignedTo: String(r.assigned_to),
    dueDate: String(r.due_date),
    completedAt: (r.completed_at as string | null) ?? null,
    completedBy: (r.completed_by as string | null) ?? null,
    status: r.status as OnboardingTask['status'],
    priority: r.priority as OnboardingTask['priority'],
    dependsOn: (r.depends_on as string[] | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OffboardingPlan -----

export function offboardingPlanFromRow(row: DbOffboardingPlan): OffboardingPlan {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    terminationDate: String(r.termination_date),
    initiatedBy: String(r.initiated_by),
    status: r.status as OffboardingPlan['status'],
    checklistTemplate: String(r.checklist_template),
    targetCompletionDate: String(r.target_completion_date),
    actualCompletionDate: (r.actual_completion_date as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OffboardingTask -----

export function offboardingTaskFromRow(row: DbOffboardingTask): OffboardingTask {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    planId: String(r.plan_id),
    taskName: String(r.task_name),
    category: r.category as OffboardingTask['category'],
    assignedTo: String(r.assigned_to),
    dueDate: String(r.due_date),
    completedAt: (r.completed_at as string | null) ?? null,
    completedBy: (r.completed_by as string | null) ?? null,
    status: r.status as OffboardingTask['status'],
    priority: r.priority as OffboardingTask['priority'],
    dependsOn: (r.depends_on as string[] | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OffboardingAsset -----

export function offboardingAssetFromRow(row: DbOffboardingAsset): OffboardingAsset {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    planId: String(r.plan_id),
    assetType: r.asset_type as OffboardingAsset['assetType'],
    description: String(r.description),
    expectedReturnDate: String(r.expected_return_date),
    returnedAt: (r.returned_at as string | null) ?? null,
    conditionNotes: (r.condition_notes as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- OffboardingAccess -----

export function offboardingAccessFromRow(row: DbOffboardingAccess): OffboardingAccess {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    planId: String(r.plan_id),
    systemName: String(r.system_name),
    removalStatus: r.removal_status as OffboardingAccess['removalStatus'],
    scheduledDate: (r.scheduled_date as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- WorkflowInstance (from `workflows` table) -----

export function workflowInstanceFromRow(row: DbWorkflow): WorkflowInstance {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    workflowType: r.workflow_type as WorkflowInstance['workflowType'],
    referenceType: String(r.reference_type),
    referenceId: String(r.reference_id),
    initiatorId: String(r.initiator_id),
    status: r.status as WorkflowInstance['status'],
    currentStep: Number(r.current_step),
    totalSteps: Number(r.total_steps),
    startedAt: String(r.started_at ?? ''),
    completedAt: (r.completed_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ----- WorkflowStep (from `approval_steps` table) -----

export function workflowStepFromRow(row: DbApprovalStep): WorkflowStep {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    workflowId: String(r.workflow_id),
    stepNumber: Number(r.step_number),
    stepName: String(r.step_name ?? ''),
    approverId: (r.approver_id as string | null) ?? null,
    approverRole: (r.approver_role as string | null) ?? null,
    status: r.status as WorkflowStep['status'],
    comments: (r.comments as string | null) ?? null,
    actedAt: (r.acted_at as string | null) ?? null,
    dueDate: String(r.due_date),
    escalatedTo: (r.escalated_to as string | null) ?? null,
    escalatedAt: (r.escalated_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

// ============================================
// Domain Types - Core entities and value objects
// ============================================

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

// ============================================
// Document Domain
// ============================================

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  sourceId: string;
  sourcePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: 'contract' | 'visa' | 'certification' | 'id' | 'medical' | 'tax' | 'performance' | 'other';
  status: 'active' | 'expired' | 'expiring' | 'missing';
  uploadedAt: string;
  expiresAt: string | null;
  extractedData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequirement {
  id: string;
  category: string;
  employmentTypes: string[];
  required: boolean;
  expires: boolean;
  expirationWarningDays: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Leave Domain
// ============================================

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  entitlementDays: number;
  takenDays: number;
  pendingDays: number;
  remainingDays: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'unpaid' | 'other';
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Compensation Domain
// ============================================

export interface CompensationRecord {
  id: string;
  employeeId: string;
  effectiveDate: string;
  baseSalary: number;
  currency: string;
  salaryFrequency: 'annual' | 'monthly' | 'biweekly' | 'weekly';
  bonusAmount: number | null;
  bonusType: string | null;
  totalCompensation: number;
  externalSyncId: string | null;
  externalSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Milestones Domain
// ============================================

export interface Milestone {
  id: string;
  employeeId: string;
  milestoneType: 'service_anniversary' | 'probation_end' | 'visa_expiry' | 'certification_expiry' | 'contract_expiry' | 'performance_review';
  milestoneDate: string;
  description: string;
  alertDaysBefore: number;
  status: 'upcoming' | 'due' | 'overdue' | 'completed' | 'acknowledged';
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Workflow Domain
// ============================================

export interface Workflow {
  id: string;
  workflowType: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval' | 'review';
  referenceType: string;
  referenceId: string;
  initiatorId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  approverId: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  comments: string | null;
  actedAt: string | null;
  dueDate: string;
  escalatedTo: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Review Domain
// ============================================

export interface ReviewCycle {
  id: string;
  name: string;
  reviewType: 'probation' | 'annual' | 'mid_year' | 'project';
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInstance {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerId: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'overdue' | 'completed';
  dueDate: string;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  targetDate: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Communications Domain
// ============================================

export interface CommunicationTemplate {
  id: string;
  name: string;
  category: string;
  channel: 'email' | 'slack' | 'teams';
  subject: string | null;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationDraft {
  id: string;
  templateId: string | null;
  channel: 'email' | 'slack' | 'teams';
  recipientId: string;
  subject: string | null;
  body: string;
  variables: Record<string, string>;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'failed';
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Audit Domain
// ============================================

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ============================================
// Agent Domain
// ============================================

export interface AgentResult<T = unknown> {
  success: boolean;
  summary: string;
  confidence: number;
  data: T;
  risks: string[];
  requiresApproval: boolean;
  proposedActions?: ProposedAction[];
  citations?: Citation[];
}

export interface ProposedAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface Citation {
  source: string;
  reference: string;
}

export type AgentType =
  | 'coordinator'
  | 'employee_profile'
  | 'document_compliance'
  | 'leave_milestones'
  | 'compensation'
  | 'reporting'
  | 'communications'
  | 'reviews'
  | 'performance'
  | 'onboarding'
  | 'offboarding'
  | 'workflow_approvals'
  | 'knowledge_policy'
  | 'manager_support';

export type AgentIntent =
  // Employee & Document
  | 'employee_search'
  | 'employee_summary'
  | 'employee_profile'
  | 'employee_document_list'
  | 'document_list'
  | 'document_classify'
  | 'document_find'
  | 'team_directory'
  // Leave & Compensation
  | 'leave_balance'
  | 'leave_request'
  | 'leave_balance_check'
  | 'leave_request_submit'
  | 'leave_request_status'
  | 'pending_leave_requests'
  | 'compensation_view'
  | 'compensation_history'
  // Reviews & Milestones
  | 'milestone_list'
  | 'upcoming_milestones'
  | 'milestone_acknowledge'
  | 'review_status'
  // Compliance
  | 'compliance_check'
  // Communications & Reporting
  | 'communication_draft'
  | 'report_generate'
  // Onboarding
  | 'onboarding_create'
  | 'onboarding_status'
  | 'onboarding_progress'
  | 'onboarding_task_list'
  | 'onboarding_task_complete'
  | 'onboarding_blockers'
  | 'onboarding_missing_docs'
  // Offboarding
  | 'offboarding_create'
  | 'offboarding_status'
  | 'offboarding_progress'
  | 'offboarding_task_list'
  | 'offboarding_task_complete'
  | 'offboarding_assets'
  | 'offboarding_access'
  | 'offboarding_exit_summary'
  // Workflow & Approvals
  | 'workflow_create'
  | 'workflow_status'
  | 'workflow_approve'
  | 'workflow_reject'
  | 'workflow_history'
  | 'approval_inbox'
  | 'pending_workflows'
  // Knowledge & Policy
  | 'policy_search'
  | 'policy_answer'
  | 'policy_lookup'
  | 'policy_compare'
  | 'policy_citations'
  | 'knowledge_search'
  | 'knowledge_summary'
  // Manager Support
  | 'manager_team_overview'
  | 'manager_employee_brief'
  | 'manager_action_items'
  // Coordinator
  | 'dashboard_summary'
  // Manager Support
  | 'manager_team_summary'
  | 'manager_employee_brief'
  | 'manager_dashboard'
  | 'manager_action_items'
  | 'manager_status_check';

// ============================================
// Orchestration Types
// ============================================

export type Role = 'admin' | 'manager' | 'team_lead' | 'employee' | 'payroll';

export type RecordScope = 'self' | 'team' | 'all' | 'payroll_scope';

export type DataSensitivity =
  | 'self_visible'
  | 'team_visible'
  | 'pay_sensitive'
  | 'hr_admin_sensitive'
  | 'confidential';

export interface AgentContext {
  userId: string;
  role: Role;
  scope: RecordScope;
  sensitivityClearance: DataSensitivity[];
  employeeId?: string;
  managerId?: string;
  teamId?: string;
  tenantId?: string;
  permissions: string[];
  sessionId: string;
  timestamp: string;
}

export interface SwarmRequest {
  intent: AgentIntent;
  query: string;
  payload: Record<string, unknown>;
  context: AgentContext;
}

export interface SwarmResponse {
  agentType: AgentType;
  intent: AgentIntent;
  result: AgentResult;
  routingConfidence?: number;
  executionTimeMs: number;
  auditId: string;
  timestamp?: string;
  context?: {
    userId: string;
    role: string;
    tenantId: string;
  };
}

// ============================================
// Agent Run Record
// ============================================

export interface AgentRunRecord {
  id: string;
  agentType: string;
  intent: string;
  inputPayload: Record<string, unknown>;
  outputResult: Record<string, unknown> | AgentResult | null;
  confidence: number | null;
  executionTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================
// UI Types
// ============================================

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  badge?: number;
  children?: NavItem[];
}

export interface DashboardMetric {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
}

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  assignee?: string;
  entityType: string;
  entityId: string;
}

// ============================================
// Onboarding Domain
// ============================================

export interface OnboardingPlan {
  id: string;
  employeeId: string;
  assignedTo: string; // hiring manager / onboarding owner
  templateName: string;
  startDate: string;
  targetCompletionDate: string;
  actualCompletionDate: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTask {
  id: string;
  planId: string;
  taskName: string;
  description: string | null;
  category: 'admin' | 'it' | 'hr' | 'team' | 'training' | 'compliance';
  assignedTo: string;
  dueDate: string;
  completedAt: string | null;
  completedBy: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  dependsOn: string[] | null;
  createdAt: string;
  updatedAt: string;
  /** Template helper: days offset from start date (for template definitions only) */
  dueDateOffset?: number;
}

export interface OnboardingBlocker {
  taskId: string;
  taskName: string;
  reason: string;
  severity: 'warning' | 'blocking';
}

// ============================================
// Offboarding Domain
// ============================================

export interface OffboardingPlan {
  id: string;
  employeeId: string;
  terminationDate: string;
  initiatedBy: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  checklistTemplate: string;
  targetCompletionDate: string;
  actualCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OffboardingTask {
  id: string;
  planId: string;
  taskName: string;
  category: 'access_removal' | 'asset_return' | 'knowledge_transfer' | 'hr_exit' | 'payroll_exit' | 'compliance';
  assignedTo: string;
  dueDate: string;
  completedAt: string | null;
  completedBy: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  dependsOn: string[] | null;
  createdAt: string;
  updatedAt: string;
  /** Template helper: days offset from termination date (for template definitions only) */
  dueDateOffset?: number;
}

export interface OffboardingAsset {
  id: string;
  planId: string;
  assetType: 'laptop' | 'phone' | 'badge' | 'credit_card' | 'other';
  description: string;
  expectedReturnDate: string;
  returnedAt: string | null;
  conditionNotes: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Template helper: days offset from termination date (for template definitions only) */
  expectedReturnDateOffset?: number;
}

export interface OffboardingAccess {
  id: string;
  planId: string;
  systemName: string;
  removalStatus: 'pending' | 'scheduled' | 'completed' | 'na';
  scheduledDate: string | null;
  completedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Template helper: days offset from termination date (for template definitions only) */
  scheduledOffset?: number;
}

export interface OffboardingExitSummary {
  planId: string;
  employeeId: string;
  employeeName: string;
  terminationDate: string;
  tasksCompleted: number;
  tasksTotal: number;
  assetsReturned: number;
  assetsTotal: number;
  accessRemoved: number;
  accessTotal: number;
  pendingItems: string[];
  exitCleared: boolean;
}

// ============================================
// Workflow & Approvals Domain
// ============================================

export interface WorkflowInstance {
  id: string;
  workflowType: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval' | 'communication_approval' | 'review';
  referenceType: string;
  referenceId: string;
  initiatorId: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  stepName: string;
  approverId: string | null;
  approverRole: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  comments: string | null;
  actedAt: string | null;
  dueDate: string;
  escalatedTo: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalInboxItem {
  workflowId: string;
  stepId: string;
  stepNumber: number;
  stepName: string;
  workflowType: string;
  referenceType: string;
  referenceId: string;
  initiatorName: string;
  dueDate: string;
  isEscalated: boolean;
}

// ============================================
// Knowledge & Policy Domain
// ============================================

export interface PolicySearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  relevanceScore: number;
  citations: { source: string; reference: string }[];
}

export interface PolicyAnswer {
  answer: string;
  confidence: number;
  citations: { source: string; reference: string }[];
  relatedQuestions: string[];
  requiresEscalation: boolean;
  escalationReason?: string;
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

// Re-export database types for agent layer use
export type { PolicyDocument, PolicyChunk } from './database';

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status' | 'badge';
  format?: string;
  width?: number;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

// ============================================
// Export Domain
// ============================================

export interface ExportApproval {
  id: string;
  requesterId: string;
  requesterEmail: string;
  fields: string[];
  format: string;
  filters?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approverId: string | null;
  approvedAt: string | null;
  rejectionReason?: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string;
}

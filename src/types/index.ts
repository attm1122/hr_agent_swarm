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
  | 'performance';

export type AgentIntent =
  | 'employee_search'
  | 'employee_summary'
  | 'document_list'
  | 'document_classify'
  | 'leave_balance'
  | 'leave_request'
  | 'compensation_view'
  | 'compensation_history'
  | 'milestone_list'
  | 'review_status'
  | 'communication_draft'
  | 'report_generate'
  | 'dashboard_summary';

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

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status' | 'badge';
  format?: string;
  width?: number;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

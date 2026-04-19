// ============================================
// Domain Types - Core entities and value objects
// ============================================

// Import AgentIntent from validation schemas to ensure consistency
import type { AgentIntent } from '@/lib/validation/schemas';
export type { AgentIntent };

// Re-export moved domain types (strangler-fig pattern)
export type {
  Employee,
  Team,
  Position,
  EmployeeSummary,
} from '@/lib/domain/employee/types';

export type {
  LeaveBalance,
  LeaveRequest,
} from '@/lib/domain/leave/types';

export type {
  Workflow,
  ApprovalStep,
  WorkflowInstance,
  WorkflowStep,
  ApprovalInboxItem,
  WorkflowStatus,
} from '@/lib/domain/workflow/types';

export type {
  EmployeeDocument,
  DocumentRequirement,
  PolicyDocument,
  PolicyChunk,
} from '@/lib/domain/document/types';

export type {
  CommunicationTemplate,
  CommunicationDraft,
} from '@/lib/domain/communication/types';

export type {
  AuditEvent,
  AgentRunRecord,
} from '@/lib/domain/audit/types';

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
  milestoneType: 'probation_end' | 'work_anniversary' | 'promotion' | 'role_change' | 'team_change' | 'performance_review' | 'visa_expiry' | 'certification_expiry' | 'contract_expiry';
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
  tenantId: string;
  role: Role;
  scope: RecordScope;
  sensitivityClearance: DataSensitivity[];
  employeeId?: string;
  managerId?: string;
  teamId?: string;
  permissions: string[];
  sessionId: string;
  timestamp: string;
}

export interface SwarmRequest {
  intent: AgentIntent | string;
  query?: string;
  payload?: Record<string, unknown>;
  context: AgentContext;
}

export interface SwarmResponse {
  agentType: AgentType;
  intent: AgentIntent;
  result: AgentResult;
  routingConfidence?: number;
  executionTimeMs: number;
  auditId: string;
  timestamp: string;
  context: {
    userId: string;
    role: Role;
    tenantId: string;
  };
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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'not_started' | 'blocked';
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

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status' | 'badge';
  format?: string;
  width?: number;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';


// ============================================================================
// Export Approval Types
// ============================================================================

export interface ExportApproval {
  id: string;
  requesterId: string;
  requesterEmail: string;
  fields: string[];
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  requestedAt: string;
  approverId: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string;
  rejectionReason?: string;
}

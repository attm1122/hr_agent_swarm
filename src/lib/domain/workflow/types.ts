/**
 * Workflow Domain Types
 */

export interface Workflow {
  id: string;
  workflowType: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval' | 'review';
  referenceType: string;
  referenceId: string;
  initiatorId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
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

export interface WorkflowInstance {
  id: string;
  workflowType: 'leave_approval' | 'salary_change' | 'promotion' | 'termination' | 'onboarding' | 'offboarding' | 'document_approval' | 'communication_approval' | 'review';
  referenceType: string;
  referenceId: string;
  initiatorId: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
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

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

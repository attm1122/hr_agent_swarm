/**
 * Workflow & Approvals Data Store
 * In-memory store for workflow instances and approval steps (POC).
 * Production: Replace with Supabase database calls.
 */

import type { WorkflowInstance, WorkflowStep, ApprovalInboxItem } from '@/lib/domain/workflow/types';
import { getEmployeeById, getEmployeeFullName } from './mock-data';
import { addDaysToDateOnly, toDateOnlyString } from '@/lib/domain/shared/date-value';
import { getNextStepState } from '@/lib/domain/workflow/workflow-state-machine';

// In-memory stores
export const workflowInstances: WorkflowInstance[] = [];
export const workflowSteps: WorkflowStep[] = [];

// Workflow type configurations
type WorkflowTypeConfig = {
  name: string;
  steps: { stepName: string; approverRole: string }[];
};

export const WORKFLOW_CONFIGS: Record<string, WorkflowTypeConfig> = {
  leave_approval: {
    name: 'Leave Request Approval',
    steps: [
      { stepName: 'Manager Review', approverRole: 'manager' },
      { stepName: 'HR Confirmation', approverRole: 'admin' },
    ],
  },
  communication_approval: {
    name: 'Communication Approval',
    steps: [
      { stepName: 'Content Review', approverRole: 'manager' },
      { stepName: 'Legal Review', approverRole: 'admin' },
    ],
  },
  onboarding: {
    name: 'Onboarding Approval',
    steps: [
      { stepName: 'Manager Approval', approverRole: 'manager' },
      { stepName: 'HR Setup', approverRole: 'admin' },
    ],
  },
  offboarding: {
    name: 'Offboarding Approval',
    steps: [
      { stepName: 'Manager Acknowledgment', approverRole: 'manager' },
      { stepName: 'HR Review', approverRole: 'admin' },
      { stepName: 'Final Approval', approverRole: 'admin' },
    ],
  },
  salary_change: {
    name: 'Salary Change Approval',
    steps: [
      { stepName: 'Manager Review', approverRole: 'manager' },
      { stepName: 'HR Approval', approverRole: 'admin' },
      { stepName: 'Finance Review', approverRole: 'admin' },
    ],
  },
};

// Initialize with sample data
export function initializeWorkflowStore(): void {
  // Sample leave approval workflow for emp-008
  const workflowId = 'wf-001';
  const now = new Date().toISOString();
  const today = toDateOnlyString();

  workflowInstances.push({
    id: workflowId,
    workflowType: 'leave_approval',
    referenceType: 'leave_request',
    referenceId: 'lr-001',
    initiatorId: 'emp-008',
    status: 'in_progress',
    currentStep: 1,
    totalSteps: 2,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  workflowSteps.push(
    {
      id: 'ws-001',
      workflowId,
      stepNumber: 1,
      stepName: 'Manager Review',
      approverId: 'emp-006',
      approverRole: 'manager',
      status: 'approved',
      comments: 'Approved - coverage is arranged',
      actedAt: now,
      dueDate: addDaysToDateOnly(today, 1),
      escalatedTo: null,
      escalatedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ws-002',
      workflowId,
      stepNumber: 2,
      stepName: 'HR Confirmation',
      approverId: 'emp-001',
      approverRole: 'admin',
      status: 'pending',
      comments: null,
      actedAt: null,
      dueDate: addDaysToDateOnly(today, 2),
      escalatedTo: null,
      escalatedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  );
}

// Helper functions
export function getWorkflowById(id: string): WorkflowInstance | undefined {
  return workflowInstances.find(w => w.id === id);
}

export function getWorkflowSteps(workflowId: string): WorkflowStep[] {
  return workflowSteps
    .filter(s => s.workflowId === workflowId)
    .sort((a, b) => a.stepNumber - b.stepNumber);
}

export function getWorkflowsForInitiator(initiatorId: string): WorkflowInstance[] {
  return workflowInstances.filter(w => w.initiatorId === initiatorId);
}

export function getPendingWorkflowsForApprover(approverId: string): WorkflowInstance[] {
  const stepWorkflowIds = workflowSteps
    .filter(s => s.approverId === approverId && s.status === 'pending')
    .map(s => s.workflowId);
  return workflowInstances.filter(w => stepWorkflowIds.includes(w.id) && w.status === 'in_progress');
}

export function getApprovalInboxForUser(userId: string): ApprovalInboxItem[] {
  const pendingSteps = workflowSteps.filter(
    s => s.approverId === userId && s.status === 'pending'
  );

  return pendingSteps.map(step => {
    const workflow = getWorkflowById(step.workflowId)!;
    const initiator = getEmployeeById(workflow.initiatorId);

    return {
      workflowId: workflow.id,
      stepId: step.id,
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      workflowType: workflow.workflowType,
      referenceType: workflow.referenceType,
      referenceId: workflow.referenceId,
      initiatorName: initiator ? getEmployeeFullName(initiator) : 'Unknown',
      dueDate: step.dueDate,
      isEscalated: step.escalatedTo !== null,
    };
  });
}

export function createWorkflow(
  workflowType: WorkflowInstance['workflowType'],
  referenceType: string,
  referenceId: string,
  initiatorId: string
): WorkflowInstance | null {
  const config = WORKFLOW_CONFIGS[workflowType];
  if (!config) return null;

  const workflowId = `wf-${String(workflowInstances.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const workflow: WorkflowInstance = {
    id: workflowId,
    workflowType,
    referenceType,
    referenceId,
    initiatorId,
    status: 'pending',
    currentStep: 1,
    totalSteps: config.steps.length,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  workflowInstances.push(workflow);

  // Create steps
  config.steps.forEach((stepConfig, index) => {
    const dueDate = addDaysToDateOnly(toDateOnlyString(), (index + 1) * 2);

    workflowSteps.push({
      id: `ws-${String(workflowSteps.length + 1).padStart(3, '0')}`,
      workflowId,
      stepNumber: index + 1,
      stepName: stepConfig.stepName,
      approverId: null,
      approverRole: stepConfig.approverRole,
      status: index === 0 ? 'pending' : 'pending',
      comments: null,
      actedAt: null,
      dueDate,
      escalatedTo: null,
      escalatedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return workflow;
}

export function approveWorkflowStep(
  stepId: string,
  approverId: string,
  comments?: string
): boolean {
  const step = workflowSteps.find(s => s.id === stepId);
  if (!step || step.status !== 'pending') return false;

  const now = new Date().toISOString();

  step.status = 'approved';
  step.approverId = approverId;
  step.comments = comments || null;
  step.actedAt = now;
  step.updatedAt = now;

  // Advance workflow state
  const workflow = getWorkflowById(step.workflowId);
  if (workflow) {
    const allSteps = getWorkflowSteps(workflow.id);
    const { complete, nextStepNumber } = getNextStepState(allSteps, step.stepNumber);

    if (complete) {
      workflow.status = 'completed';
      workflow.completedAt = now;
      workflow.currentStep = workflow.totalSteps;
    } else {
      workflow.currentStep = nextStepNumber!;
      workflow.status = 'in_progress';
    }
    workflow.updatedAt = now;
  }

  return true;
}

export function rejectWorkflowStep(
  stepId: string,
  approverId: string,
  comments: string
): boolean {
  const step = workflowSteps.find(s => s.id === stepId);
  if (!step || step.status !== 'pending') return false;

  const now = new Date().toISOString();

  step.status = 'rejected';
  step.approverId = approverId;
  step.comments = comments;
  step.actedAt = now;
  step.updatedAt = now;

  const workflow = getWorkflowById(step.workflowId);
  if (workflow) {
    workflow.status = 'rejected';
    workflow.updatedAt = now;
  }

  return true;
}

export function getWorkflowHistory(workflowId: string): WorkflowStep[] {
  return getWorkflowSteps(workflowId).filter(s => s.status !== 'pending');
}

export function identifyOverdueSteps(): WorkflowStep[] {
  const today = toDateOnlyString();
  return workflowSteps.filter(
    s => s.status === 'pending' && s.dueDate < today && !s.escalatedTo
  );
}

// Track if already initialized to prevent duplicate seed data
let isWorkflowStoreInitialized = false;

// Initialize on module load (idempotent)
export function ensureWorkflowStoreInitialized(): void {
  if (!isWorkflowStoreInitialized) {
    initializeWorkflowStore();
    isWorkflowStoreInitialized = true;
  }
}

// Auto-initialize on module load for backward compatibility
ensureWorkflowStoreInitialized();

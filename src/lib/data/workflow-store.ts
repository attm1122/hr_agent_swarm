/**
 * Workflow & Approvals data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `workflows` / `approval_steps` tables (in production) or the
 * in-memory mock data (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getWorkflowStore();
 *   const wf = await store.getWorkflowById('wf-001', 'tenant-leap');
 *
 * Pure helper functions and WORKFLOW_CONFIGS are re-exported for backward
 * compatibility.
 */

import type { WorkflowInstance, WorkflowStep, ApprovalInboxItem } from '@/types';
import { getEmployeeById, getEmployeeFullName } from './mock-data';
import { addDaysToDateOnly, toDateOnlyString } from '@/lib/date-only';
import { workflowInstanceFromRow, workflowStepFromRow } from './mappers';

// ==========================================
// Workflow type configurations (shared)
// ==========================================

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

// ==========================================
// In-memory mock data
// ==========================================

export const workflowInstances: WorkflowInstance[] = [];
export const workflowSteps: WorkflowStep[] = [];

function seedMockData(): void {
  if (workflowInstances.length > 0) return; // already seeded

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

// ==========================================
// Store interface
// ==========================================

export interface WorkflowStore {
  readonly backend: 'supabase' | 'mock';
  getWorkflowById(id: string, tenantId: string): Promise<WorkflowInstance | null>;
  getWorkflowByReference(referenceId: string, tenantId: string): Promise<WorkflowInstance | null>;
  getAllWorkflows(tenantId: string): Promise<WorkflowInstance[]>;
  getStepsForWorkflow(workflowId: string, tenantId: string): Promise<WorkflowStep[]>;
  getPendingStepsForApprover(approverId: string, tenantId: string): Promise<WorkflowStep[]>;
  createWorkflow(workflow: Omit<WorkflowInstance, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<WorkflowInstance | null>;
  createStep(step: Omit<WorkflowStep, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<WorkflowStep | null>;
  updateStep(stepId: string, fields: Partial<WorkflowStep>, tenantId: string): Promise<WorkflowStep | null>;
  updateWorkflow(workflowId: string, fields: Partial<WorkflowInstance>, tenantId: string): Promise<WorkflowInstance | null>;
}

// ==========================================
// Mock-backed implementation
// ==========================================

const mockStore: WorkflowStore = {
  backend: 'mock',

  async getWorkflowById(id: string) {
    seedMockData();
    return workflowInstances.find(w => w.id === id) ?? null;
  },
  async getWorkflowByReference(referenceId: string) {
    seedMockData();
    return workflowInstances.find(w => w.referenceId === referenceId) ?? null;
  },
  async getAllWorkflows() {
    seedMockData();
    return [...workflowInstances];
  },
  async getStepsForWorkflow(workflowId: string) {
    seedMockData();
    return workflowSteps
      .filter(s => s.workflowId === workflowId)
      .sort((a, b) => a.stepNumber - b.stepNumber);
  },
  async getPendingStepsForApprover(approverId: string) {
    seedMockData();
    return workflowSteps.filter(
      s => s.approverId === approverId && s.status === 'pending'
    );
  },
  async createWorkflow(workflow) {
    seedMockData();
    const full: WorkflowInstance = { ...workflow, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    workflowInstances.push(full);
    return full;
  },
  async createStep(step) {
    seedMockData();
    const full: WorkflowStep = { ...step, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    workflowSteps.push(full);
    return full;
  },
  async updateStep(stepId: string, fields: Partial<WorkflowStep>) {
    seedMockData();
    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) return null;
    Object.assign(step, fields, { updatedAt: new Date().toISOString() });
    return { ...step };
  },
  async updateWorkflow(workflowId: string, fields: Partial<WorkflowInstance>) {
    seedMockData();
    const wf = workflowInstances.find(w => w.id === workflowId);
    if (!wf) return null;
    Object.assign(wf, fields, { updatedAt: new Date().toISOString() });
    return { ...wf };
  },
};

// ==========================================
// Supabase-backed implementation
// ==========================================

function createSupabaseStore(): WorkflowStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async getWorkflowById(id: string, tenantId: string) {
      const t = (await table('workflows')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? workflowInstanceFromRow(data as never) : null;
    },

    async getWorkflowByReference(referenceId: string, tenantId: string) {
      const t = (await table('workflows')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).eq('reference_id', referenceId).maybeSingle();
      if (error) throw error;
      return data ? workflowInstanceFromRow(data as never) : null;
    },

    async getAllWorkflows(tenantId: string) {
      const t = (await table('workflows')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => workflowInstanceFromRow(r as never));
    },

    async getStepsForWorkflow(workflowId: string, tenantId: string) {
      const t = (await table('approval_steps')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('workflow_id', workflowId)
        .order('step_number', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => workflowStepFromRow(r as never));
    },

    async getPendingStepsForApprover(approverId: string, tenantId: string) {
      const t = (await table('approval_steps')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('approver_id', approverId)
        .eq('status', 'pending');
      if (error) throw error;
      return (data ?? []).map((r) => workflowStepFromRow(r as never));
    },

    async createWorkflow(workflow, tenantId: string) {
      const t = (await table('workflows')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: workflow.id,
          tenant_id: tenantId,
          workflow_type: workflow.workflowType,
          reference_type: workflow.referenceType,
          reference_id: workflow.referenceId,
          initiator_id: workflow.initiatorId,
          status: workflow.status,
          current_step: workflow.currentStep,
          total_steps: workflow.totalSteps,
          started_at: workflow.startedAt,
          completed_at: workflow.completedAt,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? workflowInstanceFromRow(data as never) : null;
    },

    async createStep(step, tenantId: string) {
      const t = (await table('approval_steps')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: step.id,
          tenant_id: tenantId,
          workflow_id: step.workflowId,
          step_number: step.stepNumber,
          approver_id: step.approverId,
          approver_role: step.approverRole,
          status: step.status,
          comments: step.comments,
          acted_at: step.actedAt,
          due_date: step.dueDate,
          escalated_to: step.escalatedTo,
          escalated_at: step.escalatedAt,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? workflowStepFromRow(data as never) : null;
    },

    async updateStep(stepId: string, fields: Partial<WorkflowStep>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.approverId !== undefined) row.approver_id = fields.approverId;
      if (fields.comments !== undefined) row.comments = fields.comments;
      if (fields.actedAt !== undefined) row.acted_at = fields.actedAt;
      if (fields.escalatedTo !== undefined) row.escalated_to = fields.escalatedTo;
      if (fields.escalatedAt !== undefined) row.escalated_at = fields.escalatedAt;

      const t = (await table('approval_steps')) as {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              select: (c: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        };
      };
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', stepId).select('*').maybeSingle();
      if (error) throw error;
      return data ? workflowStepFromRow(data as never) : null;
    },

    async updateWorkflow(workflowId: string, fields: Partial<WorkflowInstance>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.currentStep !== undefined) row.current_step = fields.currentStep;
      if (fields.completedAt !== undefined) row.completed_at = fields.completedAt;

      const t = (await table('workflows')) as {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              select: (c: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        };
      };
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', workflowId).select('*').maybeSingle();
      if (error) throw error;
      return data ? workflowInstanceFromRow(data as never) : null;
    },
  };
}

// ==========================================
// Resolver
// ==========================================

function isSupabaseConfigured(): boolean {
  return (
    typeof window === 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

let cachedStore: WorkflowStore | null = null;

export function getWorkflowStore(): WorkflowStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetWorkflowStore(): void {
  cachedStore = null;
}

// ==========================================
// Backward-compat helpers
// ==========================================

/** @deprecated Use getWorkflowStore().getWorkflowById() instead. */
export function getWorkflowById(id: string): WorkflowInstance | undefined {
  seedMockData();
  return workflowInstances.find(w => w.id === id);
}

/** @deprecated Use getWorkflowStore().getStepsForWorkflow() instead. */
export function getWorkflowSteps(workflowId: string): WorkflowStep[] {
  seedMockData();
  return workflowSteps
    .filter(s => s.workflowId === workflowId)
    .sort((a, b) => a.stepNumber - b.stepNumber);
}

/** @deprecated Use getWorkflowStore() + getPendingStepsForApprover instead. */
export function getPendingWorkflowsForApprover(approverId: string): WorkflowInstance[] {
  seedMockData();
  const stepWorkflowIds = workflowSteps
    .filter(s => s.approverId === approverId && s.status === 'pending')
    .map(s => s.workflowId);
  return workflowInstances.filter(w => stepWorkflowIds.includes(w.id) && w.status === 'in_progress');
}

/** @deprecated Use getWorkflowStore() + getPendingStepsForApprover instead. */
export function getApprovalInboxForUser(userId: string): ApprovalInboxItem[] {
  seedMockData();
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

/** @deprecated Use getWorkflowStore() + createWorkflow/createStep instead. */
export function createWorkflow(
  workflowType: WorkflowInstance['workflowType'],
  referenceType: string,
  referenceId: string,
  initiatorId: string
): WorkflowInstance | null {
  seedMockData();
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

  config.steps.forEach((stepConfig, index) => {
    const dueDate = addDaysToDateOnly(toDateOnlyString(), (index + 1) * 2);

    workflowSteps.push({
      id: `ws-${String(workflowSteps.length + 1).padStart(3, '0')}`,
      workflowId,
      stepNumber: index + 1,
      stepName: stepConfig.stepName,
      approverId: null,
      approverRole: stepConfig.approverRole,
      status: 'pending',
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

/** @deprecated Use getWorkflowStore() + updateStep/updateWorkflow instead. */
export function approveWorkflowStep(
  stepId: string,
  approverId: string,
  comments?: string
): boolean {
  seedMockData();
  const step = workflowSteps.find(s => s.id === stepId);
  if (!step || step.status !== 'pending') return false;

  const now = new Date().toISOString();

  step.status = 'approved';
  step.approverId = approverId;
  step.comments = comments || null;
  step.actedAt = now;
  step.updatedAt = now;

  const workflow = getWorkflowById(step.workflowId);
  if (workflow) {
    const allSteps = getWorkflowSteps(workflow.id);
    const allCompleted = allSteps.every(s => s.status === 'approved' || s.status === 'skipped');

    if (allCompleted) {
      workflow.status = 'completed';
      workflow.completedAt = now;
      workflow.currentStep = workflow.totalSteps;
    } else {
      workflow.currentStep = step.stepNumber + 1;
      workflow.status = 'in_progress';
    }
    workflow.updatedAt = now;
  }

  return true;
}

/** @deprecated Use getWorkflowStore() + updateStep/updateWorkflow instead. */
export function rejectWorkflowStep(
  stepId: string,
  approverId: string,
  comments: string
): boolean {
  seedMockData();
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

/** @deprecated Use getWorkflowStore().getStepsForWorkflow() instead. */
export function getWorkflowHistory(workflowId: string): WorkflowStep[] {
  seedMockData();
  return getWorkflowSteps(workflowId).filter(s => s.status !== 'pending');
}

/** @deprecated */
export function identifyOverdueSteps(): WorkflowStep[] {
  seedMockData();
  const today = toDateOnlyString();
  return workflowSteps.filter(
    s => s.status === 'pending' && s.dueDate < today && !s.escalatedTo
  );
}

/** @deprecated Kept for backward compatibility only. */
export function initializeWorkflowStore(): void {
  seedMockData();
}

/** @deprecated Kept for backward compatibility only. */
export function ensureWorkflowStoreInitialized(): void {
  seedMockData();
}

// Auto-seed on module load for backward compat
seedMockData();

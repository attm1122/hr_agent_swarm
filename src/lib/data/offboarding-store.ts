/**
 * Offboarding data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `offboarding_plans` / `offboarding_tasks` tables (in production) or
 * the in-memory mock data (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getOffboardingStore();
 *   const plan = await store.getPlanById('ofp-001', 'tenant-leap');
 *
 * Pure helper functions (calculateOffboardingProgress, generateExitSummary, etc.)
 * and OFFBOARDING_TEMPLATES are re-exported for backward compatibility.
 */

import type { OffboardingPlan, OffboardingTask, OffboardingAsset, OffboardingAccess, OffboardingExitSummary } from '@/types';
import { getEmployeeById, getEmployeeFullName } from './mock-data';
import { addDaysToDateOnly, toDateOnlyString } from '@/lib/date-only';
import {
  offboardingPlanFromRow,
  offboardingTaskFromRow,
  offboardingAssetFromRow,
  offboardingAccessFromRow,
} from './mappers';

// ==========================================
// Template definitions (shared)
// ==========================================

type OffboardingTemplateTask = {
  taskName: string;
  category: OffboardingTask['category'];
  assignedTo: string;
  dueDateOffset: number;
  priority: OffboardingTask['priority'];
};

type OffboardingTemplateAsset = {
  assetType: OffboardingAsset['assetType'];
  description: string;
  expectedReturnDateOffset: number;
};

type OffboardingTemplateAccess = {
  systemName: string;
  removalStatus: OffboardingAccess['removalStatus'];
  scheduledOffset: number;
};

export const OFFBOARDING_TEMPLATES: Record<string, { name: string; tasks: OffboardingTemplateTask[]; assets: OffboardingTemplateAsset[]; access: OffboardingTemplateAccess[] }> = {
  standard: {
    name: 'Standard Employee Exit',
    tasks: [
      { taskName: 'Exit interview', category: 'hr_exit', assignedTo: 'emp-001', dueDateOffset: -2, priority: 'high' },
      { taskName: 'Knowledge transfer session', category: 'knowledge_transfer', assignedTo: 'manager', dueDateOffset: -3, priority: 'high' },
      { taskName: 'Final payroll processing', category: 'payroll_exit', assignedTo: 'payroll', dueDateOffset: 0, priority: 'high' },
      { taskName: 'Return company assets', category: 'asset_return', assignedTo: 'exiting_employee', dueDateOffset: 0, priority: 'high' },
      { taskName: 'Project handoff completion', category: 'knowledge_transfer', assignedTo: 'exiting_employee', dueDateOffset: -2, priority: 'medium' },
      { taskName: 'Remove system access', category: 'access_removal', assignedTo: 'it_admin', dueDateOffset: 0, priority: 'high' },
    ],
    assets: [
      { assetType: 'laptop', description: 'Company laptop and charger', expectedReturnDateOffset: 0 },
      { assetType: 'badge', description: 'Building access badge', expectedReturnDateOffset: 0 },
      { assetType: 'credit_card', description: 'Company credit card', expectedReturnDateOffset: -1 },
    ],
    access: [
      { systemName: 'email', removalStatus: 'pending', scheduledOffset: 0 },
      { systemName: 'slack', removalStatus: 'pending', scheduledOffset: 0 },
      { systemName: 'vpn', removalStatus: 'pending', scheduledOffset: 0 },
      { systemName: 'github', removalStatus: 'pending', scheduledOffset: -1 },
      { systemName: 'aws', removalStatus: 'pending', scheduledOffset: 0 },
    ],
  },
  voluntary: {
    name: 'Voluntary Resignation',
    tasks: [
      { taskName: 'Resignation acknowledgment', category: 'hr_exit', assignedTo: 'emp-001', dueDateOffset: 0, priority: 'high' },
      { taskName: 'Notice period confirmation', category: 'hr_exit', assignedTo: 'emp-001', dueDateOffset: 0, priority: 'high' },
      { taskName: 'Knowledge transfer plan', category: 'knowledge_transfer', assignedTo: 'manager', dueDateOffset: -10, priority: 'medium' },
      { taskName: 'Exit interview', category: 'hr_exit', assignedTo: 'emp-001', dueDateOffset: -1, priority: 'medium' },
      { taskName: 'Final paycheck review', category: 'payroll_exit', assignedTo: 'payroll', dueDateOffset: 0, priority: 'high' },
    ],
    assets: [
      { assetType: 'laptop', description: 'Company laptop', expectedReturnDateOffset: 0 },
      { assetType: 'badge', description: 'Access badge', expectedReturnDateOffset: 0 },
    ],
    access: [
      { systemName: 'email', removalStatus: 'pending', scheduledOffset: 0 },
      { systemName: 'slack', removalStatus: 'pending', scheduledOffset: 0 },
      { systemName: 'vpn', removalStatus: 'pending', scheduledOffset: 0 },
    ],
  },
};

// ==========================================
// In-memory mock data
// ==========================================

export const offboardingPlans: OffboardingPlan[] = [];
export const offboardingTasks: OffboardingTask[] = [];
export const offboardingAssets: OffboardingAsset[] = [];
export const offboardingAccessItems: OffboardingAccess[] = [];

function seedMockData(): void {
  // No initial offboarding plans — these are created when needed
}

// ==========================================
// Pure helper functions (shared, no store dependency)
// ==========================================

export function calculateOffboardingProgress(tasks: OffboardingTask[]): { completed: number; total: number; percentage: number } {
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function getOffboardingAssetStatus(assets: OffboardingAsset[]): { returned: number; total: number } {
  const returned = assets.filter(a => a.returnedAt !== null).length;
  return { returned, total: assets.length };
}

export function getOffboardingAccessStatus(accessItems: OffboardingAccess[]): { completed: number; total: number } {
  const completed = accessItems.filter(a => a.removalStatus === 'completed').length;
  return { completed, total: accessItems.length };
}

export function generateExitSummary(
  plan: OffboardingPlan,
  employeeName: string,
  tasks: OffboardingTask[],
  assets: OffboardingAsset[],
  accessItems: OffboardingAccess[],
): OffboardingExitSummary {
  const pendingItems: string[] = [];

  tasks.filter(t => t.status !== 'completed').forEach(t => {
    pendingItems.push(`Task: ${t.taskName}`);
  });

  assets.filter(a => a.returnedAt === null).forEach(a => {
    pendingItems.push(`Asset: ${a.description}`);
  });

  accessItems.filter(a => a.removalStatus !== 'completed' && a.removalStatus !== 'na').forEach(a => {
    pendingItems.push(`Access: ${a.systemName}`);
  });

  return {
    planId: plan.id,
    employeeId: plan.employeeId,
    employeeName,
    terminationDate: plan.terminationDate,
    tasksCompleted: tasks.filter(t => t.status === 'completed').length,
    tasksTotal: tasks.length,
    assetsReturned: assets.filter(a => a.returnedAt !== null).length,
    assetsTotal: assets.length,
    accessRemoved: accessItems.filter(a => a.removalStatus === 'completed').length,
    accessTotal: accessItems.filter(a => a.removalStatus !== 'na').length,
    pendingItems,
    exitCleared: pendingItems.length === 0,
  };
}

// ==========================================
// Store interface
// ==========================================

export interface OffboardingStore {
  readonly backend: 'supabase' | 'mock';
  getPlanById(id: string, tenantId: string): Promise<OffboardingPlan | null>;
  getActivePlanByEmployee(employeeId: string, tenantId: string): Promise<OffboardingPlan | null>;
  getAllPlans(tenantId: string): Promise<OffboardingPlan[]>;
  getTasksForPlan(planId: string, tenantId: string): Promise<OffboardingTask[]>;
  getAssetsForPlan(planId: string, tenantId: string): Promise<OffboardingAsset[]>;
  getAccessForPlan(planId: string, tenantId: string): Promise<OffboardingAccess[]>;
  createPlan(plan: Omit<OffboardingPlan, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OffboardingPlan | null>;
  createTask(task: Omit<OffboardingTask, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OffboardingTask | null>;
  createAsset(asset: Omit<OffboardingAsset, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OffboardingAsset | null>;
  createAccess(access: Omit<OffboardingAccess, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OffboardingAccess | null>;
  updateTask(taskId: string, fields: Partial<OffboardingTask>, tenantId: string): Promise<OffboardingTask | null>;
  updatePlan(planId: string, fields: Partial<OffboardingPlan>, tenantId: string): Promise<OffboardingPlan | null>;
  updateAsset(assetId: string, fields: Partial<OffboardingAsset>, tenantId: string): Promise<OffboardingAsset | null>;
  updateAccess(accessId: string, fields: Partial<OffboardingAccess>, tenantId: string): Promise<OffboardingAccess | null>;
}

// ==========================================
// Mock-backed implementation
// ==========================================

const mockStore: OffboardingStore = {
  backend: 'mock',

  async getPlanById(id: string) {
    seedMockData();
    return offboardingPlans.find(p => p.id === id) ?? null;
  },
  async getActivePlanByEmployee(employeeId: string) {
    seedMockData();
    return offboardingPlans.find(p => p.employeeId === employeeId && !['completed', 'cancelled'].includes(p.status)) ?? null;
  },
  async getAllPlans() {
    seedMockData();
    return [...offboardingPlans];
  },
  async getTasksForPlan(planId: string) {
    seedMockData();
    return offboardingTasks.filter(t => t.planId === planId);
  },
  async getAssetsForPlan(planId: string) {
    seedMockData();
    return offboardingAssets.filter(a => a.planId === planId);
  },
  async getAccessForPlan(planId: string) {
    seedMockData();
    return offboardingAccessItems.filter(a => a.planId === planId);
  },
  async createPlan(plan) {
    seedMockData();
    const full: OffboardingPlan = { ...plan, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    offboardingPlans.push(full);
    return full;
  },
  async createTask(task) {
    seedMockData();
    const full: OffboardingTask = { ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    offboardingTasks.push(full);
    return full;
  },
  async createAsset(asset) {
    seedMockData();
    const full: OffboardingAsset = { ...asset, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    offboardingAssets.push(full);
    return full;
  },
  async createAccess(access) {
    seedMockData();
    const full: OffboardingAccess = { ...access, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    offboardingAccessItems.push(full);
    return full;
  },
  async updateTask(taskId: string, fields: Partial<OffboardingTask>) {
    seedMockData();
    const task = offboardingTasks.find(t => t.id === taskId);
    if (!task) return null;
    Object.assign(task, fields, { updatedAt: new Date().toISOString() });
    return { ...task };
  },
  async updatePlan(planId: string, fields: Partial<OffboardingPlan>) {
    seedMockData();
    const plan = offboardingPlans.find(p => p.id === planId);
    if (!plan) return null;
    Object.assign(plan, fields, { updatedAt: new Date().toISOString() });
    return { ...plan };
  },
  async updateAsset(assetId: string, fields: Partial<OffboardingAsset>) {
    seedMockData();
    const asset = offboardingAssets.find(a => a.id === assetId);
    if (!asset) return null;
    Object.assign(asset, fields, { updatedAt: new Date().toISOString() });
    return { ...asset };
  },
  async updateAccess(accessId: string, fields: Partial<OffboardingAccess>) {
    seedMockData();
    const access = offboardingAccessItems.find(a => a.id === accessId);
    if (!access) return null;
    Object.assign(access, fields, { updatedAt: new Date().toISOString() });
    return { ...access };
  },
};

// ==========================================
// Supabase-backed implementation
// ==========================================

function createSupabaseStore(): OffboardingStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async getPlanById(id: string, tenantId: string) {
      const t = (await table('offboarding_plans')) as {
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
      return data ? offboardingPlanFromRow(data as never) : null;
    },

    async getActivePlanByEmployee(employeeId: string, tenantId: string) {
      const t = (await table('offboarding_plans')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              not: (c: string, op: string, v: string) => {
                not: (c: string, op: string, v: string) => {
                  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'cancelled')
        .maybeSingle();
      if (error) throw error;
      return data ? offboardingPlanFromRow(data as never) : null;
    },

    async getAllPlans(tenantId: string) {
      const t = (await table('offboarding_plans')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => offboardingPlanFromRow(r as never));
    },

    async getTasksForPlan(planId: string, tenantId: string) {
      const t = (await table('offboarding_tasks')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).eq('plan_id', planId);
      if (error) throw error;
      return (data ?? []).map((r) => offboardingTaskFromRow(r as never));
    },

    async getAssetsForPlan(planId: string, tenantId: string) {
      const t = (await table('offboarding_assets')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).eq('plan_id', planId);
      if (error) throw error;
      return (data ?? []).map((r) => offboardingAssetFromRow(r as never));
    },

    async getAccessForPlan(planId: string, tenantId: string) {
      const t = (await table('offboarding_access')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).eq('plan_id', planId);
      if (error) throw error;
      return (data ?? []).map((r) => offboardingAccessFromRow(r as never));
    },

    async createPlan(plan, tenantId: string) {
      const t = (await table('offboarding_plans')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: plan.id,
          tenant_id: tenantId,
          employee_id: plan.employeeId,
          termination_date: plan.terminationDate,
          initiated_by: plan.initiatedBy,
          status: plan.status,
          checklist_template: plan.checklistTemplate,
          target_completion_date: plan.targetCompletionDate,
          actual_completion_date: plan.actualCompletionDate,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? offboardingPlanFromRow(data as never) : null;
    },

    async createTask(task, tenantId: string) {
      const t = (await table('offboarding_tasks')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: task.id,
          tenant_id: tenantId,
          plan_id: task.planId,
          task_name: task.taskName,
          category: task.category,
          assigned_to: task.assignedTo,
          due_date: task.dueDate,
          completed_at: task.completedAt,
          completed_by: task.completedBy,
          status: task.status,
          priority: task.priority,
          depends_on: task.dependsOn,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? offboardingTaskFromRow(data as never) : null;
    },

    async createAsset(asset, tenantId: string) {
      const t = (await table('offboarding_assets')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: asset.id,
          tenant_id: tenantId,
          plan_id: asset.planId,
          asset_type: asset.assetType,
          description: asset.description,
          expected_return_date: asset.expectedReturnDate,
          returned_at: asset.returnedAt,
          condition_notes: asset.conditionNotes,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? offboardingAssetFromRow(data as never) : null;
    },

    async createAccess(access, tenantId: string) {
      const t = (await table('offboarding_access')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert({
          id: access.id,
          tenant_id: tenantId,
          plan_id: access.planId,
          system_name: access.systemName,
          removal_status: access.removalStatus,
          scheduled_date: access.scheduledDate,
          completed_at: access.completedAt,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? offboardingAccessFromRow(data as never) : null;
    },

    async updateTask(taskId: string, fields: Partial<OffboardingTask>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.completedAt !== undefined) row.completed_at = fields.completedAt;
      if (fields.completedBy !== undefined) row.completed_by = fields.completedBy;

      const t = (await table('offboarding_tasks')) as {
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
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', taskId).select('*').maybeSingle();
      if (error) throw error;
      return data ? offboardingTaskFromRow(data as never) : null;
    },

    async updatePlan(planId: string, fields: Partial<OffboardingPlan>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.actualCompletionDate !== undefined) row.actual_completion_date = fields.actualCompletionDate;

      const t = (await table('offboarding_plans')) as {
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
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', planId).select('*').maybeSingle();
      if (error) throw error;
      return data ? offboardingPlanFromRow(data as never) : null;
    },

    async updateAsset(assetId: string, fields: Partial<OffboardingAsset>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.returnedAt !== undefined) row.returned_at = fields.returnedAt;
      if (fields.conditionNotes !== undefined) row.condition_notes = fields.conditionNotes;

      const t = (await table('offboarding_assets')) as {
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
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', assetId).select('*').maybeSingle();
      if (error) throw error;
      return data ? offboardingAssetFromRow(data as never) : null;
    },

    async updateAccess(accessId: string, fields: Partial<OffboardingAccess>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.removalStatus !== undefined) row.removal_status = fields.removalStatus;
      if (fields.completedAt !== undefined) row.completed_at = fields.completedAt;

      const t = (await table('offboarding_access')) as {
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
      const { data, error } = await t.update(row).eq('tenant_id', tenantId).eq('id', accessId).select('*').maybeSingle();
      if (error) throw error;
      return data ? offboardingAccessFromRow(data as never) : null;
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

let cachedStore: OffboardingStore | null = null;

export function getOffboardingStore(): OffboardingStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetOffboardingStore(): void {
  cachedStore = null;
}

// ==========================================
// Backward-compat helpers
// ==========================================

/** @deprecated Use getOffboardingStore() + createPlan/createTask/createAsset/createAccess. */
export function createOffboardingPlan(
  employeeId: string,
  templateName: string,
  terminationDate: string,
  initiatedById: string
): OffboardingPlan | null {
  seedMockData();
  const employee = getEmployeeById(employeeId);
  if (!employee) return null;

  const template = OFFBOARDING_TEMPLATES[templateName];
  if (!template) return null;

  const existingPlan = offboardingPlans.find(p => p.employeeId === employeeId && !['completed', 'cancelled'].includes(p.status));
  if (existingPlan) return null;

  const planId = `ofp-${String(offboardingPlans.length + 1).padStart(3, '0')}`;

  const plan: OffboardingPlan = {
    id: planId,
    employeeId,
    terminationDate,
    initiatedBy: initiatedById,
    status: 'pending',
    checklistTemplate: templateName,
    targetCompletionDate: terminationDate,
    actualCompletionDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  offboardingPlans.push(plan);

  template.tasks.forEach((taskTemplate, index) => {
    const dueDate = addDaysToDateOnly(terminationDate, taskTemplate.dueDateOffset);

    let assignedTo = taskTemplate.assignedTo;
    if (assignedTo === 'manager') assignedTo = employee.managerId || 'emp-001';
    if (assignedTo === 'exiting_employee') assignedTo = employeeId;
    if (assignedTo === 'payroll') assignedTo = 'emp-019';
    if (assignedTo === 'it_admin') assignedTo = 'emp-003';

    offboardingTasks.push({
      id: `oft-${String(offboardingTasks.length + 1).padStart(3, '0')}`,
      planId,
      taskName: taskTemplate.taskName,
      category: taskTemplate.category,
      assignedTo,
      dueDate,
      completedAt: null,
      completedBy: null,
      status: 'pending',
      priority: taskTemplate.priority,
      dependsOn: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  template.assets.forEach((assetTemplate) => {
    const returnDate = addDaysToDateOnly(terminationDate, assetTemplate.expectedReturnDateOffset);

    offboardingAssets.push({
      id: `ofa-${String(offboardingAssets.length + 1).padStart(3, '0')}`,
      planId,
      assetType: assetTemplate.assetType,
      description: assetTemplate.description,
      expectedReturnDate: returnDate,
      returnedAt: null,
      conditionNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  template.access.forEach((accessTemplate) => {
    const scheduledDate = addDaysToDateOnly(terminationDate, accessTemplate.scheduledOffset);

    offboardingAccessItems.push({
      id: `ofc-${String(offboardingAccessItems.length + 1).padStart(3, '0')}`,
      planId,
      systemName: accessTemplate.systemName,
      removalStatus: accessTemplate.removalStatus,
      scheduledDate: accessTemplate.scheduledOffset === 0 ? null : scheduledDate,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return plan;
}

/** @deprecated Use getOffboardingStore() + updateTask instead. */
export function completeOffboardingTask(taskId: string, completedById: string): boolean {
  seedMockData();
  const task = offboardingTasks.find(t => t.id === taskId);
  if (!task || task.status === 'completed') return false;

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.completedBy = completedById;
  task.updatedAt = new Date().toISOString();

  const planTasks = offboardingTasks.filter(t => t.planId === task.planId);
  const allCompleted = planTasks.every(t => t.status === 'completed');
  if (allCompleted) {
    const plan = offboardingPlans.find(p => p.id === task.planId);
    if (plan) {
      plan.status = 'completed';
      plan.actualCompletionDate = toDateOnlyString();
      plan.updatedAt = new Date().toISOString();
    }
  }

  return true;
}

/** @deprecated Use getOffboardingStore() + updateAsset instead. */
export function recordAssetReturn(assetId: string, conditionNotes?: string): boolean {
  seedMockData();
  const asset = offboardingAssets.find(a => a.id === assetId);
  if (!asset || asset.returnedAt !== null) return false;

  asset.returnedAt = new Date().toISOString();
  asset.conditionNotes = conditionNotes || null;
  asset.updatedAt = new Date().toISOString();

  return true;
}

/** @deprecated Use getOffboardingStore() + updateAccess instead. */
export function updateAccessRemovalStatus(accessId: string, status: OffboardingAccess['removalStatus']): boolean {
  seedMockData();
  const access = offboardingAccessItems.find(a => a.id === accessId);
  if (!access) return false;

  access.removalStatus = status;
  if (status === 'completed') {
    access.completedAt = new Date().toISOString();
  }
  access.updatedAt = new Date().toISOString();

  return true;
}

/** @deprecated Kept for backward compatibility only. */
export function initializeOffboardingStore(): void {
  seedMockData();
}

/** @deprecated Kept for backward compatibility only. */
export function ensureOffboardingStoreInitialized(): void {
  seedMockData();
}

// Auto-seed on module load for backward compat
seedMockData();

/**
 * Onboarding data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `onboarding_plans` / `onboarding_tasks` tables (in production) or
 * the in-memory mock data (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getOnboardingStore();
 *   const plan = await store.getPlanById('obp-001', 'tenant-leap');
 *
 * Pure helper functions (calculateOnboardingProgress, identifyOnboardingBlockers,
 * createOnboardingPlan, completeOnboardingTask) and ONBOARDING_TEMPLATES are
 * re-exported for backward compatibility.
 */

import type { OnboardingPlan, OnboardingTask, OnboardingBlocker } from '@/types';
import { getEmployeeById, getEmployeeFullName } from './mock-data';
import { addDaysToDateOnly, differenceInDateOnlyDays, toDateOnlyString } from '@/lib/date-only';
import { onboardingPlanFromRow, onboardingTaskFromRow } from './mappers';

// ==========================================
// Template definitions (shared by both mock and agent)
// ==========================================

type OnboardingTemplateTask = {
  taskName: string;
  description?: string;
  category: OnboardingTask['category'];
  assignedTo: string;
  dueDateOffset: number;
  priority: OnboardingTask['priority'];
};

export const ONBOARDING_TEMPLATES: Record<string, { name: string; tasks: OnboardingTemplateTask[] }> = {
  standard: {
    name: 'Standard Employee Onboarding',
    tasks: [
      { taskName: 'Complete HR documentation', description: 'Fill out all required HR forms', category: 'hr', assignedTo: 'emp-001', dueDateOffset: 3, priority: 'high' },
      { taskName: 'IT equipment setup', description: 'Laptop, accounts, and access provisioning', category: 'it', assignedTo: 'emp-001', dueDateOffset: 1, priority: 'high' },
      { taskName: 'Security badge issuance', description: 'Obtain building access badge', category: 'admin', assignedTo: 'emp-001', dueDateOffset: 1, priority: 'high' },
      { taskName: 'Team introduction meeting', description: 'Meet with immediate team members', category: 'team', assignedTo: 'manager', dueDateOffset: 2, priority: 'medium' },
      { taskName: 'Manager 1:1', description: 'First one-on-one with direct manager', category: 'team', assignedTo: 'manager', dueDateOffset: 1, priority: 'medium' },
      { taskName: 'Complete compliance training', description: 'Security and policy training modules', category: 'compliance', assignedTo: 'new_hire', dueDateOffset: 5, priority: 'high' },
      { taskName: 'Product overview training', description: 'Introduction to company products', category: 'training', assignedTo: 'new_hire', dueDateOffset: 7, priority: 'medium' },
    ],
  },
  engineering: {
    name: 'Engineering Onboarding',
    tasks: [
      { taskName: 'Dev environment setup', description: 'IDE, repos, and build tools', category: 'it', assignedTo: 'emp-001', dueDateOffset: 1, priority: 'high' },
      { taskName: 'Code repository access', description: 'GitHub/GitLab access and permissions', category: 'it', assignedTo: 'emp-001', dueDateOffset: 1, priority: 'high' },
      { taskName: 'Security training', description: 'Secure coding and data handling', category: 'compliance', assignedTo: 'new_hire', dueDateOffset: 3, priority: 'high' },
      { taskName: 'Architecture overview', description: 'System architecture walkthrough', category: 'training', assignedTo: 'tech_lead', dueDateOffset: 5, priority: 'medium' },
      { taskName: 'First code review', description: 'Shadow and participate in code review', category: 'team', assignedTo: 'buddy', dueDateOffset: 7, priority: 'medium' },
    ],
  },
  executive: {
    name: 'Executive Onboarding',
    tasks: [
      { taskName: 'Leadership team introductions', description: 'Meet with C-suite and key stakeholders', category: 'team', assignedTo: 'emp-001', dueDateOffset: 2, priority: 'high' },
      { taskName: 'Strategy briefing', description: 'Company strategy and OKR review', category: 'training', assignedTo: 'emp-001', dueDateOffset: 3, priority: 'high' },
      { taskName: 'Board materials review', description: 'Review recent board meeting materials', category: 'compliance', assignedTo: 'new_hire', dueDateOffset: 5, priority: 'high' },
      { taskName: 'Direct report 1:1s', description: 'Individual meetings with all direct reports', category: 'team', assignedTo: 'new_hire', dueDateOffset: 7, priority: 'high' },
    ],
  },
};

// ==========================================
// In-memory mock data
// ==========================================

export const onboardingPlans: OnboardingPlan[] = [];
export const onboardingTasks: OnboardingTask[] = [];

function seedMockData(): void {
  if (onboardingPlans.length > 0) return; // already seeded

  const planId = 'obp-001';
  const startDate = toDateOnlyString();
  const targetDate = addDaysToDateOnly(startDate, 14);

  onboardingPlans.push({
    id: planId,
    employeeId: 'emp-022',
    assignedTo: 'emp-005',
    templateName: 'standard',
    startDate,
    targetCompletionDate: targetDate,
    actualCompletionDate: null,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const template = ONBOARDING_TEMPLATES.standard;
  template.tasks.forEach((taskTemplate, index) => {
    const dueDate = addDaysToDateOnly(startDate, taskTemplate.dueDateOffset);

    let assignedTo = taskTemplate.assignedTo;
    if (assignedTo === 'manager') assignedTo = 'emp-005';
    if (assignedTo === 'new_hire') assignedTo = 'emp-022';
    if (assignedTo === 'tech_lead') assignedTo = 'emp-006';
    if (assignedTo === 'buddy') assignedTo = 'emp-008';

    onboardingTasks.push({
      id: `obt-${String(index + 1).padStart(3, '0')}`,
      planId,
      taskName: taskTemplate.taskName,
      description: taskTemplate.description || null,
      category: taskTemplate.category,
      assignedTo,
      dueDate,
      completedAt: index < 3 ? new Date().toISOString() : null,
      completedBy: index < 3 ? 'emp-001' : null,
      status: index < 3 ? 'completed' : index === 3 ? 'in_progress' : 'pending',
      priority: taskTemplate.priority,
      dependsOn: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

// ==========================================
// Pure helper functions (shared, no store dependency)
// ==========================================

export function calculateOnboardingProgress(tasks: OnboardingTask[]): { completed: number; total: number; percentage: number } {
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function identifyOnboardingBlockers(tasks: OnboardingTask[]): OnboardingBlocker[] {
  const blockers: OnboardingBlocker[] = [];
  const today = toDateOnlyString();

  tasks.forEach(task => {
    if (task.status === 'blocked') {
      blockers.push({
        taskId: task.id,
        taskName: task.taskName,
        reason: 'Task is blocked by dependencies or external factors',
        severity: 'blocking',
      });
    } else if (task.status !== 'completed' && task.dueDate < today) {
      const daysOverdue = differenceInDateOnlyDays(today, task.dueDate);
      blockers.push({
        taskId: task.id,
        taskName: task.taskName,
        reason: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
        severity: daysOverdue > 3 ? 'blocking' : 'warning',
      });
    }
  });

  return blockers;
}

// ==========================================
// Store interface
// ==========================================

export interface OnboardingStore {
  readonly backend: 'supabase' | 'mock';
  getPlanById(id: string, tenantId: string): Promise<OnboardingPlan | null>;
  getActivePlanByEmployee(employeeId: string, tenantId: string): Promise<OnboardingPlan | null>;
  getAllPlans(tenantId: string): Promise<OnboardingPlan[]>;
  getTasksForPlan(planId: string, tenantId: string): Promise<OnboardingTask[]>;
  createPlan(plan: Omit<OnboardingPlan, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OnboardingPlan | null>;
  createTask(task: Omit<OnboardingTask, 'createdAt' | 'updatedAt'>, tenantId: string): Promise<OnboardingTask | null>;
  updateTask(taskId: string, fields: Partial<OnboardingTask>, tenantId: string): Promise<OnboardingTask | null>;
  updatePlan(planId: string, fields: Partial<OnboardingPlan>, tenantId: string): Promise<OnboardingPlan | null>;
}

// ==========================================
// Mock-backed implementation
// ==========================================

const mockStore: OnboardingStore = {
  backend: 'mock',

  async getPlanById(id: string) {
    seedMockData();
    return onboardingPlans.find(p => p.id === id) ?? null;
  },
  async getActivePlanByEmployee(employeeId: string) {
    seedMockData();
    return onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed') ?? null;
  },
  async getAllPlans() {
    seedMockData();
    return [...onboardingPlans];
  },
  async getTasksForPlan(planId: string) {
    seedMockData();
    return onboardingTasks.filter(t => t.planId === planId);
  },
  async createPlan(plan) {
    seedMockData();
    const full: OnboardingPlan = { ...plan, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    onboardingPlans.push(full);
    return full;
  },
  async createTask(task) {
    seedMockData();
    const full: OnboardingTask = { ...task, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    onboardingTasks.push(full);
    return full;
  },
  async updateTask(taskId: string, fields: Partial<OnboardingTask>) {
    seedMockData();
    const task = onboardingTasks.find(t => t.id === taskId);
    if (!task) return null;
    Object.assign(task, fields, { updatedAt: new Date().toISOString() });
    return { ...task };
  },
  async updatePlan(planId: string, fields: Partial<OnboardingPlan>) {
    seedMockData();
    const plan = onboardingPlans.find(p => p.id === planId);
    if (!plan) return null;
    Object.assign(plan, fields, { updatedAt: new Date().toISOString() });
    return { ...plan };
  },
};

// ==========================================
// Supabase-backed implementation
// ==========================================

function createSupabaseStore(): OnboardingStore {
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
      const t = (await table('onboarding_plans')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? onboardingPlanFromRow(data as never) : null;
    },

    async getActivePlanByEmployee(employeeId: string, tenantId: string) {
      const t = (await table('onboarding_plans')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              neq: (c: string, v: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .neq('status', 'completed')
        .maybeSingle();
      if (error) throw error;
      return data ? onboardingPlanFromRow(data as never) : null;
    },

    async getAllPlans(tenantId: string) {
      const t = (await table('onboarding_plans')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => onboardingPlanFromRow(r as never));
    },

    async getTasksForPlan(planId: string, tenantId: string) {
      const t = (await table('onboarding_tasks')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('plan_id', planId);
      if (error) throw error;
      return (data ?? []).map((r) => onboardingTaskFromRow(r as never));
    },

    async createPlan(plan, tenantId: string) {
      const t = (await table('onboarding_plans')) as {
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
          template_name: plan.templateName,
          start_date: plan.startDate,
          target_completion_date: plan.targetCompletionDate,
          actual_completion_date: plan.actualCompletionDate,
          status: plan.status,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? onboardingPlanFromRow(data as never) : null;
    },

    async createTask(task, tenantId: string) {
      const t = (await table('onboarding_tasks')) as {
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
          description: task.description,
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
      return data ? onboardingTaskFromRow(data as never) : null;
    },

    async updateTask(taskId: string, fields: Partial<OnboardingTask>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.completedAt !== undefined) row.completed_at = fields.completedAt;
      if (fields.completedBy !== undefined) row.completed_by = fields.completedBy;

      const t = (await table('onboarding_tasks')) as {
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
      const { data, error } = await t
        .update(row)
        .eq('tenant_id', tenantId)
        .eq('id', taskId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? onboardingTaskFromRow(data as never) : null;
    },

    async updatePlan(planId: string, fields: Partial<OnboardingPlan>, tenantId: string) {
      const row: Record<string, unknown> = {};
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.actualCompletionDate !== undefined) row.actual_completion_date = fields.actualCompletionDate;

      const t = (await table('onboarding_plans')) as {
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
      const { data, error } = await t
        .update(row)
        .eq('tenant_id', tenantId)
        .eq('id', planId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? onboardingPlanFromRow(data as never) : null;
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

let cachedStore: OnboardingStore | null = null;

export function getOnboardingStore(): OnboardingStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetOnboardingStore(): void {
  cachedStore = null;
}

// ==========================================
// Backward-compat helpers (used by agent and external consumers)
// ==========================================

/** @deprecated Use getOnboardingStore() + createPlan/createTask instead. */
export function createOnboardingPlan(
  employeeId: string,
  assignedTo: string,
  templateName: string,
  startDate: Date | string = new Date()
): OnboardingPlan | null {
  seedMockData();
  const employee = getEmployeeById(employeeId);
  if (!employee) return null;

  const template = ONBOARDING_TEMPLATES[templateName];
  if (!template) return null;

  const existingPlan = onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed');
  if (existingPlan) return null;

  const planId = `obp-${String(onboardingPlans.length + 1).padStart(3, '0')}`;
  const normalizedStartDate = typeof startDate === 'string' ? startDate : toDateOnlyString(startDate);
  const targetDate = addDaysToDateOnly(normalizedStartDate, 14);

  const plan: OnboardingPlan = {
    id: planId,
    employeeId,
    assignedTo,
    templateName,
    startDate: normalizedStartDate,
    targetCompletionDate: targetDate,
    actualCompletionDate: null,
    status: 'not_started',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  onboardingPlans.push(plan);

  template.tasks.forEach((taskTemplate, index) => {
    const dueDate = addDaysToDateOnly(normalizedStartDate, taskTemplate.dueDateOffset);

    let taskAssignedTo = taskTemplate.assignedTo;
    if (taskAssignedTo === 'manager') taskAssignedTo = assignedTo;
    if (taskAssignedTo === 'new_hire') taskAssignedTo = employeeId;

    onboardingTasks.push({
      id: `obt-${String(onboardingTasks.length + 1).padStart(3, '0')}`,
      planId,
      taskName: taskTemplate.taskName,
      description: taskTemplate.description || null,
      category: taskTemplate.category,
      assignedTo: taskAssignedTo,
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

  return plan;
}

/** @deprecated Use getOnboardingStore() + updateTask instead. */
export function completeOnboardingTask(taskId: string, completedById: string): boolean {
  seedMockData();
  const task = onboardingTasks.find(t => t.id === taskId);
  if (!task || task.status === 'completed') return false;

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.completedBy = completedById;
  task.updatedAt = new Date().toISOString();

  const planTasks = onboardingTasks.filter(t => t.planId === task.planId);
  const allCompleted = planTasks.every(t => t.status === 'completed');
  if (allCompleted) {
    const plan = onboardingPlans.find(p => p.id === task.planId);
    if (plan) {
      plan.status = 'completed';
      plan.actualCompletionDate = toDateOnlyString();
      plan.updatedAt = new Date().toISOString();
    }
  }

  return true;
}

/** @deprecated Kept for backward compatibility only. */
export function initializeOnboardingStore(): void {
  seedMockData();
}

/** @deprecated Kept for backward compatibility only. */
export function ensureOnboardingStoreInitialized(): void {
  seedMockData();
}

// Auto-seed on module load for backward compat
seedMockData();

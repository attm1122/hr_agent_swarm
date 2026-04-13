/**
 * Offboarding Data Store
 * In-memory store for offboarding plans, tasks, assets, and access items (POC).
 * Production: Replace with Supabase database calls.
 */

import type { OffboardingPlan, OffboardingTask, OffboardingAsset, OffboardingAccess, OffboardingExitSummary } from '@/types';
import { getEmployeeById, getEmployeeFullName } from './mock-data';
import { addDaysToDateOnly, toDateOnlyString } from '@/lib/date-only';

// Template definitions (subset of fields used for template creation)
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

// In-memory stores
export const offboardingPlans: OffboardingPlan[] = [];
export const offboardingTasks: OffboardingTask[] = [];
export const offboardingAssets: OffboardingAsset[] = [];
export const offboardingAccessItems: OffboardingAccess[] = [];

// Templates for offboarding plans
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

// Initialize with sample data
export function initializeOffboardingStore(): void {
  // No initial offboarding plans - these are created when needed
}

// Helper functions
export function getOffboardingPlanById(id: string): OffboardingPlan | undefined {
  return offboardingPlans.find(p => p.id === id);
}

export function getOffboardingPlanByEmployee(employeeId: string): OffboardingPlan | undefined {
  return offboardingPlans.find(p => p.employeeId === employeeId && !['completed', 'cancelled'].includes(p.status));
}

export function getOffboardingTasksForPlan(planId: string): OffboardingTask[] {
  return offboardingTasks.filter(t => t.planId === planId);
}

export function getOffboardingAssetsForPlan(planId: string): OffboardingAsset[] {
  return offboardingAssets.filter(a => a.planId === planId);
}

export function getOffboardingAccessForPlan(planId: string): OffboardingAccess[] {
  return offboardingAccessItems.filter(a => a.planId === planId);
}

export function calculateOffboardingProgress(planId: string): { completed: number; total: number; percentage: number } {
  const tasks = getOffboardingTasksForPlan(planId);
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function getOffboardingAssetStatus(planId: string): { returned: number; total: number } {
  const assets = getOffboardingAssetsForPlan(planId);
  const returned = assets.filter(a => a.returnedAt !== null).length;
  return { returned, total: assets.length };
}

export function getOffboardingAccessStatus(planId: string): { completed: number; total: number } {
  const access = getOffboardingAccessForPlan(planId);
  const completed = access.filter(a => a.removalStatus === 'completed').length;
  return { completed, total: access.length };
}

export function createOffboardingPlan(
  employeeId: string,
  templateName: string,
  terminationDate: string,
  initiatedById: string
): OffboardingPlan | null {
  const employee = getEmployeeById(employeeId);
  if (!employee) return null;

  const template = OFFBOARDING_TEMPLATES[templateName];
  if (!template) return null;

  const existingPlan = getOffboardingPlanByEmployee(employeeId);
  if (existingPlan) {
    return null; // Already has an active plan
  }

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

  // Create tasks from template
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

  // Create assets from template
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

  // Create access items from template
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

export function completeOffboardingTask(taskId: string, completedById: string): boolean {
  const task = offboardingTasks.find(t => t.id === taskId);
  if (!task || task.status === 'completed') return false;

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.completedBy = completedById;
  task.updatedAt = new Date().toISOString();

  // Check if all tasks completed to update plan status
  const planTasks = getOffboardingTasksForPlan(task.planId);
  const allCompleted = planTasks.every(t => t.status === 'completed');
  if (allCompleted) {
    const plan = getOffboardingPlanById(task.planId);
    if (plan) {
      plan.status = 'completed';
      plan.actualCompletionDate = toDateOnlyString();
      plan.updatedAt = new Date().toISOString();
    }
  }

  return true;
}

export function recordAssetReturn(assetId: string, conditionNotes?: string): boolean {
  const asset = offboardingAssets.find(a => a.id === assetId);
  if (!asset || asset.returnedAt !== null) return false;

  asset.returnedAt = new Date().toISOString();
  asset.conditionNotes = conditionNotes || null;
  asset.updatedAt = new Date().toISOString();

  return true;
}

export function updateAccessRemovalStatus(accessId: string, status: OffboardingAccess['removalStatus']): boolean {
  const access = offboardingAccessItems.find(a => a.id === accessId);
  if (!access) return false;

  access.removalStatus = status;
  if (status === 'completed') {
    access.completedAt = new Date().toISOString();
  }
  access.updatedAt = new Date().toISOString();

  return true;
}

export function generateExitSummary(planId: string): OffboardingExitSummary | null {
  const plan = getOffboardingPlanById(planId);
  if (!plan) return null;

  const employee = getEmployeeById(plan.employeeId);
  if (!employee) return null;

  const tasks = getOffboardingTasksForPlan(planId);
  const assets = getOffboardingAssetsForPlan(planId);
  const access = getOffboardingAccessForPlan(planId);

  const pendingItems: string[] = [];

  tasks.filter(t => t.status !== 'completed').forEach(t => {
    pendingItems.push(`Task: ${t.taskName}`);
  });

  assets.filter(a => a.returnedAt === null).forEach(a => {
    pendingItems.push(`Asset: ${a.description}`);
  });

  access.filter(a => a.removalStatus !== 'completed' && a.removalStatus !== 'na').forEach(a => {
    pendingItems.push(`Access: ${a.systemName}`);
  });

  return {
    planId,
    employeeId: plan.employeeId,
    employeeName: getEmployeeFullName(employee),
    terminationDate: plan.terminationDate,
    tasksCompleted: tasks.filter(t => t.status === 'completed').length,
    tasksTotal: tasks.length,
    assetsReturned: assets.filter(a => a.returnedAt !== null).length,
    assetsTotal: assets.length,
    accessRemoved: access.filter(a => a.removalStatus === 'completed').length,
    accessTotal: access.filter(a => a.removalStatus !== 'na').length,
    pendingItems,
    exitCleared: pendingItems.length === 0,
  };
}

// Track if already initialized to prevent duplicate seed data
let isOffboardingStoreInitialized = false;

// Initialize on module load (idempotent)
export function ensureOffboardingStoreInitialized(): void {
  if (!isOffboardingStoreInitialized) {
    initializeOffboardingStore();
    isOffboardingStoreInitialized = true;
  }
}

// Auto-initialize on module load for backward compatibility
ensureOffboardingStoreInitialized();

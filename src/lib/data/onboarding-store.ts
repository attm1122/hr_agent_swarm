/**
 * Onboarding Data Store
 * In-memory store for onboarding plans and tasks (POC).
 * Production: Replace with Supabase database calls.
 */

import type { OnboardingPlan, OnboardingTask, OnboardingBlocker } from '@/types';
import { employees, getEmployeeById, getEmployeeFullName, getDirectReports } from './mock-data';
import { addDaysToDateOnly, differenceInDateOnlyDays, toDateOnlyString } from '@/lib/date-only';

// Template task definition (subset of fields used for template creation)
type OnboardingTemplateTask = {
  taskName: string;
  description?: string;
  category: OnboardingTask['category'];
  assignedTo: string;
  dueDateOffset: number;
  priority: OnboardingTask['priority'];
};

// In-memory stores
export const onboardingPlans: OnboardingPlan[] = [];
export const onboardingTasks: OnboardingTask[] = [];

// Templates for onboarding plans
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

// Initialize with sample data
export function initializeOnboardingStore(): void {
  // Sample onboarding plan for emp-022 (new hire)
  const planId = 'obp-001';
  const startDate = toDateOnlyString();
  const targetDate = addDaysToDateOnly(startDate, 14);

  onboardingPlans.push({
    id: planId,
    employeeId: 'emp-022',
    assignedTo: 'emp-005', // Alex Thompson as hiring manager
    templateName: 'standard',
    startDate,
    targetCompletionDate: targetDate,
    actualCompletionDate: null,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Create tasks from template
  const template = ONBOARDING_TEMPLATES.standard;
  template.tasks.forEach((taskTemplate, index) => {
    const dueDate = addDaysToDateOnly(startDate, taskTemplate.dueDateOffset);

    let assignedTo = taskTemplate.assignedTo;
    if (assignedTo === 'manager') assignedTo = 'emp-005'; // Alex Thompson
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

// Helper functions
export function getOnboardingPlanById(id: string): OnboardingPlan | undefined {
  return onboardingPlans.find(p => p.id === id);
}

export function getOnboardingPlanByEmployee(employeeId: string): OnboardingPlan | undefined {
  return onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed');
}

export function getOnboardingTasksForPlan(planId: string): OnboardingTask[] {
  return onboardingTasks.filter(t => t.planId === planId);
}

export function getOnboardingTasksForEmployee(employeeId: string): OnboardingTask[] {
  const plan = getOnboardingPlanByEmployee(employeeId);
  if (!plan) return [];
  return getOnboardingTasksForPlan(plan.id);
}

export function calculateOnboardingProgress(planId: string): { completed: number; total: number; percentage: number } {
  const tasks = getOnboardingTasksForPlan(planId);
  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    completed,
    total: tasks.length,
    percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

export function identifyOnboardingBlockers(planId: string): OnboardingBlocker[] {
  const tasks = getOnboardingTasksForPlan(planId);
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

export function createOnboardingPlan(
  employeeId: string,
  assignedTo: string,
  templateName: string,
  startDate: Date | string = new Date()
): OnboardingPlan | null {
  const employee = getEmployeeById(employeeId);
  if (!employee) return null;

  const template = ONBOARDING_TEMPLATES[templateName];
  if (!template) return null;

  const existingPlan = getOnboardingPlanByEmployee(employeeId);
  if (existingPlan && existingPlan.status !== 'completed') {
    return null; // Already has an active plan
  }

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

  // Create tasks from template
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

export function completeOnboardingTask(taskId: string, completedById: string): boolean {
  const task = onboardingTasks.find(t => t.id === taskId);
  if (!task || task.status === 'completed') return false;

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.completedBy = completedById;
  task.updatedAt = new Date().toISOString();

  // Update plan status if all tasks completed
  const planTasks = getOnboardingTasksForPlan(task.planId);
  const allCompleted = planTasks.every(t => t.status === 'completed');
  if (allCompleted) {
      const plan = getOnboardingPlanById(task.planId);
      if (plan) {
        plan.status = 'completed';
        plan.actualCompletionDate = toDateOnlyString();
        plan.updatedAt = new Date().toISOString();
      }
  }

  return true;
}

// Track if already initialized to prevent duplicate seed data
let isOnboardingStoreInitialized = false;

// Initialize on module load (idempotent)
export function ensureOnboardingStoreInitialized(): void {
  if (!isOnboardingStoreInitialized) {
    initializeOnboardingStore();
    isOnboardingStoreInitialized = true;
  }
}

// Auto-initialize on module load for backward compatibility
ensureOnboardingStoreInitialized();

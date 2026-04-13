/**
 * Onboarding Agent
 * Handles new employee onboarding workflows, task tracking, and progress monitoring.
 *
 * Data source: `getOnboardingStore()` — transparently reads from Supabase when
 * `SUPABASE_SERVICE_ROLE_KEY` is configured, or falls back to mock data in
 * dev. No agent changes needed to switch modes.
 *
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, OnboardingPlan } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  getOnboardingStore,
  createOnboardingPlan,
  completeOnboardingTask,
  calculateOnboardingProgress,
  identifyOnboardingBlockers,
  ONBOARDING_TEMPLATES,
} from '@/lib/data/onboarding-store';
import {
  canViewOnboarding,
  canCreateOnboarding,
  canManageOnboarding,
  hasCapability,
  isInScope,
} from '@/lib/auth/authorization';
import { getEmployeeStore } from '@/lib/data/employee-store';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';

/** Check if user can view specific onboarding plan */
function canViewPlan(context: AgentContext, plan: OnboardingPlan, teamIds: string[]): boolean {
  if (hasCapability(context.role, 'onboarding:manage:all')) return true;
  if (plan.assignedTo === context.employeeId) return true;
  if (plan.employeeId === context.employeeId) return true;
  return isInScope(context.scope, plan.employeeId, { employeeId: context.employeeId, teamEmployeeIds: teamIds });
}

export class OnboardingAgent implements Agent {
  readonly type = 'onboarding' as const;
  readonly name = 'Onboarding Agent';
  readonly supportedIntents: AgentIntent[] = [
    'onboarding_create',
    'onboarding_status',
    'onboarding_task_list',
    'onboarding_task_complete',
    'onboarding_blockers',
  ];
  readonly requiredPermissions = ['onboarding:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    switch (intent) {
      case 'onboarding_create':
        return this.create(payload, context);
      case 'onboarding_status':
        return this.status(payload, context);
      case 'onboarding_task_list':
        return this.taskList(payload, context);
      case 'onboarding_task_complete':
        return this.taskComplete(payload, context);
      case 'onboarding_blockers':
        return this.blockers(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async create(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canCreateOnboarding(context)) {
      return createErrorResult('Not authorized to create onboarding plans', ['RBAC violation']);
    }

    const employeeId = payload.employeeId as string;
    const assignedTo = payload.assignedTo as string | undefined;
    const templateName = payload.templateName as string | undefined;
    const startDate = payload.startDate as string | undefined;

    if (!employeeId) {
      return createErrorResult('Employee ID is required');
    }

    const empStore = getEmployeeStore();
    const onbStore = getOnboardingStore();
    const tenantId = context.tenantId || 'default';

    const employee = await empStore.findById(employeeId, tenantId);
    if (!employee) {
      return createErrorResult('Employee not found');
    }

    const effectiveManagerId = assignedTo || context.employeeId;
    const effectiveTemplateName = templateName || 'standard';
    if (!ONBOARDING_TEMPLATES[effectiveTemplateName]) {
      return createErrorResult(`Unknown template: ${effectiveTemplateName}`);
    }

    // Check if plan already exists
    const existingPlan = await onbStore.getActivePlanByEmployee(employeeId, tenantId);
    if (existingPlan) {
      return createErrorResult(
        `Active onboarding plan already exists for ${employee.firstName} ${employee.lastName}`,
        [`Existing plan ID: ${existingPlan.id}`]
      );
    }

    const plan = createOnboardingPlan(
      employeeId,
      effectiveManagerId!,
      effectiveTemplateName,
      startDate || new Date()
    );

    if (!plan) {
      return createErrorResult('Failed to create onboarding plan');
    }

    const tasks = await onbStore.getTasksForPlan(plan.id, tenantId);

    const citationSource = onbStore.backend === 'supabase' ? 'Supabase' : 'HR System';

    return createAgentResult(
      {
        plan,
        tasksCreated: tasks.length,
      },
      {
        summary: `Onboarding plan created for ${employee.firstName} ${employee.lastName} with ${ONBOARDING_TEMPLATES[effectiveTemplateName].name}`,
        confidence: 1.0,
        citations: [{ source: citationSource, reference: plan.id }],
      }
    );
  }

  private async status(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string | undefined;
    const employeeId = payload.employeeId as string | undefined;

    const empStore = getEmployeeStore();
    const onbStore = getOnboardingStore();
    const tenantId = context.tenantId || 'default';

    let plan: OnboardingPlan | null = null;

    if (planId) {
      plan = await onbStore.getPlanById(planId, tenantId);
    } else if (employeeId) {
      plan = await onbStore.getActivePlanByEmployee(employeeId, tenantId);
    } else {
      // Return all accessible plans
      const scopeContext = buildRecordScopeContext(context);
      const allPlans = await onbStore.getAllPlans(tenantId);
      const accessiblePlans = allPlans.filter((p) =>
        canViewPlan(context, p, scopeContext.teamEmployeeIds)
      );

      const enriched = await Promise.all(accessiblePlans.map(async (p) => {
        const emp = await empStore.findById(p.employeeId, tenantId);
        const mgr = await empStore.findById(p.assignedTo, tenantId);
        const tasks = await onbStore.getTasksForPlan(p.id, tenantId);
        return {
          ...p,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : p.employeeId,
          hiringManagerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : p.assignedTo,
          progress: calculateOnboardingProgress(tasks).percentage,
        };
      }));

      return createAgentResult(enriched, {
        summary: `Found ${enriched.length} onboarding plan${enriched.length !== 1 ? 's' : ''}`,
        confidence: 1.0,
      });
    }

    if (!plan) {
      return createErrorResult('Onboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOnboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this onboarding plan', ['RBAC violation']);
    }

    const tasks = await onbStore.getTasksForPlan(plan.id, tenantId);
    const progress = calculateOnboardingProgress(tasks);
    const emp = await empStore.findById(plan.employeeId, tenantId);
    const mgr = await empStore.findById(plan.assignedTo, tenantId);

    return createAgentResult(
      {
        plan,
        tasks,
        progress: progress.percentage,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : plan.employeeId,
        hiringManagerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : plan.assignedTo,
      },
      {
        summary: `Onboarding ${progress.percentage}% complete — ${tasks.filter(t => t.status === 'completed').length}/${tasks.length} tasks done`,
        confidence: 1.0,
      }
    );
  }

  private async taskList(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;
    const assignedTo = payload.assignedTo as string | undefined;
    const category = payload.category as string | undefined;
    const status = payload.status as string | undefined;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const empStore = getEmployeeStore();
    const onbStore = getOnboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await onbStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Onboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOnboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    let tasks = await onbStore.getTasksForPlan(planId, tenantId);

    if (assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === assignedTo);
    }
    if (category && category !== 'all') {
      tasks = tasks.filter(t => t.category === category);
    }
    if (status && status !== 'all') {
      tasks = tasks.filter(t => t.status === status);
    }

    const enriched = await Promise.all(tasks.map(async (t) => {
      const assignee = await empStore.findById(t.assignedTo, tenantId);
      return {
        ...t,
        assigneeName: assignee?.firstName || t.assignedTo,
      };
    }));

    return createAgentResult(enriched, {
      summary: `Found ${enriched.length} task${enriched.length !== 1 ? 's' : ''}`,
      confidence: 1.0,
    });
  }

  private async taskComplete(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canManageOnboarding(context)) {
      return createErrorResult('Not authorized to complete tasks', ['RBAC violation']);
    }

    const taskId = payload.taskId as string;

    if (!taskId) {
      return createErrorResult('Task ID is required');
    }

    const onbStore = getOnboardingStore();
    const tenantId = context.tenantId || 'default';

    // Find the task by scanning plan tasks (store has no direct task-by-id lookup
    // but completeOnboardingTask works on the mock arrays)
    const allPlans = await onbStore.getAllPlans(tenantId);
    let foundTask: { taskName: string; planId: string; assignedTo: string } | null = null;
    let foundPlan: { assignedTo: string } | null = null;

    for (const plan of allPlans) {
      const tasks = await onbStore.getTasksForPlan(plan.id, tenantId);
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        foundTask = task;
        foundPlan = plan;
        break;
      }
    }

    if (!foundTask || !foundPlan) {
      return createErrorResult('Task not found');
    }

    // Additional scope check: can only complete tasks if admin, manager of plan, or assigned to task
    const isAssigned = foundTask.assignedTo === context.employeeId;
    const isManager = foundPlan.assignedTo === context.employeeId;
    const isAdmin = hasCapability(context.role, 'onboarding:manage:all');

    if (!isAssigned && !isManager && !isAdmin) {
      return createErrorResult('Access denied: can only complete your assigned tasks', ['RBAC violation']);
    }

    const success = completeOnboardingTask(taskId, context.employeeId!);

    if (!success) {
      return createErrorResult('Failed to complete task');
    }

    const tasks = await onbStore.getTasksForPlan(foundTask.planId, tenantId);
    const progress = calculateOnboardingProgress(tasks);

    return createAgentResult(
      {
        planProgress: progress.percentage,
        planComplete: progress.percentage === 100,
      },
      {
        summary: `Task "${foundTask.taskName}" completed. Plan is now ${progress.percentage}% complete.`,
        confidence: 1.0,
      }
    );
  }

  private async blockers(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const onbStore = getOnboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await onbStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Onboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewPlan(context, plan, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const tasks = await onbStore.getTasksForPlan(planId, tenantId);
    const blockers = identifyOnboardingBlockers(tasks);
    const criticalBlockers = blockers.filter((b) => b.severity === 'blocking');

    return createAgentResult(
      {
        blockers,
        hasBlockers: blockers.length > 0,
        criticalCount: criticalBlockers.length,
        canProceed: criticalBlockers.length === 0,
      },
      {
        summary: blockers.length === 0
          ? 'No blockers — onboarding can proceed'
          : `${blockers.length} blocker${blockers.length !== 1 ? 's' : ''} (${criticalBlockers.length} critical)`,
        confidence: 1.0,
      }
    );
  }
}

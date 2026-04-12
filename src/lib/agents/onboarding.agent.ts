/**
 * Onboarding Agent
 * Handles new employee onboarding workflows, task tracking, and progress monitoring.
 * Data source: onboarding-store.ts (POC; production: Supabase)
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, OnboardingPlan, OnboardingTask } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  onboardingPlans,
  onboardingTasks,
  createOnboardingPlan,
  completeOnboardingTask,
  calculateOnboardingProgress,
  identifyOnboardingBlockers,
  ONBOARDING_TEMPLATES,
  initializeOnboardingStore,
} from '@/lib/data/onboarding-store';
import {
  canViewOnboarding,
  canCreateOnboarding,
  canManageOnboarding,
  hasCapability,
  isInScope,
} from '@/lib/auth/authorization';
import { getEmployeeById, getEmployeeFullName } from '@/lib/data/mock-data';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';

// Ensure store is initialized
initializeOnboardingStore();

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

    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return createErrorResult('Employee not found');
    }

    // Default to current user as hiring manager if not specified
    const effectiveManagerId = assignedTo || context.employeeId;

    // Use default template if not specified
    const effectiveTemplateName = templateName || 'standard';
    if (!ONBOARDING_TEMPLATES[effectiveTemplateName]) {
      return createErrorResult(`Unknown template: ${effectiveTemplateName}`);
    }

    // Check if plan already exists
    const existingPlan = onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed');
    if (existingPlan) {
      return createErrorResult(
        `Active onboarding plan already exists for ${getEmployeeFullName(employee)}`,
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

    return createAgentResult(
      {
        plan,
        tasksCreated: onboardingTasks.filter(t => t.planId === plan.id).length,
      },
      {
        summary: `Onboarding plan created for ${getEmployeeFullName(employee)} with ${ONBOARDING_TEMPLATES[effectiveTemplateName].name}`,
        confidence: 1.0,
        citations: [{ source: 'HR System', reference: plan.id }],
      }
    );
  }

  private async status(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string | undefined;
    const employeeId = payload.employeeId as string | undefined;

    let plan: OnboardingPlan | undefined;

    if (planId) {
      plan = onboardingPlans.find(p => p.id === planId);
    } else if (employeeId) {
      plan = onboardingPlans.find(p => p.employeeId === employeeId && p.status !== 'completed');
    } else {
      // Return all accessible plans
      const scopeContext = buildRecordScopeContext(context);
      const accessiblePlans = onboardingPlans.filter((plan) =>
        canViewPlan(context, plan, scopeContext.teamEmployeeIds)
      );

      const enriched = accessiblePlans.map(p => ({
        ...p,
        employeeName: getEmployeeById(p.employeeId)?.firstName + ' ' + getEmployeeById(p.employeeId)?.lastName,
        hiringManagerName: getEmployeeById(p.assignedTo)?.firstName + ' ' + getEmployeeById(p.assignedTo)?.lastName,
        progress: calculateOnboardingProgress(p.id).percentage,
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

    const tasks = onboardingTasks.filter(t => t.planId === plan!.id);
    const progress = calculateOnboardingProgress(plan.id);

    return createAgentResult(
      {
        plan,
        tasks,
        progress: progress.percentage,
        employeeName: getEmployeeFullName(getEmployeeById(plan.employeeId)!),
        hiringManagerName: getEmployeeFullName(getEmployeeById(plan.assignedTo)!),
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

    const plan = onboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Onboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOnboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    let tasks = onboardingTasks.filter(t => t.planId === planId);

    if (assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === assignedTo);
    }
    if (category && category !== 'all') {
      tasks = tasks.filter(t => t.category === category);
    }
    if (status && status !== 'all') {
      tasks = tasks.filter(t => t.status === status);
    }

    const enriched = tasks.map(t => ({
      ...t,
      assigneeName: getEmployeeById(t.assignedTo)?.firstName || t.assignedTo,
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

    const task = onboardingTasks.find(t => t.id === taskId);
    if (!task) {
      return createErrorResult('Task not found');
    }

    const plan = onboardingPlans.find(p => p.id === task.planId);
    if (!plan) {
      return createErrorResult('Parent onboarding plan not found');
    }

    // Additional scope check: can only complete tasks if admin, manager of plan, or assigned to task
    const isAssigned = task.assignedTo === context.employeeId;
    const isManager = plan.assignedTo === context.employeeId;
    const isAdmin = hasCapability(context.role, 'onboarding:manage:all');

    if (!isAssigned && !isManager && !isAdmin) {
      return createErrorResult('Access denied: can only complete your assigned tasks', ['RBAC violation']);
    }

    const success = completeOnboardingTask(taskId, context.employeeId!);

    if (!success) {
      return createErrorResult('Failed to complete task');
    }

    const progress = calculateOnboardingProgress(plan.id);

    return createAgentResult(
      {
        planProgress: progress.percentage,
        planComplete: progress.percentage === 100,
      },
      {
        summary: `Task "${task.taskName}" completed. Plan is now ${progress.percentage}% complete.`,
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

    const plan = onboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Onboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewPlan(context, plan, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const blockers = identifyOnboardingBlockers(planId);
    const criticalBlockers = blockers.filter((b: { severity: string }) => b.severity === 'blocking');

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

/**
 * Offboarding Agent
 * Handles employee exit workflows, asset returns, access removal tracking, and exit summaries.
 * Data source: offboarding-store.ts (POC; production: Supabase)
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, OffboardingPlan, OffboardingTask, OffboardingAccess } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  offboardingPlans,
  offboardingTasks,
  offboardingAssets,
  offboardingAccessItems,
  createOffboardingPlan,
  completeOffboardingTask,
  calculateOffboardingProgress,
  getOffboardingAssetStatus,
  getOffboardingAccessStatus,
  recordAssetReturn,
  updateAccessRemovalStatus,
  generateExitSummary,
  OFFBOARDING_TEMPLATES,
  initializeOffboardingStore,
} from '@/lib/data/offboarding-store';
import {
  canViewOffboarding,
  canCreateOffboarding,
  canManageOffboarding,
  hasCapability,
} from '@/lib/auth/authorization';
import { getEmployeeById, getEmployeeFullName } from '@/lib/data/mock-data';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';

// Ensure store is initialized
initializeOffboardingStore();

export class OffboardingAgent implements Agent {
  readonly type = 'offboarding' as const;
  readonly name = 'Offboarding Agent';
  readonly supportedIntents: AgentIntent[] = [
    'offboarding_create',
    'offboarding_status',
    'offboarding_task_list',
    'offboarding_task_complete',
    'offboarding_assets',
    'offboarding_access',
    'offboarding_exit_summary',
  ];
  readonly requiredPermissions = ['offboarding:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    switch (intent) {
      case 'offboarding_create':
        return this.create(payload, context);
      case 'offboarding_status':
        return this.status(payload, context);
      case 'offboarding_task_list':
        return this.taskList(payload, context);
      case 'offboarding_task_complete':
        return this.taskComplete(payload, context);
      case 'offboarding_assets':
        return this.assets(payload, context);
      case 'offboarding_access':
        return this.access(payload, context);
      case 'offboarding_exit_summary':
        return this.exitSummary(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async create(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canCreateOffboarding(context)) {
      return createErrorResult('Not authorized to create offboarding plans', ['RBAC violation']);
    }

    const employeeId = payload.employeeId as string;
    const terminationDate = payload.terminationDate as string;
    const templateName = payload.templateName as string | undefined;
    const initiatedBy = payload.initiatedBy as string | undefined;

    if (!employeeId) {
      return createErrorResult('Employee ID is required');
    }
    if (!terminationDate) {
      return createErrorResult('Termination date is required');
    }

    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return createErrorResult('Employee not found');
    }

    const effectiveInitiator = initiatedBy || context.employeeId;
    const effectiveTemplate = templateName || 'standard';

    if (!OFFBOARDING_TEMPLATES[effectiveTemplate]) {
      return createErrorResult(`Unknown template: ${effectiveTemplate}`);
    }

    const plan = createOffboardingPlan(
      employeeId,
      effectiveTemplate,
      terminationDate,
      effectiveInitiator!
    );

    if (!plan) {
      return createErrorResult('Failed to create offboarding plan or active plan already exists');
    }

    return createAgentResult(
      {
        plan,
        tasksCreated: offboardingTasks.filter(t => t.planId === plan.id).length,
        assetsCreated: offboardingAssets.filter(a => a.planId === plan.id).length,
        accessItemsCreated: offboardingAccessItems.filter(a => a.planId === plan.id).length,
      },
      {
        summary: `Offboarding plan created for ${getEmployeeFullName(employee)} with termination date ${terminationDate}`,
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

    let plan: OffboardingPlan | undefined;

    if (planId) {
      plan = offboardingPlans.find(p => p.id === planId);
    } else if (employeeId) {
      plan = offboardingPlans.find(p => p.employeeId === employeeId && !['completed', 'cancelled'].includes(p.status));
    } else {
      // Return all accessible plans
      const plans = offboardingPlans.filter(p => 
        hasCapability(context.role, 'offboarding:manage:all') ||
        p.initiatedBy === context.employeeId ||
        p.employeeId === context.employeeId
      );

      const enriched = plans.map(p => ({
        ...p,
        employeeName: getEmployeeFullName(getEmployeeById(p.employeeId)!),
        progress: calculateOffboardingProgress(p.id).percentage,
      }));

      return createAgentResult(enriched, {
        summary: `Found ${enriched.length} offboarding plan${enriched.length !== 1 ? 's' : ''}`,
        confidence: 1.0,
      });
    }

    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this offboarding plan', ['RBAC violation']);
    }

    const tasks = offboardingTasks.filter(t => t.planId === plan!.id);
    const assets = offboardingAssets.filter(a => a.planId === plan!.id);
    const access = offboardingAccessItems.filter(a => a.planId === plan!.id);
    const progress = calculateOffboardingProgress(plan.id);
    const assetStatus = getOffboardingAssetStatus(plan.id);
    const accessStatus = getOffboardingAccessStatus(plan.id);

    return createAgentResult(
      {
        plan,
        tasks,
        assets,
        access,
        progress: progress.percentage,
        assetStatus,
        accessStatus,
        employeeName: getEmployeeFullName(getEmployeeById(plan.employeeId)!),
      },
      {
        summary: `Offboarding ${progress.percentage}% complete — ${progress.completed}/${progress.total} tasks, ${assetStatus.returned}/${assetStatus.total} assets returned, ${accessStatus.completed}/${accessStatus.total} access items removed`,
        confidence: 1.0,
      }
    );
  }

  private async taskList(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const plan = offboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const tasks = offboardingTasks.filter(t => t.planId === planId);

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
    if (!canManageOffboarding(context)) {
      return createErrorResult('Not authorized to complete tasks', ['RBAC violation']);
    }

    const taskId = payload.taskId as string;

    if (!taskId) {
      return createErrorResult('Task ID is required');
    }

    const task = offboardingTasks.find(t => t.id === taskId);
    if (!task) {
      return createErrorResult('Task not found');
    }

    const plan = offboardingPlans.find(p => p.id === task.planId);
    if (!plan) {
      return createErrorResult('Parent offboarding plan not found');
    }

    // Additional scope check
    const isAssigned = task.assignedTo === context.employeeId;
    const isInitiator = plan.initiatedBy === context.employeeId;
    const isAdmin = hasCapability(context.role, 'offboarding:manage:all');

    if (!isAssigned && !isInitiator && !isAdmin) {
      return createErrorResult('Access denied: can only complete your assigned tasks', ['RBAC violation']);
    }

    const success = completeOffboardingTask(taskId, context.employeeId!);

    if (!success) {
      return createErrorResult('Failed to complete task');
    }

    const progress = calculateOffboardingProgress(plan.id);

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

  private async assets(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const plan = offboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const assets = offboardingAssets.filter(a => a.planId === planId);
    const status = getOffboardingAssetStatus(planId);

    // If action is record_return
    const assetId = payload.assetId as string | undefined;
    const conditionNotes = payload.conditionNotes as string | undefined;
    const action = payload.action as string | undefined;

    if (action === 'record_return' && assetId) {
      if (!canManageOffboarding(context)) {
        return createErrorResult('Not authorized to record asset returns', ['RBAC violation']);
      }

      const success = recordAssetReturn(assetId, conditionNotes);
      if (!success) {
        return createErrorResult('Failed to record asset return');
      }

      const updatedStatus = getOffboardingAssetStatus(planId);
      return createAgentResult(
        { assets, status: updatedStatus },
        {
          summary: `Asset return recorded. ${updatedStatus.returned}/${updatedStatus.total} assets returned.`,
          confidence: 1.0,
        }
      );
    }

    return createAgentResult(
      { assets, status },
      {
        summary: `${status.returned}/${status.total} assets returned (${assets.filter(a => !a.returnedAt).length} pending)`,
        confidence: 1.0,
      }
    );
  }

  private async access(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const plan = offboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const access = offboardingAccessItems.filter(a => a.planId === planId);
    const status = getOffboardingAccessStatus(planId);

    // If action is update_status
    const accessId = payload.accessId as string | undefined;
    const newStatus = payload.newStatus as OffboardingAccess['removalStatus'] | undefined;
    const action = payload.action as string | undefined;

    if (action === 'update_status' && accessId && newStatus) {
      if (!canManageOffboarding(context)) {
        return createErrorResult('Not authorized to update access status', ['RBAC violation']);
      }

      const success = updateAccessRemovalStatus(accessId, newStatus);
      if (!success) {
        return createErrorResult('Failed to update access status');
      }

      const updatedStatus = getOffboardingAccessStatus(planId);
      return createAgentResult(
        { access, status: updatedStatus },
        {
          summary: `Access status updated. ${updatedStatus.completed}/${updatedStatus.total} access items completed.`,
          confidence: 1.0,
        }
      );
    }

    return createAgentResult(
      { access, status },
      {
        summary: `${status.completed}/${status.total} access items removed (${access.filter(a => a.removalStatus !== 'completed').length} pending)`,
        confidence: 1.0,
      }
    );
  }

  private async exitSummary(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const plan = offboardingPlans.find(p => p.id === planId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const summary = generateExitSummary(planId);

    if (!summary) {
      return createErrorResult('Failed to generate exit summary');
    }

    return createAgentResult(summary, {
      summary: `Exit summary for ${summary.employeeName} — ${summary.tasksCompleted}/${summary.tasksTotal} tasks, ${summary.assetsReturned}/${summary.assetsTotal} assets, ${summary.accessRemoved}/${summary.accessTotal} access items`,
      confidence: 1.0,
    });
  }
}

/**
 * Offboarding Agent
 * Handles employee exit workflows, asset returns, access removal tracking, and exit summaries.
 *
 * Data source: `getOffboardingStore()` — transparently reads from Supabase when
 * `SUPABASE_SERVICE_ROLE_KEY` is configured, or falls back to mock data in
 * dev. No agent changes needed to switch modes.
 *
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, OffboardingAccess } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  getOffboardingStore,
  createOffboardingPlan,
  completeOffboardingTask,
  calculateOffboardingProgress,
  getOffboardingAssetStatus,
  getOffboardingAccessStatus,
  recordAssetReturn,
  updateAccessRemovalStatus,
  generateExitSummary,
  OFFBOARDING_TEMPLATES,
} from '@/lib/data/offboarding-store';
import {
  canViewOffboarding,
  canCreateOffboarding,
  canManageOffboarding,
  hasCapability,
} from '@/lib/auth/authorization';
import { getEmployeeStore } from '@/lib/data/employee-store';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';

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

    const empStore = getEmployeeStore();
    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    const employee = await empStore.findById(employeeId, tenantId);
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

    const tasks = await offStore.getTasksForPlan(plan.id, tenantId);
    const assets = await offStore.getAssetsForPlan(plan.id, tenantId);
    const accessItems = await offStore.getAccessForPlan(plan.id, tenantId);

    const citationSource = offStore.backend === 'supabase' ? 'Supabase' : 'HR System';

    return createAgentResult(
      {
        plan,
        tasksCreated: tasks.length,
        assetsCreated: assets.length,
        accessItemsCreated: accessItems.length,
      },
      {
        summary: `Offboarding plan created for ${employee.firstName} ${employee.lastName} with termination date ${terminationDate}`,
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
    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    if (planId) {
      // Lookup by planId
    } else if (employeeId) {
      // Lookup by employeeId
    } else {
      // Return all accessible plans
      const allPlans = await offStore.getAllPlans(tenantId);
      const plans = allPlans.filter(p =>
        hasCapability(context.role, 'offboarding:manage:all') ||
        p.initiatedBy === context.employeeId ||
        p.employeeId === context.employeeId
      );

      const enriched = await Promise.all(plans.map(async (p) => {
        const emp = await empStore.findById(p.employeeId, tenantId);
        const tasks = await offStore.getTasksForPlan(p.id, tenantId);
        return {
          ...p,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : p.employeeId,
          progress: calculateOffboardingProgress(tasks).percentage,
        };
      }));

      return createAgentResult(enriched, {
        summary: `Found ${enriched.length} offboarding plan${enriched.length !== 1 ? 's' : ''}`,
        confidence: 1.0,
      });
    }

    let plan = planId
      ? await offStore.getPlanById(planId, tenantId)
      : employeeId
        ? await offStore.getActivePlanByEmployee(employeeId, tenantId)
        : null;

    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this offboarding plan', ['RBAC violation']);
    }

    const tasks = await offStore.getTasksForPlan(plan.id, tenantId);
    const assets = await offStore.getAssetsForPlan(plan.id, tenantId);
    const accessItems = await offStore.getAccessForPlan(plan.id, tenantId);
    const progress = calculateOffboardingProgress(tasks);
    const assetStatus = getOffboardingAssetStatus(assets);
    const accessStatus = getOffboardingAccessStatus(accessItems);
    const emp = await empStore.findById(plan.employeeId, tenantId);

    return createAgentResult(
      {
        plan,
        tasks,
        assets,
        access: accessItems,
        progress: progress.percentage,
        assetStatus,
        accessStatus,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : plan.employeeId,
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

    const empStore = getEmployeeStore();
    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await offStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const tasks = await offStore.getTasksForPlan(planId, tenantId);

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
    if (!canManageOffboarding(context)) {
      return createErrorResult('Not authorized to complete tasks', ['RBAC violation']);
    }

    const taskId = payload.taskId as string;

    if (!taskId) {
      return createErrorResult('Task ID is required');
    }

    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    // Find the task by scanning plan tasks
    const allPlans = await offStore.getAllPlans(tenantId);
    let foundTask: { taskName: string; planId: string; assignedTo: string } | null = null;
    let foundPlan: { initiatedBy: string } | null = null;

    for (const plan of allPlans) {
      const tasks = await offStore.getTasksForPlan(plan.id, tenantId);
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

    // Additional scope check
    const isAssigned = foundTask.assignedTo === context.employeeId;
    const isInitiator = foundPlan.initiatedBy === context.employeeId;
    const isAdmin = hasCapability(context.role, 'offboarding:manage:all');

    if (!isAssigned && !isInitiator && !isAdmin) {
      return createErrorResult('Access denied: can only complete your assigned tasks', ['RBAC violation']);
    }

    const success = completeOffboardingTask(taskId, context.employeeId!);

    if (!success) {
      return createErrorResult('Failed to complete task');
    }

    const tasks = await offStore.getTasksForPlan(foundTask.planId, tenantId);
    const progress = calculateOffboardingProgress(tasks);

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

  private async assets(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const planId = payload.planId as string;

    if (!planId) {
      return createErrorResult('Plan ID is required');
    }

    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await offStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const assets = await offStore.getAssetsForPlan(planId, tenantId);
    const status = getOffboardingAssetStatus(assets);

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

      const updatedAssets = await offStore.getAssetsForPlan(planId, tenantId);
      const updatedStatus = getOffboardingAssetStatus(updatedAssets);
      return createAgentResult(
        { assets: updatedAssets, status: updatedStatus },
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

    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await offStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const accessItems = await offStore.getAccessForPlan(planId, tenantId);
    const status = getOffboardingAccessStatus(accessItems);

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

      const updatedAccess = await offStore.getAccessForPlan(planId, tenantId);
      const updatedStatus = getOffboardingAccessStatus(updatedAccess);
      return createAgentResult(
        { access: updatedAccess, status: updatedStatus },
        {
          summary: `Access status updated. ${updatedStatus.completed}/${updatedStatus.total} access items completed.`,
          confidence: 1.0,
        }
      );
    }

    return createAgentResult(
      { access: accessItems, status },
      {
        summary: `${status.completed}/${status.total} access items removed (${accessItems.filter(a => a.removalStatus !== 'completed').length} pending)`,
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

    const empStore = getEmployeeStore();
    const offStore = getOffboardingStore();
    const tenantId = context.tenantId || 'default';

    const plan = await offStore.getPlanById(planId, tenantId);
    if (!plan) {
      return createErrorResult('Offboarding plan not found');
    }

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewOffboarding(context, plan.employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: cannot view this plan', ['RBAC violation']);
    }

    const employee = await empStore.findById(plan.employeeId, tenantId);
    if (!employee) {
      return createErrorResult('Employee not found');
    }

    const tasks = await offStore.getTasksForPlan(planId, tenantId);
    const assets = await offStore.getAssetsForPlan(planId, tenantId);
    const accessItems = await offStore.getAccessForPlan(planId, tenantId);

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const summary = generateExitSummary(plan, employeeName, tasks, assets, accessItems);

    return createAgentResult(summary, {
      summary: `Exit summary for ${summary.employeeName} — ${summary.tasksCompleted}/${summary.tasksTotal} tasks, ${summary.assetsReturned}/${summary.assetsTotal} assets, ${summary.accessRemoved}/${summary.accessTotal} access items`,
      confidence: 1.0,
    });
  }
}

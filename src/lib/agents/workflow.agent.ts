/**
 * Workflow & Approvals Agent
 * Handles workflow instances, approval steps, escalation, inbox, and history.
 * Data source: workflow-store.ts (POC; production: Supabase)
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, WorkflowInstance, WorkflowStep } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  workflowInstances,
  workflowSteps,
  createWorkflow,
  approveWorkflowStep,
  rejectWorkflowStep,
  getWorkflowById,
  getWorkflowSteps,
  getPendingWorkflowsForApprover,
  getApprovalInboxForUser,
  getWorkflowHistory,
  identifyOverdueSteps,
  WORKFLOW_CONFIGS,
  initializeWorkflowStore,
} from '@/lib/data/workflow-store';
import {
  canCreateWorkflow,
  canApproveWorkflow,
  canViewWorkflow,
  hasCapability,
} from '@/lib/auth/authorization';
import { getEmployeeById, getEmployeeFullName } from '@/lib/data/mock-data';

// Ensure store is initialized
initializeWorkflowStore();

export class WorkflowAgent implements Agent {
  readonly type = 'workflow_approvals' as const;
  readonly name = 'Workflow & Approvals Agent';
  readonly supportedIntents: AgentIntent[] = [
    'workflow_create',
    'workflow_status',
    'workflow_approve',
    'workflow_reject',
    'approval_inbox',
    'workflow_history',
  ];
  readonly requiredPermissions = ['workflow:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    switch (intent) {
      case 'workflow_create':
        return this.create(payload, context);
      case 'workflow_status':
        return this.status(payload, context);
      case 'workflow_approve':
        return this.approve(payload, context);
      case 'workflow_reject':
        return this.reject(payload, context);
      case 'approval_inbox':
        return this.inbox(payload, context);
      case 'workflow_history':
        return this.history(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async create(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canCreateWorkflow(context)) {
      return createErrorResult('Not authorized to create workflows', ['RBAC violation']);
    }

    const workflowType = payload.workflowType as WorkflowInstance['workflowType'];
    const referenceType = payload.referenceType as string;
    const referenceId = payload.referenceId as string;

    if (!workflowType || !referenceType || !referenceId) {
      return createErrorResult('workflowType, referenceType, and referenceId are required');
    }

    if (!WORKFLOW_CONFIGS[workflowType]) {
      return createErrorResult(`Unknown workflow type: ${workflowType}`);
    }

    const workflow = createWorkflow(workflowType, referenceType, referenceId, context.employeeId!);

    if (!workflow) {
      return createErrorResult('Failed to create workflow');
    }

    return createAgentResult(
      { workflow, steps: getWorkflowSteps(workflow.id) },
      {
        summary: `${WORKFLOW_CONFIGS[workflowType].name} created with ${workflow.totalSteps} steps`,
        confidence: 1.0,
        citations: [{ source: 'Workflow System', reference: workflow.id }],
      }
    );
  }

  private async status(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const workflowId = payload.workflowId as string | undefined;
    const referenceId = payload.referenceId as string | undefined;

    let workflow: WorkflowInstance | undefined;

    if (workflowId) {
      workflow = getWorkflowById(workflowId);
    } else if (referenceId) {
      workflow = workflowInstances.find(w => w.referenceId === referenceId);
    } else {
      // Return all accessible workflows
      const workflows = workflowInstances.filter(w =>
        hasCapability(context.role, 'workflow:manage:all') ||
        w.initiatorId === context.employeeId
      );

      const enriched = workflows.map(w => ({
        ...w,
        initiatorName: getEmployeeFullName(getEmployeeById(w.initiatorId)!),
      }));

      return createAgentResult(enriched, {
        summary: `Found ${enriched.length} workflow${enriched.length !== 1 ? 's' : ''}`,
        confidence: 1.0,
      });
    }

    if (!workflow) {
      return createErrorResult('Workflow not found');
    }

    if (!canViewWorkflow(context)) {
      return createErrorResult('Access denied: cannot view this workflow', ['RBAC violation']);
    }

    const steps = getWorkflowSteps(workflow.id);
    const currentStep = steps.find(s => s.stepNumber === workflow!.currentStep);
    const pendingSteps = steps.filter(s => s.status === 'pending');

    return createAgentResult(
      {
        workflow,
        steps,
        currentStep,
        pendingSteps,
        initiatorName: getEmployeeFullName(getEmployeeById(workflow.initiatorId)!),
      },
      {
        summary: `Workflow ${workflow.status} — step ${workflow.currentStep}/${workflow.totalSteps}${currentStep ? ` (${currentStep.stepName})` : ''}`,
        confidence: 1.0,
      }
    );
  }

  private async approve(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canApproveWorkflow(context)) {
      return createErrorResult('Not authorized to approve workflows', ['RBAC violation']);
    }

    const stepId = payload.stepId as string;
    const comments = payload.comments as string | undefined;

    if (!stepId) {
      return createErrorResult('Step ID is required');
    }

    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) {
      return createErrorResult('Workflow step not found');
    }

    if (step.approverId && step.approverId !== context.employeeId) {
      // Check if admin can override
      if (!hasCapability(context.role, 'workflow:manage:all')) {
        return createErrorResult('Access denied: not assigned to approve this step', ['RBAC violation']);
      }
    }

    const success = approveWorkflowStep(stepId, context.employeeId!, comments);

    if (!success) {
      return createErrorResult('Failed to approve workflow step');
    }

    const workflow = getWorkflowById(step.workflowId)!;

    return createAgentResult(
      { workflow, step, completed: workflow.status === 'completed' },
      {
        summary: workflow.status === 'completed'
          ? 'Step approved — workflow is now complete'
          : `Step approved — workflow proceeding to step ${workflow.currentStep}`,
        confidence: 1.0,
      }
    );
  }

  private async reject(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    if (!canApproveWorkflow(context)) {
      return createErrorResult('Not authorized to reject workflows', ['RBAC violation']);
    }

    const stepId = payload.stepId as string;
    const comments = payload.comments as string;

    if (!stepId) {
      return createErrorResult('Step ID is required');
    }
    if (!comments) {
      return createErrorResult('Rejection reason (comments) is required');
    }

    const step = workflowSteps.find(s => s.id === stepId);
    if (!step) {
      return createErrorResult('Workflow step not found');
    }

    if (step.approverId && step.approverId !== context.employeeId) {
      if (!hasCapability(context.role, 'workflow:manage:all')) {
        return createErrorResult('Access denied: not assigned to reject this step', ['RBAC violation']);
      }
    }

    const success = rejectWorkflowStep(stepId, context.employeeId!, comments);

    if (!success) {
      return createErrorResult('Failed to reject workflow step');
    }

    const workflow = getWorkflowById(step.workflowId)!;

    return createAgentResult(
      { workflow, step },
      {
        summary: `Step rejected — workflow status: ${workflow.status}`,
        confidence: 1.0,
      }
    );
  }

  private async inbox(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    // Get inbox for current user
    const inbox = getApprovalInboxForUser(context.employeeId!);

    // Filter by escalation status if requested
    const escalatedOnly = payload.escalatedOnly as boolean | undefined;
    let filtered = inbox;
    if (escalatedOnly) {
      filtered = inbox.filter(i => i.isEscalated);
    }

    return createAgentResult(filtered, {
      summary: `${filtered.length} item${filtered.length !== 1 ? 's' : ''} in your approval inbox${escalatedOnly ? ' (escalated only)' : ''}`,
      confidence: 1.0,
    });
  }

  private async history(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const workflowId = payload.workflowId as string;

    if (!workflowId) {
      return createErrorResult('Workflow ID is required');
    }

    const workflow = getWorkflowById(workflowId);
    if (!workflow) {
      return createErrorResult('Workflow not found');
    }

    if (!canViewWorkflow(context)) {
      return createErrorResult('Access denied: cannot view this workflow', ['RBAC violation']);
    }

    const history = getWorkflowHistory(workflowId);

    const enriched = history.map(h => ({
      ...h,
      approverName: h.approverId ? getEmployeeFullName(getEmployeeById(h.approverId)!) : 'Unassigned',
    }));

    return createAgentResult(enriched, {
      summary: `${enriched.length} historical step${enriched.length !== 1 ? 's' : ''}`,
      confidence: 1.0,
    });
  }

}

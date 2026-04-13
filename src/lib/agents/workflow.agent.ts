/**
 * Workflow & Approvals Agent
 * Handles workflow instances, approval steps, escalation, inbox, and history.
 *
 * Data source: `getWorkflowStore()` — transparently reads from Supabase when
 * `SUPABASE_SERVICE_ROLE_KEY` is configured, or falls back to mock data in
 * dev. No agent changes needed to switch modes.
 *
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, WorkflowInstance } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  getWorkflowStore,
  createWorkflow,
  approveWorkflowStep,
  rejectWorkflowStep,
  getApprovalInboxForUser,
  WORKFLOW_CONFIGS,
} from '@/lib/data/workflow-store';
import {
  canCreateWorkflow,
  canApproveWorkflow,
  canViewWorkflow,
  hasCapability,
} from '@/lib/auth/authorization';
import { getEmployeeStore } from '@/lib/data/employee-store';

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

    const wfStore = getWorkflowStore();
    const tenantId = context.tenantId || 'default';

    const workflow = createWorkflow(workflowType, referenceType, referenceId, context.employeeId!);

    if (!workflow) {
      return createErrorResult('Failed to create workflow');
    }

    const steps = await wfStore.getStepsForWorkflow(workflow.id, tenantId);
    const citationSource = wfStore.backend === 'supabase' ? 'Supabase' : 'Workflow System';

    return createAgentResult(
      { workflow, steps },
      {
        summary: `${WORKFLOW_CONFIGS[workflowType].name} created with ${workflow.totalSteps} steps`,
        confidence: 1.0,
        citations: [{ source: citationSource, reference: workflow.id }],
      }
    );
  }

  private async status(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const workflowId = payload.workflowId as string | undefined;
    const referenceId = payload.referenceId as string | undefined;

    const empStore = getEmployeeStore();
    const wfStore = getWorkflowStore();
    const tenantId = context.tenantId || 'default';

    let workflow: WorkflowInstance | null = null;

    if (workflowId) {
      workflow = await wfStore.getWorkflowById(workflowId, tenantId);
    } else if (referenceId) {
      workflow = await wfStore.getWorkflowByReference(referenceId, tenantId);
    } else {
      // Return all accessible workflows
      const allWorkflows = await wfStore.getAllWorkflows(tenantId);
      const workflows = allWorkflows.filter(w =>
        hasCapability(context.role, 'workflow:manage:all') ||
        w.initiatorId === context.employeeId
      );

      const enriched = await Promise.all(workflows.map(async (w) => {
        const initiator = await empStore.findById(w.initiatorId, tenantId);
        return {
          ...w,
          initiatorName: initiator ? `${initiator.firstName} ${initiator.lastName}` : w.initiatorId,
        };
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

    const steps = await wfStore.getStepsForWorkflow(workflow.id, tenantId);
    const currentStep = steps.find(s => s.stepNumber === workflow!.currentStep);
    const pendingSteps = steps.filter(s => s.status === 'pending');
    const initiator = await empStore.findById(workflow.initiatorId, tenantId);

    return createAgentResult(
      {
        workflow,
        steps,
        currentStep,
        pendingSteps,
        initiatorName: initiator ? `${initiator.firstName} ${initiator.lastName}` : workflow.initiatorId,
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

    const wfStore = getWorkflowStore();
    const tenantId = context.tenantId || 'default';

    // Find the step to check approver assignment
    const allWorkflows = await wfStore.getAllWorkflows(tenantId);
    let foundStep: { approverId: string | null; workflowId: string } | null = null;

    for (const wf of allWorkflows) {
      const steps = await wfStore.getStepsForWorkflow(wf.id, tenantId);
      const step = steps.find(s => s.id === stepId);
      if (step) {
        foundStep = step;
        break;
      }
    }

    if (!foundStep) {
      return createErrorResult('Workflow step not found');
    }

    if (foundStep.approverId && foundStep.approverId !== context.employeeId) {
      if (!hasCapability(context.role, 'workflow:manage:all')) {
        return createErrorResult('Access denied: not assigned to approve this step', ['RBAC violation']);
      }
    }

    const success = approveWorkflowStep(stepId, context.employeeId!, comments);

    if (!success) {
      return createErrorResult('Failed to approve workflow step');
    }

    const workflow = await wfStore.getWorkflowById(foundStep.workflowId, tenantId);

    return createAgentResult(
      { workflow, step: foundStep, completed: workflow?.status === 'completed' },
      {
        summary: workflow?.status === 'completed'
          ? 'Step approved — workflow is now complete'
          : `Step approved — workflow proceeding to step ${workflow?.currentStep ?? 'next'}`,
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

    const wfStore = getWorkflowStore();
    const tenantId = context.tenantId || 'default';

    // Find the step to check approver assignment
    const allWorkflows = await wfStore.getAllWorkflows(tenantId);
    let foundStep: { approverId: string | null; workflowId: string } | null = null;

    for (const wf of allWorkflows) {
      const steps = await wfStore.getStepsForWorkflow(wf.id, tenantId);
      const step = steps.find(s => s.id === stepId);
      if (step) {
        foundStep = step;
        break;
      }
    }

    if (!foundStep) {
      return createErrorResult('Workflow step not found');
    }

    if (foundStep.approverId && foundStep.approverId !== context.employeeId) {
      if (!hasCapability(context.role, 'workflow:manage:all')) {
        return createErrorResult('Access denied: not assigned to reject this step', ['RBAC violation']);
      }
    }

    const success = rejectWorkflowStep(stepId, context.employeeId!, comments);

    if (!success) {
      return createErrorResult('Failed to reject workflow step');
    }

    const workflow = await wfStore.getWorkflowById(foundStep.workflowId, tenantId);

    return createAgentResult(
      { workflow, step: foundStep },
      {
        summary: `Step rejected — workflow status: ${workflow?.status ?? 'unknown'}`,
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

    const empStore = getEmployeeStore();
    const wfStore = getWorkflowStore();
    const tenantId = context.tenantId || 'default';

    const workflow = await wfStore.getWorkflowById(workflowId, tenantId);
    if (!workflow) {
      return createErrorResult('Workflow not found');
    }

    if (!canViewWorkflow(context)) {
      return createErrorResult('Access denied: cannot view this workflow', ['RBAC violation']);
    }

    const steps = await wfStore.getStepsForWorkflow(workflowId, tenantId);
    const history = steps.filter(s => s.status !== 'pending');

    const enriched = await Promise.all(history.map(async (h) => {
      const approver = h.approverId ? await empStore.findById(h.approverId, tenantId) : null;
      return {
        ...h,
        approverName: approver ? `${approver.firstName} ${approver.lastName}` : 'Unassigned',
      };
    }));

    return createAgentResult(enriched, {
      summary: `${enriched.length} historical step${enriched.length !== 1 ? 's' : ''}`,
      confidence: 1.0,
    });
  }
}

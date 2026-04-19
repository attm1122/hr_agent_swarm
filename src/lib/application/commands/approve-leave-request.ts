/**
 * Approve Leave Request — Application Command Handler
 *
 * Orchestrates the approval of a leave request by:
 * 1. Fetching the leave request
 * 2. Locating the associated approval workflow
 * 3. Validating the step transition via the domain state machine
 * 4. Updating the workflow step and instance
 * 5. Updating the leave request status
 * 6. Publishing a domain event
 *
 * Design rules:
 * - Depends ONLY on ports (interfaces) and pure domain functions.
 * - Has zero knowledge of Next.js, HTTP, or React.
 * - Returns a structured result; callers decide how to map to transport.
 */

import type { LeaveRequest } from '@/lib/domain/leave/types';
import type {
  LeaveRepositoryPort,
  WorkflowRepositoryPort,
  EventBusPort,
  LeaveApprovedEvent,
} from '@/lib/ports';
import {
  canTransitionStep,
  getWorkflowStateFromAction,
  type StepState,
} from '@/lib/domain/workflow/workflow-state-machine';
import { createId } from '@/lib/utils/ids';

export interface ApproveLeaveRequestCommand {
  leaveRequestId: string;
  approverId: string;
  approverRole: string;
  tenantId: string;
}

export type ApproveLeaveRequestResult =
  | { success: true; leaveRequest: LeaveRequest }
  | { success: false; error: string; code: string };

export async function approveLeaveRequest(
  command: ApproveLeaveRequestCommand,
  deps: {
    leaveRepo: LeaveRepositoryPort;
    workflowRepo: WorkflowRepositoryPort;
    eventBus: EventBusPort;
  }
): Promise<ApproveLeaveRequestResult> {
  const { leaveRequestId, approverId, approverRole, tenantId } = command;
  const { leaveRepo, workflowRepo, eventBus } = deps;

  // ---------------------------------------------------------------------------
  // 1. Fetch the leave request
  // ---------------------------------------------------------------------------
  const requests = await leaveRepo.findRequests({ tenantId });
  const leaveRequest = requests.find(r => r.id === leaveRequestId);

  if (!leaveRequest) {
    return {
      success: false,
      error: 'Leave request not found',
      code: 'LEAVE_REQUEST_NOT_FOUND',
    };
  }

  if (leaveRequest.status !== 'pending') {
    return {
      success: false,
      error: `Leave request is already "${leaveRequest.status}"`,
      code: 'INVALID_LEAVE_STATUS',
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Find the associated workflow
  // ---------------------------------------------------------------------------
  const workflows = await workflowRepo.findInstances({
    tenantId,
    referenceId: leaveRequestId,
    type: 'leave_approval',
  });

  const workflow = workflows[0];

  if (!workflow) {
    return {
      success: false,
      error: 'No workflow found for this leave request',
      code: 'WORKFLOW_NOT_FOUND',
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Find the current workflow step
  // ---------------------------------------------------------------------------
  const steps = await workflowRepo.findSteps(workflow.id, tenantId);
  const currentStep = steps.find(s => s.stepNumber === workflow.currentStep);

  if (!currentStep) {
    return {
      success: false,
      error: 'Current workflow step not found',
      code: 'WORKFLOW_STEP_NOT_FOUND',
    };
  }

  if (currentStep.status !== 'pending') {
    return {
      success: false,
      error: `Workflow step is already "${currentStep.status}"`,
      code: 'WORKFLOW_STEP_NOT_PENDING',
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Validate transition via domain state machine
  // ---------------------------------------------------------------------------
  const transition = canTransitionStep(
    currentStep.status as StepState,
    'approve',
    {
      approverId,
      stepApproverId: currentStep.approverId,
      stepApproverRole: currentStep.approverRole,
      userRole: approverRole,
    }
  );

  if (!transition.allowed) {
    return {
      success: false,
      error: transition.reason || 'Approval not allowed',
      code: 'TRANSITION_NOT_ALLOWED',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Update workflow step
  // ---------------------------------------------------------------------------
  await workflowRepo.approveStep(currentStep.id, approverId, tenantId);

  // ---------------------------------------------------------------------------
  // 6. Determine next workflow state
  // ---------------------------------------------------------------------------
  const updatedSteps = steps.map(s =>
    s.stepNumber === currentStep.stepNumber
      ? { ...s, status: 'approved' as StepState }
      : s
  );

  const { workflowState, completedAt } = getWorkflowStateFromAction(
    'approve',
    updatedSteps.map(s => ({
      stepNumber: s.stepNumber,
      status: s.status as StepState,
    })),
    currentStep.stepNumber
  );

  // The state machine uses 'approved'; the DB type uses 'completed'.
  const mappedWorkflowStatus =
    workflowState === 'approved' ? 'completed' : workflowState;

  const nextStepNumber =
    mappedWorkflowStatus === 'completed'
      ? workflow.currentStep
      : workflow.currentStep + 1;

  // ---------------------------------------------------------------------------
  // 7. Update workflow instance
  // ---------------------------------------------------------------------------
  await workflowRepo.updateInstance(
    workflow.id,
    {
      status: mappedWorkflowStatus,
      currentStep: nextStepNumber,
      completedAt,
    },
    tenantId
  );

  // ---------------------------------------------------------------------------
  // 8. Update leave request status
  // ---------------------------------------------------------------------------
  await leaveRepo.approveRequest(leaveRequestId, approverId, tenantId);

  // ---------------------------------------------------------------------------
  // 9. Refresh leave request to return latest state
  // ---------------------------------------------------------------------------
  const refreshedRequests = await leaveRepo.findRequests({ tenantId });
  const refreshedLeaveRequest = refreshedRequests.find(
    r => r.id === leaveRequestId
  );

  if (!refreshedLeaveRequest) {
    return {
      success: false,
      error: 'Leave request disappeared after update',
      code: 'CONCURRENCY_ERROR',
    };
  }

  // ---------------------------------------------------------------------------
  // 10. Publish domain event
  // ---------------------------------------------------------------------------
  const correlationId = createId();
  const event: LeaveApprovedEvent = {
    id: createId(),
    type: 'leave.approved',
    payload: {
      requestId: leaveRequestId,
      employeeId: leaveRequest.employeeId,
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
    correlationId,
    tenantId,
    userId: approverId,
    version: 1,
  };

  await eventBus.publish(event);

  return {
    success: true,
    leaveRequest: refreshedLeaveRequest,
  };
}

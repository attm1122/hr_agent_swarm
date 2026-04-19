/**
 * Approve Leave Request Command Handler — Integration Tests
 *
 * Tests the full stack using real in-memory repositories and event bus.
 * No mocks — exercises: command handler → domain state machine → repository → event bus.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  approveLeaveRequest,
  type ApproveLeaveRequestCommand,
} from './approve-leave-request';
import {
  InMemoryLeaveRepository,
  InMemoryWorkflowRepository,
} from '@/lib/testing/inmemory-repositories';
import { InMemoryEventBus } from '@/lib/infrastructure/event-bus/in-memory-event-bus';
import type { LeaveRequest, WorkflowInstance, WorkflowStep } from '@/types';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'lr-001',
    employeeId: 'emp-001',
    leaveType: 'annual',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    daysRequested: 5,
    reason: 'Vacation',
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeWorkflow(
  overrides: Partial<WorkflowInstance> = {}
): WorkflowInstance {
  return {
    id: 'wf-001',
    workflowType: 'leave_approval',
    referenceType: 'leave_request',
    referenceId: 'lr-001',
    initiatorId: 'emp-001',
    status: 'in_progress',
    currentStep: 1,
    totalSteps: 1,
    startedAt: '2026-04-01T00:00:00Z',
    completedAt: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 'ws-001',
    workflowId: 'wf-001',
    stepNumber: 1,
    stepName: 'Manager approval',
    approverId: 'mgr-001',
    approverRole: 'manager',
    status: 'pending',
    comments: null,
    actedAt: null,
    dueDate: '2026-04-05',
    escalatedTo: null,
    escalatedAt: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeCommand(
  overrides: Partial<ApproveLeaveRequestCommand> = {}
): ApproveLeaveRequestCommand {
  return {
    leaveRequestId: 'lr-001',
    approverId: 'mgr-001',
    approverRole: 'manager',
    tenantId: 'tenant-test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approveLeaveRequest (integration)', () => {
  let leaveRepo: InMemoryLeaveRepository;
  let workflowRepo: InMemoryWorkflowRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    leaveRepo = new InMemoryLeaveRepository();
    workflowRepo = new InMemoryWorkflowRepository();
    eventBus = new InMemoryEventBus();
  });

  it('successfully approves a leave request end-to-end', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow({ totalSteps: 1, currentStep: 1 });
    const step = makeStep({ stepNumber: 1 });

    await leaveRepo.saveRequest(leaveRequest, 'tenant-test');
    await workflowRepo.saveInstance(workflow, 'tenant-test');
    await workflowRepo.saveStep(step, 'tenant-test');

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // 1. Response indicates success with approved leave request
    expect(result.leaveRequest.status).toBe('approved');
    expect(result.leaveRequest.approvedBy).toBe('mgr-001');

    // 2. Leave request status changed to approved in repository
    const refreshedRequests = await leaveRepo.findRequests({
      tenantId: 'tenant-test',
    });
    const refreshed = refreshedRequests.find((r) => r.id === 'lr-001');
    expect(refreshed?.status).toBe('approved');
    expect(refreshed?.approvedBy).toBe('mgr-001');

    // 3. Workflow step status changed to approved
    const steps = await workflowRepo.findSteps('wf-001', 'tenant-test');
    const updatedStep = steps.find((s) => s.id === 'ws-001');
    expect(updatedStep?.status).toBe('approved');
    expect(updatedStep?.actedAt).not.toBeNull();

    // 4. Workflow instance marked as completed (single-step workflow)
    const instances = await workflowRepo.findInstances({
      tenantId: 'tenant-test',
      referenceId: 'lr-001',
    });
    expect(instances[0]?.status).toBe('completed');

    // 5. LeaveApprovedEvent was published
    const events = await eventBus.query({
      tenantId: 'tenant-test',
      eventTypes: ['leave.approved'],
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('leave.approved');
    const payload = events[0].payload as {
      requestId: string;
      employeeId: string;
      approvedBy: string;
    };
    expect(payload.requestId).toBe('lr-001');
    expect(payload.employeeId).toBe('emp-001');
    expect(payload.approvedBy).toBe('mgr-001');
  });

  it('returns error when leave request is not found', async () => {
    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('LEAVE_REQUEST_NOT_FOUND');

    const events = await eventBus.query({ tenantId: 'tenant-test' });
    expect(events).toHaveLength(0);
  });

  it('returns error when approver is not authorized and not admin', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep({ approverId: 'mgr-002' });

    await leaveRepo.saveRequest(leaveRequest, 'tenant-test');
    await workflowRepo.saveInstance(workflow, 'tenant-test');
    await workflowRepo.saveStep(step, 'tenant-test');

    const result = await approveLeaveRequest(
      makeCommand({ approverId: 'mgr-001', approverRole: 'manager' }),
      { leaveRepo, workflowRepo, eventBus }
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('TRANSITION_NOT_ALLOWED');

    // Verify no state changes occurred
    const requests = await leaveRepo.findRequests({ tenantId: 'tenant-test' });
    expect(requests[0]?.status).toBe('pending');

    const steps = await workflowRepo.findSteps('wf-001', 'tenant-test');
    expect(steps[0]?.status).toBe('pending');

    const events = await eventBus.query({ tenantId: 'tenant-test' });
    expect(events).toHaveLength(0);
  });

  it('allows admin to override step approver assignment', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep({ approverId: 'mgr-002' });

    await leaveRepo.saveRequest(leaveRequest, 'tenant-test');
    await workflowRepo.saveInstance(workflow, 'tenant-test');
    await workflowRepo.saveStep(step, 'tenant-test');

    const result = await approveLeaveRequest(
      makeCommand({ approverId: 'admin-001', approverRole: 'admin' }),
      { leaveRepo, workflowRepo, eventBus }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.leaveRequest.status).toBe('approved');

    const steps = await workflowRepo.findSteps('wf-001', 'tenant-test');
    const updatedStep = steps.find((s) => s.id === 'ws-001');
    expect(updatedStep?.status).toBe('approved');
    expect(updatedStep?.approverId).toBe('admin-001');

    const events = await eventBus.query({
      tenantId: 'tenant-test',
      eventTypes: ['leave.approved'],
    });
    expect(events).toHaveLength(1);
  });
});

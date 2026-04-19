/**
 * Approve Leave Request Command Handler — Unit Tests
 *
 * Tests the application command handler in isolation using in-memory port mocks.
 * No database, no Next.js, no HTTP layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  approveLeaveRequest,
  type ApproveLeaveRequestCommand,
} from './approve-leave-request';
import type {
  LeaveRepositoryPort,
  WorkflowRepositoryPort,
  EventBusPort,
  DomainEvent,
} from '@/lib/ports';
import type { LeaveRequest } from '@/lib/domain/leave/types';
import type { WorkflowInstance, WorkflowStep } from '@/lib/domain/workflow/types';

vi.mock('@/lib/utils/ids', () => ({
  createId: vi.fn(() => 'test-uuid-001'),
}));

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
    totalSteps: 2,
    startedAt: '2026-04-01T00:00:00Z',
    completedAt: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeStep(
  overrides: Partial<WorkflowStep> = {}
): WorkflowStep {
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
// Mock builders
// ---------------------------------------------------------------------------

function createMockLeaveRepo(
  requests: LeaveRequest[]
): LeaveRepositoryPort {
  const store = [...requests];

  return {
    findBalance: vi.fn(),
    findBalances: vi.fn(),
    findRequests: vi.fn(async () => [...store]),
    findPendingRequestsForApprover: vi.fn(),
    saveRequest: vi.fn(),
    updateRequest: vi.fn(async (id, data) => {
      const idx = store.findIndex(r => r.id === id);
      if (idx !== -1) {
        store[idx] = { ...store[idx], ...data } as LeaveRequest;
      }
    }),
    approveRequest: vi.fn(async (id, approverId) => {
      const idx = store.findIndex(r => r.id === id);
      if (idx !== -1) {
        store[idx] = {
          ...store[idx],
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date().toISOString(),
        };
      }
    }),
    rejectRequest: vi.fn(),
    updateBalance: vi.fn(),
  };
}

function createMockWorkflowRepo(
  instances: WorkflowInstance[],
  steps: WorkflowStep[]
): WorkflowRepositoryPort {
  const instanceStore = [...instances];
  const stepStore = [...steps];

  return {
    findInstanceById: vi.fn(),
    findInstances: vi.fn(async () =>
      instanceStore.filter(
        i =>
          i.referenceId === instances[0]?.referenceId &&
          i.workflowType === 'leave_approval'
      )
    ),
    findPendingForApprover: vi.fn(),
    findSteps: vi.fn(async () => [...stepStore]),
    findStepById: vi.fn(),
    saveInstance: vi.fn(),
    saveStep: vi.fn(),
    updateInstance: vi.fn(async (id, data) => {
      const idx = instanceStore.findIndex(i => i.id === id);
      if (idx !== -1) {
        instanceStore[idx] = { ...instanceStore[idx], ...data } as WorkflowInstance;
      }
    }),
    updateStep: vi.fn(),
    approveStep: vi.fn(async (stepId, approverId) => {
      const idx = stepStore.findIndex(s => s.id === stepId);
      if (idx !== -1) {
        stepStore[idx] = {
          ...stepStore[idx],
          status: 'approved',
          approverId,
          actedAt: new Date().toISOString(),
        };
      }
    }),
    rejectStep: vi.fn(),
  };
}

function createMockEventBus(): EventBusPort & { published: DomainEvent[] } {
  const published: DomainEvent[] = [];

  return {
    publish: vi.fn(async (event: DomainEvent) => {
      published.push(event);
    }),
    publishBatch: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
    unsubscribe: vi.fn(),
    query: vi.fn(),
    health: vi.fn(async () => ({ healthy: true, lag: 0 })),
    published,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approveLeaveRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when approver matches step approver', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep();

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.leaveRequest.status).toBe('approved');
    expect(result.leaveRequest.approvedBy).toBe('mgr-001');

    expect(leaveRepo.approveRequest).toHaveBeenCalledWith(
      'lr-001',
      'mgr-001',
      'tenant-test'
    );
    expect(workflowRepo.approveStep).toHaveBeenCalledWith(
      'ws-001',
      'mgr-001',
      'tenant-test'
    );
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0].type).toBe('leave.approved');
  });

  it('returns error when leave request is not found', async () => {
    const leaveRepo = createMockLeaveRepo([]);
    const workflowRepo = createMockWorkflowRepo([], []);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('LEAVE_REQUEST_NOT_FOUND');
    expect(leaveRepo.approveRequest).not.toHaveBeenCalled();
    expect(eventBus.published).toHaveLength(0);
  });

  it('returns error when leave request is not pending', async () => {
    const leaveRequest = makeLeaveRequest({ status: 'approved' });
    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([], []);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('INVALID_LEAVE_STATUS');
    expect(leaveRepo.approveRequest).not.toHaveBeenCalled();
  });

  it('returns error when no workflow is found', async () => {
    const leaveRequest = makeLeaveRequest();
    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([], []);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('WORKFLOW_NOT_FOUND');
  });

  it('returns error when current workflow step is not pending', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep({ status: 'approved' });

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('WORKFLOW_STEP_NOT_PENDING');
  });

  it('returns error when approver does not match and is not admin', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep({ approverId: 'mgr-002' });

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(
      makeCommand({ approverId: 'mgr-001', approverRole: 'manager' }),
      { leaveRepo, workflowRepo, eventBus }
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('TRANSITION_NOT_ALLOWED');
    expect(workflowRepo.approveStep).not.toHaveBeenCalled();
  });

  it('allows admin override when approver does not match step approver', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep({ approverId: 'mgr-002' });

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(
      makeCommand({ approverId: 'admin-001', approverRole: 'admin' }),
      { leaveRepo, workflowRepo, eventBus }
    );

    expect(result.success).toBe(true);
    expect(workflowRepo.approveStep).toHaveBeenCalledWith(
      'ws-001',
      'admin-001',
      'tenant-test'
    );
  });

  it('marks workflow as completed when all steps are approved', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow({ totalSteps: 1, currentStep: 1 });
    const step = makeStep({ stepNumber: 1 });

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(true);
    expect(workflowRepo.updateInstance).toHaveBeenCalledWith(
      'wf-001',
      expect.objectContaining({ status: 'completed' }),
      'tenant-test'
    );
  });

  it('advances currentStep when workflow is not yet complete', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow({ totalSteps: 2, currentStep: 1 });
    const step1 = makeStep({ stepNumber: 1 });
    const step2 = makeStep({
      id: 'ws-002',
      stepNumber: 2,
      status: 'pending',
      approverId: 'mgr-002',
    });

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step1, step2]);
    const eventBus = createMockEventBus();

    const result = await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(result.success).toBe(true);
    expect(workflowRepo.updateInstance).toHaveBeenCalledWith(
      'wf-001',
      expect.objectContaining({ status: 'in_progress', currentStep: 2 }),
      'tenant-test'
    );
  });

  it('publishes LeaveApprovedEvent with correct payload', async () => {
    const leaveRequest = makeLeaveRequest();
    const workflow = makeWorkflow();
    const step = makeStep();

    const leaveRepo = createMockLeaveRepo([leaveRequest]);
    const workflowRepo = createMockWorkflowRepo([workflow], [step]);
    const eventBus = createMockEventBus();

    await approveLeaveRequest(makeCommand(), {
      leaveRepo,
      workflowRepo,
      eventBus,
    });

    expect(eventBus.published).toHaveLength(1);
    const event = eventBus.published[0];
    expect(event.type).toBe('leave.approved');
    expect(event.tenantId).toBe('tenant-test');
    expect(event.userId).toBe('mgr-001');
    expect((event.payload as Record<string, unknown>).requestId).toBe('lr-001');
    expect((event.payload as Record<string, unknown>).employeeId).toBe('emp-001');
    expect((event.payload as Record<string, unknown>).approvedBy).toBe('mgr-001');
  });
});

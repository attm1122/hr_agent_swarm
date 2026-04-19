/**
 * In-memory repository implementations for testing
 *
 * These provide real port implementations using in-memory storage.
 * No mocking — useful for integration tests that exercise the full stack.
 */

import type { LeaveRepositoryPort, WorkflowRepositoryPort } from '@/lib/ports';
import type {
  LeaveBalance,
  LeaveRequest,
  WorkflowInstance,
  WorkflowStep,
} from '@/types';
import { calculateLeaveBalance } from '@/lib/domain/leave/leave-calculation';

// ============================================================================
// In-Memory Leave Repository
// ============================================================================

export class InMemoryLeaveRepository implements LeaveRepositoryPort {
  private balances = new Map<string, LeaveBalance[]>();
  private requests = new Map<string, LeaveRequest[]>();

  private getBalanceList(tenantId: string): LeaveBalance[] {
    if (!this.balances.has(tenantId)) {
      this.balances.set(tenantId, []);
    }
    return this.balances.get(tenantId)!;
  }

  private getRequestList(tenantId: string): LeaveRequest[] {
    if (!this.requests.has(tenantId)) {
      this.requests.set(tenantId, []);
    }
    return this.requests.get(tenantId)!;
  }

  async findBalance(
    employeeId: string,
    leaveType: string,
    tenantId: string
  ): Promise<LeaveBalance | null> {
    const list = this.getBalanceList(tenantId);
    return (
      list.find((b) => b.employeeId === employeeId && b.leaveType === leaveType) ?? null
    );
  }

  async findBalances(employeeId: string, tenantId: string): Promise<LeaveBalance[]> {
    const list = this.getBalanceList(tenantId);
    return list.filter((b) => b.employeeId === employeeId);
  }

  async findRequests(params: {
    tenantId: string;
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRequest[]> {
    let results = this.getRequestList(params.tenantId);

    if (params.employeeId) {
      results = results.filter((r) => r.employeeId === params.employeeId);
    }
    if (params.status) {
      results = results.filter((r) => r.status === params.status);
    }
    const startDate = params.startDate;
    const endDate = params.endDate;
    if (startDate) {
      results = results.filter((r) => r.startDate >= startDate);
    }
    if (endDate) {
      results = results.filter((r) => r.endDate <= endDate);
    }

    return results;
  }

  async findPendingRequestsForApprover(
    _approverId: string,
    tenantId: string
  ): Promise<LeaveRequest[]> {
    const list = this.getRequestList(tenantId);
    // Simplified — returns all pending requests for the tenant
    return list.filter((r) => r.status === 'pending');
  }

  async saveRequest(request: LeaveRequest, tenantId: string): Promise<void> {
    const list = this.getRequestList(tenantId);
    const idx = list.findIndex((r) => r.id === request.id);
    if (idx !== -1) {
      list[idx] = request;
    } else {
      list.push(request);
    }
  }

  async updateRequest(
    id: string,
    data: Partial<LeaveRequest>,
    tenantId: string
  ): Promise<void> {
    const list = this.getRequestList(tenantId);
    const idx = list.findIndex((r) => r.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    }
  }

  async approveRequest(id: string, approverId: string, tenantId: string): Promise<void> {
    await this.updateRequest(
      id,
      {
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date().toISOString(),
      },
      tenantId
    );
  }

  async rejectRequest(
    id: string,
    approverId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    await this.updateRequest(
      id,
      {
        status: 'rejected',
        approvedBy: approverId,
        rejectionReason: reason,
      },
      tenantId
    );
  }

  async updateBalance(
    employeeId: string,
    leaveType: string,
    delta: number,
    tenantId: string
  ): Promise<void> {
    const list = this.getBalanceList(tenantId);
    const idx = list.findIndex(
      (b) => b.employeeId === employeeId && b.leaveType === leaveType
    );
    if (idx === -1) {
      throw new Error('Balance not found');
    }

    const balance = list[idx];
    const newTaken = balance.takenDays + delta;
    const newRemaining = calculateLeaveBalance(
      balance.entitlementDays,
      newTaken,
      balance.pendingDays
    );

    list[idx] = {
      ...balance,
      takenDays: newTaken,
      remainingDays: newRemaining,
      updatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// In-Memory Workflow Repository
// ============================================================================

export class InMemoryWorkflowRepository implements WorkflowRepositoryPort {
  private instances = new Map<string, WorkflowInstance[]>();
  private steps = new Map<string, WorkflowStep[]>();

  private getInstanceList(tenantId: string): WorkflowInstance[] {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, []);
    }
    return this.instances.get(tenantId)!;
  }

  private getStepList(tenantId: string): WorkflowStep[] {
    if (!this.steps.has(tenantId)) {
      this.steps.set(tenantId, []);
    }
    return this.steps.get(tenantId)!;
  }

  async findInstanceById(id: string, tenantId: string): Promise<WorkflowInstance | null> {
    const list = this.getInstanceList(tenantId);
    return list.find((i) => i.id === id) ?? null;
  }

  async findInstances(params: {
    tenantId: string;
    referenceId?: string;
    employeeId?: string;
    type?: string;
    status?: string;
  }): Promise<WorkflowInstance[]> {
    let results = this.getInstanceList(params.tenantId);

    if (params.referenceId) {
      results = results.filter((i) => i.referenceId === params.referenceId);
    }
    if (params.employeeId) {
      results = results.filter((i) => i.initiatorId === params.employeeId);
    }
    if (params.type) {
      results = results.filter((i) => i.workflowType === params.type);
    }
    if (params.status) {
      results = results.filter((i) => i.status === params.status);
    }

    return results;
  }

  async findPendingForApprover(
    _approverId: string,
    tenantId: string
  ): Promise<WorkflowInstance[]> {
    const list = this.getInstanceList(tenantId);
    // Simplified — returns all pending instances for the tenant
    return list.filter((i) => i.status === 'pending');
  }

  async findSteps(workflowId: string, tenantId: string): Promise<WorkflowStep[]> {
    const list = this.getStepList(tenantId);
    return list
      .filter((s) => s.workflowId === workflowId)
      .sort((a, b) => a.stepNumber - b.stepNumber);
  }

  async findStepById(stepId: string, tenantId: string): Promise<WorkflowStep | null> {
    const list = this.getStepList(tenantId);
    return list.find((s) => s.id === stepId) ?? null;
  }

  async saveInstance(instance: WorkflowInstance, tenantId: string): Promise<void> {
    const list = this.getInstanceList(tenantId);
    const idx = list.findIndex((i) => i.id === instance.id);
    if (idx !== -1) {
      list[idx] = instance;
    } else {
      list.push(instance);
    }
  }

  async saveStep(step: WorkflowStep, tenantId: string): Promise<void> {
    const list = this.getStepList(tenantId);
    const idx = list.findIndex((s) => s.id === step.id);
    if (idx !== -1) {
      list[idx] = step;
    } else {
      list.push(step);
    }
  }

  async updateInstance(
    id: string,
    data: Partial<WorkflowInstance>,
    tenantId: string
  ): Promise<void> {
    const list = this.getInstanceList(tenantId);
    const idx = list.findIndex((i) => i.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    }
  }

  async updateStep(
    id: string,
    data: Partial<WorkflowStep>,
    tenantId: string
  ): Promise<void> {
    const list = this.getStepList(tenantId);
    const idx = list.findIndex((s) => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    }
  }

  async approveStep(stepId: string, approverId: string, tenantId: string): Promise<void> {
    await this.updateStep(
      stepId,
      {
        status: 'approved',
        approverId,
        actedAt: new Date().toISOString(),
      },
      tenantId
    );
  }

  async rejectStep(
    stepId: string,
    approverId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    await this.updateStep(
      stepId,
      {
        status: 'rejected',
        approverId,
        actedAt: new Date().toISOString(),
        comments: reason,
      },
      tenantId
    );
  }
}

/**
 * Leave & Milestones Agent
 * Handles leave balance queries, leave requests, and milestone tracking.
 * Data source: BambooHR leave (mock: mock-data.ts leaveRequests/milestones)
 * Deterministic business rules — approval gating enforced here.
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  leaveRequests, milestones, getEmployeeById, getEmployeeFullName, getDirectReports,
} from '@/lib/data/mock-data';
import type { LeaveRequest } from '@/types';
import { canEditLeave, canViewLeave, canViewMilestone, isInScope } from '@/lib/auth/authorization';

/** Resolve team member IDs for scope checks */
function getTeamIds(ctx: AgentContext): string[] {
  if (!ctx.employeeId) return [];
  return getDirectReports(ctx.employeeId).map(r => r.id);
}

export class LeaveMilestonesAgent implements Agent {
  readonly type = 'leave_milestones' as const;
  readonly name = 'Leave & Milestones Agent';
  readonly supportedIntents: AgentIntent[] = ['leave_balance', 'leave_request', 'milestone_list'];
  readonly requiredPermissions = ['leave:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    switch (intent) {
      case 'leave_balance':
        return this.getLeaveRequests(payload, context);
      case 'leave_request':
        return this.handleLeaveAction(payload, context);
      case 'milestone_list':
        return this.getMilestones(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async getLeaveRequests(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const teamIds = getTeamIds(context);
    let requests = [...leaveRequests];

    // Scope filtering via policy
    requests = requests.filter(lr =>
      canViewLeave(context, lr.employeeId, teamIds)
    );

    if (payload.status && payload.status !== 'all') {
      requests = requests.filter(lr => lr.status === payload.status);
    }

    const enriched = requests.map(lr => {
      const emp = getEmployeeById(lr.employeeId);
      return { ...lr, employeeName: emp ? getEmployeeFullName(emp) : 'Unknown' };
    });

    const pending = enriched.filter(lr => lr.status === 'pending').length;

    return createAgentResult(enriched, {
      summary: `${enriched.length} leave request${enriched.length !== 1 ? 's' : ''} (${pending} pending)`,
      confidence: 1.0,
    });
  }

  private async handleLeaveAction(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const action = payload.action as 'approve' | 'reject' | undefined;
    const requestId = payload.requestId as string | undefined;

    if (!action || !requestId) {
      return createErrorResult('action and requestId are required');
    }

    // Policy check: can this user edit/approve leave?
    if (!canEditLeave(context)) {
      return createErrorResult('Not authorized to approve/reject leave', ['RBAC violation']);
    }

    const request = leaveRequests.find(lr => lr.id === requestId);
    if (!request) return createErrorResult('Leave request not found');
    if (request.status !== 'pending') {
      return createErrorResult(`Request already ${request.status}`);
    }

    // Team-scoped roles can only approve their direct reports
    if (context.scope === 'team') {
      const teamIds = getTeamIds(context);
      if (!teamIds.includes(request.employeeId)) {
        return createErrorResult('Not authorized: not a direct report', ['RBAC violation']);
      }
    }

    // Mutate in-memory (POC: real system writes to DB)
    const idx = leaveRequests.findIndex(lr => lr.id === requestId);
    if (idx !== -1) {
      (leaveRequests[idx] as LeaveRequest).status = action === 'approve' ? 'approved' : 'rejected';
      (leaveRequests[idx] as LeaveRequest).approvedBy = context.employeeId || null;
      (leaveRequests[idx] as LeaveRequest).approvedAt = new Date().toISOString();
    }

    const emp = getEmployeeById(request.employeeId);

    return createAgentResult(
      { requestId, action, employeeName: emp ? getEmployeeFullName(emp) : 'Unknown' },
      {
        summary: `Leave request ${action}d for ${emp ? getEmployeeFullName(emp) : 'Unknown'}`,
        confidence: 1.0,
        requiresApproval: false,
        proposedActions: action === 'approve' ? [
          { type: 'notification', label: 'Notify employee of approval', payload: { employeeId: request.employeeId, channel: 'email' } },
        ] : [],
        citations: [{ source: 'Leave System', reference: requestId }],
      }
    );
  }

  private async getMilestones(
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const teamIds = getTeamIds(context);
    let items = [...milestones];

    if (payload.type) {
      items = items.filter(m => m.milestoneType === payload.type);
    }
    if (payload.status && payload.status !== 'all') {
      items = items.filter(m => m.status === payload.status);
    }

    // Scope filtering via policy
    items = items.filter(m =>
      canViewMilestone(context, m.employeeId, teamIds)
    );

    const enriched = items
      .sort((a, b) => new Date(a.milestoneDate).getTime() - new Date(b.milestoneDate).getTime())
      .map(m => {
        const emp = getEmployeeById(m.employeeId);
        const daysUntil = Math.ceil((new Date(m.milestoneDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return { ...m, employeeName: emp ? getEmployeeFullName(emp) : 'Unknown', daysUntil };
      });

    return createAgentResult(enriched, {
      summary: `${enriched.length} milestone${enriched.length !== 1 ? 's' : ''} tracked`,
      confidence: 1.0,
    });
  }
}

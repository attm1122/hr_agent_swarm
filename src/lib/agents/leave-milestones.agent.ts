/**
 * Leave & Milestones Agent
 * Handles leave balance queries, leave requests, and milestone tracking.
 *
 * Data source: `getLeaveStore()` / `getMilestoneStore()` — transparently reads
 * from Supabase when `SUPABASE_SERVICE_ROLE_KEY` is configured, or falls back
 * to mock-data in dev. No agent changes needed to switch modes.
 *
 * Deterministic business rules — approval gating enforced here.
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import { getLeaveStore } from '@/lib/data/leave-store';
import { getMilestoneStore } from '@/lib/data/milestone-store';
import { getEmployeeStore } from '@/lib/data/employee-store';
import { canEditLeave, canViewLeave, canViewMilestone } from '@/lib/auth/authorization';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';
import { compareMilestonesByDate, getDerivedMilestoneState, getMilestoneDayOffset } from '@/lib/milestones';

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
    context: AgentContext,
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
    context: AgentContext,
  ): Promise<AgentResult> {
    const scopeContext = buildRecordScopeContext(context);
    const leaveStore = getLeaveStore();
    const employeeStore = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const statusFilter = payload.status as string | undefined;

    let requests = await leaveStore.listRequests(
      { status: statusFilter },
      tenantId,
    );

    // Scope filtering via policy
    requests = requests.filter((lr) =>
      canViewLeave(context, lr.employeeId, scopeContext.teamEmployeeIds),
    );

    // Enrich with employee names
    const empIds = Array.from(new Set(requests.map((r) => r.employeeId)));
    const employees = empIds.length
      ? await employeeStore.findByIds(empIds, tenantId)
      : [];
    const empById = new Map(employees.map((e) => [e.id, e]));

    const enriched = requests.map((lr) => {
      const emp = empById.get(lr.employeeId);
      return {
        ...lr,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      };
    });

    const pending = enriched.filter((lr) => lr.status === 'pending').length;

    return createAgentResult(enriched, {
      summary: `${enriched.length} leave request${enriched.length !== 1 ? 's' : ''} (${pending} pending)`,
      confidence: 1.0,
      citations: [
        {
          source: leaveStore.backend === 'supabase' ? 'Supabase' : 'Leave System',
          reference: 'leave_requests',
        },
      ],
    });
  }

  private async handleLeaveAction(
    payload: Record<string, unknown>,
    context: AgentContext,
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

    const leaveStore = getLeaveStore();
    const employeeStore = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const request = await leaveStore.findRequestById(requestId, tenantId);
    if (!request) return createErrorResult('Leave request not found');
    if (request.status !== 'pending') {
      return createErrorResult(`Request already ${request.status}`);
    }

    // Team-scoped roles can only approve their direct reports
    if (context.scope === 'team') {
      const scopeContext = buildRecordScopeContext(context);
      if (!scopeContext.teamEmployeeIds.includes(request.employeeId)) {
        return createErrorResult('Not authorized: not a direct report', ['RBAC violation']);
      }
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updated = await leaveStore.updateRequestStatus(
      requestId,
      newStatus,
      context.employeeId || null,
      tenantId,
    );

    if (!updated) {
      return createErrorResult('Failed to update leave request');
    }

    const emp = await employeeStore.findById(request.employeeId, tenantId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';

    return createAgentResult(
      { requestId, action, employeeName: empName },
      {
        summary: `Leave request ${action}d for ${empName}`,
        confidence: 1.0,
        requiresApproval: false,
        proposedActions: action === 'approve'
          ? [
              {
                type: 'notification',
                label: 'Notify employee of approval',
                payload: { employeeId: request.employeeId, channel: 'email' },
              },
            ]
          : [],
        citations: [
          {
            source: leaveStore.backend === 'supabase' ? 'Supabase' : 'Leave System',
            reference: requestId,
          },
        ],
      },
    );
  }

  private async getMilestones(
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    const scopeContext = buildRecordScopeContext(context);
    const milestoneStore = getMilestoneStore();
    const employeeStore = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const typeFilter = payload.type as string | undefined;

    // Fetch all milestones (optionally filtered by type); derived-state
    // filtering is done in-memory after fetch because the DB stores the raw
    // status, not the computed state.
    let items = await milestoneStore.list(
      { milestoneType: typeFilter },
      tenantId,
    );

    if (payload.status && payload.status !== 'all') {
      items = items.filter(
        (milestone) => getDerivedMilestoneState(milestone) === payload.status,
      );
    }

    // Scope filtering via policy
    items = items.filter((m) =>
      canViewMilestone(context, m.employeeId, scopeContext.teamEmployeeIds),
    );

    // Enrich with employee names
    const empIds = Array.from(new Set(items.map((m) => m.employeeId)));
    const employees = empIds.length
      ? await employeeStore.findByIds(empIds, tenantId)
      : [];
    const empById = new Map(employees.map((e) => [e.id, e]));

    const enriched = items
      .sort(compareMilestonesByDate)
      .map((m) => {
        const emp = empById.get(m.employeeId);
        const daysUntil = getMilestoneDayOffset(m);
        return {
          ...m,
          status: getDerivedMilestoneState(m),
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
          daysUntil,
        };
      });

    return createAgentResult(enriched, {
      summary: `${enriched.length} milestone${enriched.length !== 1 ? 's' : ''} tracked`,
      confidence: 1.0,
      citations: [
        {
          source: milestoneStore.backend === 'supabase' ? 'Supabase' : 'Milestone Tracker',
          reference: 'milestones',
        },
      ],
    });
  }
}

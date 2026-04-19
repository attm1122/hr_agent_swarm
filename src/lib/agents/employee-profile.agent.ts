/**
 * Employee Profile Agent
 * Handles employee search, summary, and profile queries.
 *
 * Data source: `getEmployeeStore()` — transparently reads from Supabase when
 * `SUPABASE_SERVICE_ROLE_KEY` is configured, or falls back to mock-data in
 * dev. No agent changes needed to switch modes.
 *
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent, Employee } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import { getEmployeeStore } from '@/lib/data/employee-store';
import {
  canViewEmployee,
  hasCapability,
  isInScope,
  stripSensitiveFields,
} from '@/lib/auth/authorization';
import { buildRecordScopeContext } from '@/lib/auth/team-scope';
import { getFullYearsSinceDateOnly } from '@/lib/domain/shared/date-value';

function fullName(e: Employee): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export class EmployeeProfileAgent implements Agent {
  readonly type = 'employee_profile' as const;
  readonly name = 'Employee Profile Agent';
  readonly supportedIntents: AgentIntent[] = ['employee_search', 'employee_summary'];
  readonly requiredPermissions = ['employee:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    switch (intent) {
      case 'employee_search':
        return this.search(payload, context);
      case 'employee_summary':
        return this.summary(payload, context);
      default:
        return createErrorResult(`Unsupported intent: ${intent}`);
    }
  }

  private async search(
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    // Defense-in-depth: verify capability even if coordinator already checked
    if (!hasCapability(context.role, 'employee:read')) {
      return createErrorResult('Not authorized to search employees', ['RBAC violation']);
    }

    const store = getEmployeeStore();
    const tenantId = context.tenantId || 'default';
    const scopeContext = buildRecordScopeContext(context);

    const query = String(payload.query || '').toLowerCase();
    const teamFilter = payload.teamId as string | undefined;
    const statusFilter = payload.status as string | undefined;

    // Pull candidates from the store. Scope filtering is applied in-memory
    // since the scope rules (team/manager reach) aren't easy to express as
    // SQL filters and the employee counts are small (<10k).
    const candidates = await store.search(
      {
        query,
        teamId: teamFilter,
        status: statusFilter,
      },
      tenantId,
    );

    const visible = candidates.filter((e) =>
      isInScope(context.scope, e.id, scopeContext),
    );

    const [teamsById, positionsById] = await Promise.all([
      this.indexBy(await store.getAllTeams(tenantId), 'id'),
      this.indexBy(await store.getAllPositions(tenantId), 'id'),
    ]);

    // Resolve manager names in one batch
    const managerIds = Array.from(
      new Set(visible.map((e) => e.managerId).filter((m): m is string => Boolean(m))),
    );
    const managers = managerIds.length
      ? await store.findByIds(managerIds, tenantId)
      : [];
    const managersById = this.indexBy(managers, 'id');

    const enriched = visible.map((e) => {
      const base = {
        ...e,
        teamName: e.teamId ? teamsById.get(e.teamId)?.name ?? null : null,
        positionTitle: e.positionId
          ? positionsById.get(e.positionId)?.title ?? null
          : null,
        managerName: e.managerId
          ? managersById.get(e.managerId)
            ? fullName(managersById.get(e.managerId)!)
            : null
          : null,
      };
      return stripSensitiveFields(base, context.sensitivityClearance);
    });

    return createAgentResult(enriched, {
      summary: `Found ${enriched.length} employee${enriched.length !== 1 ? 's' : ''}`,
      confidence: 1.0,
    });
  }

  private async summary(
    payload: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AgentResult> {
    const employeeId = payload.employeeId as string;
    if (!employeeId) return createErrorResult('Employee ID is required');

    const store = getEmployeeStore();
    const tenantId = context.tenantId || 'default';

    const employee = await store.findById(employeeId, tenantId);
    if (!employee) return createErrorResult('Employee not found');

    const scopeContext = buildRecordScopeContext(context);
    if (!canViewEmployee(context, employeeId, scopeContext.teamEmployeeIds)) {
      return createErrorResult('Access denied: insufficient permissions', [
        'RBAC violation',
      ]);
    }

    const [team, position, manager, reports] = await Promise.all([
      employee.teamId ? store.getTeam(employee.teamId, tenantId) : null,
      employee.positionId ? store.getPosition(employee.positionId, tenantId) : null,
      employee.managerId ? store.findById(employee.managerId, tenantId) : null,
      store.findDirectReports(employee.id, tenantId),
    ]);

    const tenure = getFullYearsSinceDateOnly(employee.hireDate);

    const data = stripSensitiveFields(
      {
        employee,
        team,
        position,
        manager: manager ? { id: manager.id, name: fullName(manager) } : null,
        directReports: reports.map((r) => ({
          id: r.id,
          name: fullName(r),
          status: r.status,
        })),
        tenure,
      },
      context.sensitivityClearance,
    );

    return createAgentResult(data, {
      summary: `${fullName(employee)} — ${position?.title || 'No position'}, ${team?.name || 'No team'}, ${tenure}y tenure`,
      confidence: 1.0,
      citations: [
        {
          source: store.backend === 'supabase' ? 'Supabase' : 'BambooHR',
          reference: employee.employeeNumber,
        },
      ],
    });
  }

  private indexBy<T>(items: T[], key: keyof T): Map<string, T> {
    const map = new Map<string, T>();
    for (const item of items) {
      map.set(String(item[key]), item);
    }
    return map;
  }
}

/**
 * Employee Profile Agent
 * Handles employee search, summary, and profile queries.
 * Data source: BambooHR (mock: mock-data.ts employees)
 * Deterministic logic only — no AI reasoning.
 */

import type { AgentResult, AgentContext, AgentIntent } from '@/types';
import type { Agent } from './base';
import { createAgentResult, createErrorResult } from './base';
import {
  employees, getEmployeeById, getTeamById, getPositionById,
  getManagerForEmployee, getDirectReports, getEmployeeFullName,
} from '@/lib/data/mock-data';
import { canViewEmployee, hasCapability, isInScope, stripSensitiveFields } from '@/lib/auth/authorization';

/** Resolve team member IDs for scope checks */
function getTeamIds(ctx: AgentContext): string[] {
  if (!ctx.employeeId) return [];
  return getDirectReports(ctx.employeeId).map(r => r.id);
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
    context: AgentContext
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
    context: AgentContext
  ): Promise<AgentResult> {
    // Defense-in-depth: verify capability even if coordinator already checked
    if (!hasCapability(context.role, 'employee:read')) {
      return createErrorResult('Not authorized to search employees', ['RBAC violation']);
    }

    const query = String(payload.query || '').toLowerCase();
    const teamFilter = payload.teamId as string | undefined;
    const statusFilter = payload.status as string | undefined;
    const teamIds = getTeamIds(context);

    let results = employees.filter(e => e.status !== 'terminated');

    // Scope filtering via policy
    results = results.filter(e =>
      isInScope(context.scope, e.id, { employeeId: context.employeeId, teamEmployeeIds: teamIds })
    );

    if (query) {
      results = results.filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
        e.email.toLowerCase().includes(query) ||
        e.employeeNumber.toLowerCase().includes(query)
      );
    }
    if (teamFilter && teamFilter !== 'all') {
      results = results.filter(e => e.teamId === teamFilter);
    }
    if (statusFilter && statusFilter !== 'all') {
      results = results.filter(e => e.status === statusFilter);
    }

    const enriched = results.map(e => {
      const base = {
        ...e,
        teamName: e.teamId ? getTeamById(e.teamId)?.name : null,
        positionTitle: e.positionId ? getPositionById(e.positionId)?.title : null,
        managerName: getManagerForEmployee(e) ? getEmployeeFullName(getManagerForEmployee(e)!) : null,
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
    context: AgentContext
  ): Promise<AgentResult> {
    const employeeId = payload.employeeId as string;
    if (!employeeId) return createErrorResult('Employee ID is required');

    const employee = getEmployeeById(employeeId);
    if (!employee) return createErrorResult('Employee not found');

    const teamIds = getTeamIds(context);
    if (!canViewEmployee(context, employeeId, teamIds)) {
      return createErrorResult('Access denied: insufficient permissions', ['RBAC violation']);
    }

    const team = employee.teamId ? getTeamById(employee.teamId) : null;
    const position = employee.positionId ? getPositionById(employee.positionId) : null;
    const manager = getManagerForEmployee(employee);
    const reports = getDirectReports(employee.id);
    const tenure = Math.floor(
      (Date.now() - new Date(employee.hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    const data = stripSensitiveFields(
      {
        employee,
        team,
        position,
        manager: manager ? { id: manager.id, name: getEmployeeFullName(manager) } : null,
        directReports: reports.map(r => ({ id: r.id, name: getEmployeeFullName(r), status: r.status })),
        tenure,
      },
      context.sensitivityClearance,
    );

    return createAgentResult(data, {
      summary: `${getEmployeeFullName(employee)} — ${position?.title || 'No position'}, ${team?.name || 'No team'}, ${tenure}y tenure`,
      confidence: 1.0,
      citations: [{ source: 'BambooHR', reference: employee.employeeNumber }],
    });
  }
}

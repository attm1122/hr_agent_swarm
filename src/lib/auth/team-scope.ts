import type { AgentContext } from '@/types';
import { getDirectReports } from '@/lib/data/mock-data';
import { getEmployeeStore } from '@/lib/data/employee-store';

export interface RecordScopeContext {
  employeeId?: string;
  teamEmployeeIds: string[];
}

/**
 * Sync variant — always reads from the mock-data module.
 *
 * Still here because several call-sites (tests, the legacy employee service)
 * depend on a synchronous signature. In production-with-Supabase mode, prefer
 * `getTeamScopeEmployeeIdsAsync` + `buildRecordScopeContextAsync` which hit
 * the employee store (Supabase or mock, depending on config).
 */
export function getTeamScopeEmployeeIds(employeeId?: string | null): string[] {
  if (!employeeId) {
    return [];
  }

  return getDirectReports(employeeId).map((employee) => employee.id);
}

export function buildRecordScopeContext(
  context: Pick<AgentContext, 'employeeId'>,
): RecordScopeContext {
  return {
    employeeId: context.employeeId,
    teamEmployeeIds: getTeamScopeEmployeeIds(context.employeeId),
  };
}

/**
 * Async variant — resolves direct reports through the employee store so it
 * works correctly when Supabase is the source of truth. Falls back to mock
 * data automatically when `SUPABASE_SERVICE_ROLE_KEY` isn't set.
 */
export async function getTeamScopeEmployeeIdsAsync(
  employeeId: string | null | undefined,
  tenantId: string,
): Promise<string[]> {
  if (!employeeId) return [];
  const store = getEmployeeStore();
  const reports = await store.findDirectReports(employeeId, tenantId);
  return reports.map((e) => e.id);
}

export async function buildRecordScopeContextAsync(
  context: Pick<AgentContext, 'employeeId' | 'tenantId'>,
): Promise<RecordScopeContext> {
  const tenantId = context.tenantId || 'default';
  return {
    employeeId: context.employeeId,
    teamEmployeeIds: await getTeamScopeEmployeeIdsAsync(
      context.employeeId,
      tenantId,
    ),
  };
}

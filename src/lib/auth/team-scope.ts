import type { AgentContext } from '@/types';
import { getDirectReports } from '@/lib/data/mock-data';

export interface RecordScopeContext {
  employeeId?: string;
  teamEmployeeIds: string[];
}

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

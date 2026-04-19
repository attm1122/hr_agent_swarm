import { describe, expect, it } from 'vitest';
import type { AgentContext, Role } from '@/types';
import { ROLE_CAPABILITIES, ROLE_SCOPE, ROLE_SENSITIVITY } from '@/lib/auth/authorization';
import { getEmployee, getEmployeeList } from '@/lib/services/employee.service';
import { EmployeeProfileAgent } from '@/lib/agents/employee-profile.agent';
import { OnboardingAgent } from '@/lib/agents/onboarding.agent';

function makeContext(role: Role, employeeId: string): AgentContext {
  return {
    userId: `user-${employeeId}`,
    tenantId: 'tenant-test',
    role,
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
    employeeId,
    permissions: ROLE_CAPABILITIES[role],
    sessionId: `session-${employeeId}`,
    timestamp: new Date().toISOString(),
  };
}

describe('team-scope consistency', () => {
  const employeeProfileAgent = new EmployeeProfileAgent();
  const onboardingAgent = new OnboardingAgent();

  it('manager sees the same direct-report employee set through the service and employee agent', async () => {
    const context = makeContext('manager', 'emp-003');

    const serviceResult = await getEmployeeList(context, { status: 'all', limit: 100 });
    const agentResult = await employeeProfileAgent.execute('employee_search', { status: 'all' }, context);

    expect(agentResult.success).toBe(true);
    const serviceIds = serviceResult.employees.map((employee) => employee.id).sort();
    const agentIds = (agentResult.data as { id: string }[]).map((employee) => employee.id).sort();

    expect(agentIds).toEqual(serviceIds);
    expect(agentIds).toEqual(['emp-003', 'emp-005', 'emp-011']);
  });

  it('team lead gets the same deny decision for a skip-level employee across the service and employee agent', async () => {
    const context = makeContext('team_lead', 'emp-005');

    const serviceResult = await getEmployee(context, 'emp-008');
    const agentResult = await employeeProfileAgent.execute('employee_summary', { employeeId: 'emp-008' }, context);

    expect(serviceResult).toBeNull();
    expect(agentResult.success).toBe(false);
  });

  it('team lead can still access a direct report onboarding plan through the agent surface', async () => {
    const context = makeContext('team_lead', 'emp-005');

    const result = await onboardingAgent.execute('onboarding_status', { employeeId: 'emp-022' }, context);

    expect(result.success).toBe(true);
  });
});

/**
 * Agent Registry
 * Singleton coordinator with all specialist agents registered.
 * Import this anywhere you need to execute agent requests.
 */

import { SwarmCoordinator } from './coordinator';
import { EmployeeProfileAgent } from './employee-profile.agent';
import { LeaveMilestonesAgent } from './leave-milestones.agent';
import { DocumentComplianceAgent } from './document-compliance.agent';
import { OnboardingAgent } from './onboarding.agent';
import { OffboardingAgent } from './offboarding.agent';
import { WorkflowAgent } from './workflow.agent';
import { KnowledgeAgent } from './knowledge.agent';
import { ManagerSupportAgent } from './manager-support.agent';
import { createSupabaseRepositoryFactory } from '@/lib/repositories/supabase-factory';
import { InMemoryEventBus } from '@/lib/infrastructure/event-bus/in-memory-event-bus';
import { createAuditLog } from '@/lib/infrastructure/audit/supabase-audit-log';
import { registerNotificationHandlers } from '@/lib/notifications';
import { getEmployeeStore } from '@/lib/data/employee-store';

let coordinator: SwarmCoordinator | null = null;

export function getCoordinator(): SwarmCoordinator {
  if (coordinator) return coordinator;

  const repoFactory = createSupabaseRepositoryFactory();
  const agentRunRepo = repoFactory.agentRun();
  const eventBus = new InMemoryEventBus();
  const auditLog = createAuditLog();

  // Notification bus: turn domain events into email + Teams pings.
  // Graceful in dev — if Graph/Teams aren't configured, senders no-op with a
  // warning, so agent execution is never blocked by missing notification infra.
  const tenantId = 'default';
  registerNotificationHandlers(eventBus, {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    lookupEmployee: async (employeeId) => {
      try {
        const store = getEmployeeStore();
        const emp = await store.findById(employeeId, tenantId);
        if (!emp) return null;
        return {
          email: emp.email,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
        };
      } catch {
        return null;
      }
    },
  });

  coordinator = new SwarmCoordinator(agentRunRepo, eventBus, auditLog);
  coordinator.register(new EmployeeProfileAgent());
  coordinator.register(new LeaveMilestonesAgent());
  coordinator.register(new DocumentComplianceAgent());
  coordinator.register(new OnboardingAgent());
  coordinator.register(new OffboardingAgent());
  coordinator.register(new WorkflowAgent());
  coordinator.register(new KnowledgeAgent());
  coordinator.register(new ManagerSupportAgent());

  return coordinator;
}

export { SwarmCoordinator } from './coordinator';
export type { Agent } from './base';
export { createAgentResult, createErrorResult } from './base';

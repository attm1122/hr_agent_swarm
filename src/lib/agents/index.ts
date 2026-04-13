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
import { InMemoryAuditLog } from '@/lib/infrastructure/audit/in-memory-audit-log';

let coordinator: SwarmCoordinator | null = null;

export function getCoordinator(): SwarmCoordinator {
  if (coordinator) return coordinator;

  const repoFactory = createSupabaseRepositoryFactory();
  const agentRunRepo = repoFactory.agentRun();
  const eventBus = new InMemoryEventBus();
  const auditLog = new InMemoryAuditLog();

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

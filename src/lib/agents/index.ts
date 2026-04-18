/**
 * Agent Registry
 * Singleton coordinator with all specialist agents registered.
 * Import this anywhere you need to execute agent requests.
 */

import { SwarmCoordinator, initializeCoordinator } from './coordinator';
import { EmployeeProfileAgent } from './employee-profile.agent';
import { LeaveMilestonesAgent } from './leave-milestones.agent';
import { DocumentComplianceAgent } from './document-compliance.agent';
import { OnboardingAgent } from './onboarding.agent';
import { OffboardingAgent } from './offboarding.agent';
import { WorkflowAgent } from './workflow.agent';
import { KnowledgeAgent } from './knowledge.agent';
import { ManagerSupportAgent } from './manager-support.agent';
import { InMemoryEventBus } from '@/lib/infrastructure/event-bus/in-memory-event-bus';
import { createSupabaseRepositoryFactory } from '@/lib/repositories/supabase-factory';

let coordinator: SwarmCoordinator | null = null;

export function getCoordinator(): SwarmCoordinator {
  if (coordinator) return coordinator;

  // Initialize with in-memory implementations for now
  const eventBus = new InMemoryEventBus();
  const repoFactory = createSupabaseRepositoryFactory();
  const agentRunRepo = repoFactory.agentRun();
  
  // Create mock audit log (TODO: implement real audit log port)
  const auditLog = {
    log: async () => {},
    query: async () => [],
    verifyIntegrity: async () => ({ valid: true }),
  };

  coordinator = initializeCoordinator(agentRunRepo, eventBus, auditLog, {
    timeoutMs: 30000,
    maxRetries: 3,
    enablePersistence: false, // Disable persistence for now
  });
  
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

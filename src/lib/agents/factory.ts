/**
 * Agent Coordinator Factory
 *
 * Explicit dependency injection for the agent swarm.
 * Replaces the implicit singleton pattern with a factory
 * that creates a fully-configured coordinator on demand.
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
import type {
  AgentRunRepositoryPort,
  EventBusPort,
  AuditLogPort,
} from '@/lib/ports';

export interface CoordinatorFactoryDeps {
  agentRunRepo?: AgentRunRepositoryPort;
  eventBus?: EventBusPort;
  auditLog?: AuditLogPort;
  timeoutMs?: number;
  maxRetries?: number;
  enablePersistence?: boolean;
}

export function createCoordinator(deps: CoordinatorFactoryDeps = {}): SwarmCoordinator {
  const eventBus = deps.eventBus ?? new InMemoryEventBus();
  const agentRunRepo = deps.agentRunRepo ?? createSupabaseRepositoryFactory().agentRun();

  const auditLog: AuditLogPort = deps.auditLog ?? {
    log: async () => {},
    query: async () => [],
    verifyIntegrity: async () => ({ valid: true }),
  };

  const coordinator = initializeCoordinator(agentRunRepo, eventBus, auditLog, {
    timeoutMs: deps.timeoutMs ?? 30000,
    maxRetries: deps.maxRetries ?? 3,
    enablePersistence: deps.enablePersistence ?? false,
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

/**
 * Repositories Index
 * 
 * Central export for all repository layers.
 * Repositories abstract data access with Supabase persistence
 * and safe fallback to local stores for development.
 */

// Manager Support Repositories
export {
  ManagerOperationalRepository,
  getManagerOperationalRepository,
  type ManagerTeamContext,
  type TeamOperationalSummary,
  type EmployeeOperationalStatus,
} from './manager-operational-repository';

export {
  ManagerSupportRepository,
  getManagerSupportRepository,
  type TeamBrief,
  type EmployeeBrief,
  type ManagerDashboardData,
} from './manager-support-repository';

// Agent Observability Repository
export {
  AgentRunRepository,
  getAgentRunRepository,
  createServiceRoleClient,
  type AgentRunRecord,
  type AgentRunQueryOptions,
} from './agent-run-repository';

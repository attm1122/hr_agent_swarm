/**
 * Agent Types
 * Standard contracts for all HR Agent Swarm agents
 */

export interface AgentResult<T = unknown> {
  success: boolean;
  summary: string;
  confidence: number;
  data: T;
  risks: string[];
  requiresApproval: boolean;
  proposedActions?: ProposedAction[];
  citations?: Citation[];
}

export interface ProposedAction {
  type: string;
  label: string;
  payload: Record<string, unknown>;
}

export interface Citation {
  source: string;
  reference: string;
}

export type AgentIntent =
  | 'employee_file_query'
  | 'employee_file_summary'
  | 'document_classification'
  | 'leave_balance_query'
  | 'leave_request_submit'
  | 'leave_request_approve'
  | 'salary_snapshot'
  | 'salary_history'
  | 'salary_variance'
  | 'compliance_check'
  | 'anniversary_query'
  | 'expiry_alert'
  | 'onboarding_progress'
  | 'onboarding_task_update'
  | 'policy_query'
  | 'policy_search'
  | 'workflow_initiate'
  | 'workflow_approve'
  | 'report_generate'
  | 'report_export'
  | 'dashboard_summary'
  | 'unknown';

export interface AgentContext {
  employeeId?: string;
  managerId?: string;
  hrUserId?: string;
  teamId?: string;
  sessionId: string;
  timestamp: string;
  permissions: string[];
}

export interface SwarmRequest {
  intent: AgentIntent;
  payload: Record<string, unknown>;
  context: AgentContext;
}

export interface SwarmResponse {
  agentType: string;
  result: AgentResult;
  routingTime: number;
  executionTime: number;
}

export type AgentType =
  | 'employee_file'
  | 'leave'
  | 'salary'
  | 'reporting'
  | 'compliance'
  | 'onboarding'
  | 'policy'
  | 'workflow'
  | 'coordinator';

export interface AgentDefinition {
  type: AgentType;
  name: string;
  description: string;
  allowedIntents: AgentIntent[];
  requiredPermissions: string[];
  maxConfidence: number;
}

/**
 * Swarm Coordinator
 * Routes intents to specialist agents, enforces permissions,
 * and logs all agent runs for auditability.
 *
 * This is the ONLY entry point for agent execution.
 * Pages and API routes call the coordinator — never agents directly.
 * 
 * Persistence: When SUPABASE_SERVICE_ROLE_KEY is available,
 * all agent runs are persisted to the agent_runs table for
 * full traceability and observability.
 */

import type { AgentType, AgentIntent, SwarmRequest, SwarmResponse, AgentResult } from '@/types';
import type { Agent } from './base';
import { createErrorResult } from './base';
import {
  AgentRunRepository,
  getAgentRunRepository,
  createServiceRoleClient,
  AgentRunRecord,
} from '@/lib/repositories/agent-run-repository';

/** Maps each intent to its owning agent. Only list intents with registered agents. */
const INTENT_ROUTING: Partial<Record<AgentIntent, AgentType>> = {
  employee_search: 'employee_profile',
  employee_summary: 'employee_profile',
  document_list: 'document_compliance',
  document_classify: 'document_compliance',
  leave_balance: 'leave_milestones',
  leave_request: 'leave_milestones',
  milestone_list: 'leave_milestones',
  // Onboarding
  onboarding_create: 'onboarding',
  onboarding_status: 'onboarding',
  onboarding_task_list: 'onboarding',
  onboarding_task_complete: 'onboarding',
  onboarding_blockers: 'onboarding',
  // Offboarding
  offboarding_create: 'offboarding',
  offboarding_status: 'offboarding',
  offboarding_task_list: 'offboarding',
  offboarding_task_complete: 'offboarding',
  offboarding_assets: 'offboarding',
  offboarding_access: 'offboarding',
  offboarding_exit_summary: 'offboarding',
  // Workflow & Approvals
  workflow_create: 'workflow_approvals',
  workflow_status: 'workflow_approvals',
  workflow_approve: 'workflow_approvals',
  workflow_reject: 'workflow_approvals',
  approval_inbox: 'workflow_approvals',
  workflow_history: 'workflow_approvals',
  // Knowledge & Policy
  policy_search: 'knowledge_policy',
  policy_answer: 'knowledge_policy',
  policy_citations: 'knowledge_policy',
  // Manager Support
  manager_team_summary: 'manager_support',
  manager_employee_brief: 'manager_support',
  manager_dashboard: 'manager_support',
  manager_action_items: 'manager_support',
  manager_status_check: 'manager_support',
  // Coordinator
  dashboard_summary: 'coordinator',
};

/**
 * Intent-level permissions — checked IN ADDITION to agent.requiredPermissions.
 * leave_request uses OR-logic (INTENT_PERMISSIONS_ANY) so both leave:approve and leave:write work.
 */
const INTENT_PERMISSIONS: Partial<Record<AgentIntent, string[]>> = {
  document_classify: ['compliance:read'],
};

/** Intents where ANY ONE of the listed capabilities suffices (OR-logic) */
const INTENT_PERMISSIONS_ANY: Partial<Record<AgentIntent, string[]>> = {
  leave_request: ['leave:approve', 'leave:write'],
};

/** Audit log entry (in-memory for POC; production writes to agent_runs table) */
export interface AuditEntry {
  id: string;
  timestamp: string;
  agentType: AgentType | 'coordinator';
  intent: AgentIntent;
  userId: string;
  role: string;
  success: boolean;
  executionTimeMs: number;
  summary: string;
}

export class SwarmCoordinator {
  private agents: Map<AgentType, Agent> = new Map();
  private auditLog: AuditEntry[] = [];
  private agentRunRepo: AgentRunRepository;

  constructor(agentRunRepo?: AgentRunRepository) {
    this.agentRunRepo = agentRunRepo || this.initializeRepository();
  }

  /**
   * Initialize the agent run repository with service role if available
   */
  private initializeRepository(): AgentRunRepository {
    const serviceClient = createServiceRoleClient();
    return getAgentRunRepository(serviceClient || undefined);
  }

  register(agent: Agent): void {
    this.agents.set(agent.type, agent);
  }

  /** Read-only access to the audit log */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return this.auditLog;
  }

  /** Check if coordinator is using persistent storage for agent runs */
  isUsingPersistence(): boolean {
    return this.agentRunRepo.isUsingPersistence();
  }

  /** Main routing entry point */
  async route(request: SwarmRequest): Promise<SwarmResponse> {
    const start = performance.now();
    const auditId = crypto.randomUUID();

    // 1. Resolve target agent
    const targetType = INTENT_ROUTING[request.intent];
    if (!targetType) {
      return this.buildResponse('coordinator', request.intent, createErrorResult(`Unknown intent: ${request.intent}`), start, auditId, request);
    }

    // 2. Dashboard summary is handled by the coordinator itself
    if (request.intent === 'dashboard_summary') {
      return this.dashboardSummary(request, start, auditId);
    }

    // 3. Find the agent
    const agent = this.agents.get(targetType);
    if (!agent) {
      return this.buildResponse(
        'coordinator', request.intent,
        createErrorResult(`Agent '${targetType}' is not registered`, [`No handler for ${targetType}`]),
        start, auditId, request,
      );
    }

    // 4. Permission check — agent-level + intent-level (AND) + intent-level (ANY)
    const requiredPerms = [
      ...agent.requiredPermissions,
      ...(INTENT_PERMISSIONS[request.intent] || []),
    ];
    const missingPerms = requiredPerms.filter(
      p => !request.context.permissions.includes(p)
    );
    if (missingPerms.length > 0) {
      return this.buildResponse(
        targetType, request.intent,
        createErrorResult(`Permission denied: missing ${missingPerms.join(', ')}`, ['Insufficient permissions']),
        start, auditId, request,
      );
    }
    // OR-logic: user must have at least ONE of the listed capabilities
    const anyPerms = INTENT_PERMISSIONS_ANY[request.intent];
    if (anyPerms && !anyPerms.some(p => request.context.permissions.includes(p))) {
      return this.buildResponse(
        targetType, request.intent,
        createErrorResult(`Permission denied: need one of ${anyPerms.join(', ')}`, ['Insufficient permissions']),
        start, auditId, request,
      );
    }

    // 5. Execute
    let result: AgentResult;
    try {
      result = await agent.execute(request.intent, request.payload, request.context);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown agent error';
      result = createErrorResult(`Agent execution failed: ${message}`, ['Agent runtime error']);
    }

    return this.buildResponse(targetType, request.intent, result, start, auditId, request);
  }

  /** Coordinator-level dashboard summary: aggregates across agents */
  private async dashboardSummary(
    request: SwarmRequest,
    start: number,
    auditId: string,
  ): Promise<SwarmResponse> {
    const results: Record<string, AgentResult> = {};

    // Fan out to registered agents with safe intents
    const summaryIntents: { intent: AgentIntent; payload: Record<string, unknown> }[] = [
      { intent: 'employee_search', payload: {} },
      { intent: 'leave_balance', payload: { status: 'pending' } },
      { intent: 'document_classify', payload: {} },
      { intent: 'milestone_list', payload: { status: 'upcoming' } },
    ];

    // Fan out in parallel — these agents are independent
    const tasks = summaryIntents
      .filter(({ intent }) => {
        const agentType = INTENT_ROUTING[intent];
        if (!agentType) return false;
        const agent = this.agents.get(agentType);
        if (!agent) return false;
        // Check agent-level + intent-level AND permissions
        const requiredPerms = [
          ...agent.requiredPermissions,
          ...(INTENT_PERMISSIONS[intent] || []),
        ];
        if (!requiredPerms.every(p => request.context.permissions.includes(p))) return false;
        // Check intent-level OR permissions (need at least one)
        const anyPerms = INTENT_PERMISSIONS_ANY[intent];
        if (anyPerms && !anyPerms.some(p => request.context.permissions.includes(p))) return false;
        return true;
      })
      .map(async ({ intent, payload }) => {
        const agent = this.agents.get(INTENT_ROUTING[intent]!);
        return { intent, result: await agent!.execute(intent, payload, request.context) };
      });

    const settled = await Promise.allSettled(tasks);
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results[outcome.value.intent] = outcome.value.result;
      }
      // Partial failure: rejected promises are silently skipped
    }

    const combined = {
      success: true,
      summary: 'Dashboard summary assembled from specialist agents',
      confidence: 1.0,
      data: results,
      risks: Object.values(results).flatMap(r => r.risks),
      requiresApproval: false,
      proposedActions: Object.values(results).flatMap(r => r.proposedActions || []),
      citations: Object.values(results).flatMap(r => r.citations || []),
    };

    return this.buildResponse('coordinator', 'dashboard_summary', combined, start, auditId, request);
  }

  private buildResponse(
    agentType: AgentType | 'coordinator',
    intent: AgentIntent,
    result: AgentResult,
    start: number,
    auditId: string,
    request: SwarmRequest,
  ): SwarmResponse {
    const executionTimeMs = Math.round(performance.now() - start);

    // Audit log (in-memory)
    this.auditLog.push({
      id: auditId,
      timestamp: new Date().toISOString(),
      agentType: agentType as AgentType,
      intent,
      userId: request.context.userId,
      role: request.context.role,
      success: result.success,
      executionTimeMs,
      summary: result.summary,
    });

    // Keep log bounded (POC)
    if (this.auditLog.length > 200) this.auditLog.splice(0, this.auditLog.length - 200);

    // Persist to database if available (async, don't block response)
    this.persistAgentRun({
      id: auditId,
      agentType: agentType as AgentType,
      intent,
      inputPayload: request.payload,
      outputResult: result,
      confidence: result.confidence,
      executionTimeMs,
      success: result.success,
      errorMessage: result.success ? null : result.summary,
      context: {
        userId: request.context.userId,
        role: request.context.role,
        permissions: request.context.permissions,
        sessionId: request.context.sessionId,
        timestamp: request.context.timestamp,
      },
      metadata: {
        isModelBacked: result.confidence > 0,
        isFallback: result.confidence === 0,
      },
      createdAt: new Date().toISOString(),
    }).catch(err => {
      // Silently log persistence errors - don't fail the user request
      console.warn('Failed to persist agent run:', err);
    });

    return {
      agentType: agentType as AgentType,
      intent,
      result,
      routingConfidence: 1.0,
      executionTimeMs,
      auditId,
    };
  }

  /**
   * Persist agent run to durable storage
   */
  private async persistAgentRun(record: AgentRunRecord): Promise<void> {
    await this.agentRunRepo.saveAgentRun(record);
  }

  /**
   * Query persisted agent runs (for observability)
   */
  async queryAgentRuns(...args: Parameters<AgentRunRepository['queryAgentRuns']>) {
    return this.agentRunRepo.queryAgentRuns(...args);
  }

  /**
   * Get success statistics (for observability)
   */
  async getSuccessStats(...args: Parameters<AgentRunRepository['getSuccessStats']>) {
    return this.agentRunRepo.getSuccessStats(...args);
  }
}

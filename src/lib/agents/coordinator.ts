/**
 * Swarm Coordinator - Central Agent Orchestrator
 * 
 * Implements dependency injection for testability and hexagonal architecture.
 */

import type { Agent, AgentIntent, AgentResult, AgentType } from './base';
import { createErrorResult } from './base';
import type { AgentContext, SwarmRequest, SwarmResponse } from '@/types';
import type {
  AgentRunRepositoryPort,
  EventBusPort,
  AuditLogPort,
} from '@/lib/ports';
import { createId } from '@/lib/utils/ids';

// Intent routing map
const INTENT_ROUTING: Partial<Record<AgentIntent, AgentType>> = {
  // Employee Profile Agent
  employee_search: 'employee_profile',
  employee_summary: 'employee_profile',
  employee_profile: 'employee_profile',
  team_directory: 'employee_profile',
  
  // Leave Milestones Agent
  leave_balance_check: 'leave_milestones',
  leave_request_submit: 'leave_milestones',
  leave_request_status: 'leave_milestones',
  upcoming_milestones: 'leave_milestones',
  milestone_acknowledge: 'leave_milestones',
  
  // Document Compliance Agent
  policy_lookup: 'document_compliance',
  policy_compare: 'document_compliance',
  compliance_check: 'document_compliance',
  document_find: 'document_compliance',
  
  // Onboarding Agent
  onboarding_create: 'onboarding',
  onboarding_progress: 'onboarding',
  onboarding_task_complete: 'onboarding',
  
  // Offboarding Agent
  offboarding_create: 'offboarding',
  offboarding_progress: 'offboarding',
  offboarding_task_complete: 'offboarding',
  
  // Workflow Agent
  workflow_status: 'workflow',
  workflow_create: 'workflow',
  workflow_approve: 'workflow',
  
  // Knowledge Agent
  knowledge_search: 'knowledge',
  knowledge_summary: 'knowledge',
  report_generate: 'knowledge',
  
  // Manager Support Agent
  dashboard_summary: 'manager_support',
  manager_team_overview: 'manager_support',
  manager_employee_brief: 'manager_support',
  manager_action_items: 'manager_support',
  employee_document_list: 'manager_support',
  pending_leave_requests: 'manager_support',
  pending_workflows: 'manager_support',
};

// Permission requirements per intent
const INTENT_PERMISSIONS: Partial<Record<AgentIntent, string[]>> = {
  employee_search: ['employee:read'],
  employee_summary: ['employee:read'],
  employee_profile: ['employee:read'],
  leave_balance_check: ['leave:read'],
  leave_request_submit: ['leave:write'],
  policy_lookup: ['policy:read'],
  onboarding_create: ['onboarding:write'],
  offboarding_create: ['offboarding:write'],
  workflow_create: ['workflow:write'],
  workflow_approve: ['workflow:approve'],
  dashboard_summary: ['dashboard:view'],
};

export interface CoordinatorConfig {
  timeoutMs?: number;
  maxRetries?: number;
  enablePersistence?: boolean;
}

export class SwarmCoordinator {
  private agents = new Map<AgentType, Agent>();
  private config: Required<CoordinatorConfig>;
  
  constructor(
    private agentRunRepo: AgentRunRepositoryPort,
    private eventBus: EventBusPort,
    private auditLog: AuditLogPort,
    config?: CoordinatorConfig
  ) {
    this.config = {
      timeoutMs: config?.timeoutMs || 30000,
      maxRetries: config?.maxRetries || 3,
      enablePersistence: config?.enablePersistence ?? true,
    };
  }

  register(agent: Agent): void {
    if (this.agents.has(agent.type)) {
      throw new Error(`Agent ${agent.type} already registered`);
    }
    
    this.agents.set(agent.type, agent);
  }

  async route(request: SwarmRequest): Promise<SwarmResponse> {
    const auditId = createId();
    const startTime = performance.now();
    
    try {
      // Resolve target agent
      const targetType = INTENT_ROUTING[request.intent];
      if (!targetType) {
        throw new Error(`Unknown intent: ${request.intent}`);
      }

      const agent = this.agents.get(targetType);
      if (!agent) {
        throw new Error(`Agent ${targetType} not registered`);
      }

      // Permission check
      if (!this.hasPermission(request.context, request.intent)) {
        throw new Error('Insufficient permissions');
      }

      // Check if agent can handle intent
      if (!agent.canHandle(request.intent)) {
        throw new Error(`Agent ${targetType} cannot handle intent ${request.intent}`);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => agent.execute(request.intent, request.payload || {}, request.context),
        this.config.timeoutMs
      );

      // Build response
      const executionTimeMs = Math.round(performance.now() - startTime);
      const response = this.buildResponse(
        targetType,
        request.intent,
        result,
        executionTimeMs,
        auditId,
        request
      );

      // Persist execution (non-blocking)
      if (this.config.enablePersistence) {
        this.persistExecution(auditId, targetType, request, result, executionTimeMs)
          .catch(err => console.error('Failed to persist agent run:', err));
      }

      // Publish event
      this.eventBus.publish({
        id: createId(),
        type: 'agent.execution_completed',
        payload: {
          auditId,
          agentType: targetType,
          intent: request.intent,
          success: result.success,
          confidence: result.confidence,
        },
        timestamp: new Date().toISOString(),
        correlationId: request.context.sessionId,
        tenantId: request.context.tenantId,
        userId: request.context.userId,
        version: 1,
      }).catch(err => console.error('Failed to publish event:', err));

      return response;

    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      const errorResult = createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        ['execution_failed']
      );

      // Persist error
      if (this.config.enablePersistence) {
        this.persistExecution(auditId, 'coordinator', request, errorResult, executionTimeMs)
          .catch(err => console.error('Failed to persist error:', err));
      }

      return this.buildResponse(
        'coordinator',
        request.intent,
        errorResult,
        executionTimeMs,
        auditId,
        request
      );
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)
      ),
    ]);
  }

  private hasPermission(context: AgentContext, intent: AgentIntent): boolean {
    const required = INTENT_PERMISSIONS[intent];
    if (!required) return true; // No specific permissions required
    
    return required.every(perm => context.permissions.includes(perm));
  }

  private buildResponse(
    agentType: AgentType,
    intent: AgentIntent,
    result: AgentResult<unknown>,
    executionTimeMs: number,
    auditId: string,
    request: SwarmRequest
  ): SwarmResponse {
    return {
      intent,
      agentType,
      result,
      executionTimeMs,
      auditId,
      timestamp: new Date().toISOString(),
      context: {
        userId: request.context.userId,
        role: request.context.role,
        tenantId: request.context.tenantId,
      },
    };
  }

  private async persistExecution(
    auditId: string,
    agentType: AgentType,
    request: SwarmRequest,
    result: AgentResult<unknown>,
    executionTimeMs: number
  ): Promise<void> {
    await this.agentRunRepo.save({
      id: auditId,
      agentType,
      intent: request.intent,
      inputPayload: request.payload || {},
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
        timestamp: new Date().toISOString(),
      },
      metadata: {
        isModelBacked: false,
        isFallback: false,
        dataSource: 'supabase',
      },
      createdAt: new Date().toISOString(),
    }, request.context.tenantId);
  }

  /**
   * Dashboard summary with parallel agent execution
   */
  async dashboardSummary(context: AgentContext): Promise<{
    results: Record<string, AgentResult<unknown>>;
    errors: Record<string, string>;
  }> {
    const summaryIntents: Array<{ intent: AgentIntent; payload: Record<string, unknown> }> = [
      { intent: 'manager_team_overview', payload: {} },
      { intent: 'manager_action_items', payload: {} },
      { intent: 'pending_leave_requests', payload: {} },
      { intent: 'upcoming_milestones', payload: { days: 30 } },
    ];

    const results: Record<string, AgentResult<unknown>> = {};
    const errors: Record<string, string> = {};

    // Execute in parallel with individual error handling
    const executions = summaryIntents.map(async ({ intent, payload }) => {
      try {
        const response = await this.route({
          intent,
          payload,
          context,
        });
        results[intent] = response.result;
      } catch (err) {
        errors[intent] = err instanceof Error ? err.message : 'Unknown error';
      }
    });

    await Promise.all(executions);

    return { results, errors };
  }
}

// Singleton instance factory
let coordinatorInstance: SwarmCoordinator | null = null;

export function initializeCoordinator(
  agentRunRepo: AgentRunRepositoryPort,
  eventBus: EventBusPort,
  auditLog: AuditLogPort,
  config?: CoordinatorConfig
): SwarmCoordinator {
  coordinatorInstance = new SwarmCoordinator(agentRunRepo, eventBus, auditLog, config);
  return coordinatorInstance;
}

export function getCoordinator(): SwarmCoordinator {
  if (!coordinatorInstance) {
    throw new Error('Coordinator not initialized. Call initializeCoordinator first.');
  }
  return coordinatorInstance;
}

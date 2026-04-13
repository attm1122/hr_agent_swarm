/**
 * Swarm Coordinator - Central Agent Orchestrator
 * 
 * Implements dependency injection for testability and hexagonal architecture.
 */

import type { Agent } from './base';
import { createErrorResult } from './base';
import type { AgentContext, AgentIntent, AgentResult, AgentType, SwarmRequest, SwarmResponse } from '@/types';
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

  // Leave Milestones Agent (both old and new intent names)
  leave_balance: 'leave_milestones',
  leave_request: 'leave_milestones',
  leave_balance_check: 'leave_milestones',
  leave_request_submit: 'leave_milestones',
  leave_request_status: 'leave_milestones',
  upcoming_milestones: 'leave_milestones',
  milestone_list: 'leave_milestones',
  milestone_acknowledge: 'leave_milestones',

  // Document Compliance Agent (both old and new intent names)
  document_list: 'document_compliance',
  document_classify: 'document_compliance',
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
  workflow_status: 'workflow_approvals',
  workflow_create: 'workflow_approvals',
  workflow_approve: 'workflow_approvals',

  // Knowledge Agent
  knowledge_search: 'knowledge_policy',
  knowledge_summary: 'knowledge_policy',
  report_generate: 'knowledge_policy',

  // Manager Support Agent
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
  leave_balance: ['leave:read'],
  leave_request: ['leave:read'],
  leave_balance_check: ['leave:read'],
  leave_request_submit: ['leave:write'],
  document_list: ['document:read'],
  document_classify: ['compliance:read'],
  milestone_list: ['leave:read'],
  policy_lookup: ['policy:read'],
  onboarding_create: ['onboarding:write'],
  offboarding_create: ['offboarding:write'],
  workflow_create: ['workflow:write'],
  workflow_approve: ['workflow:approve'],
};

export interface CoordinatorConfig {
  timeoutMs?: number;
  maxRetries?: number;
  enablePersistence?: boolean;
}

interface AuditEntry {
  userId: string;
  role: string;
  intent: string;
  success: boolean;
  executionTimeMs: number;
  timestamp: string;
}

export class SwarmCoordinator {
  private agents = new Map<AgentType, Agent>();
  private config: Required<CoordinatorConfig>;
  private auditEntries: AuditEntry[] = [];
  private readonly maxAuditEntries = 200;

  constructor(
    private agentRunRepo: AgentRunRepositoryPort,
    private eventBus: EventBusPort,
    private auditLogPort: AuditLogPort,
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
    // Handle dashboard_summary as a fan-out across all registered agents
    if (request.intent === 'dashboard_summary') {
      return this.handleDashboardSummary(request);
    }

    const auditId = createId();
    const startTime = performance.now();

    try {
      // Resolve target agent
      const targetType = INTENT_ROUTING[request.intent];
      if (!targetType) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        const errorResult = createErrorResult(
          `Unknown intent: ${request.intent}`,
          ['unknown_intent']
        );
        this.recordAudit(request, false, executionTimeMs);
        return this.buildResponse('coordinator', request.intent, errorResult, executionTimeMs, auditId, request);
      }

      const agent = this.agents.get(targetType);
      if (!agent) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        const errorResult = createErrorResult(
          `Agent ${targetType} not registered`,
          ['agent_not_found']
        );
        this.recordAudit(request, false, executionTimeMs);
        return this.buildResponse('coordinator', request.intent, errorResult, executionTimeMs, auditId, request);
      }

      // Permission check
      if (!this.hasPermission(request.context, request.intent)) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        const errorResult = createErrorResult(
          'Insufficient permissions',
          ['permission_denied']
        );
        this.recordAudit(request, false, executionTimeMs);
        return this.buildResponse('coordinator', request.intent, errorResult, executionTimeMs, auditId, request);
      }

      // Check if agent can handle intent
      if (!agent.canHandle(request.intent)) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        const errorResult = createErrorResult(
          `Agent ${targetType} cannot handle intent ${request.intent}`,
          ['intent_not_supported']
        );
        this.recordAudit(request, false, executionTimeMs);
        return this.buildResponse('coordinator', request.intent, errorResult, executionTimeMs, auditId, request);
      }

      // Execute with timeout
      let result: AgentResult<unknown>;
      try {
        result = await this.executeWithTimeout(
          () => agent.execute(request.intent, request.payload || {}, request.context),
          this.config.timeoutMs
        );
      } catch (execErr) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        const errorResult = createErrorResult(
          `Agent execution failed: ${execErr instanceof Error ? execErr.message : 'Unknown error'}`,
          ['execution_failed']
        );
        this.recordAudit(request, false, executionTimeMs);
        return this.buildResponse(targetType, request.intent, errorResult, executionTimeMs, auditId, request);
      }

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

      // Record audit
      this.recordAudit(request, result.success, executionTimeMs);

      // Persist execution (non-blocking)
      if (this.config.enablePersistence) {
        this.persistExecution(auditId, targetType, request, result, executionTimeMs)
          .catch(err => console.error('Failed to persist agent run:', err));
      }

      // Publish event (non-blocking)
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
        tenantId: request.context.tenantId || 'default',
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

      this.recordAudit(request, false, executionTimeMs);

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

  /**
   * Handle dashboard_summary by fanning out to all registered agent intents
   */
  private async handleDashboardSummary(request: SwarmRequest): Promise<SwarmResponse> {
    const auditId = createId();
    const startTime = performance.now();
    const context = request.context;

    // Collect one representative intent per registered agent
    const dashboardIntents: AgentIntent[] = [];
    for (const agent of this.agents.values()) {
      for (const intent of agent.supportedIntents) {
        if (this.hasPermission(context, intent) && agent.canHandle(intent)) {
          dashboardIntents.push(intent);
        }
      }
    }

    // Execute all in parallel
    const results: Record<string, AgentResult> = {};
    const executions = dashboardIntents.map(async (intent) => {
      try {
        const response = await this.route({
          intent,
          query: '',
          payload: {},
          context,
        });
        if (response.result.success || !response.result.success) {
          results[intent] = response.result;
        }
      } catch {
        // Ignore individual failures in dashboard fan-out
      }
    });

    await Promise.all(executions);

    const executionTimeMs = Math.round(performance.now() - startTime);
    const dashboardResult: AgentResult = {
      success: true,
      data: results,
      summary: 'Dashboard summary completed',
      confidence: 1,
      risks: [],
      requiresApproval: false,
    };

    this.recordAudit(request, true, executionTimeMs);

    return this.buildResponse(
      'coordinator',
      'dashboard_summary',
      dashboardResult,
      executionTimeMs,
      auditId,
      request
    );
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
        tenantId: request.context.tenantId || 'default',
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
    }, request.context.tenantId || 'default');
  }

  // ============================================
  // Backward-compatible audit & query methods
  // ============================================

  private recordAudit(request: SwarmRequest, success: boolean, executionTimeMs: number): void {
    this.auditEntries.push({
      userId: request.context.userId,
      role: request.context.role,
      intent: request.intent,
      success,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });
    // Trim to max size
    if (this.auditEntries.length > this.maxAuditEntries) {
      this.auditEntries = this.auditEntries.slice(-this.maxAuditEntries);
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditEntries];
  }

  async queryAgentRuns(options: {
    userId?: string;
    agentType?: string;
    intent?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ records: Array<{ context: { userId: string }; [key: string]: unknown }>; total: number }> {
    let filtered = [...this.auditEntries] as Array<AuditEntry & { context: { userId: string } }>;

    // Map audit entries to record-like objects
    let records = filtered.map(entry => ({
      ...entry,
      context: { userId: entry.userId },
    }));

    if (options.userId) {
      records = records.filter(r => r.context.userId === options.userId);
    }
    if (options.intent) {
      records = records.filter(r => r.intent === options.intent);
    }
    if (options.success !== undefined) {
      records = records.filter(r => r.success === options.success);
    }

    const total = records.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const sliced = records.slice(offset, offset + limit);

    return { records: sliced, total };
  }

  async getSuccessStats(timeRangeHours: number = 24): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgExecutionTimeMs: number;
  }> {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
    const filtered = this.auditEntries.filter(e => e.timestamp >= since);
    const total = filtered.length;
    const successful = filtered.filter(e => e.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const avgExecutionTimeMs = total > 0
      ? filtered.reduce((sum, e) => sum + e.executionTimeMs, 0) / total
      : 0;

    return { total, successful, failed, successRate, avgExecutionTimeMs };
  }

  isUsingPersistence(): boolean {
    return this.config.enablePersistence;
  }

  /**
   * Dashboard summary with parallel agent execution (programmatic API)
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
          query: '',
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

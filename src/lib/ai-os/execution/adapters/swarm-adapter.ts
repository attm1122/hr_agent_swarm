/**
 * Swarm adapter — routes an Intent into one or more SwarmCoordinator calls.
 *
 * This adapter is deliberately thin. It picks the right AgentIntent(s) and
 * payload shape based on the AI-OS Intent, then delegates to the existing
 * coordinator which handles RBAC, audit, and event bus integration.
 */

import { randomUUID } from 'node:crypto';
import { getCoordinator } from '@/lib/agents';
import type { AgentContext, SwarmResponse, AgentIntent } from '@/types';
import type { Intent } from '../../intent/types';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';

export interface SwarmCallSpec {
  intent: AgentIntent;
  payload: Record<string, unknown>;
  query?: string;
}

export interface SwarmCallOutcome {
  responses: SwarmResponse[];
  traces: ToolCallTrace[];
}

/** Map an AI-OS Intent → one or more AgentIntent calls. */
export function planSwarmCalls(intent: Intent): SwarmCallSpec[] {
  const { action, entity, target, filters, constraints, rawInput, fields } = intent;

  // ---- milestones / anniversaries ----------------------------------------
  if (entity === 'milestone' && action === 'ANALYZE') {
    const withinDays =
      constraints?.timeframe === 'next_month' ||
      filters?.timeframe === 'next_month'
        ? 45
        : typeof filters?.withinDays === 'number'
        ? (filters.withinDays as number)
        : 60;
    return [
      {
        intent: 'milestone_list',
        query: rawInput,
        payload: {
          withinDays,
          type: (filters?.type as string) ?? 'anniversary',
        },
      },
    ];
  }

  // ---- leave --------------------------------------------------------------
  if (entity === 'leave' && action === 'READ') {
    if (target.scope === 'self' && (fields ?? []).some((f) => f.startsWith('balance'))) {
      return [
        {
          intent: 'leave_balance',
          query: rawInput,
          payload: { employeeId: intent.actor.employeeId },
        },
      ];
    }
    return [
      {
        intent: 'leave_request',
        query: rawInput,
        payload: { status: (filters?.status as string) ?? 'approved' },
      },
    ];
  }

  // ---- employees ----------------------------------------------------------
  if (entity === 'employee' && (action === 'READ' || action === 'ANALYZE')) {
    if (target.scope === 'specific' && target.subjectId) {
      return [
        {
          intent: 'employee_summary',
          query: rawInput,
          payload: { employeeId: target.subjectId },
        },
      ];
    }
    return [
      {
        intent: 'employee_search',
        query: rawInput,
        payload: {
          query: target.description ?? rawInput,
          teamId: filters?.teamId,
          status: filters?.status,
        },
      },
    ];
  }

  // ---- policy -------------------------------------------------------------
  if (entity === 'policy') {
    return [
      {
        intent: 'policy_answer',
        query: rawInput,
        payload: {
          question: rawInput,
          topic: filters?.topic,
        },
      },
    ];
  }

  // ---- documents ----------------------------------------------------------
  if (entity === 'document' && action === 'READ') {
    return [
      {
        intent: 'document_list',
        query: rawInput,
        payload: {
          employeeId: target.subjectId ?? intent.actor.employeeId,
          category: filters?.category,
        },
      },
    ];
  }

  // ---- workflows ----------------------------------------------------------
  if (entity === 'workflow' && action === 'READ') {
    return [
      {
        intent: 'approval_inbox',
        query: rawInput,
        payload: {},
      },
    ];
  }

  // ---- RECOMMEND on employee (termination check, etc.) --------------------
  if (entity === 'employee' && action === 'RECOMMEND' && target.subjectId) {
    return [
      {
        intent: 'employee_summary',
        query: rawInput,
        payload: { employeeId: target.subjectId },
      },
      {
        intent: 'policy_answer',
        query: rawInput,
        payload: { question: rawInput, topic: 'termination' },
      },
    ];
  }

  // ---- team summary -------------------------------------------------------
  if (entity === 'team' && (action === 'ANALYZE' || action === 'READ')) {
    return [
      {
        intent: 'manager_team_overview',
        query: rawInput,
        payload: { teamId: filters?.teamId },
      },
    ];
  }

  // ---- default dashboard summary for unknown reads ------------------------
  if (action === 'READ' || action === 'ANALYZE') {
    return [
      {
        intent: 'dashboard_summary',
        query: rawInput,
        payload: {},
      },
    ];
  }

  return [];
}

export async function runSwarmCalls(
  specs: SwarmCallSpec[],
  ctx: AgentContext,
): Promise<SwarmCallOutcome> {
  const coordinator = getCoordinator();
  const responses: SwarmResponse[] = [];
  const traces: ToolCallTrace[] = [];

  for (const spec of specs) {
    const start = Date.now();
    try {
      const response = await coordinator.route({
        intent: spec.intent,
        query: spec.query ?? '',
        payload: spec.payload,
        context: ctx,
      });
      responses.push(response);
      traces.push({
        toolName: spec.intent,
        intent: spec.intent,
        input: spec.payload,
        success: response.result.success,
        summary: response.result.summary ?? '',
        executionTimeMs: response.executionTimeMs,
        auditId: response.auditId,
        data: response.result.data,
        citations: response.result.citations,
      });
    } catch (err) {
      traces.push({
        toolName: spec.intent,
        intent: spec.intent,
        input: spec.payload,
        success: false,
        summary: 'agent failure',
        executionTimeMs: Date.now() - start,
        auditId: randomUUID(),
        error: err instanceof Error ? err.message : 'agent failure',
      });
    }
  }

  return { responses, traces };
}

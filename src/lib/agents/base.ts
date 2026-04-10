/**
 * Base Agent Contract
 * All specialist agents implement this interface.
 * The coordinator dispatches to agents via this contract.
 */

import type { AgentResult, AgentContext, AgentIntent, AgentType } from '@/types';

export interface Agent {
  readonly type: AgentType;
  readonly name: string;
  readonly supportedIntents: AgentIntent[];
  readonly requiredPermissions: string[];

  canHandle(intent: AgentIntent): boolean;
  execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult>;
}

/** Factory to build a well-shaped AgentResult with safe defaults */
export function createAgentResult<T>(
  data: T,
  overrides: Partial<AgentResult<T>> = {}
): AgentResult<T> {
  return {
    success: true,
    summary: '',
    confidence: 1.0,
    data,
    risks: [],
    requiresApproval: false,
    proposedActions: [],
    citations: [],
    ...overrides,
  };
}

/** Standard error result */
export function createErrorResult(message: string, risks: string[] = []): AgentResult<null> {
  return {
    success: false,
    summary: message,
    confidence: 0,
    data: null,
    risks,
    requiresApproval: false,
    proposedActions: [],
    citations: [],
  };
}

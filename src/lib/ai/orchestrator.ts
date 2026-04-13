/**
 * LLM Orchestrator
 *
 * The brain of the HR swarm. Wraps Anthropic's tool-use loop and bridges
 * Claude's tool calls into the existing `SwarmCoordinator.route(...)` so
 * every tool invocation still flows through RBAC + audit.
 *
 * Contract:
 * - Stateless per call. Conversation history is passed in explicitly.
 * - Never calls coordinator without a fully-built `AgentContext` from the
 *   verified session. Clients cannot spoof permissions.
 * - Hard iteration cap (`MAX_TOOL_ITERATIONS`) prevents runaway loops.
 * - Collects an audit trail of every tool_use/tool_result pair the model
 *   produced, so UIs can render "the AI looked at X, Y, Z".
 */
/* eslint-disable no-console */

import type Anthropic from '@anthropic-ai/sdk';
import type { AgentContext, SwarmResponse } from '@/types';
import { getCoordinator } from '@/lib/agents';
import {
  getAnthropicClient,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  resolveModelId,
} from './anthropic-client';
import { getAnthropicTools, getToolByName } from './tools';

/** A single turn stored in conversation history. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  /**
   * Content blocks as Anthropic expects. We persist the *full* block array
   * (text + tool_use + tool_result) so multi-turn tool calls replay faithfully.
   */
  content: Anthropic.MessageParam['content'];
}

/** Record of a single tool call the model made during a run. */
export interface ToolCallTrace {
  toolName: string;
  intent: string;
  input: Record<string, unknown>;
  success: boolean;
  summary: string;
  executionTimeMs: number;
  auditId: string;
  /** Raw agent result payload — useful for rendering structured UI cards. */
  data?: unknown;
  citations?: { source: string; reference: string }[];
  error?: string;
}

export interface OrchestrateOptions {
  /** Prior conversation turns, oldest first. */
  history: ChatTurn[];
  /** The new user message. Required. */
  userMessage: string;
  /** Verified session-derived agent context. Required. */
  context: AgentContext;
  /** Optional override for max iterations. */
  maxIterations?: number;
  /** Optional override for max tokens per LLM call. */
  maxTokens?: number;
  /** Optional override for model. */
  model?: string;
  /** Called on each iteration boundary so UIs can stream progress. */
  onEvent?: (event: OrchestrationEvent) => void;
}

export type OrchestrationEvent =
  | { type: 'llm_start'; iteration: number }
  | { type: 'tool_call'; trace: ToolCallTrace }
  | { type: 'assistant_text'; text: string }
  | { type: 'done'; stopReason: Anthropic.Message['stop_reason'] };

export interface OrchestrateResult {
  /** Final assistant text. Empty string if the loop stopped without a message. */
  assistantText: string;
  /** All turns produced during this run (assistant + tool_result user turns). */
  newTurns: ChatTurn[];
  /** Full tool-call trace for audit / UI rendering. */
  toolCalls: ToolCallTrace[];
  /** Why Claude stopped producing tokens on the final iteration. */
  stopReason: Anthropic.Message['stop_reason'];
  /** Total LLM iterations actually performed. */
  iterations: number;
  /** Total tokens used across all iterations. */
  usage: { inputTokens: number; outputTokens: number };
}

const SYSTEM_PROMPT = `You are the HR AI assistant for LEAP Legal Software — an expert HR partner that helps managers, employees, and HR administrators get work done.

You operate by calling tools. Each tool maps to a specialist agent (employee directory, leave, documents, onboarding, offboarding, workflows, policy). Call tools liberally to ground your answers in real data; never guess employee details, dates, balances, or policy text.

Rules of engagement:
- Prefer tool calls over assumptions. If you don't have the data, fetch it.
- Chain tools when helpful: e.g. employee_search → employee_summary → leave_balance.
- Every tool call is RBAC-checked server-side. If a tool returns a permission error, explain the limitation to the user — do not attempt to work around it.
- Never fabricate names, IDs, policy clauses, or numbers. Cite the tool that produced a fact when it matters.
- When the user asks a policy question, use policy_answer (grounded) rather than policy_search when possible.
- For ambiguous requests, ask one concise clarifying question before calling tools that require specific IDs.
- Keep replies crisp and professional. Use short paragraphs or bullet lists. No emoji unless the user uses them first.
- If a requested action is destructive or consequential (approvals, offboarding, plan creation), confirm with the user before calling the tool.

You do not have memory beyond this conversation. You do not have internet access. You cannot send email or messages on your own. Stick to the tools provided.`;

/**
 * Run one orchestration cycle: feed the conversation + new user message to
 * Claude, execute any tool calls it makes, loop until it stops asking for
 * tools or we hit the iteration cap.
 */
export async function orchestrate(
  options: OrchestrateOptions,
): Promise<OrchestrateResult> {
  const {
    history,
    userMessage,
    context,
    maxIterations = MAX_TOOL_ITERATIONS,
    maxTokens = DEFAULT_MAX_TOKENS,
    model = DEFAULT_MODEL,
    onEvent,
  } = options;

  const client = getAnthropicClient();
  const tools = getAnthropicTools();
  const coordinator = getCoordinator();
  // Resolve the provider-qualified model id (adds `anthropic/` prefix when
  // routing through Vercel AI Gateway).
  const resolvedModel = resolveModelId(model);

  // Working message list Claude will see. Starts with the full prior history
  // plus the incoming user turn.
  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userMessage },
  ];

  // Turns we'll hand back to the caller to persist. The user's own message
  // is the caller's responsibility (they already have it).
  const newTurns: ChatTurn[] = [];
  const toolCalls: ToolCallTrace[] = [];

  let iterations = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let stopReason: Anthropic.Message['stop_reason'] = 'end_turn';
  let finalAssistantText = '';

  while (iterations < maxIterations) {
    iterations += 1;
    onEvent?.({ type: 'llm_start', iteration: iterations });

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: resolvedModel,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    } catch (err) {
      // If the LLM call itself fails, surface a graceful assistant turn so
      // the UI can render "something went wrong" without losing state.
      const message =
        err instanceof Error ? err.message : 'Unknown LLM error';
      console.error('[orchestrator] LLM call failed:', message);
      finalAssistantText =
        "I hit a snag talking to my reasoning engine. Please try again in a moment.";
      newTurns.push({
        role: 'assistant',
        content: [{ type: 'text', text: finalAssistantText }],
      });
      stopReason = 'end_turn';
      break;
    }

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;
    stopReason = response.stop_reason;

    // Record the assistant turn exactly as Claude produced it (text + tool_use
    // blocks). This is what we'll persist so subsequent turns replay correctly.
    messages.push({ role: 'assistant', content: response.content });
    newTurns.push({ role: 'assistant', content: response.content });

    // Emit any text Claude generated this iteration.
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        onEvent?.({ type: 'assistant_text', text: block.text });
        finalAssistantText = block.text;
      }
    }

    if (response.stop_reason !== 'tool_use') {
      onEvent?.({ type: 'done', stopReason: response.stop_reason });
      break;
    }

    // Collect every tool_use block this iteration asked for.
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      // stop_reason said tool_use but there are no tool blocks — bail safely.
      break;
    }

    // Execute all requested tools. Run them in parallel; each flows through
    // the coordinator which enforces RBAC, timeouts, and audit.
    const results = await Promise.all(
      toolUseBlocks.map((block) => executeToolCall(block, context, coordinator)),
    );

    // Emit traces + build the user turn containing tool_result blocks.
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const { trace, resultBlock } of results) {
      toolCalls.push(trace);
      onEvent?.({ type: 'tool_call', trace });
      toolResultBlocks.push(resultBlock);
    }

    const toolResultTurn: Anthropic.MessageParam = {
      role: 'user',
      content: toolResultBlocks,
    };
    messages.push(toolResultTurn);
    newTurns.push({ role: 'user', content: toolResultBlocks });
    // Loop continues — Claude now gets to see the tool results.
  }

  if (iterations >= maxIterations && stopReason === 'tool_use') {
    // We hit the cap mid-tool-use. Append a soft assistant message so the UI
    // doesn't just silently stop.
    const capMsg =
      "I reached the maximum number of tool calls for this turn. Here's what I found so far — ask a follow-up if you want me to dig deeper.";
    finalAssistantText = finalAssistantText || capMsg;
    newTurns.push({
      role: 'assistant',
      content: [{ type: 'text', text: capMsg }],
    });
    onEvent?.({ type: 'done', stopReason: 'max_tokens' });
  }

  return {
    assistantText: finalAssistantText,
    newTurns,
    toolCalls,
    stopReason,
    iterations,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
  };
}

/**
 * Execute a single Claude tool_use block via the coordinator.
 * Returns both the audit trace (for UIs/logs) and the tool_result block
 * Claude needs on its next turn.
 */
async function executeToolCall(
  block: Anthropic.ToolUseBlock,
  context: AgentContext,
  coordinator: ReturnType<typeof getCoordinator>,
): Promise<{ trace: ToolCallTrace; resultBlock: Anthropic.ToolResultBlockParam }> {
  const tool = getToolByName(block.name);
  const input = (block.input ?? {}) as Record<string, unknown>;

  // Unknown tool — return a synthetic error so the model can recover.
  if (!tool) {
    const trace: ToolCallTrace = {
      toolName: block.name,
      intent: 'unknown',
      input,
      success: false,
      summary: `Unknown tool: ${block.name}`,
      executionTimeMs: 0,
      auditId: '',
      error: 'unknown_tool',
    };
    return {
      trace,
      resultBlock: {
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: Unknown tool "${block.name}".`,
        is_error: true,
      },
    };
  }

  try {
    const response: SwarmResponse = await coordinator.route({
      intent: tool.intent,
      query: '',
      payload: input,
      context,
    });

    const result = response.result;
    const trace: ToolCallTrace = {
      toolName: tool.name,
      intent: tool.intent,
      input,
      success: result.success,
      summary: result.summary,
      executionTimeMs: response.executionTimeMs,
      auditId: response.auditId,
      data: result.data,
      citations: result.citations,
      error: result.success ? undefined : result.summary,
    };

    // Give Claude a compact JSON string. We strip giant objects down to a
    // summary + top-level data so responses stay within token budget.
    const resultPayload = {
      success: result.success,
      summary: result.summary,
      confidence: result.confidence,
      data: result.data,
      risks: result.risks,
      requiresApproval: result.requiresApproval,
      citations: result.citations,
    };

    return {
      trace,
      resultBlock: {
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(resultPayload),
        is_error: !result.success,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[orchestrator] Tool ${block.name} threw:`, message);
    const trace: ToolCallTrace = {
      toolName: tool.name,
      intent: tool.intent,
      input,
      success: false,
      summary: message,
      executionTimeMs: 0,
      auditId: '',
      error: message,
    };
    return {
      trace,
      resultBlock: {
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: ${message}`,
        is_error: true,
      },
    };
  }
}

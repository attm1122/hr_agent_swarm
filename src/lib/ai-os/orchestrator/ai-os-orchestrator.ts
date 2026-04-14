/**
 * AI-OS Orchestrator — the top-level pipeline.
 *
 *   text ──▶ interpret ──▶ decide ──▶ execute ──▶ compose ──▶ persist
 *                │           │          │           │
 *                └── emits SSE events at every boundary ──▶ client
 *
 * Everything is wrapped in try/catch so a single-layer failure still
 * produces a sensible error block + a persisted trace.
 */

import { randomUUID } from 'node:crypto';
import type { AgentContext } from '@/types';
import type { AiOsEmit } from './events';
import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { UIBlock, ComposedWorkspace } from '../ui-composer/types';
import type { ExecutionResult } from '../execution/types';

import { interpretRequest, InterpreterError } from '../intent/interpreter';
import { decideExecutionMode } from '../decision/engine';
import { executeDecision } from '../execution/executor';
import { compose } from '../ui-composer/composer';
import { persistTrace } from '../agents/audit-agent';

export interface RunAiOsInput {
  input: string;
  context: AgentContext;
  conversationId?: string | null;
  onEvent: AiOsEmit;
  /** Optional model override for the interpreter. */
  model?: string;
  /**
   * Called once the Intent has been parsed, before the decision engine
   * runs. Return `{ allow: false, reason }` to abort the pipeline — this
   * is how the API route enforces per-action rate limits (write intents
   * get stricter quotas than reads).
   */
  onIntentParsed?: (
    intent: Intent,
  ) => Promise<{ allow: true } | { allow: false; reason: string; code: string }>;
}

export interface RunAiOsResult {
  traceId: string;
  intent: Intent;
  decision: DecisionTrace;
  execution: ExecutionResult;
  workspace: ComposedWorkspace;
  durationMs: number;
}

function safeEmit(emit: AiOsEmit, event: Parameters<AiOsEmit>[0]) {
  try {
    emit(event);
  } catch (err) {
    // Never let a broken client-side emitter kill the pipeline.
    // eslint-disable-next-line no-console
    console.warn('[ai-os] emit failed', err);
  }
}

/**
 * End-to-end pipeline. Always returns a result (or throws only on truly
 * unrecoverable errors). SSE events are emitted through `onEvent` as each
 * boundary is crossed.
 */
export async function runAiOs(input: RunAiOsInput): Promise<RunAiOsResult> {
  const startedAt = Date.now();
  const traceId = randomUUID();
  const emit: AiOsEmit = (e) => safeEmit(input.onEvent, e);

  emit({ kind: 'ready', traceId });

  // 1. INTERPRET -------------------------------------------------------
  let intent: Intent;
  try {
    const { intent: parsed } = await interpretRequest({
      rawInput: input.input,
      ctx: input.context,
      model: input.model,
    });
    intent = parsed;
  } catch (err) {
    const message =
      err instanceof InterpreterError
        ? err.message
        : err instanceof Error
        ? err.message
        : 'Interpreter failed';
    const code = err instanceof InterpreterError ? err.code : 'INTERPRETER_ERROR';
    emit({ kind: 'error', message, code });
    throw err;
  }

  emit({ kind: 'intent_parsed', intent });

  // Per-action rate-limit gate. The API layer checks a global quota before
  // Claude is even called; this secondary gate enforces tighter limits on
  // write/escalate actions once we know what the user is trying to do.
  if (input.onIntentParsed) {
    const verdict = await input.onIntentParsed(intent);
    if (!verdict.allow) {
      emit({ kind: 'error', message: verdict.reason, code: verdict.code });
      const empty: ExecutionResult = {
        mode: 'WORKSPACE',
        swarmResponses: [],
        agentCalls: [],
        artifacts: [],
        data: {},
        error: { message: verdict.reason, code: verdict.code },
      };
      emit({ kind: 'done', traceId, durationMs: Date.now() - startedAt });
      return {
        traceId,
        intent,
        decision: {
          intentId: intent.id,
          mode: 'WORKSPACE',
          risk: { value: 'low', reasons: [], policyRefs: [] },
          permissionChecks: [],
          confidenceFloor: 0,
          reasons: [verdict.reason],
          decidedAt: new Date().toISOString(),
        },
        execution: empty,
        workspace: {
          intentId: intent.id,
          mode: 'WORKSPACE',
          blocks: [],
          headline: verdict.reason,
        },
        durationMs: Date.now() - startedAt,
      };
    }
  }

  // Early exit: the interpreter flagged unresolved clarifications with
  // very low confidence. Short-circuit to a clarification block.
  if (
    intent.clarificationsNeeded &&
    intent.clarificationsNeeded.length > 0 &&
    intent.confidence < 0.55
  ) {
    emit({
      kind: 'clarification_required',
      questions: intent.clarificationsNeeded,
      intent,
    });
  }

  // 2. DECIDE ----------------------------------------------------------
  const decision = decideExecutionMode(intent, input.context);
  emit({ kind: 'decision', trace: decision });

  // 3. EXECUTE ---------------------------------------------------------
  let execution: ExecutionResult;
  try {
    execution = await executeDecision(intent, decision, input.context, emit);
  } catch (err) {
    execution = {
      mode: decision.mode,
      swarmResponses: [],
      agentCalls: [],
      artifacts: [],
      data: {},
      error: {
        message: err instanceof Error ? err.message : 'Execution failed',
        code: 'EXECUTOR_EXCEPTION',
      },
    };
    emit({
      kind: 'error',
      message: execution.error!.message,
      code: execution.error!.code,
    });
  }

  // 4. COMPOSE ---------------------------------------------------------
  const workspace = compose(intent, decision, execution);
  for (const block of workspace.blocks as UIBlock[]) {
    emit({ kind: 'block', block });
  }
  if (workspace.headline) {
    emit({ kind: 'headline', text: workspace.headline });
  }

  const durationMs = Date.now() - startedAt;

  // 5. PERSIST ---------------------------------------------------------
  try {
    await persistTrace({
      tenantId: input.context.tenantId ?? 'default',
      userId: input.context.userId,
      conversationId: input.conversationId ?? null,
      intent,
      decision,
      execution,
      blocks: workspace.blocks,
      durationMs,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ai-os] trace persist failed', err);
  }

  emit({ kind: 'done', traceId, durationMs });

  return {
    traceId,
    intent,
    decision,
    execution,
    workspace,
    durationMs,
  };
}

/**
 * AuditAgent — persists a single DecisionTrace row per request into
 * the `ai_os_traces` table. Falls back to an in-memory ring buffer
 * when Supabase credentials are absent so unit tests and dev mode
 * both work.
 *
 * The trace carries everything needed to replay a request: the intent,
 * the decision rules that fired, every agent call and its timing, every
 * block that was emitted to the client, any artifacts produced, plus
 * top-level timing and success state.
 *
 * Before writing, the pipeline passes everything through a PII redactor
 * so that TFNs, bank accounts, DOBs, passports, etc. never land in the
 * trace table. A redaction report is kept alongside the record for
 * downstream observability.
 */

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { UIBlock } from '../ui-composer/types';
import type { ExecutionResult } from '../execution/types';
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';
import { redactPII } from './pii-redactor';

export interface AiOsTraceRecord {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  intent: Intent;
  decision: DecisionTrace;
  agentCalls: unknown[];
  blocks: UIBlock[];
  artifactIds: string[];
  durationMs: number;
  success: boolean;
  error?: string | null;
  redaction: { redactedCount: number; categories: string[] };
  createdAt: string;
}

export interface PersistTraceInput {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  intent: Intent;
  decision: DecisionTrace;
  execution: ExecutionResult;
  blocks: UIBlock[];
  durationMs: number;
}

const memoryLog: AiOsTraceRecord[] = [];
const MEMORY_LIMIT = 500;

function pushMemory(rec: AiOsTraceRecord) {
  memoryLog.unshift(rec);
  if (memoryLog.length > MEMORY_LIMIT) memoryLog.length = MEMORY_LIMIT;
}

/**
 * Supabase client cast for tables the generated `Database` type does not
 * yet cover (`ai_os_traces`, applied out-of-band). Using a structural cast
 * instead of `any` keeps the insert payload type-checked field-by-field.
 */
type TracesClient = {
  from: (table: 'ai_os_traces') => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

export async function persistTrace(
  input: PersistTraceInput,
  supabase: SupabaseClient<Database> | null = createServiceRoleClient(),
): Promise<AiOsTraceRecord> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Redact PII from anything that could plausibly contain it: rawInput,
  // rationale, agent-call inputs/summaries, block content. Structural
  // identifiers (intent id, confidence, mode) are left intact.
  const redactedIntent = redactPII(input.intent);
  const redactedAgentCalls = redactPII(input.execution.agentCalls);
  const redactedBlocks = redactPII(input.blocks);
  const redactionReport = {
    redactedCount:
      redactedIntent.report.redactedCount +
      redactedAgentCalls.report.redactedCount +
      redactedBlocks.report.redactedCount,
    categories: Array.from(
      new Set([
        ...redactedIntent.report.categories,
        ...redactedAgentCalls.report.categories,
        ...redactedBlocks.report.categories,
      ]),
    ),
  };

  const record: AiOsTraceRecord = {
    id,
    tenantId: input.tenantId,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    intent: redactedIntent.value as Intent,
    decision: input.decision,
    agentCalls: redactedAgentCalls.value as unknown[],
    blocks: redactedBlocks.value as UIBlock[],
    artifactIds: input.execution.artifacts.map((a) => a.id),
    durationMs: input.durationMs,
    success: !input.execution.error,
    error: input.execution.error?.message ?? null,
    redaction: redactionReport,
    createdAt,
  };

  if (!supabase) {
    pushMemory(record);
    return record;
  }

  try {
    const client = supabase as unknown as TracesClient;
    const { error } = await client.from('ai_os_traces').insert({
      id,
      tenant_id: record.tenantId,
      user_id: record.userId,
      conversation_id: record.conversationId,
      intent_id: record.intent.id,
      raw_input: record.intent.rawInput,
      intent: record.intent,
      decision: record.decision,
      agent_calls: record.agentCalls,
      blocks: record.blocks,
      artifact_ids: record.artifactIds,
      mode: record.decision.mode,
      duration_ms: record.durationMs,
      success: record.success,
      error: record.error,
      metadata: { redaction: record.redaction },
      created_at: createdAt,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[audit-agent] supabase insert failed, falling back to memory', error);
      pushMemory(record);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit-agent] unexpected persist error', err);
    pushMemory(record);
  }

  return record;
}

export function recentTraces(limit = 50): AiOsTraceRecord[] {
  return memoryLog.slice(0, limit);
}

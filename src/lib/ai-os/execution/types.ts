/**
 * Execution layer types. The executor returns an ExecutionResult that the
 * UIComposer consumes.
 */

import type { ToolCallTrace } from '@/lib/ai/orchestrator';
import type { ArtifactRef } from '../orchestrator/events';
import type { SwarmResponse } from '@/types';

export interface ExecutionResult {
  /** The ExecutionMode we actually executed under. */
  mode: 'AUTO_COMPLETE' | 'WORKSPACE' | 'ESCALATE';
  /** Agent responses collected from swarm calls. */
  swarmResponses: SwarmResponse[];
  /** Structured record of each tool/adapter call, same shape the chat UI uses. */
  agentCalls: ToolCallTrace[];
  /** Artifacts generated (XLSX/DOCX). */
  artifacts: ArtifactRef[];
  /** Adapter-level structured data (e.g. the before/after for a ConfirmationCard). */
  data: Record<string, unknown>;
  /** Populated only when execution failed end-to-end. */
  error?: { message: string; code: string };
}

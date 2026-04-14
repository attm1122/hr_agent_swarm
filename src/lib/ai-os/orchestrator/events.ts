/**
 * AI-OS SSE event stream.
 * All events are JSON-serialisable. The server emits one JSON line per event
 * prefixed with `data: ` (Server-Sent Events).
 */

import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { UIBlock } from '../ui-composer/types';
import type { ToolCallTrace } from '@/lib/ai/orchestrator';

export interface ArtifactRef {
  id: string;
  kind: 'xlsx' | 'docx' | 'pdf';
  filename: string;
  href: string;
  mimeType: string;
  sizeBytes?: number;
  expiresAt?: string;
}

export type AiOsEvent =
  | { kind: 'ready'; traceId: string }
  | { kind: 'intent_parsed'; intent: Intent }
  | { kind: 'clarification_required'; questions: string[]; intent: Intent }
  | { kind: 'decision'; trace: DecisionTrace }
  | { kind: 'agent_call'; call: ToolCallTrace }
  | { kind: 'artifact_ready'; artifact: ArtifactRef }
  | { kind: 'block'; block: UIBlock }
  | { kind: 'headline'; text: string }
  | { kind: 'done'; traceId: string; durationMs: number }
  | { kind: 'error'; message: string; code: string };

export type AiOsEventKind = AiOsEvent['kind'];

/** Emit callback shape used throughout the pipeline. */
export type AiOsEmit = (event: AiOsEvent) => void;

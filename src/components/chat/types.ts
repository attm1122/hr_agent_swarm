/**
 * Client-side mirror of the server chat types.
 * Keep in sync with `src/lib/ai/orchestrator.ts` and `src/lib/ai/conversation-store.ts`.
 */

export interface ClientConversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ClientToolCall {
  toolName: string;
  intent: string;
  input: Record<string, unknown>;
  success: boolean;
  summary: string;
  executionTimeMs: number;
  auditId: string;
  data?: unknown;
  citations?: { source: string; reference: string }[];
  error?: string;
}

/** One rendered message in the UI (aggregated from stored content blocks). */
export interface ClientMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: ClientToolCall[];
  /** True while the server is still streaming events for this message. */
  pending?: boolean;
}

/** Shape of server-sent events on /api/chat. */
export type ServerEvent =
  | { type: 'meta'; conversationId: string; title: string }
  | { type: 'llm_start'; iteration: number }
  | { type: 'tool_call'; trace: ClientToolCall }
  | { type: 'assistant_text'; text: string }
  | { type: 'done'; stopReason: string | null }
  | { type: 'error'; message: string };

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  >;
  toolCalls?: ClientToolCall[];
  createdAt: string;
}

/** Condense stored content blocks into a flat UI message. */
export function storedToClientMessage(m: StoredMessage): ClientMessage | null {
  const texts: string[] = [];
  for (const block of m.content) {
    if (block.type === 'text' && block.text) {
      texts.push(block.text);
    }
  }
  const text = texts.join('\n\n').trim();
  // Tool-result-only user turns never render as their own bubble.
  if (m.role === 'user' && !text) return null;

  return {
    id: m.id,
    role: m.role,
    text,
    toolCalls: m.toolCalls ?? [],
  };
}

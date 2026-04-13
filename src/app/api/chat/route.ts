/**
 * POST /api/chat
 *
 * Conversational entry point. Auth-gated, rate-limited, persistence-backed.
 * Streams Server-Sent Events so the client can render tool calls + text as
 * the orchestrator produces them.
 *
 * Flow:
 *   1. Resolve session -> build AgentContext (same shape /api/swarm uses)
 *   2. Load or create conversation for this user
 *   3. Persist the user message
 *   4. Run orchestrator; stream events to client
 *   5. Persist the final assistant turn (with tool-call trace + usage)
 *
 * Note: we intentionally don't stream token-by-token from Anthropic — the
 * tool-use loop needs full messages to route tool calls. What we *do* stream
 * is per-iteration events (tool_call, assistant_text, done). For end-user
 * experience this feels live enough; token streaming can be added later.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireResolvedSession } from '@/lib/auth/session';
import { isAnthropicConfigured } from '@/lib/ai/anthropic-client';
import {
  orchestrate,
  type OrchestrationEvent,
  type ChatTurn,
} from '@/lib/ai/orchestrator';
import {
  getConversationStore,
  messagesToTurns,
} from '@/lib/ai/conversation-store';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter } from '@/lib/security/rate-limit-redis';
import type { AgentContext } from '@/types';

export const runtime = 'nodejs';
// Give the orchestrator room to run the full tool-use loop.
export const maxDuration = 120;

const cache = createCacheAdapter();
const rateLimiter = new RedisRateLimiter(cache);

// Chat has its own bucket — LLM calls are expensive, cap per user per minute.
const CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'ratelimit:chat',
} as const;

const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
});

function jsonError(message: string, code: string, status: number) {
  return new Response(
    JSON.stringify({
      error: { message, code, timestamp: new Date().toISOString() },
    }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export async function POST(req: NextRequest) {
  // ---- auth ----------------------------------------------------------------
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  // ---- AI configured? -----------------------------------------------------
  if (!isAnthropicConfigured()) {
    return jsonError(
      'ANTHROPIC_API_KEY is not configured on the server.',
      'AI_NOT_CONFIGURED',
      503,
    );
  }

  // ---- rate limit ---------------------------------------------------------
  const rl = await rateLimiter.check(session.userId, CHAT_RATE_LIMIT);
  if (!rl.allowed) {
    return jsonError(
      `Rate limit exceeded. Retry in ${rl.retryAfter}s.`,
      'RATE_LIMIT_EXCEEDED',
      429,
    );
  }

  // ---- validate body ------------------------------------------------------
  let body: z.infer<typeof ChatRequestSchema>;
  try {
    const raw = await req.json();
    body = ChatRequestSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError('Invalid request body', 'VALIDATION_ERROR', 400);
    }
    return jsonError('Invalid JSON', 'VALIDATION_ERROR', 400);
  }

  const store = getConversationStore();
  const tenantId = session.tenantId || 'default';

  // ---- load or create conversation ----------------------------------------
  let conversation;
  if (body.conversationId) {
    conversation = await store.getConversation(
      body.conversationId,
      session.userId,
      tenantId,
    );
    if (!conversation) {
      return jsonError('Conversation not found', 'NOT_FOUND', 404);
    }
  } else {
    conversation = await store.createConversation({
      tenantId,
      userId: session.userId,
      employeeId: session.employeeId,
      title: deriveTitle(body.message),
    });
  }

  // ---- load prior turns ---------------------------------------------------
  const history = messagesToTurns(
    await store.listMessages(conversation.id, tenantId),
  );

  // ---- persist the user turn upfront so it's captured even on failure -----
  const userContent: ChatTurn['content'] = [
    { type: 'text', text: body.message },
  ];
  await store.appendMessage({
    conversationId: conversation.id,
    tenantId,
    role: 'user',
    content: userContent,
  });

  // ---- build context (same shape swarm uses) ------------------------------
  const context: AgentContext = {
    userId: session.userId,
    employeeId: session.employeeId,
    tenantId,
    role: session.role,
    scope: session.scope,
    sensitivityClearance: session.sensitivityClearance,
    permissions: session.permissions,
    sessionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  // ---- stream response ----------------------------------------------------
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: OrchestrationEvent | { type: 'meta'; conversationId: string; title: string } | { type: 'error'; message: string }) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // client disconnected — nothing we can do
        }
      }

      // Send conversation metadata first so the UI can pin the thread id.
      send({
        type: 'meta',
        conversationId: conversation.id,
        title: conversation.title,
      });

      try {
        const result = await orchestrate({
          history,
          userMessage: body.message,
          context,
          onEvent: (ev) => send(ev),
        });

        // Persist the new assistant turn(s). We collapse into a single row
        // capturing the final assistant content + tool call trace.
        // The orchestrator may have produced multiple turns (assistant + tool
        // result users); we store each one so replay works.
        for (const turn of result.newTurns) {
          await store.appendMessage({
            conversationId: conversation.id,
            tenantId,
            role: turn.role,
            content: turn.content,
            toolCalls:
              turn.role === 'assistant' && result.toolCalls.length
                ? result.toolCalls
                : undefined,
            usage:
              turn.role === 'assistant'
                ? result.usage
                : undefined,
          });
        }

        controller.close();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[api/chat] orchestrate failed:', err);
        send({
          type: 'error',
          message:
            err instanceof Error ? err.message : 'Unknown server error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-conversation-id': conversation.id,
    },
  });
}

/** GET /api/chat — list the current user's conversations. */
export async function GET() {
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  const store = getConversationStore();
  const tenantId = session.tenantId || 'default';
  const conversations = await store.listConversations(session.userId, tenantId);

  return new Response(JSON.stringify({ conversations }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Crude title: first 60 chars of the user's opening message. */
function deriveTitle(message: string): string {
  const trimmed = message.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}...`;
}

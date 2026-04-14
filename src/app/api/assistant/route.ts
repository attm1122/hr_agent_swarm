/**
 * POST /api/assistant
 *
 * The AI-OS entry point. Natural-language in, SSE stream of `AiOsEvent`s
 * out. Mirrors the auth + rate-limit + conversation-store pattern used by
 * /api/chat so session hygiene stays identical across the app.
 *
 * Event contract (one JSON object per `data:` line):
 *   ready                 — traceId pinned
 *   intent_parsed         — structured Intent from the Interpreter
 *   clarification_required — ambiguous input, questions surfaced
 *   decision              — DecisionTrace (mode, risk, permission checks)
 *   agent_call            — individual swarm / adapter call trace
 *   artifact_ready        — XLSX / DOCX / PDF is downloadable
 *   block                 — one validated UIBlock
 *   headline              — short natural-language summary
 *   done                  — final terminator + duration
 *   error                 — fatal failure; client should render a banner
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireResolvedSession, getAgentContext } from '@/lib/auth/session';
import { isAnthropicConfigured } from '@/lib/ai/anthropic-client';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter } from '@/lib/security/rate-limit-redis';
import { extractCsrfToken, validateCsrfToken } from '@/lib/security/csrf';
import { securityLog } from '@/lib/security/logger';
import { runAiOs } from '@/lib/ai-os';
import type { AgentContext } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const cache = createCacheAdapter();
const rateLimiter = new RedisRateLimiter(cache);

/**
 * Two-tier rate limiting:
 *
 *   1. Global per-user limit (cheap guard before we spend Claude budget).
 *   2. Per (user, intent.action) limit — writes/escalations are capped
 *      tighter than reads. Applied once the Interpreter has returned so
 *      the gate reflects what the user is actually trying to do.
 */
const ASSISTANT_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'ratelimit:assistant',
} as const;

const ACTION_RATE_LIMITS: Record<
  string,
  { windowMs: number; maxRequests: number; keyPrefix: string }
> = {
  READ:     { windowMs: 60_000, maxRequests: 30, keyPrefix: 'ratelimit:assistant:READ' },
  ANALYZE:  { windowMs: 60_000, maxRequests: 20, keyPrefix: 'ratelimit:assistant:ANALYZE' },
  RECOMMEND:{ windowMs: 60_000, maxRequests: 10, keyPrefix: 'ratelimit:assistant:RECOMMEND' },
  CREATE:   { windowMs: 60_000, maxRequests: 10, keyPrefix: 'ratelimit:assistant:CREATE' },
  UPDATE:   { windowMs: 60_000, maxRequests: 10, keyPrefix: 'ratelimit:assistant:UPDATE' },
  TRIGGER:  { windowMs: 60_000, maxRequests: 5,  keyPrefix: 'ratelimit:assistant:TRIGGER' },
  ESCALATE: { windowMs: 60_000, maxRequests: 5,  keyPrefix: 'ratelimit:assistant:ESCALATE' },
};

const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
});

function jsonError(message: string, code: string, status: number) {
  return new Response(
    JSON.stringify({
      error: { message, code, timestamp: new Date().toISOString() },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export async function POST(req: NextRequest) {
  // ---- auth ---------------------------------------------------------------
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return jsonError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  if (!isAnthropicConfigured()) {
    return jsonError(
      'ANTHROPIC_API_KEY is not configured on the server.',
      'AI_NOT_CONFIGURED',
      503,
    );
  }

  // ---- CSRF validation ----------------------------------------------------
  const csrfToken = extractCsrfToken(req.headers);
  const strictCsrf = process.env.STRICT_CSRF === 'true';
  if (csrfToken) {
    if (!validateCsrfToken(csrfToken, session.userId)) {
      securityLog.warn('csrf', 'Invalid CSRF token on /api/assistant', { userId: session.userId });
      return jsonError('CSRF token invalid or expired', 'CSRF_VIOLATION', 403);
    }
  } else if (strictCsrf) {
    securityLog.warn('csrf', 'Missing CSRF token on /api/assistant (strict mode)', { userId: session.userId });
    return jsonError('CSRF token required', 'CSRF_VIOLATION', 403);
  }

  const rl = await rateLimiter.check(session.userId, ASSISTANT_RATE_LIMIT);
  if (!rl.allowed) {
    return jsonError(
      `Rate limit exceeded. Retry in ${rl.retryAfter}s.`,
      'RATE_LIMIT_EXCEEDED',
      429,
    );
  }

  // ---- validate body ------------------------------------------------------
  let body: z.infer<typeof AssistantRequestSchema>;
  try {
    const raw = await req.json();
    body = AssistantRequestSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError('Invalid request body', 'VALIDATION_ERROR', 400);
    }
    return jsonError('Invalid JSON', 'VALIDATION_ERROR', 400);
  }

  // ---- build context ------------------------------------------------------
  const context: AgentContext = {
    ...getAgentContext(session),
    tenantId: session.tenantId ?? 'default',
  };

  // ---- stream -------------------------------------------------------------
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        await runAiOs({
          input: body.message,
          context,
          conversationId: body.conversationId ?? null,
          onEvent: (event) => send(event),
          onIntentParsed: async (intent) => {
            const cfg = ACTION_RATE_LIMITS[intent.action];
            if (!cfg) return { allow: true };
            const check = await rateLimiter.check(session.userId, cfg);
            if (!check.allowed) {
              return {
                allow: false,
                code: 'ACTION_RATE_LIMIT_EXCEEDED',
                reason: `You've hit the ${intent.action.toLowerCase()} limit. Try again in ${check.retryAfter}s.`,
              };
            }
            return { allow: true };
          },
        });
      } catch (err) {
        // SECURITY: Never leak raw error details to client
        securityLog.error('ai-os', 'Assistant pipeline failed', { error: err instanceof Error ? err.message : err });
        send({
          kind: 'error',
          message: 'An error occurred processing your request. Please try again.',
          code: 'PIPELINE_FAILED',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store, no-transform, must-revalidate',
      'pragma': 'no-cache',
      connection: 'keep-alive',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    },
  });
}

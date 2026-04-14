/**
 * GET /api/csrf
 *
 * Returns a fresh CSRF token bound to the current user's session.
 * The frontend should call this before making any state-changing request
 * (POST/PUT/PATCH/DELETE) and include the token in the `x-csrf-token` header.
 *
 * Tokens are single-use and expire after 24 hours.
 *
 * Flow:
 *   1. Frontend loads → GET /api/csrf → receives { token }
 *   2. Frontend sends POST /api/chat with header x-csrf-token: <token>
 *   3. Server validates + consumes the token
 *   4. Frontend fetches a new token for the next mutation
 *
 * Rate limited to prevent token exhaustion attacks.
 */

import { NextRequest } from 'next/server';
import { requireResolvedSession } from '@/lib/auth/session';
import { generateCsrfToken } from '@/lib/security/csrf';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter } from '@/lib/security/rate-limit-redis';

export const runtime = 'nodejs';

const cache = createCacheAdapter();
const rateLimiter = new RedisRateLimiter(cache);

const CSRF_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,   // generous — frontend may fetch one per mutation
  keyPrefix: 'ratelimit:csrf',
} as const;

export async function GET(_req: NextRequest) {
  // Auth required — anonymous users don't get CSRF tokens
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      },
    );
  }

  // Rate limit to prevent token-generation flood
  const rl = await rateLimiter.check(session.userId, CSRF_RATE_LIMIT);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(rl.retryAfter ?? 60),
          'cache-control': 'no-store',
        },
      },
    );
  }

  // Generate a single-use token bound to this session
  const token = generateCsrfToken(session.userId);

  return new Response(
    JSON.stringify({ token }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // CRITICAL: Never cache CSRF tokens
        'cache-control': 'no-store, no-cache, must-revalidate, private',
        'pragma': 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    },
  );
}

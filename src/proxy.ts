/**
 * Next.js proxy (formerly `middleware`): runs on EVERY request at the Edge.
 *
 * Responsibilities:
 * 1. Security — attack-probe blocking, global rate limiting, security headers,
 *    body-size guards, correlation ID injection.
 * 2. Auth — refreshes Supabase auth session cookies so server reads current tokens.
 *
 * The security layer is the "outer wall" — cheap, fast, always-on.
 * Route-level controls (CSRF, role-based rate limiting, input sanitisation)
 * remain in `securityMiddleware()` which individual API routes call.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '@/lib/supabase/middleware';

// =========================================================================
// Configuration
// =========================================================================

/** Paths that skip security checks (health probes, static assets). */
const BYPASS_PREFIXES = [
  '/_next/',
  '/favicon.ico',
  '/api/health',
];

/** Maximum Content-Length for any API request (5 MB). */
const GLOBAL_MAX_BODY_BYTES = 5 * 1024 * 1024;

// =========================================================================
// Global IP rate limiting (lightweight sliding window)
// =========================================================================

const GLOBAL_RATE_WINDOW_MS = 60_000; // 1 minute
const GLOBAL_RATE_MAX = 300;          // 300 req/min per IP

interface WindowEntry {
  count: number;
  windowStart: number;
}
const ipWindows = new Map<string, WindowEntry>();
const IP_MAP_MAX = 50_000;
let lastCleanup = Date.now();

function cleanupIpMap() {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return;
  lastCleanup = now;
  for (const [ip, entry] of ipWindows) {
    if (now - entry.windowStart > GLOBAL_RATE_WINDOW_MS * 2) {
      ipWindows.delete(ip);
    }
  }
  if (ipWindows.size > IP_MAP_MAX) {
    const excess = ipWindows.size - IP_MAP_MAX;
    const keys = ipWindows.keys();
    for (let i = 0; i < excess; i++) {
      const next = keys.next();
      if (next.done) break;
      ipWindows.delete(next.value);
    }
  }
}

// =========================================================================
// Attack-probe detection (cheap string checks)
// =========================================================================

/**
 * Obvious attack signatures in URL path/query. These have zero legitimate
 * use in this application. Match triggers immediate 400.
 */
const PATH_PROBES: RegExp[] = [
  /\.\.[\\/]/,                         // path traversal
  /<script/i,                          // XSS in URL
  /\bunion\b.*\bselect\b/i,           // SQL injection in URL
  /%00/,                               // null byte
  /\bwp-admin\b/i,                     // WordPress scanner
  /\bphpmyadmin\b/i,                   // phpMyAdmin scanner
  /\.env\b/,                           // env file probe
  /\/etc\/passwd/,                     // LFI
  /\bSELECT\b.*\bFROM\b/i,            // SQL in URL
  /\bDROP\b.*\bTABLE\b/i,             // SQL in URL
];

// =========================================================================
// Helpers
// =========================================================================

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function generateRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function applySecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  // Remove server identification
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  return response;
}

function blockedResponse(requestId: string, status: number, error: string, extra?: Record<string, unknown>): NextResponse {
  return new NextResponse(
    JSON.stringify({ error, code: 'BLOCKED', ...extra }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    },
  );
}

// =========================================================================
// Proxy entry point
// =========================================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = generateRequestId();

  // ------------------------------------------------------------------
  // 0. Bypass for static / health-check paths
  // ------------------------------------------------------------------
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next({ request });
    res.headers.set('X-Request-ID', requestId);
    return res;
  }

  const clientIp = getClientIp(request);
  const isApiRoute = pathname.startsWith('/api/');

  // ------------------------------------------------------------------
  // 1. Attack-probe detection (check both raw + decoded URL)
  // ------------------------------------------------------------------
  const rawUrl = pathname + (request.nextUrl.search || '');
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    decodedUrl = rawUrl;
  }
  const urlsToCheck = rawUrl === decodedUrl ? [rawUrl] : [rawUrl, decodedUrl];

  for (const urlVariant of urlsToCheck) {
    for (const probe of PATH_PROBES) {
      if (probe.test(urlVariant)) {
        console.warn('[proxy:blocked]', {
          ip: clientIp,
          path: pathname,
          reason: 'attack_probe',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return blockedResponse(requestId, 400, 'Bad request');
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Global IP rate limiting (API routes only)
  // ------------------------------------------------------------------
  if (isApiRoute && clientIp !== 'unknown') {
    cleanupIpMap();
    const now = Date.now();
    const entry = ipWindows.get(clientIp);

    if (!entry || now - entry.windowStart > GLOBAL_RATE_WINDOW_MS) {
      ipWindows.set(clientIp, { count: 1, windowStart: now });
    } else {
      entry.count++;
      if (entry.count > GLOBAL_RATE_MAX) {
        const retryAfter = Math.ceil(
          (entry.windowStart + GLOBAL_RATE_WINDOW_MS - now) / 1000,
        );
        console.warn('[proxy:rate-limit]', { ip: clientIp, count: entry.count, requestId });
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests', retryAfter }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
              'X-Request-ID': requestId,
            },
          },
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Body-size guardrail for API routes
  // ------------------------------------------------------------------
  if (isApiRoute) {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > GLOBAL_MAX_BODY_BYTES) {
      return blockedResponse(requestId, 413, 'Payload too large', {
        maxBytes: GLOBAL_MAX_BODY_BYTES,
      });
    }
  }

  // ------------------------------------------------------------------
  // 4. Inject correlation ID into request headers for downstream use
  // ------------------------------------------------------------------
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ------------------------------------------------------------------
  // 5. Supabase auth session refresh
  // ------------------------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refresh session cookies. Non-fatal — the page decides whether to
    // redirect to login.
    await supabase.auth.getUser().catch(() => undefined);
  }

  // ------------------------------------------------------------------
  // 6. Apply security headers to response
  // ------------------------------------------------------------------
  return applySecurityHeaders(response, requestId);
}

// =========================================================================
// Matcher — run on everything except static files
// =========================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static assets)
     * - favicon, image/font files
     * - /auth/* (sign-in flow must not loop through proxy refreshes)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};

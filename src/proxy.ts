/**
 * Next.js proxy (formerly `middleware`): refreshes Supabase auth session cookies
 * on every request.
 *
 * Without this, the server reads stale auth cookies and users appear logged out
 * on first request after token refresh.
 *
 * Runs before every request except static assets and auth endpoints.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet, just pass through.
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh session cookies. Errors here are non-fatal — the page itself will
  // decide whether to redirect to login.
  await supabase.auth.getUser().catch(() => undefined);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static assets)
     * - favicon, image files
     * - /auth/* (sign-in flow must not loop through proxy refreshes)
     * - /api/health (must be unauthenticated)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};

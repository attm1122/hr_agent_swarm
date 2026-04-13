/**
 * OAuth callback handler.
 *
 * Exchanges the `?code=...` returned by Supabase (after Azure AD SSO) for a
 * session cookie, then redirects the user to `?next=...` (defaulting to /hr).
 *
 * Flow:
 *   1. User clicks "Continue with Microsoft" on /auth/signin
 *   2. Supabase redirects to Azure AD → back to /auth/callback?code=...&next=/hr
 *   3. This handler calls exchangeCodeForSession → writes auth cookies
 *   4. Redirects the browser to `next`
 *
 * On any error, redirects back to /auth/signin?error=<message>.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEFAULT_NEXT = '/hr';

function isSafeRelativePath(path: string | null | undefined): path is string {
  if (!path) return false;
  // Must be a relative path starting with `/` and not a protocol-relative URL.
  return path.startsWith('/') && !path.startsWith('//');
}

function getAllowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = isSafeRelativePath(nextParam) ? nextParam : DEFAULT_NEXT;

  // Supabase surfaces provider errors as query params on the callback URL.
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error');
  if (oauthError) {
    const redirect = new URL('/auth/signin', origin);
    redirect.searchParams.set('error', oauthError);
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    const redirect = new URL('/auth/signin', origin);
    redirect.searchParams.set('error', 'Missing authorization code');
    return NextResponse.redirect(redirect);
  }

  // If Supabase isn't configured yet, fail gracefully.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const redirect = new URL('/auth/signin', origin);
    redirect.searchParams.set('error', 'Supabase authentication is not configured');
    return NextResponse.redirect(redirect);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const redirect = new URL('/auth/signin', origin);
    redirect.searchParams.set('error', error.message);
    return NextResponse.redirect(redirect);
  }

  // Enforce tenant restrictions: only @leap.com.au / @leaplegalsoftware.com (etc.)
  const allowedDomains = getAllowedDomains();
  const email = data.user?.email?.toLowerCase() ?? null;
  if (allowedDomains.length > 0) {
    const domain = email?.split('@')[1] ?? '';
    if (!allowedDomains.includes(domain)) {
      // Reject by signing out and redirecting with an error.
      await supabase.auth.signOut();
      const redirect = new URL('/auth/signin', origin);
      redirect.searchParams.set(
        'error',
        `Access is restricted to ${allowedDomains.join(', ')} accounts.`,
      );
      return NextResponse.redirect(redirect);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}

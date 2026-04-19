/**
 * Auth Callback Handler
 * Handles OAuth and email confirmation callbacks from Supabase Auth
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/observability/logger';
import { getCorrelationId } from '@/lib/observability/correlation';

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request.headers);
  const routeLogger = createRequestLogger('api:auth-callback', correlationId);

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    routeLogger.error('Auth callback error', { error: error.message });
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}

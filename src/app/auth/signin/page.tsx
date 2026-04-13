'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function SignInForm() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '/hr';
  const queryError = searchParams?.get('error') ?? null;
  const displayedError = error ?? queryError;
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function signInWithAzure() {
    setError(null);
    setIsSigningIn(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid email profile offline_access User.Read',
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setIsSigningIn(false);
      }
      // Success: browser is redirected to Microsoft, then back to /auth/callback.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error during sign-in');
      setIsSigningIn(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-lg">
          HR
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to LEAP HR</h1>
        <p className="text-slate-500 mt-2 text-sm">
          Use your LEAP Microsoft 365 account to continue.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">
          Authentication is not yet configured. Ask an administrator to set
          NEXT_PUBLIC_SUPABASE_URL and the Azure AD provider in Supabase.
        </div>
      )}

      {displayedError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4 text-sm text-red-900">
          {displayedError}
        </div>
      )}

      <button
        onClick={signInWithAzure}
        disabled={isSigningIn || !supabaseConfigured}
        className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        {isSigningIn ? 'Redirecting to Microsoft…' : 'Continue with Microsoft'}
      </button>

      <p className="text-center mt-6 text-xs text-slate-400">
        By signing in you agree to LEAP&apos;s acceptable use policies.
      </p>

      <div className="mt-8 border-t border-slate-100 pt-4 text-center">
        <button
          onClick={() => router.push('/')}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          ← Back to home
        </button>
      </div>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-lg">
          HR
        </div>
        <p className="text-slate-500 text-sm">Loading sign-in…</p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={<SignInFallback />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}

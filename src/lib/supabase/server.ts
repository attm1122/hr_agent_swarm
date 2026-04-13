/**
 * Supabase server-side client with cookie-based auth.
 * Use in Server Components, Route Handlers, and Server Actions.
 *
 * Do NOT import from Client Components — cookies() is server-only.
 */

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `set` can only be called from a Server Action or Route Handler.
            // Safe to ignore in pure Server Components — middleware refreshes cookies.
          }
        },
      },
    },
  );
}

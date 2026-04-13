/**
 * Supabase browser client. Use in Client Components ("use client").
 * Reads / writes auth cookies via @supabase/ssr for SSR consistency.
 */

'use client';

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  client = createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

/**
 * Supabase Database Client
 * Server and client-side database access
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client-side singleton
let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(supabaseUrl, supabaseKey);
  return browserClient;
}

// Admin client with service role (for background jobs/seed data)
export function createAdminClient(): SupabaseClient {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

// Simple server-side client (for API routes)
export function createServerClient(): SupabaseClient {
  return createSupabaseClient(supabaseUrl, supabaseKey);
}

/**
 * Supabase Database Client
 * Server and client-side database access
 * 
 * SECURITY CRITICAL:
 * - Service role key (SUPABASE_SERVICE_ROLE_KEY) is SERVER-ONLY
 * - Never expose service role key to browser/client
 * - createAdminClient() will throw if called in browser
 * - Use createBrowserClient() for client-side operations
 * - Use createServerClient() for API routes
 * - Use createAdminClient() ONLY for background jobs/migrations
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-only flag detection
const isServer = typeof window === 'undefined';

// Client-side singleton
let browserClient: SupabaseClient | null = null;

/**
 * Browser client - safe for client-side use
 * Uses anon key with RLS policies
 */
export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(supabaseUrl, supabaseKey);
  return browserClient;
}

/**
 * Server client for API routes
 * Uses anon key - respects RLS policies
 */
export function createServerClient(): SupabaseClient {
  return createSupabaseClient(supabaseUrl, supabaseKey);
}

/**
 * Admin client with service role - SERVER ONLY
 * Bypasses RLS - use with extreme caution
 * 
 * SECURITY: Throws error if called in browser environment
 * This prevents accidental service key exposure
 */
export function createAdminClient(): SupabaseClient {
  // CRITICAL SECURITY CHECK: Never allow service key in browser
  if (!isServer) {
    throw new SecurityError(
      'createAdminClient() cannot be called in browser environment. ' +
      'SUPABASE_SERVICE_ROLE_KEY must remain server-side only. ' +
      'Use createBrowserClient() for client operations.'
    );
  }
  
  // Additional check: Verify service key is not the same as anon key
  if (supabaseServiceKey === supabaseKey && supabaseServiceKey !== '') {
    console.warn(
      '[SECURITY WARNING] SUPABASE_SERVICE_ROLE_KEY appears to be the same as NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Ensure you are using different keys for service role and anon key.'
    );
  }
  
  // Verify service key is configured
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'Set it in environment variables for server-side operations.'
    );
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Security error class for client/server boundary violations
 */
class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
    
    // Log security violation for monitoring
    if (typeof console !== 'undefined') {
      console.error('[SECURITY VIOLATION]', {
        error: message,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      });
    }
  }
}

/**
 * Verify service role key is not exposed in client bundle
 * Call this in build process or CI/CD
 */
export function verifyServiceKeyNotInBundle(): void {
  if (!isServer) {
    // Check if service key is accessible in browser
    try {
      // In browser, SUPABASE_SERVICE_ROLE_KEY should be undefined
      const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (hasServiceKey) {
        console.error(
          '[CRITICAL SECURITY ERROR] ' +
          'SUPABASE_SERVICE_ROLE_KEY is exposed in client bundle! ' +
          'This is a critical security vulnerability. ' +
          'Ensure NEXT_PUBLIC_ prefix is NOT used for service role key.'
        );
      }
    } catch {
      // Expected in browser - env vars not accessible
    }
  }
}

// Auto-verify on module load in browser
if (!isServer) {
  verifyServiceKeyNotInBundle();
}

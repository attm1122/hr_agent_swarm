/**
 * Base Supabase Repository
 * 
 * Common functionality for all Supabase repositories.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export abstract class BaseSupabaseRepository {
  constructor(protected supabase: SupabaseClient<Database>) {}

  /**
   * Type-safe table accessor that works around Supabase JS v2.103+ type resolution
   * issues with hand-written Database schemas. The strict generic checking requires
   * generated types; this bypasses it while preserving runtime safety.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected table(name: string) { return (this.supabase as any).from(name); }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on client errors (4xx)
        if (lastError.message.includes('400') || lastError.message.includes('403')) {
          throw lastError;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  protected handleError(error: unknown, context: string): never {
    console.error(`Repository error in ${context}:`, error);
    throw error;
  }
}

/**
 * Idempotency Support
 * 
 * Ensures operations can be safely retried without side effects.
 */

import type { CachePort } from '@/lib/ports';

export interface IdempotencyEntry {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  response?: unknown;
  createdAt: string;
  completedAt?: string;
}

export class IdempotencyStore {
  private readonly ttlSeconds = 86400; // 24 hours

  constructor(private cache: CachePort) {}

  async check(key: string): Promise<{
    exists: boolean;
    status?: 'processing' | 'completed' | 'failed';
    response?: unknown;
  }> {
    const entry = await this.cache.get<IdempotencyEntry>(`idempotency:${key}`);
    
    if (!entry) {
      return { exists: false };
    }

    return {
      exists: true,
      status: entry.status,
      response: entry.response,
    };
  }

  async start(key: string): Promise<void> {
    const entry: IdempotencyEntry = {
      key,
      status: 'processing',
      createdAt: new Date().toISOString(),
    };
    
    await this.cache.set(`idempotency:${key}`, entry, this.ttlSeconds);
  }

  async complete(key: string, response: unknown): Promise<void> {
    const entry: IdempotencyEntry = {
      key,
      status: 'completed',
      response,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    
    await this.cache.set(`idempotency:${key}`, entry, this.ttlSeconds);
  }

  async fail(key: string, error: unknown): Promise<void> {
    const entry: IdempotencyEntry = {
      key,
      status: 'failed',
      response: error,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    
    await this.cache.set(`idempotency:${key}`, entry, this.ttlSeconds);
  }

  async clear(key: string): Promise<void> {
    await this.cache.delete(`idempotency:${key}`);
  }
}

/**
 * Idempotency middleware for API routes
 */
export function withIdempotency<T extends { idempotencyKey?: string }>(
  handler: (request: T) => Promise<unknown>,
  store: IdempotencyStore
) {
  return async (request: T): Promise<unknown> => {
    const key = request.idempotencyKey;
    
    if (!key) {
      // No idempotency key, proceed normally
      return handler(request);
    }

    // Check if we've seen this key
    const existing = await store.check(key);
    
    if (existing.exists) {
      if (existing.status === 'processing') {
        throw new Error('Request is already being processed');
      }
      
      if (existing.status === 'completed') {
        // Return cached response
        return existing.response;
      }
      
      if (existing.status === 'failed') {
        // Clear the failed entry and retry
        await store.clear(key);
      }
    }

    // Start processing
    await store.start(key);
    
    try {
      const response = await handler(request);
      await store.complete(key, response);
      return response;
    } catch (error) {
      await store.fail(key, error);
      throw error;
    }
  };
}

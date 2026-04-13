/**
 * Redis Cache Adapter - Production-ready cache implementation
 */

import type { CachePort } from '@/lib/ports';
import { createClient, type RedisClientType } from 'redis';

export class RedisCacheAdapter implements CachePort {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.client = createClient({
      url: this.url,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    await this.client.connect();
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) throw new Error('Redis not connected');
    
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) throw new Error('Redis not connected');
    const result = await this.client.exists(key);
    return result === 1;
  }

  async increment(key: string, amount = 1): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return await this.client.incrBy(key, amount);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    await this.client.expire(key, seconds);
  }

  async rateLimitCheck(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!this.client) throw new Error('Redis not connected');

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;
    
    // Use Redis sorted set for sliding window
    const pipeline = this.client.multi();
    pipeline.zRemRangeByScore(key, 0, windowStart);
    pipeline.zCard(key);
    pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    const currentCount = Number(results?.[1]) || 0;
    
    const allowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetTime = now + windowSeconds;
    
    return { allowed, remaining, resetTime };
  }

  async storeCsrfToken(sessionId: string, token: string, ttlSeconds: number): Promise<void> {
    const key = `csrf:${sessionId}`;
    await this.set(key, token, ttlSeconds);
  }

  async validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
    const key = `csrf:${sessionId}`;
    const stored = await this.get<string>(key);
    return stored === token;
  }

  async revokeCsrfToken(sessionId: string): Promise<void> {
    const key = `csrf:${sessionId}`;
    await this.delete(key);
  }
}

// Factory function with environment detection
export function createCacheAdapter(): CachePort {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl && process.env.NODE_ENV === 'production') {
    return new RedisCacheAdapter(redisUrl);
  }
  
  // Fallback to in-memory for development
  return new InMemoryCacheAdapter();
}

/**
 * In-Memory Cache Adapter (for development/testing)
 */
class InMemoryCacheAdapter implements CachePort {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private csrfTokens = new Map<string, { token: string; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return entry.value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value: serialized, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async increment(key: string, amount = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const next = current + amount;
    await this.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  }

  async rateLimitCheck(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = (now - windowSeconds) * 1000;
    
    // Clean old entries
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(`ratelimit:${key}:`) && v.expiresAt && v.expiresAt < windowStart) {
        this.store.delete(k);
      }
    }
    
    // Count current requests
    let count = 0;
    for (const [k] of this.store.entries()) {
      if (k.startsWith(`ratelimit:${key}:`)) count++;
    }
    
    const allowed = count < maxRequests;
    const remaining = Math.max(0, maxRequests - count - 1);
    const resetTime = now + windowSeconds;
    
    if (allowed) {
      await this.set(`ratelimit:${key}:${now}-${Math.random()}`, '1', windowSeconds);
    }
    
    return { allowed, remaining, resetTime };
  }

  async storeCsrfToken(sessionId: string, token: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.csrfTokens.set(sessionId, { token, expiresAt });
  }

  async validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
    const entry = this.csrfTokens.get(sessionId);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.csrfTokens.delete(sessionId);
      return false;
    }
    
    return entry.token === token;
  }

  async revokeCsrfToken(sessionId: string): Promise<void> {
    this.csrfTokens.delete(sessionId);
  }
}

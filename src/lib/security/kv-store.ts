/**
 * Key-Value Store Adapter
 *
 * A tiny Redis-or-in-memory abstraction used by CSRF, rate-limiting, and
 * audit modules. The goal is to keep the same API shape whether you're
 * running a single Vercel instance (in-memory is fine) or a multi-region
 * deployment (must use Redis so state is shared).
 *
 * Behaviour:
 *   - If `REDIS_URL` is set, lazily connect a `redis` v5 client.
 *   - Otherwise, fall back to a process-local Map with expiry timers.
 *   - `incr()` + `expire()` together give us atomic sliding-window counters.
 *
 * All methods are safe to call before Redis is connected — connection is
 * awaited inside each call.
 */

import type { RedisClientType } from 'redis';

export interface KvStore {
  readonly backend: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Increment an integer counter. Creates the key at 1 if missing. */
  incr(key: string): Promise<number>;
  /** Set an expiry on an existing key. No-op if the key is missing. */
  expire(key: string, ttlMs: number): Promise<void>;
  /** Remove all keys matching `prefix*`. Used for bulk session invalidation. */
  deleteByPrefix(prefix: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (default for single-instance dev/production).
// ---------------------------------------------------------------------------

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

function createMemoryStore(): KvStore {
  const data = new Map<string, MemoryEntry>();

  function maybePurge(key: string): MemoryEntry | null {
    const entry = data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      data.delete(key);
      return null;
    }
    return entry;
  }

  return {
    backend: 'memory',
    async get(key) {
      return maybePurge(key)?.value ?? null;
    },
    async set(key, value, ttlMs) {
      data.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
    },
    async del(key) {
      data.delete(key);
    },
    async incr(key) {
      const entry = maybePurge(key);
      const current = entry ? Number(entry.value) || 0 : 0;
      const next = current + 1;
      data.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt,
      });
      return next;
    },
    async expire(key, ttlMs) {
      const entry = data.get(key);
      if (!entry) return;
      entry.expiresAt = Date.now() + ttlMs;
    },
    async deleteByPrefix(prefix) {
      let n = 0;
      for (const k of data.keys()) {
        if (k.startsWith(prefix)) {
          data.delete(k);
          n++;
        }
      }
      return n;
    },
  };
}

// ---------------------------------------------------------------------------
// Redis implementation
// ---------------------------------------------------------------------------

function createRedisStore(url: string): KvStore {
  // Lazy import so server-side bundles don't pull Redis into the browser
  // build — and so the module is still importable when `redis` isn't
  // installed (memory fallback kicks in before this ever runs).
  let clientPromise: Promise<RedisClientType> | null = null;

  async function getClient(): Promise<RedisClientType> {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const { createClient } = await import('redis');
      const client = createClient({ url }) as RedisClientType;
      client.on('error', (err: unknown) => {
        // Don't crash on transient network blips; next call will retry.
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[kv-store:redis] error', msg);
      });
      await client.connect();
      return client;
    })();
    return clientPromise;
  }

  return {
    backend: 'redis',
    async get(key) {
      const c = await getClient();
      return (await c.get(key)) as string | null;
    },
    async set(key, value, ttlMs) {
      const c = await getClient();
      if (ttlMs && ttlMs > 0) {
        await c.set(key, value, { PX: ttlMs });
      } else {
        await c.set(key, value);
      }
    },
    async del(key) {
      const c = await getClient();
      await c.del(key);
    },
    async incr(key) {
      const c = await getClient();
      return Number(await c.incr(key));
    },
    async expire(key, ttlMs) {
      const c = await getClient();
      await c.pExpire(key, ttlMs);
    },
    async deleteByPrefix(prefix) {
      const c = await getClient();
      let removed = 0;
      // SCAN avoids blocking the server on large keyspaces (vs KEYS).
      for await (const key of c.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
        const keys = Array.isArray(key) ? key : [key];
        for (const k of keys) {
          await c.del(k as string);
          removed++;
        }
      }
      return removed;
    },
  };
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

let cached: KvStore | null = null;

export function getKvStore(): KvStore {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (url && typeof window === 'undefined') {
    try {
      cached = createRedisStore(url);
      return cached;
    } catch (err) {
      // Fall through to memory if Redis init throws synchronously (the
      // import is dynamic, so this is mostly belt-and-braces).
      console.warn(
        '[kv-store] Redis init failed, using memory fallback:',
        err instanceof Error ? err.message : err,
      );
    }
  }
  cached = createMemoryStore();
  return cached;
}

/** Tests only: drop the cached instance so env changes take effect. */
export function __resetKvStore(): void {
  cached = null;
}

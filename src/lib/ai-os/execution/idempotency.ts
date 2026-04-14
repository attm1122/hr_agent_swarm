/**
 * Idempotency guard for AI-OS write operations.
 *
 * Prevents the same write from executing twice when a request is retried
 * (network retry, SSE reconnect, user double-click). The guard stores a
 * hash of (userId + action + entity + key payload fields) → result for a
 * configurable TTL. A duplicate request within the TTL returns the cached
 * result without re-executing the side effect.
 *
 * In-memory for now; swap to Redis/Supabase for multi-instance deployments.
 */

import { createHash } from 'node:crypto';

export interface IdempotencyEntry<T = unknown> {
  key: string;
  result: T;
  createdAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_ENTRIES = 2000;

const cache = new Map<string, IdempotencyEntry>();

/**
 * Build a deterministic idempotency key from structured fields.
 * Fields are sorted alphabetically to ensure key stability regardless
 * of object property insertion order.
 */
export function buildIdempotencyKey(fields: Record<string, string | undefined>): string {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

/**
 * Check whether a write has already been executed within the TTL window.
 * Returns the cached result if found, or undefined if the write should proceed.
 */
export function getIdempotent<T>(key: string): T | undefined {
  evictExpired();
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.result as T;
}

/**
 * Record a completed write so duplicates within the TTL return the cached result.
 */
export function setIdempotent<T>(key: string, result: T): void {
  // Evict oldest if at capacity.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { key, result, createdAt: Date.now() });
}

function evictExpired(): void {
  const now = Date.now();
  for (const [k, entry] of cache) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      cache.delete(k);
    }
  }
}

/** For tests: clear the entire idempotency cache. */
export function __resetIdempotencyCache(): void {
  cache.clear();
}

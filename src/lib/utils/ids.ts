/**
 * ID Generation Utilities
 */

import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure UUID v4
 */
export function createId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a secure session ID
 */
export function createSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a secure token
 */
export function createToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Generate an idempotency key
 */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

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
 * Generate a secure token
 */
export function createToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

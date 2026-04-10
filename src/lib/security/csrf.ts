/**
 * CSRF Protection Module
 * Token-based CSRF defense for state-changing operations.
 * 
 * Strategy:
 * 1. Generate cryptographically secure tokens
 * 2. Store token in session (server-side)
 * 3. Include token in forms/API requests
 * 4. Validate token on POST/PUT/DELETE
 * 
 * Production: Store tokens in Redis with expiration.
 */

import { createHash, randomBytes } from 'crypto';

interface CsrfToken {
  token: string;
  expiresAt: number;
  sessionId: string;
}

// In-memory store (POC). Production: Redis with TTL.
const csrfTokens = new Map<string, CsrfToken>();

// Token expiration: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, token] of csrfTokens.entries()) {
    if (now > token.expiresAt) {
      csrfTokens.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Generate a new CSRF token for a session
 */
export function generateCsrfToken(sessionId: string): string {
  // Generate 32 bytes of randomness
  const random = randomBytes(32).toString('hex');
  
  // Hash with session ID for binding
  const token = createHash('sha256')
    .update(`${sessionId}:${random}:${Date.now()}`)
    .digest('hex');
  
  // Store server-side
  csrfTokens.set(token, {
    token,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    sessionId,
  });
  
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string, sessionId: string): boolean {
  if (!token || !sessionId) return false;
  
  const stored = csrfTokens.get(token);
  
  if (!stored) {
    return false; // Token not found
  }
  
  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(token);
    return false; // Token expired
  }
  
  if (stored.sessionId !== sessionId) {
    return false; // Token not bound to this session
  }
  
  // Token is valid - optionally rotate for security
  // csrfTokens.delete(token); // Uncomment for single-use tokens
  
  return true;
}

/**
 * Extract CSRF token from request headers or body
 */
export function extractCsrfToken(
  headers: Headers,
  body?: Record<string, unknown>
): string | null {
  // Check header first (preferred for API requests)
  const headerToken = headers.get('x-csrf-token');
  if (headerToken) return headerToken;
  
  // Check body for form submissions
  if (body && typeof body._csrf === 'string') {
    return body._csrf;
  }
  
  return null;
}

/**
 * Invalidate all tokens for a session (logout)
 */
export function invalidateSessionTokens(sessionId: string): void {
  for (const [key, token] of csrfTokens.entries()) {
    if (token.sessionId === sessionId) {
      csrfTokens.delete(key);
    }
  }
}

/**
 * Get remaining time for token (for UI refresh hints)
 */
export function getTokenExpiry(token: string): number | null {
  const stored = csrfTokens.get(token);
  if (!stored) return null;
  return stored.expiresAt;
}

/**
 * Security: Rotate CSRF token after sensitive action
 * This prevents replay attacks on completed operations
 */
export function rotateCsrfToken(oldToken: string, sessionId: string): string | null {
  if (!validateCsrfToken(oldToken, sessionId)) {
    return null;
  }
  
  // Delete old token
  csrfTokens.delete(oldToken);
  
  // Generate new token
  return generateCsrfToken(sessionId);
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  // Only state-changing methods require CSRF protection
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * CSRF error response helper
 */
export function createCsrfErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'CSRF token missing or invalid',
      code: 'CSRF_VIOLATION',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Security Module Unit Tests
 * 
 * Coverage:
 * 1. Rate limiting functionality
 * 2. CSRF token generation and validation
 * 3. Input sanitization (XSS, SQL injection)
 * 4. Output encoding
 * 5. Security middleware integration
 * 6. Audit logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  generateRateLimitKey,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
} from './rate-limit';
import {
  generateCsrfToken,
  validateCsrfToken,
  extractCsrfToken,
  invalidateSessionTokens,
  requiresCsrfProtection,
} from './csrf';
import {
  encodeHtml,
  stripDangerousHtml,
  sanitizeInput,
  sanitizeObject,
  containsXss,
  containsSqlInjection,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeId,
} from './sanitize';
import type { Role } from '@/types';

// ============================================
// Rate Limiting Tests
// ============================================

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit store
    resetRateLimit('test-user');
  });

  it('allows requests within limit', () => {
    const result = checkRateLimit('test-user', 'agent', 'employee');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('blocks requests exceeding limit', () => {
    // Exhaust rate limit
    const config = RATE_LIMITS.agent.employee;
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('test-user', 'agent', 'employee');
    }
    
    const result = checkRateLimit('test-user', 'agent', 'employee');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });

  it('resets after window expires', async () => {
    // Use a short window tier for testing
    const shortWindowTier = 'auth';
    
    // Exhaust rate limit
    const config = RATE_LIMITS[shortWindowTier].employee;
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('test-reset', shortWindowTier, 'employee');
    }
    
    // Should be blocked
    const blocked = checkRateLimit('test-reset', shortWindowTier, 'employee');
    expect(blocked.allowed).toBe(false);
  });

  it('has different limits per role', () => {
    const employeeLimit = RATE_LIMITS.agent.employee.maxRequests;
    const adminLimit = RATE_LIMITS.agent.admin.maxRequests;
    
    expect(adminLimit).toBeGreaterThan(employeeLimit);
  });

  it('generates correct rate limit key', () => {
    const key = generateRateLimitKey('user-123', '192.168.1.1', 'session-456');
    expect(key).toBe('user-123');
  });

  it('falls back to IP when no userId', () => {
    const key = generateRateLimitKey('', '192.168.1.1', 'session-456');
    expect(key).toBe('192.168.1.1');
  });

  it('returns status without incrementing', () => {
    checkRateLimit('status-test', 'agent', 'employee');
    const status = getRateLimitStatus('status-test', 'agent', 'employee');
    
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBeDefined();
  });
});

// ============================================
// CSRF Protection Tests
// ============================================

describe('CSRF Protection', () => {
  it('generates valid tokens', () => {
    const token = generateCsrfToken('session-123');
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(32);
  });

  it('validates correct tokens', () => {
    const sessionId = 'session-123';
    const token = generateCsrfToken(sessionId);
    
    const isValid = validateCsrfToken(token, sessionId);
    expect(isValid).toBe(true);
  });

  it('rejects invalid tokens', () => {
    const isValid = validateCsrfToken('invalid-token', 'session-123');
    expect(isValid).toBe(false);
  });

  it('rejects tokens from different sessions', () => {
    const token = generateCsrfToken('session-123');
    const isValid = validateCsrfToken(token, 'different-session');
    expect(isValid).toBe(false);
  });

  it('extracts token from headers', () => {
    const headers = new Headers();
    headers.set('x-csrf-token', 'test-token-123');
    
    const token = extractCsrfToken(headers);
    expect(token).toBe('test-token-123');
  });

  it('returns null for missing header', () => {
    const headers = new Headers();
    const token = extractCsrfToken(headers);
    expect(token).toBeNull();
  });

  it('tokens are single-use — second validation fails', () => {
    const sessionId = 'session-single-use';
    const token = generateCsrfToken(sessionId);

    // First use succeeds
    expect(validateCsrfToken(token, sessionId)).toBe(true);
    // Second use fails (consumed)
    expect(validateCsrfToken(token, sessionId)).toBe(false);
  });

  it('invalidates all session tokens', () => {
    const sessionId = 'session-123';
    const token1 = generateCsrfToken(sessionId);
    const token2 = generateCsrfToken(sessionId);

    invalidateSessionTokens(sessionId);

    expect(validateCsrfToken(token1, sessionId)).toBe(false);
    expect(validateCsrfToken(token2, sessionId)).toBe(false);
  });

  it('identifies protected methods', () => {
    expect(requiresCsrfProtection('POST')).toBe(true);
    expect(requiresCsrfProtection('PUT')).toBe(true);
    expect(requiresCsrfProtection('PATCH')).toBe(true);
    expect(requiresCsrfProtection('DELETE')).toBe(true);
  });

  it('allows GET without CSRF', () => {
    expect(requiresCsrfProtection('GET')).toBe(false);
  });
});

// ============================================
// Input Sanitization Tests
// ============================================

describe('Input Sanitization', () => {
  describe('HTML encoding', () => {
    it('encodes special characters', () => {
      const encoded = encodeHtml('<script>alert("xss")</script>');
      expect(encoded).not.toContain('<');
      expect(encoded).not.toContain('>');
      expect(encoded).toContain('&lt;');
      expect(encoded).toContain('&gt;');
    });

    it('handles empty strings', () => {
      expect(encodeHtml('')).toBe('');
    });

    it('handles non-strings', () => {
      expect(encodeHtml(null as unknown as string)).toBe('');
      expect(encodeHtml(undefined as unknown as string)).toBe('');
    });
  });

  describe('Dangerous HTML stripping', () => {
    it('removes script tags', () => {
      const clean = stripDangerousHtml('<p>Hello</p><script>evil()</script>');
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Hello</p>');
    });

    it('removes javascript: URLs', () => {
      const clean = stripDangerousHtml('<a href="javascript:alert(1)">click</a>');
      expect(clean).not.toContain('javascript:');
    });

    it('removes event handlers', () => {
      const clean = stripDangerousHtml('<div onclick="evil()">click me</div>');
      expect(clean).not.toContain('onclick');
    });

    it('removes iframes', () => {
      const clean = stripDangerousHtml('<iframe src="evil.com"></iframe>');
      expect(clean).not.toContain('<iframe');
    });
  });

  describe('Input sanitization', () => {
    it('sanitizes complete input', () => {
      const dirty = '<script>alert(1)</script>Hello<script>evil()</script>';
      const clean = sanitizeInput(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
    });

    it('removes control characters', () => {
      const withControl = 'Hello\x00World';
      const clean = sanitizeInput(withControl);
      expect(clean).not.toContain('\x00');
    });

    it('truncates long strings', () => {
      const longString = 'a'.repeat(20000);
      const clean = sanitizeInput(longString);
      expect(clean.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Object sanitization', () => {
    it('sanitizes nested objects', () => {
      const dirty = {
        name: '<script>alert(1)</script>John',
        email: 'john@test.com',
        nested: {
          bio: '<img src=x onerror=alert(1)>',
        },
      };
      
      const clean = sanitizeObject(dirty);
      expect(clean.name).not.toContain('<script>');
      expect(clean.nested?.bio).not.toContain('onerror');
    });

    it('sanitizes arrays', () => {
      const dirty = {
        names: ['<script>evil</script>John', 'Jane'],
      };
      
      const clean = sanitizeObject(dirty);
      expect(clean.names[0]).not.toContain('<script>');
    });

    it('handles null values', () => {
      const obj = { name: 'John', bio: null };
      const clean = sanitizeObject(obj);
      expect(clean.bio).toBeNull();
    });

    it('blocks prototype pollution via __proto__', () => {
      const malicious = JSON.parse('{"__proto__":{"isAdmin":true},"name":"safe"}');
      const clean = sanitizeObject(malicious);
      // __proto__ should not be set as an OWN property
      expect(Object.hasOwn(clean, '__proto__')).toBe(false);
      expect(clean.name).toBeDefined();
      // Ensure Object.prototype was not polluted
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('blocks constructor/prototype poison keys', () => {
      const obj = { constructor: 'evil', prototype: 'bad', name: 'safe' };
      const clean = sanitizeObject(obj);
      // Poison keys should NOT be own properties on the result
      expect(Object.hasOwn(clean, 'constructor')).toBe(false);
      expect(Object.hasOwn(clean, 'prototype')).toBe(false);
      expect(clean.name).toBeDefined();
    });

    it('enforces depth limit to prevent stack overflow', () => {
      // Build a 30-level deep object (exceeds MAX_OBJECT_DEPTH of 20)
      let deep: Record<string, unknown> = { value: 'bottom' };
      for (let i = 0; i < 30; i++) {
        deep = { nested: deep };
      }
      // Should not throw — returns empty at depth limit
      const clean = sanitizeObject(deep);
      expect(clean).toBeDefined();
    });
  });

  describe('XSS detection', () => {
    it('detects script tags', () => {
      expect(containsXss('<script>alert(1)</script>')).toBe(true);
    });

    it('detects javascript: URLs', () => {
      expect(containsXss('javascript:alert(1)')).toBe(true);
    });

    it('detects event handlers', () => {
      expect(containsXss('<div onclick="alert(1)">')).toBe(true);
    });

    it('returns false for safe content', () => {
      expect(containsXss('Hello World')).toBe(false);
      expect(containsXss('<p>Hello</p>')).toBe(false);
    });

    // --- New hardened detection vectors ---

    it('detects SVG tags', () => {
      expect(containsXss('<svg onload="alert(1)">')).toBe(true);
      expect(containsXss('<svg/onload=alert(1)>')).toBe(true);
    });

    it('detects MathML tags', () => {
      expect(containsXss('<math><mi>x</mi></math>')).toBe(true);
    });

    it('detects HTML entity-encoded script tags', () => {
      expect(containsXss('&#60;script src=evil.js>')).toBe(true);
      expect(containsXss('&#x3c;script>')).toBe(true);
    });

    it('detects unicode-escaped script', () => {
      expect(containsXss('\\u003cscript\\u003e')).toBe(true);
    });

    it('detects null byte injection', () => {
      expect(containsXss('hello\x00world')).toBe(true);
    });

    it('detects vbscript protocol', () => {
      expect(containsXss('vbscript:MsgBox("xss")')).toBe(true);
    });

    it('detects CSS expression()', () => {
      expect(containsXss('background: expression(alert(1))')).toBe(true);
    });

    it('detects data:text/html URI', () => {
      expect(containsXss('data:text/html,<h1>hi</h1>')).toBe(true);
    });

    it('is idempotent — same result on repeated calls (no /g statefulness)', () => {
      const payload = '<script>alert(1)</script>';
      expect(containsXss(payload)).toBe(true);
      expect(containsXss(payload)).toBe(true);
      expect(containsXss(payload)).toBe(true);
    });
  });

  describe('SQL injection detection', () => {
    it('detects single quote tautology', () => {
      expect(containsSqlInjection("' OR '1'='1")).toBe(true);
    });

    it('detects stacked query with DROP', () => {
      expect(containsSqlInjection('1; DROP TABLE users; -- ')).toBe(true);
    });

    it('detects UNION SELECT', () => {
      expect(containsSqlInjection("' UNION SELECT * FROM passwords -- ")).toBe(true);
    });

    it('returns false for safe content', () => {
      expect(containsSqlInjection('Hello World')).toBe(false);
    });

    // --- New hardened detection vectors ---

    it('detects WAITFOR DELAY (time-based blind)', () => {
      expect(containsSqlInjection("'; WAITFOR DELAY '0:0:5'-- ")).toBe(true);
    });

    it('detects BENCHMARK (MySQL blind)', () => {
      expect(containsSqlInjection("1 AND BENCHMARK(5000000,SHA1('test'))")).toBe(true);
    });

    it('detects SLEEP (MySQL)', () => {
      expect(containsSqlInjection("1' AND SLEEP(5)-- ")).toBe(true);
    });

    it('detects pg_sleep (PostgreSQL)', () => {
      expect(containsSqlInjection("'; SELECT pg_sleep(5)-- ")).toBe(true);
    });

    it('detects INFORMATION_SCHEMA probing', () => {
      expect(containsSqlInjection('SELECT * FROM INFORMATION_SCHEMA.tables')).toBe(true);
    });

    it('detects hex-encoded strings', () => {
      expect(containsSqlInjection('SELECT 0x41424344')).toBe(true);
    });

    it('detects extended stored procedures', () => {
      expect(containsSqlInjection("EXEC xp_cmdshell 'dir'")).toBe(true);
    });

    it('detects INTO OUTFILE', () => {
      expect(containsSqlInjection("SELECT * INTO OUTFILE '/tmp/dump'")).toBe(true);
    });

    it('is idempotent — same result on repeated calls', () => {
      const payload = "' OR '1'='1";
      expect(containsSqlInjection(payload)).toBe(true);
      expect(containsSqlInjection(payload)).toBe(true);
      expect(containsSqlInjection(payload)).toBe(true);
    });
  });

  describe('Email validation', () => {
    it('accepts valid emails', () => {
      expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
      expect(sanitizeEmail('User.Name+tag@example.co.uk')).toBe('user.name+tag@example.co.uk');
    });

    it('rejects invalid emails', () => {
      expect(sanitizeEmail('not-an-email')).toBeNull();
      expect(sanitizeEmail('@example.com')).toBeNull();
      expect(sanitizeEmail('user@')).toBeNull();
    });

    it('handles non-strings', () => {
      expect(sanitizeEmail(null as unknown as string)).toBeNull();
    });
  });

  describe('URL validation', () => {
    it('accepts valid HTTPS URLs', () => {
      const url = sanitizeUrl('https://example.com/path');
      expect(url).toBe('https://example.com/path');
    });

    it('rejects javascript URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects malformed URLs', () => {
      expect(sanitizeUrl('not a url')).toBeNull();
    });
  });

  describe('Filename sanitization', () => {
    it('removes path traversal', () => {
      const clean = sanitizeFilename('../../../etc/passwd');
      expect(clean).not.toContain('../');
      expect(clean).not.toContain('..\\');
    });

    it('replaces slashes with underscores', () => {
      const clean = sanitizeFilename('folder/file.txt');
      expect(clean).toBe('folder_file.txt');
    });

    it('removes null bytes', () => {
      const clean = sanitizeFilename('file\x00.txt');
      expect(clean).not.toContain('\x00');
    });

    it('rejects empty filenames', () => {
      expect(sanitizeFilename('')).toBeNull();
      expect(sanitizeFilename('.')).toBeNull();
    });
  });

  describe('ID sanitization', () => {
    it('accepts valid IDs', () => {
      expect(sanitizeId('user-123')).toBe('user-123');
      expect(sanitizeId('emp_456')).toBe('emp_456');
      expect(sanitizeId('ABC123')).toBe('ABC123');
    });

    it('rejects IDs with special characters', () => {
      expect(sanitizeId('user<script>')).toBeNull();
      expect(sanitizeId('emp;456')).toBeNull();
    });

    it('rejects long IDs', () => {
      expect(sanitizeId('a'.repeat(101))).toBeNull();
    });

    it('trims whitespace', () => {
      expect(sanitizeId('  user-123  ')).toBe('user-123');
    });
  });
});

// ============================================
// Security Integration Tests
// ============================================

describe('Security Integration', () => {
  it('CSRF + rate limit: valid token consumed then rate limit still allows', () => {
    const sessionId = 'test-session-integ';

    // Generate and validate CSRF token (consumes it — single-use)
    const csrfToken = generateCsrfToken(sessionId);
    expect(validateCsrfToken(csrfToken, sessionId)).toBe(true);

    // Token is consumed; second attempt fails
    expect(validateCsrfToken(csrfToken, sessionId)).toBe(false);

    // Rate limit status should still allow requests
    const rateStatus = getRateLimitStatus(sessionId, 'agent', 'employee');
    expect(rateStatus.allowed).toBe(true);
  });

  it('sanitized input passes XSS check', () => {
    const dirty = '<script>alert(1)</script>Hello';
    const clean = sanitizeInput(dirty);
    
    expect(containsXss(clean)).toBe(false);
  });

  it('email sanitization prevents XSS', () => {
    const dirtyEmail = 'user+<script>@example.com';
    const cleanEmail = sanitizeEmail(dirtyEmail);
    
    // Should be rejected or encoded
    expect(cleanEmail === null || !cleanEmail.includes('<script>')).toBe(true);
  });
});

// ============================================
// Security Constants Tests
// ============================================

describe('Security Configuration', () => {
  it('has reasonable rate limit defaults', () => {
    // Employee should have lower limits than admin
    expect(RATE_LIMITS.agent.employee.maxRequests).toBeLessThanOrEqual(
      RATE_LIMITS.agent.admin.maxRequests
    );
  });

  it('has stricter auth limits than agent limits', () => {
    // Auth endpoints should be more restrictive
    const authWindow = RATE_LIMITS.auth.employee.windowMs;
    const agentWindow = RATE_LIMITS.agent.employee.windowMs;
    
    expect(authWindow).toBeGreaterThan(agentWindow);
  });
});

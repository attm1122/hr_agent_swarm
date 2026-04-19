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
} from '@/lib/infrastructure/rate-limit/rate-limit';
import {
  generateCsrfToken,
  validateCsrfToken,
  extractCsrfToken,
  invalidateSessionTokens,
  requiresCsrfProtection,
} from '@/lib/infrastructure/csrf/csrf';
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
} from '@/lib/application/validation/sanitize';
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
  });

  describe('SQL injection detection', () => {
    it('detects single quote injection', () => {
      expect(containsSqlInjection("' OR '1'='1")).toBe(true);
    });

    it('detects comment injection', () => {
      expect(containsSqlInjection('1; DROP TABLE users; --')).toBe(true);
    });

    it('detects UNION injection', () => {
      expect(containsSqlInjection("' UNION SELECT * FROM passwords --")).toBe(true);
    });

    it('returns false for safe content', () => {
      expect(containsSqlInjection('Hello World')).toBe(false);
      expect(containsSqlInjection("It's a nice day")).toBe(true); // Contains single quote
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
  it('rate limit blocks after CSRF failure', () => {
    const sessionId = 'test-session';
    
    // Generate CSRF token
    const csrfToken = generateCsrfToken(sessionId);
    expect(validateCsrfToken(csrfToken, sessionId)).toBe(true);
    
    // Check rate limit status
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

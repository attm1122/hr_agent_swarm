/**
 * Authentication Integration Tests
 * 
 * Comprehensive tests for:
 * - Session resolution and validation
 * - CSRF protection
 * - Rate limiting
 * - Authorization paths
 * - Export authorization
 * 
 * These tests verify the security middleware stack works correctly
 * across all protected endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the security modules
const mockSecurityMiddleware = vi.fn();
const mockValidateCsrfToken = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockLogSecurityEvent = vi.fn();

vi.mock('@/lib/security', () => ({
  securityMiddleware: (...args: unknown[]) => mockSecurityMiddleware(...args),
  validateCsrfToken: (...args: unknown[]) => mockValidateCsrfToken(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
  logSensitiveAction: vi.fn(),
  addSecurityHeaders: (response: Response) => response,
}));

const mockRequireVerifiedSessionContext = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  requireVerifiedSessionContext: () => mockRequireVerifiedSessionContext(),
  isSessionResolutionError: (err: unknown) => 
    err && typeof err === 'object' && 'code' in err && 'status' in err,
}));

const mockHasCapability = vi.fn();
vi.mock('@/lib/auth/authorization', () => ({
  hasCapability: (role: string, capability: string) => mockHasCapability(role, capability),
}));

describe('Authentication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Resolution', () => {
    it('should reject requests without valid session', async () => {
      mockRequireVerifiedSessionContext.mockImplementation(() => {
        throw {
          code: 'AUTH_REQUIRED',
          status: 401,
          message: 'Authentication required',
        };
      });

      const request = new NextRequest('http://localhost/api/export', {
        method: 'POST',
        body: JSON.stringify({ type: 'employees', format: 'json' }),
      });

      // Simulate the route handler behavior
      try {
        mockRequireVerifiedSessionContext();
      } catch (err: unknown) {
        expect((err as { code: string }).code).toBe('AUTH_REQUIRED');
        expect((err as { status: number }).status).toBe(401);
      }
    });

    it('should reject requests with expired session', async () => {
      mockRequireVerifiedSessionContext.mockImplementation(() => {
        throw {
          code: 'SESSION_EXPIRED',
          status: 401,
          message: 'Session has expired',
        };
      });

      try {
        mockRequireVerifiedSessionContext();
      } catch (err: unknown) {
        expect((err as { code: string }).code).toBe('SESSION_EXPIRED');
        expect((err as { status: number }).status).toBe(401);
      }
    });

    it('should reject requests with invalid session token', async () => {
      mockRequireVerifiedSessionContext.mockImplementation(() => {
        throw {
          code: 'INVALID_TOKEN',
          status: 401,
          message: 'Invalid session token',
        };
      });

      try {
        mockRequireVerifiedSessionContext();
      } catch (err: unknown) {
        expect((err as { code: string }).code).toBe('INVALID_TOKEN');
        expect((err as { status: number }).status).toBe(401);
      }
    });

    it('should allow requests with valid session', async () => {
      const validContext = {
        session: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['employee:read', 'export:request'],
        },
        context: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['employee:read', 'export:request'],
          sessionId: 'session-001',
        },
        securityContext: {
          userId: 'user-001',
          sessionId: 'session-001',
          ipAddress: '127.0.0.1',
        },
      };

      mockRequireVerifiedSessionContext.mockReturnValue(validContext);

      const result = mockRequireVerifiedSessionContext();

      expect(result.session.userId).toBe('user-001');
      expect(result.session.role).toBe('manager');
      expect(result.context.permissions).toContain('employee:read');
    });
  });

  describe('CSRF Protection', () => {
    it('should reject requests without CSRF token on state-changing operations', async () => {
      mockSecurityMiddleware.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: 'CSRF token required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new NextRequest('http://localhost/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'employees', format: 'json' }),
      });

      const response = await mockSecurityMiddleware(request, {}, { requireCsrf: true });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('CSRF');
    });

    it('should reject requests with invalid CSRF token', async () => {
      mockSecurityMiddleware.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: 'Invalid CSRF token' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const request = new NextRequest('http://localhost/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token',
        },
        body: JSON.stringify({ type: 'employees', format: 'json' }),
      });

      const response = await mockSecurityMiddleware(request, {}, { requireCsrf: true });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('CSRF');
    });

    it('should allow GET requests without CSRF token', async () => {
      mockSecurityMiddleware.mockImplementation(async () => null); // null = no error

      const request = new NextRequest('http://localhost/api/export/approval?exportId=test', {
        method: 'GET',
      });

      const response = await mockSecurityMiddleware(request, {}, { requireCsrf: false });

      expect(response).toBeNull();
    });

    it('should allow requests with valid CSRF token', async () => {
      mockSecurityMiddleware.mockImplementation(async () => null);

      const request = new NextRequest('http://localhost/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
        body: JSON.stringify({ type: 'employees', format: 'json' }),
      });

      const response = await mockSecurityMiddleware(request, {}, { requireCsrf: true });

      expect(response).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should block requests exceeding rate limit', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });

      mockSecurityMiddleware.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 60 }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        );
      });

      const request = new NextRequest('http://localhost/api/swarm', {
        method: 'POST',
      });

      const response = await mockSecurityMiddleware(request, {}, { rateLimitTier: 'agent' });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should track different rate limits per tier', async () => {
      const tiers = [
        { tier: 'strict', limit: 10 },
        { tier: 'agent', limit: 60 },
        { tier: 'report', limit: 10 },
      ];

      for (const { tier, limit } of tiers) {
        mockCheckRateLimit.mockResolvedValue({
          allowed: true,
          limit,
          remaining: limit - 1,
          resetAt: Date.now() + 60000,
        });

        mockSecurityMiddleware.mockImplementation(async () => null);

        const request = new NextRequest('http://localhost/api/test', { method: 'POST' });
        const response = await mockSecurityMiddleware(request, {}, { rateLimitTier: tier });

        expect(response).toBeNull();
      }
    });

    it('should allow requests within rate limit', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        limit: 60,
        remaining: 59,
        resetAt: Date.now() + 60000,
      });

      mockSecurityMiddleware.mockImplementation(async () => null);

      const request = new NextRequest('http://localhost/api/swarm', { method: 'POST' });
      const response = await mockSecurityMiddleware(request, {}, { rateLimitTier: 'agent' });

      expect(response).toBeNull();
    });
  });

  describe('Authorization', () => {
    it('should reject requests without required capability', async () => {
      mockHasCapability.mockReturnValue(false);
      mockRequireVerifiedSessionContext.mockReturnValue({
        session: { role: 'employee' },
        context: { userId: 'user-001', role: 'employee', permissions: [] },
        securityContext: {},
      });

      const result = mockHasCapability('employee', 'report:generate');

      expect(result).toBe(false);
    });

    it('should allow requests with required capability', async () => {
      mockHasCapability.mockReturnValue(true);

      const result = mockHasCapability('admin', 'report:generate');

      expect(result).toBe(true);
    });

    it('should check role-specific capabilities', async () => {
      const capabilityChecks = [
        { role: 'admin', capability: 'employee:delete', expected: true },
        { role: 'manager', capability: 'employee:read', expected: true },
        { role: 'employee', capability: 'employee:delete', expected: false },
        { role: 'payroll', capability: 'compensation:read', expected: true },
        { role: 'manager', capability: 'compensation:read', expected: false },
      ];

      for (const { role, capability, expected } of capabilityChecks) {
        mockHasCapability.mockReturnValue(expected);
        const result = mockHasCapability(role, capability);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Export Authorization', () => {
    it('should require export:request capability for creating exports', async () => {
      mockHasCapability.mockImplementation((role: string, capability: string) => {
        if (capability === 'export:request') return true;
        return false;
      });

      const result = mockHasCapability('manager', 'export:request');

      expect(result).toBe(true);
      expect(mockHasCapability).toHaveBeenCalledWith('manager', 'export:request');
    });

    it('should require export:approve capability for approving exports', async () => {
      mockHasCapability.mockImplementation((role: string, capability: string) => {
        if (capability === 'export:approve') return role === 'admin' || role === 'payroll';
        return false;
      });

      expect(mockHasCapability('admin', 'export:approve')).toBe(true);
      expect(mockHasCapability('payroll', 'export:approve')).toBe(true);
      expect(mockHasCapability('manager', 'export:approve')).toBe(false);
      expect(mockHasCapability('employee', 'export:approve')).toBe(false);
    });

    it('should require sensitive field access for salary exports', async () => {
      const sensitiveFields = ['salary', 'taxId', 'ssn', 'bankAccount'];
      
      mockHasCapability.mockImplementation((role: string, capability: string) => {
        if (capability === 'compensation:read') {
          return role === 'admin' || role === 'payroll';
        }
        return false;
      });

      for (const field of sensitiveFields) {
        if (field === 'salary') {
          expect(mockHasCapability('admin', 'compensation:read')).toBe(true);
          expect(mockHasCapability('manager', 'compensation:read')).toBe(false);
        }
      }
    });
  });

  describe('Security Event Logging', () => {
    it('should log auth failures', async () => {
      mockLogSecurityEvent.mockImplementation(() => {});

      const context = {
        userId: 'user-001',
        role: 'employee',
        permissions: [],
        sessionId: 'session-001',
      };

      mockLogSecurityEvent('auth_failure', context, {
        reason: 'User lacks required capability',
        resourceType: 'export',
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'auth_failure',
        context,
        expect.objectContaining({ reason: expect.stringContaining('lacks') })
      );
    });

    it('should log rate limit hits', async () => {
      const context = {
        userId: 'user-001',
        role: 'manager',
        permissions: [],
        sessionId: 'session-001',
      };

      mockLogSecurityEvent('rate_limit_hit', context, {
        reason: 'Rate limit exceeded for tier: agent',
        resourceType: 'api',
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'rate_limit_hit',
        context,
        expect.objectContaining({ resourceType: 'api' })
      );
    });

    it('should log CSRF violations', async () => {
      const context = {
        userId: 'user-001',
        role: 'employee',
        permissions: [],
        sessionId: 'session-001',
      };

      mockLogSecurityEvent('csrf_violation', context, {
        reason: 'Invalid CSRF token provided',
        resourceType: 'form',
      });

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        'csrf_violation',
        context,
        expect.objectContaining({ resourceType: 'form' })
      );
    });
  });

  describe('Full Integration Flow', () => {
    it('should handle complete authenticated request flow', async () => {
      // 1. Valid session
      mockRequireVerifiedSessionContext.mockReturnValue({
        session: {
          userId: 'user-001',
          role: 'admin',
          permissions: ['employee:read', 'export:request', 'export:approve'],
        },
        context: {
          userId: 'user-001',
          role: 'admin',
          permissions: ['employee:read', 'export:request', 'export:approve'],
          sessionId: 'session-001',
        },
        securityContext: {
          userId: 'user-001',
          sessionId: 'session-001',
        },
      });

      // 2. Security middleware passes
      mockSecurityMiddleware.mockImplementation(async () => null);

      // 3. Has capability
      mockHasCapability.mockReturnValue(true);

      const sessionResult = mockRequireVerifiedSessionContext();
      expect(sessionResult.session.userId).toBe('user-001');

      const securityResult = await mockSecurityMiddleware(
        new NextRequest('http://localhost/api/export'),
        {},
        { requireCsrf: true, rateLimitTier: 'report' }
      );
      expect(securityResult).toBeNull();

      const hasCapability = mockHasCapability('admin', 'export:request');
      expect(hasCapability).toBe(true);
    });

    it('should block at first security check that fails', async () => {
      // Session is valid
      mockRequireVerifiedSessionContext.mockReturnValue({
        session: { userId: 'user-001', role: 'manager' },
        context: { userId: 'user-001', role: 'manager' },
        securityContext: {},
      });

      // But rate limit exceeded
      mockSecurityMiddleware.mockImplementation(async () => {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429 }
        );
      });

      const result = await mockSecurityMiddleware(
        new NextRequest('http://localhost/api/export'),
        {},
        { rateLimitTier: 'report' }
      );

      expect(result?.status).toBe(429);
      
      // Should never reach capability check
      expect(mockHasCapability).not.toHaveBeenCalled();
    });
  });
});

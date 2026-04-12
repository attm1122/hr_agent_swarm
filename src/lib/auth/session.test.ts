/**
 * Session — Unit Tests
 * Verifies explicit session construction, fail-closed session resolution,
 * and AgentContext building for all 5 roles.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  buildSession,
  getSession,
  requireSession,
  getAgentContext,
  getPermissionsForRole,
  hasPermission,
  verifyAuthConfiguration,
  requireVerifiedSessionContext,
  SessionResolutionError,
} from './session';
import { ROLE_CAPABILITIES, ROLE_SCOPE, ROLE_SENSITIVITY } from './authorization';
import type { Role } from '@/types';

const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];

function enableMockAuth(role: Role = 'employee') {
  vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
  vi.stubEnv('MOCK_AUTH_USER_ID', 'user-test');
  vi.stubEnv('MOCK_AUTH_EMPLOYEE_ID', 'emp-test');
  vi.stubEnv('MOCK_AUTH_NAME', 'Test User');
  vi.stubEnv('MOCK_AUTH_EMAIL', 'test@company.com');
  vi.stubEnv('MOCK_AUTH_ROLE', role);
  vi.stubEnv('MOCK_AUTH_TITLE', 'Test Title');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildSession', () => {
  it('populates permissions, scope, and sensitivity from role', () => {
    for (const role of ALL_ROLES) {
      const session = buildSession('u1', 'e1', 'Test', 'test@co.com', role, 'Title');
      expect(session.role).toBe(role);
      expect(session.permissions).toEqual(ROLE_CAPABILITIES[role]);
      expect(session.scope).toBe(ROLE_SCOPE[role]);
      expect(session.sensitivityClearance).toEqual(ROLE_SENSITIVITY[role]);
    }
  });
});

describe('getSession', () => {
  it('returns null when no explicit auth is configured', () => {
    expect(getSession()).toBeNull();
  });

  it('returns the explicitly configured non-production mock session', () => {
    enableMockAuth('manager');

    const session = getSession();

    expect(session).not.toBeNull();
    expect(session?.role).toBe('manager');
    expect(session?.employeeId).toBe('emp-test');
    expect(session?.name).toBe('Test User');
  });

  it('throws when mock auth is enabled with missing fields', () => {
    vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
    vi.stubEnv('MOCK_AUTH_ROLE', 'employee');

    expect(() => getSession()).toThrowError(SessionResolutionError);
    expect(() => getSession()).toThrowError(/missing required variables/i);
  });

  it('throws when mock auth role is invalid', () => {
    vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
    vi.stubEnv('MOCK_AUTH_USER_ID', 'user-test');
    vi.stubEnv('MOCK_AUTH_EMPLOYEE_ID', 'emp-test');
    vi.stubEnv('MOCK_AUTH_NAME', 'Test User');
    vi.stubEnv('MOCK_AUTH_EMAIL', 'test@company.com');
    vi.stubEnv('MOCK_AUTH_ROLE', 'super_admin');
    vi.stubEnv('MOCK_AUTH_TITLE', 'Test Title');

    expect(() => getSession()).toThrowError(SessionResolutionError);
    expect(() => getSession()).toThrowError(/invalid/i);
  });

  it('returns null in production when auth is not configured (fail closed)', () => {
    vi.stubEnv('NODE_ENV', 'production');

    // Production without auth configured returns null for graceful "auth required" UI
    expect(getSession()).toBeNull();
  });

  it('returns null when mock auth is enabled in production (forbidden)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    enableMockAuth('employee');

    // Mock auth in production is forbidden - returns null (fail closed)
    expect(getSession()).toBeNull();
  });

  it('returns null when production auth is enabled outside production (staging/testing)', () => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCTION_AUTH', 'true');

    // Production auth enabled outside production returns null, directing callers to async path
    expect(getSession()).toBeNull();
  });
});

describe('requireSession', () => {
  it('throws AUTH_REQUIRED when no session is available', () => {
    try {
      requireSession();
      expect.unreachable('requireSession should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SessionResolutionError);
      expect((error as SessionResolutionError).code).toBe('AUTH_REQUIRED');
      expect((error as SessionResolutionError).status).toBe(401);
    }
  });
});

describe('getAgentContext', () => {
  it('inherits scope and sensitivity from a verified session', () => {
    const session = buildSession('u1', 'e1', 'Test', 'test@co.com', 'team_lead', 'TL');
    const ctx = getAgentContext(session);
    expect(ctx.role).toBe('team_lead');
    expect(ctx.scope).toBe('team');
    expect(ctx.sensitivityClearance).toEqual(ROLE_SENSITIVITY['team_lead']);
    expect(ctx.sessionId).toBeDefined();
    expect(ctx.timestamp).toBeDefined();
  });
});

describe('requireVerifiedSessionContext', () => {
  it('builds verified session, RBAC context, and security context together', () => {
    enableMockAuth('payroll');

    const { session, context, securityContext } = requireVerifiedSessionContext();

    expect(session.role).toBe('payroll');
    expect(context.role).toBe('payroll');
    expect(context.employeeId).toBe('emp-test');
    expect(securityContext).toEqual({
      userId: 'emp-test',
      role: 'payroll',
      sessionId: 'user-test',
    });
  });
});

describe('verifyAuthConfiguration', () => {
  it('flags incomplete mock auth configuration', () => {
    vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
    vi.stubEnv('MOCK_AUTH_ROLE', 'employee');

    const result = verifyAuthConfiguration();

    expect(result.isConfigured).toBe(false);
    expect(result.errors.some((error) => error.includes('missing required variables'))).toBe(true);
  });

  it('flags production auth as release-blocking until implemented', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_PRODUCTION_AUTH', 'true');

    const result = verifyAuthConfiguration();

    expect(result.isConfigured).toBe(false);
    expect(result.errors).toContain(
      'Production authentication is enabled but not implemented. Configure real authentication before release.'
    );
  });
});

describe('getPermissionsForRole', () => {
  it('returns correct permissions for each role', () => {
    for (const role of ALL_ROLES) {
      expect(getPermissionsForRole(role)).toEqual(ROLE_CAPABILITIES[role]);
    }
  });
});

describe('hasPermission', () => {
  it('checks session permissions', () => {
    const session = buildSession('u1', 'e1', 'Test', 'test@co.com', 'employee', 'Emp');
    expect(hasPermission(session, 'employee:read')).toBe(true);
    expect(hasPermission(session, 'admin:write')).toBe(false);
  });
});

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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      },
    })
  ),
}));

const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];

function enableMockAuth(role: Role = 'employee') {
  vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
  vi.stubEnv('MOCK_AUTH_USER_ID', 'user-test');
  vi.stubEnv('MOCK_AUTH_EMPLOYEE_ID', 'emp-test');
  vi.stubEnv('MOCK_AUTH_NAME', 'Test User');
  vi.stubEnv('MOCK_AUTH_EMAIL', 'test@company.com');
  vi.stubEnv('MOCK_AUTH_ROLE', role);
  vi.stubEnv('MOCK_AUTH_TITLE', 'Test Title');
  vi.stubEnv('MOCK_AUTH_TENANT_ID', 'tenant-test');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildSession', () => {
  it('populates permissions, scope, and sensitivity from role', () => {
    for (const role of ALL_ROLES) {
      const session = buildSession('u1', 'e1', 'Test', 'test@co.com', role, 'Title', 'tenant-1');
      expect(session.role).toBe(role);
      expect(session.permissions).toEqual(ROLE_CAPABILITIES[role]);
      expect(session.scope).toBe(ROLE_SCOPE[role]);
      expect(session.sensitivityClearance).toEqual(ROLE_SENSITIVITY[role]);
    }
  });
});

describe('getSession', () => {
  it('returns null when no explicit auth is configured', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('returns the explicitly configured non-production mock session', async () => {
    enableMockAuth('manager');
    vi.stubEnv('NEXT_PUBLIC_PRODUCTION_AUTH', 'false');

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.role).toBe('manager');
    expect(session?.employeeId).toBe('emp-test');
    expect(session?.name).toBe('Test User');
  });

  it('throws when mock auth is enabled with missing fields', async () => {
    vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
    vi.stubEnv('MOCK_AUTH_ROLE', 'employee');

    await expect(getSession()).rejects.toThrowError(SessionResolutionError);
    await expect(getSession()).rejects.toThrowError(/missing required variables/i);
  });

  it('throws when mock auth role is invalid', async () => {
    vi.stubEnv('MOCK_AUTH_ENABLED', 'true');
    vi.stubEnv('MOCK_AUTH_USER_ID', 'user-test');
    vi.stubEnv('MOCK_AUTH_EMPLOYEE_ID', 'emp-test');
    vi.stubEnv('MOCK_AUTH_NAME', 'Test User');
    vi.stubEnv('MOCK_AUTH_EMAIL', 'test@company.com');
    vi.stubEnv('MOCK_AUTH_ROLE', 'super_admin');
    vi.stubEnv('MOCK_AUTH_TITLE', 'Test Title');

    await expect(getSession()).rejects.toThrowError(SessionResolutionError);
    await expect(getSession()).rejects.toThrowError(/invalid/i);
  });

  it('returns null on production auth misconfiguration when production auth is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(getSession()).resolves.toBeNull();
  });

  it('throws when mock auth is enabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    enableMockAuth('employee');

    await expect(getSession()).rejects.toThrowError(SessionResolutionError);
    await expect(getSession()).rejects.toThrowError(/forbidden in production/i);
  });

  it('returns null when production auth is marked enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCTION_AUTH', 'true');

    await expect(getSession()).resolves.toBeNull();
  });
});

describe('requireSession', () => {
  it('throws AUTH_REQUIRED when no session is available', async () => {
    await expect(requireSession()).rejects.toBeInstanceOf(SessionResolutionError);
    await expect(requireSession()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
    });
  });
});

describe('getAgentContext', () => {
  it('inherits scope and sensitivity from a verified session', () => {
    const session = buildSession('u1', 'e1', 'Test', 'test@co.com', 'team_lead', 'TL', 'tenant-1');
    const ctx = getAgentContext(session);
    expect(ctx.role).toBe('team_lead');
    expect(ctx.scope).toBe('team');
    expect(ctx.sensitivityClearance).toEqual(ROLE_SENSITIVITY['team_lead']);
    expect(ctx.sessionId).toBeDefined();
    expect(ctx.timestamp).toBeDefined();
  });
});

describe('requireVerifiedSessionContext', () => {
  it('builds verified session, RBAC context, and security context together', async () => {
    enableMockAuth('payroll');

    const result = await requireVerifiedSessionContext();

    expect(result.session.role).toBe('payroll');
    expect(result.context.role).toBe('payroll');
    expect(result.context.employeeId).toBe('emp-test');
    expect(result.securityContext).toEqual({
      userId: 'emp-test',
      role: 'payroll',
      sessionId: 'user-test',
      tenantId: 'tenant-test',
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

  it('flags missing supabase configuration in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_PRODUCTION_AUTH', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const result = verifyAuthConfiguration();

    expect(result.isConfigured).toBe(false);
    expect(result.errors).toContain('NEXT_PUBLIC_SUPABASE_URL is not configured');
    expect(result.errors).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
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
    const session = buildSession('u1', 'e1', 'Test', 'test@co.com', 'employee', 'Emp', 'tenant-1');
    expect(hasPermission(session, 'employee:read')).toBe(true);
    expect(hasPermission(session, 'admin:write')).toBe(false);
  });
});

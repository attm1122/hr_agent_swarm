/**
 * Session — Unit Tests
 * Verifies session construction, role→capability derivation,
 * and AgentContext building for all 5 roles.
 */

import { describe, it, expect } from 'vitest';
import { buildSession, getSession, getAgentContext, getPermissionsForRole, hasPermission } from './session';
import { ROLE_CAPABILITIES, ROLE_SCOPE, ROLE_SENSITIVITY } from './authorization';
import type { Role } from '@/types';

const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];

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

describe('getSession (mock)', () => {
  it('returns admin session', () => {
    const s = getSession();
    expect(s.role).toBe('admin');
    expect(s.employeeId).toBe('emp-001');
  });
});

describe('getAgentContext', () => {
  it('inherits scope and sensitivity from session', () => {
    const session = buildSession('u1', 'e1', 'Test', 'test@co.com', 'team_lead', 'TL');
    const ctx = getAgentContext(session);
    expect(ctx.role).toBe('team_lead');
    expect(ctx.scope).toBe('team');
    expect(ctx.sensitivityClearance).toEqual(ROLE_SENSITIVITY['team_lead']);
    expect(ctx.sessionId).toBeDefined();
    expect(ctx.timestamp).toBeDefined();
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
    const s = buildSession('u1', 'e1', 'Test', 'test@co.com', 'employee', 'Emp');
    expect(hasPermission(s, 'employee:read')).toBe(true);
    expect(hasPermission(s, 'admin:write')).toBe(false);
  });
});

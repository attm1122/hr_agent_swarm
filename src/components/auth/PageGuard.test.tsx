/**
 * PageGuard — Authorization Tests
 *
 * Verifies the server component blocks/allows content based on
 * the required permission and the current session role.
 *
 * Because getSession() returns a mock admin by default, these tests
 * validate:
 *  - Admin can access admin-only pages
 *  - Access-denied message renders for blocked pages
 *  - Children rendered when permission granted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageGuard } from './PageGuard';

// Mock the session module to control role
const mockGetSession = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

// Import after mock
import { ROLE_CAPABILITIES, ROLE_SCOPE, ROLE_SENSITIVITY } from '@/lib/auth/authorization';
import type { Role } from '@/types';

function buildMockSession(role: Role) {
  return {
    userId: 'user-test',
    employeeId: 'emp-test',
    name: 'Test User',
    email: 'test@co.com',
    role,
    title: 'Test',
    permissions: ROLE_CAPABILITIES[role],
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
  };
}

describe('PageGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when admin accesses admin:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('admin'));
    render(
      <PageGuard requiredPermission="admin:read">
        <div data-testid="protected">Admin Content</div>
      </PageGuard>
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('blocks employee from admin:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('employee'));
    render(
      <PageGuard requiredPermission="admin:read">
        <div data-testid="protected">Admin Content</div>
      </PageGuard>
    );
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('blocks manager from admin:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('manager'));
    render(
      <PageGuard requiredPermission="admin:read">
        <div data-testid="protected">Settings</div>
      </PageGuard>
    );
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows admin to access compliance:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('admin'));
    render(
      <PageGuard requiredPermission="compliance:read">
        <div data-testid="compliance">Compliance Dashboard</div>
      </PageGuard>
    );
    expect(screen.getByTestId('compliance')).toBeInTheDocument();
  });

  it('blocks employee from compliance:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('employee'));
    render(
      <PageGuard requiredPermission="compliance:read">
        <div>Compliance</div>
      </PageGuard>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows manager to access employee:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('manager'));
    render(
      <PageGuard requiredPermission="employee:read">
        <div data-testid="employees">Employees</div>
      </PageGuard>
    );
    expect(screen.getByTestId('employees')).toBeInTheDocument();
  });

  it('blocks payroll from document:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('payroll'));
    render(
      <PageGuard requiredPermission="document:read">
        <div>Documents</div>
      </PageGuard>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows payroll to access compensation:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('payroll'));
    render(
      <PageGuard requiredPermission="compensation:read">
        <div data-testid="comp">Compensation</div>
      </PageGuard>
    );
    expect(screen.getByTestId('comp')).toBeInTheDocument();
  });

  it('blocks team_lead from compensation:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('team_lead'));
    render(
      <PageGuard requiredPermission="compensation:read">
        <div>Compensation</div>
      </PageGuard>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('allows team_lead to access leave:read page', () => {
    mockGetSession.mockReturnValue(buildMockSession('team_lead'));
    render(
      <PageGuard requiredPermission="leave:read">
        <div data-testid="leave">Leave</div>
      </PageGuard>
    );
    expect(screen.getByTestId('leave')).toBeInTheDocument();
  });

  it('blocks all non-admin roles from audit:read', () => {
    for (const role of ['manager', 'team_lead', 'employee', 'payroll'] as Role[]) {
      const { unmount } = render(
        <PageGuard requiredPermission="audit:read">
          <div data-testid="audit">Audit Logs</div>
        </PageGuard>
      );
      mockGetSession.mockReturnValue(buildMockSession(role));
      // Re-render to pick up new mock
      unmount();
      mockGetSession.mockReturnValue(buildMockSession(role));
      const { unmount: u2 } = render(
        <PageGuard requiredPermission="audit:read">
          <div data-testid="audit">Audit Logs</div>
        </PageGuard>
      );
      expect(screen.queryByTestId('audit')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      u2();
    }
  });
});

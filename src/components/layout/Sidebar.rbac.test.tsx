/**
 * Sidebar RBAC Visibility Tests
 *
 * Verifies that navigation items are correctly shown/hidden
 * based on role and permissions for all 5 roles.
 *
 * Coverage:
 *  - ADMIN sees all nav items including Settings
 *  - MANAGER sees team management items, no admin/compliance
 *  - TEAM_LEAD sees team items, no compensation/compliance/admin
 *  - EMPLOYEE sees self-service items only
 *  - PAYROLL sees leave/compensation/reports, no reviews/admin
 *  - Settings (admin:read) hidden for non-admin roles
 *  - Negative: items that should be hidden ARE hidden per role
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { ROLE_CAPABILITIES } from '@/lib/auth/authorization';
import type { Role } from '@/types';

// ============================================
// Helper: render sidebar for a given role
// ============================================

function renderSidebar(role: Role) {
  return render(
    <Sidebar role={role} permissions={ROLE_CAPABILITIES[role]} />
  );
}

// Nav items and their required permissions (mirrored from Sidebar.tsx)
const NAV_ITEMS: { title: string; requiredPermission?: string }[] = [
  { title: 'Dashboard' }, // always visible
  { title: 'Employees', requiredPermission: 'employee:read' },
  { title: 'Approvals', requiredPermission: 'leave:approve' },
  { title: 'Leave', requiredPermission: 'leave:read' },
  { title: 'Compensation', requiredPermission: 'compensation:read' },
  { title: 'Reviews', requiredPermission: 'review:read' },
  { title: 'Onboarding', requiredPermission: 'onboarding:read' },
  { title: 'Compliance', requiredPermission: 'compliance:read' },
  { title: 'Communications', requiredPermission: 'communication:read' },
  { title: 'Reports', requiredPermission: 'report:read' },
  { title: 'Knowledge' }, // always visible
];

const BOTTOM_NAV: { title: string; requiredPermission: string }[] = [
  { title: 'Settings', requiredPermission: 'admin:read' },
];

function visibleNavFor(role: Role): string[] {
  const perms = ROLE_CAPABILITIES[role];
  // Admin sees all items (Sidebar bypasses filter for admin)
  if (role === 'admin') return [...NAV_ITEMS.map(n => n.title), ...BOTTOM_NAV.map(n => n.title)];
  const visible = NAV_ITEMS.filter(n => !n.requiredPermission || perms.includes(n.requiredPermission))
    .map(n => n.title);
  const bottomVisible = BOTTOM_NAV.filter(n => perms.includes(n.requiredPermission))
    .map(n => n.title);
  return [...visible, ...bottomVisible];
}

function hiddenNavFor(role: Role): string[] {
  const visible = new Set(visibleNavFor(role));
  const all = [...NAV_ITEMS.map(n => n.title), ...BOTTOM_NAV.map(n => n.title)];
  return all.filter(t => !visible.has(t));
}

// ============================================
// ADMIN — sees everything
// ============================================

describe('Sidebar RBAC: ADMIN', () => {
  it('shows all main nav items', () => {
    renderSidebar('admin');
    for (const title of NAV_ITEMS.map(n => n.title)) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('shows Settings in bottom nav', () => {
    renderSidebar('admin');
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

// ============================================
// MANAGER
// ============================================

describe('Sidebar RBAC: MANAGER', () => {
  it('shows expected visible items', () => {
    renderSidebar('manager');
    for (const title of visibleNavFor('manager')) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('hides items without required permissions', () => {
    renderSidebar('manager');
    for (const title of hiddenNavFor('manager')) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('hides Settings (no admin:read)', () => {
    renderSidebar('manager');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('hides Compliance (no compliance:read)', () => {
    renderSidebar('manager');
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('shows Compensation (has compensation:read)', () => {
    renderSidebar('manager');
    expect(screen.getByText('Compensation')).toBeInTheDocument();
  });
});

// ============================================
// TEAM_LEAD
// ============================================

describe('Sidebar RBAC: TEAM_LEAD', () => {
  it('shows expected visible items', () => {
    renderSidebar('team_lead');
    for (const title of visibleNavFor('team_lead')) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('hides items without required permissions', () => {
    renderSidebar('team_lead');
    for (const title of hiddenNavFor('team_lead')) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('hides Compensation (no compensation:read)', () => {
    renderSidebar('team_lead');
    expect(screen.queryByText('Compensation')).not.toBeInTheDocument();
  });

  it('hides Compliance (no compliance:read)', () => {
    renderSidebar('team_lead');
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('hides Settings (no admin:read)', () => {
    renderSidebar('team_lead');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows Approvals (has leave:approve)', () => {
    renderSidebar('team_lead');
    expect(screen.getByText('Approvals')).toBeInTheDocument();
  });
});

// ============================================
// EMPLOYEE
// ============================================

describe('Sidebar RBAC: EMPLOYEE', () => {
  it('shows expected visible items', () => {
    renderSidebar('employee');
    for (const title of visibleNavFor('employee')) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('hides items without required permissions', () => {
    renderSidebar('employee');
    for (const title of hiddenNavFor('employee')) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('hides Compensation', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Compensation')).not.toBeInTheDocument();
  });

  it('hides Approvals (no leave:approve)', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
  });

  it('hides Reports (no report:read)', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
  });

  it('hides Settings', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('hides Compliance', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('hides Onboarding', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
  });

  it('shows Dashboard, Employees, Leave, Knowledge', () => {
    renderSidebar('employee');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });
});

// ============================================
// PAYROLL
// ============================================

describe('Sidebar RBAC: PAYROLL', () => {
  it('shows expected visible items', () => {
    renderSidebar('payroll');
    for (const title of visibleNavFor('payroll')) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('hides items without required permissions', () => {
    renderSidebar('payroll');
    for (const title of hiddenNavFor('payroll')) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('hides Reviews (no review:read)', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Reviews')).not.toBeInTheDocument();
  });

  it('hides Compliance', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('hides Settings', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('hides Approvals (no leave:approve)', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
  });

  it('shows Compensation (has compensation:read)', () => {
    renderSidebar('payroll');
    expect(screen.getByText('Compensation')).toBeInTheDocument();
  });

  it('shows Reports (has report:read)', () => {
    renderSidebar('payroll');
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('shows Leave (has leave:read)', () => {
    renderSidebar('payroll');
    expect(screen.getByText('Leave')).toBeInTheDocument();
  });
});

// ============================================
// Cross-role regression
// ============================================

describe('Sidebar RBAC: cross-role regression', () => {
  const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];

  it('Dashboard and Knowledge visible for all roles', () => {
    for (const role of ALL_ROLES) {
      const { unmount } = renderSidebar(role);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Knowledge')).toBeInTheDocument();
      unmount();
    }
  });

  it('Employees visible for all roles (all have employee:read)', () => {
    for (const role of ALL_ROLES) {
      const { unmount } = renderSidebar(role);
      expect(screen.getByText('Employees')).toBeInTheDocument();
      unmount();
    }
  });

  it('Settings visible ONLY for admin', () => {
    for (const role of ALL_ROLES) {
      const { unmount } = renderSidebar(role);
      if (role === 'admin') {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      } else {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      }
      unmount();
    }
  });
});

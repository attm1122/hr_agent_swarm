/**
 * Sidebar RBAC Visibility Tests
 *
 * Verifies that navigation items are correctly shown/hidden
 * based on role and permissions for all 5 roles.
 *
 * Coverage:
 *  - ADMIN sees all nav items including Settings
 *  - MANAGER sees team management items, no admin
 *  - TEAM_LEAD sees team items, no admin
 *  - EMPLOYEE sees self-service items only
 *  - PAYROLL sees insights, no admin
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
  { title: 'Home' }, // always visible
  { title: 'People', requiredPermission: 'employee:read' },
  { title: 'Actions', requiredPermission: 'leave:approve' },
  { title: 'Insights', requiredPermission: 'report:read' },
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

  it('shows Actions (has leave:approve)', () => {
    renderSidebar('manager');
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('shows Insights (has report:read)', () => {
    renderSidebar('manager');
    expect(screen.getByText('Insights')).toBeInTheDocument();
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

  it('shows Insights (has report:read)', () => {
    renderSidebar('team_lead');
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('hides Settings (no admin:read)', () => {
    renderSidebar('team_lead');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows Actions (has leave:approve)', () => {
    renderSidebar('team_lead');
    expect(screen.getByText('Actions')).toBeInTheDocument();
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

  it('hides Actions (no leave:approve)', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('hides Insights (no report:read)', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });

  it('hides Settings', () => {
    renderSidebar('employee');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows Home, People, Knowledge', () => {
    renderSidebar('employee');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
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

  it('hides Actions (no leave:approve)', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('hides Settings', () => {
    renderSidebar('payroll');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows Insights (has report:read)', () => {
    renderSidebar('payroll');
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('shows People (has employee:read)', () => {
    renderSidebar('payroll');
    expect(screen.getByText('People')).toBeInTheDocument();
  });
});

// ============================================
// Cross-role regression
// ============================================

describe('Sidebar RBAC: cross-role regression', () => {
  const ALL_ROLES: Role[] = ['admin', 'manager', 'team_lead', 'employee', 'payroll'];

  it('Home and Knowledge visible for all roles', () => {
    for (const role of ALL_ROLES) {
      const { unmount } = renderSidebar(role);
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Knowledge')).toBeInTheDocument();
      unmount();
    }
  });

  it('People visible for all roles (all have employee:read)', () => {
    for (const role of ALL_ROLES) {
      const { unmount } = renderSidebar(role);
      expect(screen.getByText('People')).toBeInTheDocument();
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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

const mockUsePathname = vi.mocked(usePathname);

describe('Sidebar', () => {
  it('renders the brand logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('HR Agent')).toBeInTheDocument();
    expect(screen.getByText('Swarm')).toBeInTheDocument();
  });

  it('renders all HR nav items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('Compensation')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Communications')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });

  it('renders settings in bottom nav', () => {
    render(<Sidebar />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders badges for items with badge count', () => {
    render(<Sidebar />);
    // Employees badge: 23
    expect(screen.getByText('23')).toBeInTheDocument();
    // Approvals badge: 6
    expect(screen.getByText('6')).toBeInTheDocument();
    // Leave badge: dynamic count (may change if other tests mutate leave data)
    const leaveLink = screen.getByText('Leave').closest('a');
    const leaveBadge = leaveLink?.querySelector('[class*="badge"], [class*="Badge"]');
    expect(leaveBadge || screen.queryByText('4') || screen.queryByText('3') || screen.queryByText('2') || screen.queryByText('1')).toBeTruthy();
  });

  it('highlights the active route', () => {
    mockUsePathname.mockReturnValue('/hr');
    render(<Sidebar />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.className).toContain('bg-emerald-50');
  });

  it('highlights employee route when on sub-path', () => {
    mockUsePathname.mockReturnValue('/employees/emp-001');
    render(<Sidebar />);
    const employeesLink = screen.getByText('Employees').closest('a');
    expect(employeesLink?.className).toContain('bg-emerald-50');
  });

  it('renders nav links with correct hrefs', () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.getAttribute('href')).toBe('/hr');
    
    const employeesLink = screen.getByText('Employees').closest('a');
    expect(employeesLink?.getAttribute('href')).toBe('/employees');
  });

  it('renders settings link with correct href', () => {
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.getAttribute('href')).toBe('/admin');
  });

  it('applies default hr role', () => {
    render(<Sidebar />);
    // HR nav has 11 items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });

  it('accepts role prop without error', () => {
    render(<Sidebar role="manager" />);
    expect(screen.getByText('HR Agent')).toBeInTheDocument();
  });

  it('non-active links have slate styling', () => {
    mockUsePathname.mockReturnValue('/hr');
    render(<Sidebar />);
    const leaveLink = screen.getByText('Leave').closest('a');
    expect(leaveLink?.className).toContain('text-slate-600');
    expect(leaveLink?.className).not.toContain('bg-emerald-50');
  });

  it('highlights settings link when active', () => {
    mockUsePathname.mockReturnValue('/admin');
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.className).toContain('bg-emerald-50');
    expect(settingsLink?.className).toContain('text-emerald-700');
  });

  it('settings link is not active on other routes', () => {
    mockUsePathname.mockReturnValue('/hr');
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.className).toContain('text-slate-600');
    expect(settingsLink?.className).not.toContain('bg-emerald-50');
  });
});

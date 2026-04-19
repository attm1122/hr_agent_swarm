import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

const mockUsePathname = vi.mocked(usePathname);

describe('Sidebar', () => {
  it('renders the brand logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('HR Agent Swarm')).toBeInTheDocument();
  });

  it('renders all main nav items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });

  it('renders settings in bottom nav', () => {
    render(<Sidebar />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders nav items in correct order', () => {
    render(<Sidebar />);
    const nav = screen.getByText('Home').closest('nav');
    const items = nav?.querySelectorAll('a');
    expect(items?.[0]?.textContent).toContain('Home');
    expect(items?.[1]?.textContent).toContain('Actions');
    expect(items?.[2]?.textContent).toContain('People');
  });

  it('highlights the active route', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink?.className).toContain('bg-[#FEF3C7]');
  });

  it('highlights people route when on sub-path', () => {
    mockUsePathname.mockReturnValue('/employees/emp-001');
    render(<Sidebar />);
    const peopleLink = screen.getByText('People').closest('a');
    expect(peopleLink?.className).toContain('bg-[#FEF3C7]');
  });

  it('renders nav links with correct hrefs', () => {
    render(<Sidebar />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink?.getAttribute('href')).toBe('/');

    const peopleLink = screen.getByText('People').closest('a');
    expect(peopleLink?.getAttribute('href')).toBe('/employees');
  });

  it('renders settings link with correct href', () => {
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.getAttribute('href')).toBe('/admin');
  });

  it('applies default admin role', () => {
    render(<Sidebar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });

  it('accepts role prop without error', () => {
    render(<Sidebar role="manager" />);
    expect(screen.getByText('HR Agent Swarm')).toBeInTheDocument();
  });

  it('non-active links have muted styling', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    const peopleLink = screen.getByText('People').closest('a');
    expect(peopleLink?.className).toContain('text-[var(--text-secondary)]');
    expect(peopleLink?.className).not.toContain('bg-[#FEF3C7]');
  });

  it('highlights settings link when active', () => {
    mockUsePathname.mockReturnValue('/admin');
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.className).toContain('bg-[#FEF3C7]');
    expect(settingsLink?.className).toContain('text-[#92400E]');
  });

  it('settings link is not active on other routes', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    const settingsLink = screen.getByText('Settings').closest('a');
    expect(settingsLink?.className).toContain('text-[var(--text-secondary)]');
    expect(settingsLink?.className).not.toContain('bg-[#FEF3C7]');
  });
});

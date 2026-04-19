'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Users,
  CheckSquare,
  PieChart,
  BookOpen,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { actionQueue, leaveRequests, documents, milestones } from '@/lib/data/mock-data';
import type { Role } from '@/types';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  priority?: 'normal' | 'elevated' | 'urgent';
  requiredPermission?: string;
  roles?: Role[];
}

function getSignalCounts() {
  return {
    approvals: actionQueue.length,
    compliance:
      documents.filter(d => d.status === 'expiring' || d.status === 'expired').length +
      milestones.filter(m => m.milestoneType === 'visa_expiry' && m.status !== 'completed').length,
  };
}

function buildNavItems(role: Role): NavItem[] {
  const counts = getSignalCounts();
  const isEmployee = role === 'employee';

  const items: NavItem[] = [
    {
      title: 'Home',
      href: '/',
      icon: Sparkles,
      priority: 'normal',
    },
    {
      title: 'Actions',
      href: '/approvals',
      icon: CheckSquare,
      priority: 'normal',
      requiredPermission: 'leave:approve',
    },
    {
      title: 'People',
      href: '/employees',
      icon: Users,
      requiredPermission: 'employee:read',
    },
    {
      title: 'Insights',
      href: '/reports',
      icon: PieChart,
      priority: 'normal',
      requiredPermission: 'report:read',
    },
    {
      title: 'Knowledge',
      href: '/knowledge',
      icon: BookOpen,
    },
  ];

  // Fixed order matching reference design
  return items;
}

const bottomNavItems: NavItem[] = [
  { title: 'Settings', href: '/admin', icon: Settings, requiredPermission: 'admin:read' },
];

interface SidebarProps {
  role?: Role;
  permissions?: string[];
}

export function Sidebar({ role = 'admin', permissions }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const allNav = buildNavItems(role);
  const userPerms = permissions || [];

  const navItems = allNav.filter(item => {
    if (item.requiredPermission && !userPerms.includes(item.requiredPermission) && role !== 'admin')
      return false;
    return true;
  });

  const filteredBottomNav =
    role === 'admin'
      ? bottomNavItems
      : bottomNavItems.filter(
          item => !item.requiredPermission || userPerms.includes(item.requiredPermission)
        );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const hasUrgency = item.priority === 'urgent' || (item.badge && item.badge > 0);

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
          active
            ? 'bg-[#FEF3C7] text-[#92400E]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--muted-surface)] hover:text-[var(--text-primary)]'
        )}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.title : undefined}
      >
        <div className="relative shrink-0">
          <Icon
            className={cn(
              'w-[18px] h-[18px] shrink-0',
              active
                ? 'text-[#B45309]'
                : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
            )}
            aria-hidden="true"
          />
          {hasUrgency && active === false && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--warning)]"
              aria-hidden="true"
            />
          )}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 truncate" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>{item.title}</span>
            {item.badge ? (
              <Badge
                variant="secondary"
                className={cn(
                  'h-5 min-w-5 flex items-center justify-center text-[11px] px-1.5 shrink-0 font-semibold',
                  active
                    ? 'bg-[#F59E0B] text-white'
                    : 'bg-[var(--muted-surface)] text-[var(--text-tertiary)]'
                )}
              >
                {item.badge}
              </Badge>
            ) : null}
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 bg-white shadow-sm border-[var(--border-default)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="sidebar-nav"
        >
          {mobileOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        className={cn(
          'flex flex-col h-full bg-[#F0EDE8] border-r border-[#E5E2DD] z-40 transition-all duration-250 ease-in-out',
          'fixed lg:static inset-y-0 left-0',
          sidebarWidth,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#E5E2DD] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span
              className="text-sm font-bold tracking-tight text-[var(--text-primary)] truncate"
              style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              HR Agent Swarm
            </span>
          )}
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <nav className="space-y-1" aria-label="Primary">
            {navItems.map(item => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-[#E5E2DD] p-3 shrink-0">
          <nav className="space-y-1" aria-label="Secondary">
            {filteredBottomNav.map(item => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:flex w-full mt-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4 mr-2" />
            )}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, Calendar, DollarSign,
  BookOpen, CheckSquare, PieChart, Settings, Sparkles,
  Shield, UserPlus, MessageSquare, BarChart3, Menu, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { employees, leaveRequests, documents, milestones, actionQueue } from '@/lib/data/mock-data';
import type { Role } from '@/types';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  requiredPermission?: string;
}

function getBadges() {
  return {
    employees: employees.filter(e => e.status !== 'terminated').length,
    approvals: actionQueue.length,
    leave: leaveRequests.filter(lr => lr.status === 'pending').length,
    reviews: milestones.filter(m => m.milestoneType === 'probation_end' && m.status !== 'completed').length,
    onboarding: employees.filter(e => e.status === 'pending').length,
    compliance: documents.filter(d => d.status === 'expiring' || d.status === 'expired').length +
      milestones.filter(m => m.milestoneType === 'visa_expiry' && m.status !== 'completed').length,
  };
}

function buildNavItems(): NavItem[] {
  const b = getBadges();
  return [
    { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
    { title: 'Employees', href: '/employees', icon: Users, badge: b.employees, requiredPermission: 'employee:read' },
    { title: 'Approvals', href: '/approvals', icon: CheckSquare, badge: b.approvals, requiredPermission: 'leave:approve' },
    { title: 'Leave', href: '/leave', icon: Calendar, badge: b.leave, requiredPermission: 'leave:read' },
    { title: 'Compensation', href: '/compensation', icon: DollarSign, requiredPermission: 'compensation:read' },
    { title: 'Reviews', href: '/reviews', icon: BarChart3, badge: b.reviews, requiredPermission: 'review:read' },
    { title: 'Onboarding', href: '/onboarding', icon: UserPlus, badge: b.onboarding, requiredPermission: 'onboarding:read' },
    { title: 'Compliance', href: '/compliance', icon: Shield, badge: b.compliance, requiredPermission: 'compliance:read' },
    { title: 'Communications', href: '/communications', icon: MessageSquare, requiredPermission: 'communication:read' },
    { title: 'Reports', href: '/reports', icon: PieChart, requiredPermission: 'report:read' },
    { title: 'Knowledge', href: '/knowledge', icon: BookOpen },
  ];
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
  const allNav = buildNavItems();

  const userPerms = permissions || [];
  const navItems = role === 'admin'
    ? allNav
    : allNav.filter(item => !item.requiredPermission || userPerms.includes(item.requiredPermission));

  const filteredBottomNav = role === 'admin'
    ? bottomNavItems
    : bottomNavItems.filter(item => !item.requiredPermission || userPerms.includes(item.requiredPermission));

  const NavLink = ({ item, isBottom = false }: { item: NavItem; isBottom?: boolean }) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          isActive
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={cn('w-4 h-4 shrink-0', isActive && 'text-emerald-600')} aria-hidden="true" />
        <span className="flex-1 truncate">{item.title}</span>
        {item.badge ? (
          <Badge
            variant="secondary"
            className={cn(
              'h-5 min-w-5 flex items-center justify-center text-xs px-1.5 shrink-0',
              isActive
                ? 'bg-emerald-200 text-emerald-800 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-600'
            )}
            aria-label={`${item.badge} items`}
          >
            {item.badge}
          </Badge>
        ) : null}
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
          className="h-10 w-10 bg-white shadow-md border-slate-200"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="sidebar-nav"
        >
          {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        className={cn(
          'flex flex-col h-full bg-white border-r border-slate-200 z-40 transition-transform duration-300 ease-in-out',
          'fixed lg:static inset-y-0 left-0',
          'w-[280px] lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate">HR Agent Swarm</span>
          </div>
        </div>

        {/* Main nav */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* Bottom nav */}
        <div className="border-t border-slate-200 p-3">
          <nav className="space-y-1" aria-label="Secondary">
            {filteredBottomNav.map((item) => (
              <NavLink key={item.href} item={item} isBottom />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

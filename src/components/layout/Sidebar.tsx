'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, Calendar, DollarSign,
  BookOpen, CheckSquare, PieChart, Settings, Sparkles,
  Shield, UserPlus, MessageSquare, BarChart3, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { employees, leaveRequests, documents, milestones, actionQueue } from '@/lib/data/mock-data';
import type { Role } from '@/types';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  requiredPermission?: string;
}

/** Derive live badge counts from data */
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
    { title: 'AI Assistant', href: '/chat', icon: Bot },
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
  const allNav = buildNavItems();

  // Filter nav items based on permissions (if provided)
  const userPerms = permissions || [];
  const navItems = role === 'admin'
    ? allNav
    : allNav.filter(item => !item.requiredPermission || userPerms.includes(item.requiredPermission));

  const filteredBottomNav = role === 'admin'
    ? bottomNavItems
    : bottomNavItems.filter(item => !item.requiredPermission || userPerms.includes(item.requiredPermission));

  return (
    <div className="flex flex-col h-full w-64 bg-white border-r border-slate-200">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">HR Agent</span>
          <span className="text-xs text-slate-500">Swarm</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive && 'text-emerald-600')} />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <Badge 
                    variant={isActive ? 'default' : 'secondary'} 
                    className={cn(
                      'h-5 min-w-5 flex items-center justify-center text-xs px-1.5',
                      isActive && 'bg-emerald-600 text-white hover:bg-emerald-600'
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-slate-200 p-3">
        <nav className="space-y-1">
          {filteredBottomNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

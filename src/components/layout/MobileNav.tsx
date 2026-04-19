'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Sparkles, Users, CheckSquare, PieChart, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface MobileNavProps {
  role?: Role;
  permissions?: string[];
}

const mobileItems = [
  { title: 'Home', href: '/', icon: Sparkles },
  { title: 'People', href: '/employees', icon: Users, permission: 'employee:read' },
  { title: 'Actions', href: '/approvals', icon: CheckSquare, permission: 'leave:approve' },
  { title: 'Insights', href: '/reports', icon: PieChart, permission: 'report:read' },
  { title: 'Knowledge', href: '/knowledge', icon: BookOpen },
];

export function MobileNav({ role = 'admin', permissions = [] }: MobileNavProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const visibleItems = role === 'admin'
    ? mobileItems
    : mobileItems.filter(item => !item.permission || permissions.includes(item.permission));

  if (!isMobile) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--border-default)] safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {visibleItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[64px]',
                isActive
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--text-tertiary)]'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

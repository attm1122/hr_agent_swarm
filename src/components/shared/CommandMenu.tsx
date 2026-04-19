'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import {
  LayoutDashboard, Users, FileText, Calendar, DollarSign,
  BookOpen, CheckSquare, PieChart, Settings, Search,
  Shield, UserPlus, MessageSquare, BarChart3,
} from 'lucide-react';

interface CommandMenuProps {
  role?: string;
  permissions?: string[];
}

const navItems = [
  { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
  { title: 'Employees', href: '/employees', icon: Users, permission: 'employee:read' },
  { title: 'Approvals', href: '/approvals', icon: CheckSquare, permission: 'leave:approve' },
  { title: 'Leave', href: '/leave', icon: Calendar, permission: 'leave:read' },
  { title: 'Compensation', href: '/compensation', icon: DollarSign, permission: 'compensation:read' },
  { title: 'Reviews', href: '/reviews', icon: BarChart3, permission: 'review:read' },
  { title: 'Onboarding', href: '/onboarding', icon: UserPlus, permission: 'onboarding:read' },
  { title: 'Compliance', href: '/compliance', icon: Shield, permission: 'compliance:read' },
  { title: 'Communications', href: '/communications', icon: MessageSquare, permission: 'communication:read' },
  { title: 'Reports', href: '/reports', icon: PieChart, permission: 'report:read' },
  { title: 'Knowledge', href: '/knowledge', icon: BookOpen, permission: 'knowledge:read' },
  { title: 'Settings', href: '/admin', icon: Settings, permission: 'admin:read' },
];

export function CommandMenu({ role = 'admin', permissions = [] }: CommandMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const filteredItems = role === 'admin'
    ? navItems
    : navItems.filter(item => !item.permission || permissions.includes(item.permission));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-full max-w-sm hidden md:flex items-center gap-2 h-9 px-3 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Search pages and commands"
        type="button"
      >
        <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <span className="flex-1 text-left">Search pages…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a page name or command…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    router.push(item.href);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>{item.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Shortcuts">
            <CommandItem
              onSelect={() => {
                router.push('/employees');
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <span>Go to Employees</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push('/leave');
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <span>Go to Leave</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

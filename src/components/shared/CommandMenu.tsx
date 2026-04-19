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
  LayoutDashboard, Users, CheckSquare, PieChart, BookOpen, Settings,
  Search, ArrowRight, Zap, FileText, Calendar
} from 'lucide-react';

interface CommandMenuProps {
  role?: string;
  permissions?: string[];
}

const navItems = [
  { title: 'Home', href: '/', icon: LayoutDashboard },
  { title: 'People', href: '/employees', icon: Users, permission: 'employee:read' },
  { title: 'Actions', href: '/approvals', icon: CheckSquare, permission: 'leave:approve' },
  { title: 'Insights', href: '/reports', icon: PieChart, permission: 'report:read' },
  { title: 'Knowledge', href: '/knowledge', icon: BookOpen },
  { title: 'Settings', href: '/admin', icon: Settings, permission: 'admin:read' },
];

const quickActions = [
  { title: 'Approve all low-risk leave', icon: Zap, action: () => { /* TODO */ } },
  { title: 'Summarize team this week', icon: FileText, action: () => { /* TODO */ } },
  { title: 'Who is on leave next week?', icon: Calendar, action: () => { /* TODO */ } },
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
        className="relative w-full max-w-sm hidden md:flex items-center gap-2 h-9 px-3 text-sm text-[var(--text-tertiary)] bg-[var(--muted-surface)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--border-subtle)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-label="Search pages and commands"
        type="button"
      >
        <Search className="w-4 h-4 text-[var(--text-disabled)]" aria-hidden="true" />
        <span className="flex-1 text-left">Search or run a command...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-[var(--border-default)] bg-white px-1.5 font-mono text-[10px] font-medium text-[var(--text-tertiary)]">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a page, action, or question..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.title}
                  onSelect={() => {
                    action.action();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                  <span>{action.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

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
                  <Icon className="w-4 h-4 text-[var(--text-tertiary)]" aria-hidden="true" />
                  <span>{item.title}</span>
                  <ArrowRight className="w-3 h-3 ml-auto text-[var(--text-disabled)]" aria-hidden="true" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

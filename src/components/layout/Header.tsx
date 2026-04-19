'use client';

import { Bell, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CommandMenu } from '@/components/shared/CommandMenu';
import { Breadcrumb } from '@/components/shared/Breadcrumb';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export function Header({ user = { name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'Chief People Officer' } }: HeaderProps) {
  const initials = user.name.split(' ').map(n => n[0]).join('');

  return (
    <header className="flex items-center h-14 px-4 lg:px-5 bg-white border-b border-[var(--border-default)] shrink-0">
      <div className="flex items-center flex-1 gap-4 min-w-0">
        {/* Spacer for mobile hamburger */}
        <div className="w-10 lg:hidden" />

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center">
          <Breadcrumb />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CommandMenu />

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--muted-surface)]"
          aria-label="Notifications, 1 unread"
        >
          <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--danger)] rounded-full ring-2 ring-white" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-2 h-9 px-2 hover:bg-[var(--muted-surface)] rounded-md cursor-pointer">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-[var(--success-bg)] text-[var(--success-text)] text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-[var(--text-primary)] leading-none">{user.name}</span>
                <span className="text-xs text-[var(--text-tertiary)] leading-none mt-0.5">{user.role}</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--danger-text)]">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

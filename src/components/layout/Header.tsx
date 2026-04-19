'use client';

import { Bell, Search, Command } from 'lucide-react';
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

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export function Header({
  user = { name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'Chief People Officer' },
}: HeaderProps) {
  const firstName = user.name.split(' ')[0];
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('');

  return (
    <header className="flex items-center h-14 px-4 lg:px-5 bg-white border-b border-[#E5E2DD] shrink-0">
      {/* Search bar */}
      <div className="flex-1 max-w-md">
        <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[#F8F6F3] border border-[#E5E2DD] text-[#9C9C9C] hover:border-[#D1CFCA] transition-colors">
          <Search className="w-4 h-4" />
          <span className="text-sm">Search all your content...</span>
          <div className="ml-auto flex items-center gap-1 text-[11px] text-[#9C9C9C]">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-[#9C9C9C] hover:text-[#1A1A1A] hover:bg-[#F8F6F3]"
          aria-label="Notifications, 1 unread"
        >
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full ring-2 ring-white" />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex items-center gap-2 h-9 px-2 hover:bg-[#F8F6F3] rounded-md cursor-pointer">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-[#F4FCE8] text-[#3F6212] text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-[#1A1A1A] leading-none">{firstName}</span>
                <span className="text-xs text-[#9C9C9C] leading-none mt-0.5">{user.role}</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[#B91C1C]">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

'use client';

import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export function Header({ user = { name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'Chief People Officer' } }: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 px-5 bg-white border-b border-slate-200">
      <div className="flex items-center flex-1 gap-4">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search employees, documents, policies..."
            className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-4 h-4 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 hover:bg-slate-100">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-slate-900 leading-none">{user.name}</span>
                <span className="text-xs text-slate-500 leading-none mt-0.5">{user.role}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

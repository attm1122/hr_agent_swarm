'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const routeLabels: Record<string, string> = {
  '': 'Home',
  'employees': 'People',
  'approvals': 'Actions',
  'leave': 'Leave',
  'compensation': 'Compensation',
  'reviews': 'Reviews',
  'onboarding': 'Onboarding',
  'compliance': 'Compliance',
  'communications': 'Communications',
  'reports': 'Insights',
  'knowledge': 'Knowledge',
  'admin': 'Settings',
  'chat': 'Chat',
  'assistant': 'Assistant',
  'hr': 'Workspace',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Don't show breadcrumb on home
  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            Home
          </li>
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </li>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = '/' + segments.slice(0, index + 1).join('/');
          const label = routeLabels[segment] || segment;

          return (
            <li key={href} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-disabled)]" aria-hidden="true" />
              {isLast ? (
                <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors truncate max-w-[120px]"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Knowledge Admin Console Layout
 *
 * Secure layout for RAG knowledge management with RBAC enforcement.
 * Only users with knowledge management capabilities can access.
 */

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { 
  Database, 
  FileText, 
  Layers, 
  Search, 
  Shield, 
  Activity,
  BookOpen
} from 'lucide-react';

interface KnowledgeAdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/admin/knowledge', label: 'Inventory', icon: Database },
  { href: '/admin/knowledge/diagnostics', label: 'Diagnostics', icon: Search },
  { href: '/admin/knowledge/governance', label: 'Governance', icon: Shield },
  { href: '/admin/knowledge/audit', label: 'Audit', icon: Activity },
];

export default async function KnowledgeAdminLayout({ 
  children 
}: KnowledgeAdminLayoutProps) {
  const session = await getSession();

  // RBAC check - require knowledge management capability
  if (!session || !hasCapability(session.role, 'knowledge:manage')) {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Knowledge Admin
                </h1>
                <p className="text-xs text-slate-500">
                  RAG Subsystem Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {session.email}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                {session.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 -mb-px">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ 
  href, 
  icon: Icon, 
  children 
}: { 
  href: string; 
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
        'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300',
        'data-[active=true]:border-emerald-600 data-[active=true]:text-emerald-700'
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

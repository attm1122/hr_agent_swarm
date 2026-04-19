export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { CommandMenu } from '@/components/shared/CommandMenu';
import { SkipLink } from '@/components/shared/SkipLink';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center surface-canvas p-6">
        <Card className="max-w-md border border-[var(--border-default)] shadow-sm">
          <CardContent className="p-8 text-center">
            <ShieldX className="mx-auto mb-4 h-12 w-12 text-[var(--danger)]" aria-hidden="true" />
            <h1 className="ds-heading">Authentication Required</h1>
            <p className="ds-body mt-2">
              Sign in with a verified session before accessing the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SkipLink />
      <div className="flex h-screen bg-[#F8F6F3]">
        <Sidebar role={session.role} permissions={session.permissions} />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header user={{ name: session.name, email: session.email, role: session.title }} />
          <main className="flex-1 overflow-auto scrollbar-thin" id="main-content" tabIndex={-1}>
            <div className="max-w-5xl mx-auto p-5 lg:p-6 pb-20 lg:pb-6">{children}</div>
          </main>
          <MobileNav role={session.role} permissions={session.permissions} />
        </div>
        <CommandMenu role={session.role} permissions={session.permissions} />
      </div>
    </>
  );
}

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';
import { getSession, getProductionSession } from '@/lib/auth/session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Try production auth first (async), fall back to sync mock auth
  let session = await getProductionSession().catch(() => null);
  if (!session) {
    try {
      session = getSession();
    } catch {
      // Auth not configured - show auth required screen
      session = null;
    }
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--navy-50)] p-6">
        <Card className="max-w-md border shadow-sm">
          <CardContent className="p-8 text-center">
            <ShieldX className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h1 className="text-lg font-semibold text-slate-900">Authentication Required</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in with a verified session before accessing the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--navy-50)]">
      <Sidebar role={session.role} permissions={session.permissions} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={{ name: session.name, email: session.email, role: session.title }} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

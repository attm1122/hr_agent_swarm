import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { getSession } from '@/lib/auth/session';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSession();

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

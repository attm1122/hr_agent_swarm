/**
 * PageGuard
 * Server component that checks authorization before rendering page content.
 * Renders an access-denied message if the user lacks the required permission.
 */

import { getSession } from '@/lib/auth/session';
import { hasCapability } from '@/lib/auth/authorization';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';

interface PageGuardProps {
  requiredPermission: string;
  children: React.ReactNode;
}

export async function PageGuard({ requiredPermission, children }: PageGuardProps) {
  const session = await getSession();

  if (!session || !hasCapability(session.role, requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md border shadow-sm">
          <CardContent className="p-8 text-center">
            <ShieldX className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-sm text-slate-500">
              You do not have permission to view this page.
              Contact your administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * /assistant — alias for the AI-OS workspace.
 * Identical to /hr but reachable from the sidebar's "Assistant" entry.
 */

import { resolveIdentity } from '@/lib/ai-os';
import { composeHomeWorkspace } from '@/lib/ai-os/ui-composer/home';
import AssistantWorkspace from '@/components/assistant/AssistantWorkspace';
import DevRoleSwitcher from '@/components/assistant/DevRoleSwitcher';
import { getEmployeeById } from '@/lib/data/mock-data';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AssistantPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let userName: string | undefined;
  let userRole: string | undefined;
  let employeeId: string | undefined;
  try {
    const identity = await resolveIdentity();
    userName = identity.userName;
    userRole = identity.context.role;
    employeeId = identity.context.employeeId;
  } catch {
    // unauthenticated
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const overrideRole = typeof params.role === 'string' ? params.role : undefined;
    const overrideEmp = typeof params.employee === 'string' ? params.employee : undefined;
    if (overrideRole) userRole = overrideRole;
    if (overrideEmp) {
      employeeId = overrideEmp;
      const emp = getEmployeeById(overrideEmp);
      if (emp) userName = `${emp.firstName} ${emp.lastName}`;
    }
  }

  const home = await composeHomeWorkspace({ userName, userRole, employeeId });

  return (
    <>
      <AssistantWorkspace
        homeBlocks={home.blocks}
        homeHeadline={home.headline}
      />
      {isDev && <DevRoleSwitcher />}
    </>
  );
}

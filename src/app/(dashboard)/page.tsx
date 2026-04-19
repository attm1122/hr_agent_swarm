/**
 * / — The AI-native command center (default landing).
 *
 * A unified decision surface where identity, metrics, actions,
 * and workflows coexist in one adaptive layout — powered by AI orchestration.
 */

export const dynamic = 'force-dynamic';

import { resolveIdentity } from '@/lib/ai-os';
import { composeCommandWorkspace } from '@/lib/ai-os/ui-composer/command-workspace';
import CommandWorkspace from '@/components/workspace/CommandWorkspace';
import DevRoleSwitcher from '@/components/assistant/DevRoleSwitcher';
import { getEmployeeById } from '@/lib/data/mock-data';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: PageProps) {
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
    // unauthenticated — fallback handled below
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

  let data;
  try {
    data = await composeCommandWorkspace({ userName, userRole, employeeId });
  } catch (err) {
    console.error('[home] command workspace composition failed', err);
    data = {
      identity: {
        name: userName ?? 'Guest',
        role: 'employee',
        roleLabel: 'Employee view',
        avatarFallback: 'GU',
      },
      metrics: [],
      insights: [{
        id: 'error',
        title: 'Workspace temporarily unavailable',
        severity: 'warning' as const,
        narrative: 'Some features are loading slowly. Your AI assistant is still functional — type a request below.',
      }],
      timeline: [],
      workflows: [],
      aiSuggestions: ['What can you help me with?'],
    };
  }

  return (
    <>
      <CommandWorkspace data={data} />
      {isDev && <DevRoleSwitcher />}
    </>
  );
}

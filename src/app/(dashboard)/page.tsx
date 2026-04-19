/**
 * / — The AI-native workspace (default landing).
 *
 * Merged from /hr and /assistant.
 * Role-aware, intent-driven, dynamically composed.
 */

export const dynamic = 'force-dynamic';

import { resolveIdentity } from '@/lib/ai-os';
import type { ComposedWorkspace } from '@/lib/ai-os';
import { composeHomeWorkspace } from '@/lib/ai-os/ui-composer/home';
import AssistantWorkspace from '@/components/assistant/AssistantWorkspace';
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

  let home: ComposedWorkspace;
  try {
    home = await composeHomeWorkspace({ userName, userRole, employeeId });
  } catch (err) {
    console.error('[home] workspace composition failed', err);
    home = {
      intentId: 'home',
      mode: 'WORKSPACE',
      blocks: [],
      headline: 'Welcome — some features are temporarily unavailable.',
    };
  }

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

/**
 * IdentityAgent — thin wrapper over the existing session layer.
 *
 * Responsibility: turn a verified Session (or an auth request) into the AgentContext
 * the rest of the AI-OS pipeline consumes. Never build context from client input.
 */

import { getAgentContext, requireResolvedSession } from '@/lib/auth/session';
import type { AgentContext } from '@/types';

export interface IdentityResolution {
  context: AgentContext;
  userName: string;
  userEmail: string;
}

export async function resolveIdentity(): Promise<IdentityResolution> {
  const session = await requireResolvedSession();
  const context: AgentContext = {
    ...getAgentContext(session),
    tenantId: session.tenantId,
  };
  return {
    context,
    userName: session.name,
    userEmail: session.email,
  };
}

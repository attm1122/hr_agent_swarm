/**
 * NotificationAdapter — sends notifications and creates in-app shadow copies.
 *
 * Every notification is logged to console and also pushed into the in-memory
 * notification store so users can see them inside the workspace. Real
 * email / Slack / Teams delivery can be wired in a follow-up.
 */

import type { AgentContext } from '@/types';
import { addNotification } from '../../notifications';

export interface NotificationEnvelope {
  channel: 'email' | 'slack' | 'teams';
  subject: string;
  body: string;
  recipients: string[];
  metadata?: Record<string, unknown>;
}

export async function sendNotification(
  env: NotificationEnvelope,
  ctx: AgentContext,
): Promise<{ delivered: boolean; channel: string }> {
  // eslint-disable-next-line no-console
  console.log('[ai-os.notification]', {
    actor: ctx.userId,
    tenant: ctx.tenantId,
    ...env,
  });

  // Create an in-app shadow copy for each recipient so the notification
  // surfaces in the workspace regardless of the external channel.
  for (const recipientId of env.recipients) {
    addNotification({
      tenantId: ctx.tenantId ?? 'default',
      recipientId,
      senderId: ctx.userId,
      channel: 'in_app',
      priority: 'normal',
      title: env.subject,
      body: env.body,
      category: 'system',
      metadata: {
        originalChannel: env.channel,
        ...env.metadata,
      },
    });
  }

  return { delivered: true, channel: env.channel };
}

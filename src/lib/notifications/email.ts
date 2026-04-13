/**
 * Email delivery wrapper.
 *
 * Sends email via Microsoft Graph `/sendMail` using the configured shared
 * mailbox (NOTIFICATION_FROM_ADDRESS). Gracefully no-ops if Graph is not
 * configured yet — callers should check `isEmailConfigured()` before relying
 * on delivery in production code paths.
 */

import { sendMail } from '@/lib/graph/mail';
import { isGraphConfigured } from '@/lib/graph/client';

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  htmlBody: string;
  /** Override the default NOTIFICATION_FROM_ADDRESS. */
  from?: string;
}

export function isEmailConfigured(): boolean {
  return isGraphConfigured() && Boolean(process.env.NOTIFICATION_FROM_ADDRESS);
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Sends a transactional email. Returns `{ sent: false }` and logs a warning
 * if the mail subsystem is not configured — callers decide whether that's a
 * hard error.
 */
export async function sendEmail(
  message: EmailMessage,
): Promise<{ sent: boolean; reason?: string }> {
  const from = message.from ?? process.env.NOTIFICATION_FROM_ADDRESS;
  if (!from || !isGraphConfigured()) {
    // Avoid crashing in dev / unconfigured environments.
    console.warn(
      '[notifications] Skipping email: Graph or NOTIFICATION_FROM_ADDRESS not configured',
      { subject: message.subject, to: message.to },
    );
    return { sent: false, reason: 'not_configured' };
  }

  await sendMail({
    from,
    to: toArray(message.to),
    cc: toArray(message.cc),
    subject: message.subject,
    htmlBody: message.htmlBody,
  });

  return { sent: true };
}

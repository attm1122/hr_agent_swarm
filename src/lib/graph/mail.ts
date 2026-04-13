/**
 * Microsoft Graph — Mail.
 *
 * Sends transactional email from a shared mailbox (e.g. hr-notifications@leap.com.au)
 * using application permissions. The "from" address must be a real mailbox the
 * app has Mail.Send permission on (enforced in Azure via RBAC-for-applications
 * or Exchange ApplicationAccessPolicy).
 *
 * Requires application permission: Mail.Send.
 */

import { graphFetch } from './client';

export interface SendMailOptions {
  /** UPN or email address of the mailbox the message is sent from. */
  from: string;
  /** Recipient email addresses. */
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  /** HTML body. Plain text is not supported here — wrap in <p> if needed. */
  htmlBody: string;
  /**
   * If true, the message is saved to Sent Items in the `from` mailbox.
   * Defaults to false to avoid cluttering the shared mailbox.
   */
  saveToSentItems?: boolean;
}

/**
 * Sends a transactional email via Graph `/users/{from}/sendMail`.
 *
 * Fails hard on API errors so callers can decide whether to retry or swallow.
 * Prefer calling this from a notification queue/worker rather than inline
 * during a request handler — Graph can be slow (1-3s) under load.
 */
export async function sendMail(options: SendMailOptions): Promise<void> {
  const {
    from,
    to,
    cc = [],
    bcc = [],
    subject,
    htmlBody,
    saveToSentItems = false,
  } = options;

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
      bccRecipients: bcc.map((address) => ({ emailAddress: { address } })),
    },
    saveToSentItems,
  };

  await graphFetch(`/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    body: message,
  });
}

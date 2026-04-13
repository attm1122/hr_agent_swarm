/**
 * HTML email templates for HR notifications.
 *
 * Kept intentionally simple: inline CSS only, single-column layout, no
 * external images. Every template returns `{ subject, htmlBody }` so the
 * caller can pass it straight into `sendEmail()`.
 */

interface RenderedTemplate {
  subject: string;
  htmlBody: string;
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  color: #0f172a;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
`;

function layout(title: string, body: string): string {
  return `
    <!doctype html>
    <html>
      <body style="background:#f8fafc;margin:0;padding:24px 0;">
        <div style="${baseStyle}background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <h1 style="font-size:18px;margin:0 0 16px 0;color:#0f172a;">${title}</h1>
          ${body}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="font-size:12px;color:#64748b;margin:0;">
            Sent by LEAP HR. Replies to this message are not monitored.
          </p>
        </div>
      </body>
    </html>
  `;
}

// ----- Leave -----

export function leaveRequestedTemplate(args: {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  approverName: string;
  appUrl?: string;
}): RenderedTemplate {
  const { employeeName, leaveType, startDate, endDate, days, approverName, appUrl } =
    args;
  return {
    subject: `Leave request from ${employeeName} — action required`,
    htmlBody: layout(
      `New leave request awaiting your approval`,
      `
        <p>Hi ${escape(approverName)},</p>
        <p><strong>${escape(employeeName)}</strong> has submitted a leave request:</p>
        <ul>
          <li><strong>Type:</strong> ${escape(leaveType)}</li>
          <li><strong>Dates:</strong> ${escape(startDate)} → ${escape(endDate)} (${days} day${days === 1 ? '' : 's'})</li>
        </ul>
        ${
          appUrl
            ? `<p><a href="${appUrl}/approvals" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Review in LEAP HR</a></p>`
            : ''
        }
      `,
    ),
  };
}

export function leaveApprovedTemplate(args: {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  approverName: string;
}): RenderedTemplate {
  const { employeeName, leaveType, startDate, endDate, days, approverName } = args;
  return {
    subject: `Your ${leaveType} leave has been approved`,
    htmlBody: layout(
      `Leave approved`,
      `
        <p>Hi ${escape(employeeName)},</p>
        <p>Your leave request has been approved by ${escape(approverName)}.</p>
        <ul>
          <li><strong>Type:</strong> ${escape(leaveType)}</li>
          <li><strong>Dates:</strong> ${escape(startDate)} → ${escape(endDate)} (${days} day${days === 1 ? '' : 's'})</li>
        </ul>
        <p>Please ensure your calendar and handover notes are up to date before your leave begins.</p>
      `,
    ),
  };
}

// ----- Onboarding -----

export function onboardingTaskAssignedTemplate(args: {
  assigneeName: string;
  taskName: string;
  employeeName: string;
  dueDate: string;
  appUrl?: string;
}): RenderedTemplate {
  return {
    subject: `Onboarding task for ${args.employeeName}: ${args.taskName}`,
    htmlBody: layout(
      `New onboarding task`,
      `
        <p>Hi ${escape(args.assigneeName)},</p>
        <p>You've been assigned an onboarding task for <strong>${escape(args.employeeName)}</strong>.</p>
        <ul>
          <li><strong>Task:</strong> ${escape(args.taskName)}</li>
          <li><strong>Due:</strong> ${escape(args.dueDate)}</li>
        </ul>
        ${
          args.appUrl
            ? `<p><a href="${args.appUrl}/onboarding" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Open onboarding plan</a></p>`
            : ''
        }
      `,
    ),
  };
}

// ----- Workflow -----

export function workflowStepAssignedTemplate(args: {
  approverName: string;
  workflowTitle: string;
  requesterName: string;
  stepNumber: number;
  appUrl?: string;
}): RenderedTemplate {
  return {
    subject: `Approval needed: ${args.workflowTitle}`,
    htmlBody: layout(
      `Approval step ${args.stepNumber} — action required`,
      `
        <p>Hi ${escape(args.approverName)},</p>
        <p><strong>${escape(args.requesterName)}</strong> is waiting on your approval for:</p>
        <p style="font-size:16px;"><em>${escape(args.workflowTitle)}</em></p>
        ${
          args.appUrl
            ? `<p><a href="${args.appUrl}/approvals" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Review now</a></p>`
            : ''
        }
      `,
    ),
  };
}

// ----- Document / Milestone -----

export function documentExpiringTemplate(args: {
  employeeName: string;
  documentType: string;
  expiresAt: string;
  appUrl?: string;
}): RenderedTemplate {
  return {
    subject: `Document expiring soon: ${args.documentType}`,
    htmlBody: layout(
      `Document expiring`,
      `
        <p>Hi ${escape(args.employeeName)},</p>
        <p>Your <strong>${escape(args.documentType)}</strong> expires on <strong>${escape(args.expiresAt)}</strong>.</p>
        <p>Please upload an updated copy in LEAP HR before the expiry date to stay compliant.</p>
        ${
          args.appUrl
            ? `<p><a href="${args.appUrl}/compliance" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Upload document</a></p>`
            : ''
        }
      `,
    ),
  };
}

// ----- helpers -----

function escape(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

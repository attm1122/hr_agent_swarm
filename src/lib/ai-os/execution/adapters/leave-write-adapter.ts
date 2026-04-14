/**
 * Leave-write adapter — approves or rejects a leave request through the
 * AI-OS executor, so the action buttons on signal cards actually work.
 *
 * Validation:
 *   1. The leave request must exist and be in `pending` status.
 *   2. The actor must have `leave:approve` capability.
 *   3. The actor must not approve their own request (separation of duties).
 *
 * Side-effect: mutates the leave store (in-memory mock or Supabase).
 * Returns before/after for the ConfirmationCard.
 */

import type { AgentContext } from '@/types';
import type { Intent } from '../../intent/types';
import { getLeaveStore } from '@/lib/data/leave-store';
import { hasCapability } from '@/lib/auth/authorization';

export class LeaveWriteError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LeaveWriteError';
    this.code = code;
  }
}

export interface LeaveWriteResult {
  leaveRequestId: string;
  action: 'approved' | 'rejected';
  before: { status: string };
  after: { status: string; approvedBy: string | null; approvedAt: string | null };
  employeeName?: string;
  leaveType?: string;
  daysRequested?: number;
}

/**
 * Extract a leave request ID from raw input.
 * Handles patterns like: "Approve leave request lr-001", "Reject LR-002",
 * "approve 00000000-0000-0000-0004-000000000001"
 */
function extractLeaveRequestId(rawInput: string): string | null {
  // UUID pattern
  const uuidMatch = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(rawInput);
  if (uuidMatch) return uuidMatch[0];
  // lr-NNN pattern
  const lrMatch = /\b(lr-\d+)\b/i.exec(rawInput);
  if (lrMatch) return lrMatch[1].toLowerCase();
  return null;
}

function extractAction(intent: Intent): 'approved' | 'rejected' | null {
  const raw = intent.rawInput.toLowerCase();
  if (raw.includes('reject')) return 'rejected';
  if (raw.includes('approv')) return 'approved';
  // Fall back to action type from intent
  if (intent.action === 'TRIGGER') {
    if (raw.includes('reject')) return 'rejected';
    return 'approved';
  }
  return null;
}

export async function executeLeaveDecision(
  intent: Intent,
  ctx: AgentContext,
): Promise<LeaveWriteResult> {
  // 1. Capability gate
  if (!hasCapability(ctx.role, 'leave:approve')) {
    throw new LeaveWriteError(
      'INSUFFICIENT_PERMISSION',
      `Role '${ctx.role}' does not have leave:approve capability.`,
    );
  }

  // 2. Extract IDs
  const leaveRequestId = extractLeaveRequestId(intent.rawInput);
  if (!leaveRequestId) {
    throw new LeaveWriteError(
      'MISSING_ID',
      'Could not determine which leave request to act on from the input.',
    );
  }

  const action = extractAction(intent);
  if (!action) {
    throw new LeaveWriteError(
      'AMBIGUOUS_ACTION',
      'Could not determine whether to approve or reject.',
    );
  }

  // 3. Fetch the request
  const store = getLeaveStore();
  const tenantId = ctx.tenantId ?? 'default';
  const existing = await store.findRequestById(leaveRequestId, tenantId);
  if (!existing) {
    throw new LeaveWriteError(
      'NOT_FOUND',
      `Leave request '${leaveRequestId}' not found.`,
    );
  }

  if (existing.status !== 'pending') {
    throw new LeaveWriteError(
      'ALREADY_ACTIONED',
      `Leave request '${leaveRequestId}' is already '${existing.status}' — cannot ${action === 'approved' ? 'approve' : 'reject'} again.`,
    );
  }

  // 4. Separation of duties
  if (existing.employeeId === ctx.employeeId) {
    throw new LeaveWriteError(
      'SELF_APPROVAL',
      'You cannot approve or reject your own leave request.',
    );
  }

  // 5. Execute
  const updated = await store.updateRequestStatus(
    leaveRequestId,
    action,
    ctx.employeeId ?? null,
    tenantId,
  );

  if (!updated) {
    throw new LeaveWriteError(
      'UPDATE_FAILED',
      'Leave store returned null — the request may have been modified concurrently.',
    );
  }

  return {
    leaveRequestId,
    action,
    before: { status: existing.status },
    after: {
      status: updated.status,
      approvedBy: updated.approvedBy,
      approvedAt: updated.approvedAt,
    },
    leaveType: existing.leaveType,
    daysRequested: existing.daysRequested,
  };
}

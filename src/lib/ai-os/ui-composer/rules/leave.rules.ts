/**
 * Composer rules for leave approval / rejection outcomes.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../../intent/types';
import type { DecisionTrace } from '../../decision/types';
import type { ExecutionResult } from '../../execution/types';
import type { UIBlock } from '../types';

export function composeLeaveDecision(
  _intent: Intent,
  _decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  const d = result.data as {
    kind: string;
    leaveRequestId: string;
    action: 'approved' | 'rejected';
    before: { status: string };
    after: { status: string; approvedBy: string | null; approvedAt: string | null };
    leaveType?: string;
    daysRequested?: number;
  };

  if (result.error) {
    return [
      {
        id: randomUUID(),
        kind: 'RiskBanner',
        severity: 'medium',
        title: 'Leave decision failed',
        message: result.error.message,
      },
    ];
  }

  const isApproval = d.action === 'approved';
  const blocks: UIBlock[] = [];

  blocks.push({
    id: randomUUID(),
    kind: 'ConfirmationCard',
    title: isApproval
      ? `Leave request approved`
      : `Leave request rejected`,
    message: `${d.leaveType ?? 'Leave'} request (${d.daysRequested ?? '?'} days) has been ${d.action}.`,
    tone: isApproval ? 'positive' : 'neutral',
    timestamp: new Date().toISOString(),
    before: { status: d.before.status },
    after: {
      status: d.after.status,
      ...(d.after.approvedBy ? { approvedBy: d.after.approvedBy } : {}),
      ...(d.after.approvedAt ? { approvedAt: d.after.approvedAt } : {}),
    },
    changedFields: [
      'status',
      ...(d.after.approvedBy ? ['approvedBy'] : []),
      ...(d.after.approvedAt ? ['approvedAt'] : []),
    ],
  });

  blocks.push({
    id: randomUUID(),
    kind: 'ActionBar',
    actions: [
      {
        id: 'back-to-queue',
        label: 'Back to team actions',
        variant: 'secondary',
        intent: { rawInput: 'Show me my team this week' },
      },
      {
        id: 'view-leave',
        label: 'View all leave requests',
        variant: 'ghost',
        intent: { rawInput: 'Show me all pending leave requests for my team' },
      },
    ],
  });

  return blocks;
}

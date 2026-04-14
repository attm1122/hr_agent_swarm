/**
 * Employee Home — personal, self-service, low-stakes surface.
 *
 * What the employee must see at a glance:
 *   - Who they are / a hello.
 *   - "My actions" — their own projected signals (onboarding, leave balance,
 *     update details nudge).
 *   - Their pending leave requests (if any).
 *   - Quick-action bar for common flows.
 *
 * No team metrics. No org-wide HR risk. No reports on other people.
 */

import { randomUUID } from 'node:crypto';
import type { Employee, LeaveRequest } from '@/types';
import type { ComposedWorkspace, UIBlock } from './types';
import type { ProjectedSignalSet } from '../signals/types';
import {
  HOME_MODE,
  signalsToRecommendationPanel,
  buildActionBar,
  fmtDate,
} from './home-helpers';

export interface EmployeeHomeInputs {
  userName?: string;
  employee?: Employee;
  projection: ProjectedSignalSet;
  myPendingLeave: LeaveRequest[];
  leaveBalanceDays?: number;
  onboardingOpen: boolean;
}

export function composeEmployeeHome(inputs: EmployeeHomeInputs): ComposedWorkspace {
  const { userName, projection, myPendingLeave, leaveBalanceDays, onboardingOpen } = inputs;
  const blocks: UIBlock[] = [];

  const firstName = userName?.split(' ')[0] ?? 'there';

  blocks.push({
    id: randomUUID(),
    kind: 'SummaryCard',
    title: `Good day, ${firstName}`,
    body:
      'Your personal workspace. Ask anything in plain English — or use the actions below to resolve what matters most right now.',
    tone: 'neutral',
    icon: 'Sparkles',
    metrics: [
      {
        label: 'Annual leave remaining',
        value:
          typeof leaveBalanceDays === 'number' ? `${leaveBalanceDays} days` : '—',
      },
      { label: 'Pending requests', value: myPendingLeave.length },
      { label: 'Actions for you', value: projection.visible.length },
      {
        label: 'Onboarding',
        value: onboardingOpen ? 'In progress' : 'Complete',
      },
    ],
  });

  if (projection.visible.length > 0) {
    blocks.push(signalsToRecommendationPanel('Your actions', projection.visible, 5));
  }

  if (myPendingLeave.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Your pending leave requests',
      description: 'Awaiting manager decision.',
      columns: [
        { key: 'type', label: 'Type' },
        { key: 'start', label: 'Start', format: 'date' },
        { key: 'end', label: 'End', format: 'date' },
        { key: 'days', label: 'Days', align: 'right', format: 'number' },
        { key: 'submitted', label: 'Submitted', format: 'date' },
      ],
      rows: myPendingLeave.map((r) => ({
        type: r.leaveType,
        start: fmtDate(r.startDate),
        end: fmtDate(r.endDate),
        days: r.daysRequested,
        submitted: fmtDate(r.createdAt),
      })),
      rowCount: myPendingLeave.length,
    });
  }

  blocks.push(
    buildActionBar([
      {
        id: 'update-address',
        label: 'Update my address',
        variant: 'primary',
        intent: { rawInput: 'Update my address' },
      },
      {
        id: 'apply-leave',
        label: 'Request leave',
        variant: 'secondary',
        intent: { rawInput: 'I want to take annual leave next month' },
      },
      {
        id: 'my-balance',
        label: 'Leave balance',
        variant: 'secondary',
        intent: { rawInput: 'How much annual and sick leave do I have left?' },
      },
      {
        id: 'my-details',
        label: 'My details',
        variant: 'ghost',
        intent: { rawInput: 'Show me my personal details on file.' },
      },
    ]),
  );

  return {
    intentId: 'home.employee',
    mode: HOME_MODE,
    blocks,
    headline: 'Your workspace',
  };
}

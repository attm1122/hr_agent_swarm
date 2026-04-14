/**
 * Manager Home — team-scoped, decision-oriented surface.
 *
 * What a manager needs to see first:
 *   - Team size + headline queue counts.
 *   - **Team action queue** (projected signals about their reports: probation
 *     reviews due, pending leave, onboarding in progress).
 *   - One structured **recommendation card** with explicit next-step actions
 *     (the highest-severity signal becomes the hero).
 *   - Team leave balances table (context, not ambient alert).
 *
 * No org-wide compliance. No other teams' data.
 */

import { randomUUID } from 'node:crypto';
import type { Employee, LeaveRequest } from '@/types';
import type { ComposedWorkspace, UIBlock, RiskBannerBlock } from './types';
import type { ProjectedSignalSet, RiskSignal } from '../signals/types';
import {
  HOME_MODE,
  signalsToRecommendationPanel,
  buildActionBar,
  actionOptionToUIAction,
  fmtDate,
} from './home-helpers';

export interface ManagerHomeInputs {
  userName?: string;
  manager?: Employee;
  teamMembers: Employee[];
  teamPendingLeave: LeaveRequest[];
  teamBalances: Array<{ employee: Employee; annualRemaining: number | null }>;
  projection: ProjectedSignalSet;
}

function buildHeroRecommendation(signal: RiskSignal): RiskBannerBlock {
  return {
    id: randomUUID(),
    kind: 'RiskBanner',
    severity:
      signal.severity === 'critical' || signal.severity === 'high'
        ? 'high'
        : signal.severity === 'medium'
          ? 'medium'
          : 'low',
    title: signal.title,
    message: `${signal.summary} — ${signal.recommendation}`,
    references: [
      ...signal.policy_basis.map((p) => ({
        label: `${p.title}${p.clauseRef ? ` (${p.clauseRef})` : ''}`,
      })),
      ...signal.legal_basis.map((l) => ({
        label: `${l.statute} — ${l.jurisdiction}`,
      })),
    ],
    actions: signal.action_options.slice(0, 3).map(actionOptionToUIAction),
    meta: { intent: 'signals.hero' },
  };
}

export function composeManagerHome(inputs: ManagerHomeInputs): ComposedWorkspace {
  const { userName, teamMembers, teamPendingLeave, teamBalances, projection } = inputs;
  const blocks: UIBlock[] = [];
  const firstName = userName?.split(' ')[0] ?? 'Manager';

  const highPrio = projection.visible.filter(
    (s) => s.severity === 'critical' || s.severity === 'high',
  );
  const reviewsDue = projection.visible.filter(
    (s) => s.kind === 'probation_review_due',
  );

  blocks.push({
    id: randomUUID(),
    kind: 'SummaryCard',
    title: `${firstName}'s team workspace`,
    body:
      'Where your decisions live. The assistant surfaces the next-step actions on your team; resolve them here, escalate what needs escalation.',
    tone: highPrio.length > 0 ? 'warning' : 'neutral',
    icon: 'Users',
    metrics: [
      { label: 'Direct reports', value: teamMembers.length },
      { label: 'Leave to decide', value: teamPendingLeave.length },
      { label: 'Reviews due', value: reviewsDue.length },
      { label: 'High-priority signals', value: highPrio.length },
    ],
  });

  // Hero recommendation: the single most important signal right now.
  const hero = highPrio[0] ?? projection.visible[0];
  if (hero) {
    blocks.push(buildHeroRecommendation(hero));
  }

  // Team action queue — everything else.
  const rest = projection.visible.filter((s) => s.id !== hero?.id);
  if (rest.length > 0) {
    blocks.push(signalsToRecommendationPanel('Team action queue', rest, 6));
  }

  if (teamBalances.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Team leave balances',
      description: 'Annual leave remaining per direct report.',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'annual', label: 'Annual days', align: 'right', format: 'number' },
        { key: 'flag', label: 'Flag' },
      ],
      rows: teamBalances.map(({ employee, annualRemaining }) => ({
        employee: `${employee.firstName} ${employee.lastName}`,
        annual: annualRemaining ?? null,
        flag:
          typeof annualRemaining === 'number' && annualRemaining >= 25
            ? 'High balance'
            : typeof annualRemaining === 'number' && annualRemaining <= 2
              ? 'Low balance'
              : 'OK',
      })),
      rowCount: teamBalances.length,
    });
  }

  if (teamPendingLeave.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Leave awaiting your decision',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Type' },
        { key: 'start', label: 'Start', format: 'date' },
        { key: 'end', label: 'End', format: 'date' },
        { key: 'days', label: 'Days', align: 'right', format: 'number' },
      ],
      rows: teamPendingLeave.map((r) => {
        const emp = teamMembers.find((m) => m.id === r.employeeId);
        return {
          employee: emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId,
          type: r.leaveType,
          start: fmtDate(r.startDate),
          end: fmtDate(r.endDate),
          days: r.daysRequested,
        };
      }),
      rowCount: teamPendingLeave.length,
    });
  }

  blocks.push(
    buildActionBar([
      {
        id: 'team-summary',
        label: 'Summarise my team this week',
        variant: 'primary',
        intent: { rawInput: 'Summarise my team this week.' },
      },
      {
        id: 'upcoming-reviews',
        label: 'Reviews due next 30 days',
        variant: 'secondary',
        intent: {
          rawInput: 'Which of my team have performance or probation reviews due in the next 30 days?',
        },
      },
      {
        id: 'team-leave',
        label: 'Team leave next month',
        variant: 'secondary',
        intent: { rawInput: 'Who on my team is on leave next month?' },
      },
    ]),
  );

  return {
    intentId: 'home.manager',
    mode: HOME_MODE,
    blocks,
    headline: 'Your team workspace',
  };
}

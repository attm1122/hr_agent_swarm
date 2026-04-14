/**
 * HR Home — org-wide, governance-oriented surface.
 *
 * What HR needs to see first:
 *   - Organisation health metrics.
 *   - **Org action queue** — high-severity signals across the company.
 *   - **Compliance / documentation gap signal** (if present) as a RiskBanner.
 *   - Upcoming people-lifecycle events (probations, anniversaries, visas) as a table.
 *   - Primary escalation entry points.
 */

import { randomUUID } from 'node:crypto';
import type { Employee, Milestone } from '@/types';
import type { ComposedWorkspace, UIBlock, RiskBannerBlock } from './types';
import type { ProjectedSignalSet } from '../signals/types';
import {
  HOME_MODE,
  signalsToRecommendationPanel,
  buildActionBar,
  actionOptionToUIAction,
  fmtDate,
} from './home-helpers';

export interface HrHomeInputs {
  userName?: string;
  activeEmployees: number;
  pendingApprovals: number;
  openEscalations: number;
  docsExpiring: number;
  upcomingMilestones: Milestone[];
  employees: Employee[];
  projection: ProjectedSignalSet;
}

export function composeHrHome(inputs: HrHomeInputs): ComposedWorkspace {
  const {
    userName,
    activeEmployees,
    pendingApprovals,
    openEscalations,
    docsExpiring,
    upcomingMilestones,
    employees,
    projection,
  } = inputs;
  const blocks: UIBlock[] = [];
  const firstName = userName?.split(' ')[0] ?? 'HR';

  const criticalSignals = projection.visible.filter((s) => s.severity === 'critical');
  const highSignals = projection.visible.filter((s) => s.severity === 'high');
  const complianceGap = projection.visible.find((s) => s.kind === 'compliance_gap');
  const visaSignals = projection.visible.filter((s) => s.kind === 'visa_expiry_soon');

  blocks.push({
    id: randomUUID(),
    kind: 'SummaryCard',
    title: `${firstName}'s governance workspace`,
    body:
      'Organisation-wide risks, decisions, and compliance. Every signal here carries a policy and/or legal anchor so decisions are defensible end-to-end.',
    tone:
      criticalSignals.length > 0 ? 'danger' : highSignals.length > 0 ? 'warning' : 'neutral',
    icon: 'ShieldCheck',
    metrics: [
      { label: 'Active employees', value: activeEmployees },
      { label: 'Pending approvals', value: pendingApprovals },
      { label: 'Open escalations', value: openEscalations },
      { label: 'Docs expiring', value: docsExpiring },
    ],
  });

  // Compliance gap hero.
  if (complianceGap) {
    const banner: RiskBannerBlock = {
      id: randomUUID(),
      kind: 'RiskBanner',
      severity:
        complianceGap.severity === 'critical' || complianceGap.severity === 'high'
          ? 'high'
          : 'medium',
      title: complianceGap.title,
      message: `${complianceGap.summary} — ${complianceGap.recommendation}`,
      references: [
        ...complianceGap.policy_basis.map((p) => ({
          label: `${p.title}${p.clauseRef ? ` (${p.clauseRef})` : ''}`,
        })),
        ...complianceGap.legal_basis.map((l) => ({
          label: `${l.statute} — ${l.jurisdiction}`,
        })),
      ],
      actions: complianceGap.action_options.slice(0, 3).map(actionOptionToUIAction),
      meta: { intent: 'signals.compliance' },
    };
    blocks.push(banner);
  }

  // Visa + probation roll-up — critical, highest-level defensibility.
  const hotList = [...criticalSignals, ...highSignals].filter(
    (s) => s.kind !== 'compliance_gap',
  );
  if (hotList.length > 0) {
    blocks.push(signalsToRecommendationPanel('Org action queue', hotList, 8));
  }

  // Upcoming lifecycle events table.
  if (upcomingMilestones.length > 0) {
    blocks.push({
      id: randomUUID(),
      kind: 'Table',
      title: 'Upcoming lifecycle events',
      description: 'Probation endings, anniversaries, visa renewals — next 90 days.',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'event', label: 'Event' },
        { key: 'date', label: 'Date', format: 'date' },
      ],
      rows: upcomingMilestones.slice(0, 10).map((m) => {
        const emp = employees.find((e) => e.id === m.employeeId);
        return {
          employee: emp ? `${emp.firstName} ${emp.lastName}` : m.employeeId,
          event: m.description ?? m.milestoneType,
          date: fmtDate(m.milestoneDate),
        };
      }),
      rowCount: upcomingMilestones.length,
    });
  }

  if (visaSignals.length > 0) {
    const hero = visaSignals[0];
    blocks.push({
      id: randomUUID(),
      kind: 'ApprovalPanel',
      title: `Work authority — escalation candidate`,
      requiredApprovers: ['HR', 'Legal'],
      reason: `${hero.title}: ${hero.summary}. ${hero.recommendation}`,
      riskLevel: 'high',
      actions: hero.action_options.slice(0, 2).map(actionOptionToUIAction),
      meta: { intent: 'signals.visa.escalation' },
    });
  }

  blocks.push(
    buildActionBar([
      {
        id: 'org-overview',
        label: 'Summarise org-wide risk',
        variant: 'primary',
        intent: {
          rawInput: 'Summarise the current org-wide HR risk picture with cited policies.',
        },
      },
      {
        id: 'anniversaries-sheet',
        label: 'Anniversaries next month (XLSX)',
        variant: 'secondary',
        intent: {
          rawInput: 'What anniversaries are coming up next month? Send me a sheet.',
        },
      },
      {
        id: 'probation-terminations',
        label: 'Probation terminations — what do I need?',
        variant: 'secondary',
        intent: {
          rawInput: 'Can I terminate a probation employee? Walk me through the requirements.',
        },
      },
    ]),
  );

  return {
    intentId: 'home.hr',
    mode: HOME_MODE,
    blocks,
    headline: 'Organisation workspace',
  };
}

/**
 * AI-OS Risk Policy.
 *
 * Declarative table mapping (action, entity) → base risk + escalating rules.
 * This is the single place operators can tune what counts as risky.
 *
 * NON-NEGOTIABLE: Every high-risk decision must cite at least one rule id.
 * The DecisionTrace carries these ids for audit.
 */

import type { Intent } from '../intent/types';
import type { AgentContext } from '@/types';
import type { RiskLevel, RiskScore } from './types';

interface RiskRule {
  id: string;
  /** Human-readable description. Appears in DecisionTrace.risk.reasons. */
  description: string;
  /**
   * Returns the level if the rule matches, or null if it doesn't apply.
   * Rules are evaluated in order; the highest level wins.
   */
  evaluate: (intent: Intent, ctx: AgentContext) => RiskLevel | null;
}

const LEVEL_ORDER: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

/** Base risk for an (action, entity) pair before rules fire. */
function baseRisk(intent: Intent): RiskLevel {
  const { action, entity } = intent;

  // READ + ANALYZE are low by default; the data layer (RBAC + sensitivity
  // stripping) is the real gate for reads.
  if (action === 'READ' || action === 'ANALYZE') return 'low';

  // RECOMMEND is advisory — low unless a rule escalates.
  if (action === 'RECOMMEND') return 'low';

  // CREATE/UPDATE/TRIGGER/ESCALATE default to medium.
  if (action === 'CREATE' || action === 'UPDATE' || action === 'TRIGGER') {
    // Self-address update is explicitly low — see R-UPDATE-ADDRESS-SELF.
    if (entity === 'address' && intent.target.scope === 'self') return 'low';
    // Terminations/compensation changes escalate via rules below.
    return 'medium';
  }

  if (action === 'ESCALATE') return 'medium';

  return 'medium';
}

/** The rules table. Add, edit, remove — everything is audited. */
export const RISK_RULES: RiskRule[] = [
  {
    id: 'R-UPDATE-ADDRESS-SELF',
    description: 'Self address updates are low risk — employees own their address.',
    evaluate: (intent) =>
      intent.action === 'UPDATE' &&
      intent.entity === 'address' &&
      intent.target.scope === 'self'
        ? 'low'
        : null,
  },
  {
    id: 'R-TERMINATION-PROBATION',
    description:
      'Terminating an employee on probation triggers Fair Work scrutiny — always escalate.',
    evaluate: (intent) => {
      const raw = intent.rawInput.toLowerCase();
      const mentionsTermination =
        raw.includes('terminat') ||
        raw.includes('dismiss') ||
        raw.includes('fire ');
      const mentionsProbation =
        raw.includes('probation') || intent.filters?.onProbation === true;
      return mentionsTermination && mentionsProbation ? 'high' : null;
    },
  },
  {
    id: 'R-TERMINATION-ANY',
    description: 'Any termination-adjacent RECOMMEND or TRIGGER is high risk.',
    evaluate: (intent) => {
      const raw = intent.rawInput.toLowerCase();
      const mentionsTermination =
        raw.includes('terminat') ||
        raw.includes('dismiss') ||
        raw.includes('fire ') ||
        raw.includes('let go');
      if (!mentionsTermination) return null;
      if (intent.action === 'RECOMMEND' || intent.action === 'TRIGGER')
        return 'high';
      return null;
    },
  },
  {
    id: 'R-COMPENSATION-CHANGE',
    description: 'Compensation changes always require approval.',
    evaluate: (intent) =>
      intent.entity === 'compensation' &&
      (intent.action === 'UPDATE' || intent.action === 'CREATE')
        ? 'high'
        : null,
  },
  {
    id: 'R-EXPORT-PAY-SENSITIVE',
    description:
      'Bulk exports including pay-sensitive fields escalate regardless of role scope.',
    evaluate: (intent) => {
      if (intent.outputFormat !== 'spreadsheet') return null;
      const fields = (intent.fields ?? []).map((f) => f.toLowerCase());
      const hasPay = fields.some((f) =>
        ['salary', 'compensation', 'bonus', 'tax', 'bank'].some((p) =>
          f.includes(p),
        ),
      );
      return hasPay ? 'high' : null;
    },
  },
  {
    id: 'R-ORG-WIDE-WRITE',
    description: 'Any write operation with org-wide scope is high risk.',
    evaluate: (intent) => {
      const write = ['UPDATE', 'CREATE', 'TRIGGER'].includes(intent.action);
      return write && intent.target.scope === 'org' ? 'high' : null;
    },
  },
  {
    id: 'R-WORKFLOW-APPROVE-OR-REJECT',
    description:
      'Explicitly approving or rejecting a workflow triggers a recorded decision — medium baseline.',
    evaluate: (intent) => {
      const raw = intent.rawInput.toLowerCase();
      const isApproveReject =
        raw.includes('approve') ||
        raw.includes('reject') ||
        raw.includes('deny');
      return intent.entity === 'workflow' && isApproveReject ? 'medium' : null;
    },
  },
  {
    id: 'R-LOW-CONFIDENCE',
    description:
      'Interpreter confidence below 0.6 — route to workspace for confirmation.',
    evaluate: (intent) => (intent.confidence < 0.6 ? 'medium' : null),
  },
];

export function computeRiskScore(
  intent: Intent,
  ctx: AgentContext,
): RiskScore {
  const hits: Array<{ id: string; level: RiskLevel; description: string }> = [];

  const base = baseRisk(intent);
  hits.push({
    id: 'R-BASE',
    level: base,
    description: `base risk for ${intent.action} ${intent.entity}`,
  });

  for (const rule of RISK_RULES) {
    const result = rule.evaluate(intent, ctx);
    if (result) {
      hits.push({ id: rule.id, level: result, description: rule.description });
    }
  }

  const maxLevel = hits.reduce<RiskLevel>((acc, h) => {
    return LEVEL_ORDER[h.level] > LEVEL_ORDER[acc] ? h.level : acc;
  }, 'low');

  return {
    value: maxLevel,
    reasons: hits
      .filter((h) => h.level === maxLevel)
      .map((h) => h.description),
    policyRefs: hits.filter((h) => h.level === maxLevel).map((h) => h.id),
  };
}

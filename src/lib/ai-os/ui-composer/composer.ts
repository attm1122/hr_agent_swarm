/**
 * UIComposer — deterministic dispatcher.
 *
 * Given an Intent + DecisionTrace + ExecutionResult, returns a validated
 * UIBlock[] ready to stream to the client. Falls back to a safe narrative
 * summary if no specialised rule matches.
 *
 * Every block returned is parsed through UIBlockSchema so malformed outputs
 * fail loud in server logs rather than breaking the client.
 */

import { randomUUID } from 'node:crypto';
import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { ExecutionResult } from '../execution/types';
import type { UIBlock, ComposedWorkspace } from './types';
import { UIBlockSchema } from './schemas';

import {
  composeAddressUpdate,
  composeEmployeeRead,
  composeEmployeeDetail,
} from './rules/records.rules';
import { composeMilestonesWorkspace } from './rules/milestones.rules';
import { composeEscalation } from './rules/workflow.rules';
import { composePolicyAnswer, composeLeaveRead } from './rules/policy.rules';
import { composeLeaveDecision } from './rules/leave.rules';

export interface ComposeOptions {
  /** When true, validate every block with Zod and drop invalid ones. Default: true. */
  strict?: boolean;
}

export function compose(
  intent: Intent,
  decision: DecisionTrace,
  result: ExecutionResult,
  opts: ComposeOptions = {},
): ComposedWorkspace {
  const strict = opts.strict ?? true;
  let blocks: UIBlock[] = [];
  let headline: string | undefined;

  // ESCALATE always wins over entity rules — it's a safety route.
  if (decision.mode === 'ESCALATE') {
    blocks = composeEscalation(intent, decision, result);
    headline = 'Escalated for review — see risk banner below.';
  } else if (
    intent.action === 'UPDATE' &&
    intent.entity === 'address' &&
    intent.target.scope === 'self'
  ) {
    blocks = composeAddressUpdate(intent, decision, result);
    headline = result.error ? 'Address update needs attention' : 'Address updated';
  } else if (
    intent.entity === 'milestone' &&
    intent.outputFormat === 'spreadsheet'
  ) {
    blocks = composeMilestonesWorkspace(intent, decision, result);
    headline = 'Anniversaries compiled';
  } else if (intent.entity === 'policy') {
    blocks = composePolicyAnswer(intent, result);
    headline = 'Policy answer';
  } else if (
    intent.entity === 'leave' &&
    (intent.action === 'TRIGGER' || intent.action === 'UPDATE') &&
    result.data?.kind === 'leave_decision'
  ) {
    blocks = composeLeaveDecision(intent, decision, result);
    headline = result.data?.action === 'approved' ? 'Leave approved' : 'Leave rejected';
  } else if (intent.entity === 'leave') {
    blocks = composeLeaveRead(intent, result);
  } else if (
    intent.entity === 'employee' &&
    intent.action === 'READ' &&
    intent.target.scope === 'specific' &&
    intent.target.subjectId
  ) {
    // Specific employee lookup — use the rich detail composer.
    blocks = composeEmployeeDetail(intent.target.subjectId);
    const nameBlock = blocks.find((b) => b.kind === 'SummaryCard');
    headline = nameBlock && 'title' in nameBlock ? String(nameBlock.title) : 'Employee profile';
  } else if (intent.entity === 'employee' && intent.action === 'READ') {
    blocks = composeEmployeeRead(intent, decision, result);
  } else {
    blocks = composeFallback(intent, decision, result);
  }

  if (result.error && blocks.length === 0) {
    blocks = [
      {
        id: randomUUID(),
        kind: 'RiskBanner',
        severity: 'medium',
        title: 'Request failed',
        message: result.error.message,
      },
    ];
  }

  if (strict) {
    blocks = blocks
      .map((b) => {
        const parsed = UIBlockSchema.safeParse(b);
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error('[ui-composer] dropped invalid block', {
            kind: b.kind,
            issues: parsed.error.issues,
          });
          return null;
        }
        return parsed.data as UIBlock;
      })
      .filter((b): b is UIBlock => b !== null);
  }

  return {
    intentId: intent.id,
    mode: decision.mode,
    blocks,
    headline,
  };
}

function composeFallback(
  intent: Intent,
  decision: DecisionTrace,
  result: ExecutionResult,
): UIBlock[] {
  const responses = result.swarmResponses;
  if (responses.length === 0) {
    return [
      {
        id: randomUUID(),
        kind: 'RecommendationPanel',
        title: "I need a little more to go on",
        recommendations:
          intent.clarificationsNeeded?.map((q, i) => ({
            id: `clarify-${i}`,
            title: q,
            severity: 'info' as const,
          })) ?? [
            {
              id: 'rephrase',
              title: 'Try rephrasing the request',
              detail: intent.rationale,
              severity: 'info',
            },
          ],
      },
    ];
  }

  // Generic narrative summary from the first response.
  const first = responses[0];
  return [
    {
      id: randomUUID(),
      kind: 'SummaryCard',
      title: first.intent.replace(/_/g, ' '),
      body: first.result.summary,
      tone: 'neutral',
      metrics: [
        {
          label: 'Confidence',
          value: first.result.confidence?.toFixed(2) ?? '—',
        },
        { label: 'Risk', value: decision.risk.value },
      ],
    },
  ];
}

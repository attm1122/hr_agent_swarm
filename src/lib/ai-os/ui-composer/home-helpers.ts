/**
 * Shared helpers for the role-aware home composers. Every home surface
 * produces a `ComposedWorkspace` of UIBlocks, so the AssistantWorkspace has
 * a uniform render path.
 */

import { randomUUID } from 'node:crypto';
import type { UIAction, RecommendationPanelBlock, ActionBarBlock } from './types';
import type { ExecutionMode } from '../decision/types';
import type { ActionOption, RiskSignal, Severity } from '../signals/types';

/** Every home surface is a WORKSPACE projection, not a transactional turn. */
export const HOME_MODE: ExecutionMode = 'WORKSPACE';

export function fmtDate(input: string | Date | undefined | null): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Signal severity → RecommendationPanel severity. */
export function mapSeverity(s: Severity): 'info' | 'warning' | 'critical' {
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'medium' || s === 'low') return 'warning';
  return 'info';
}

/** ActionOption → UIAction (composer-level type). */
export function actionOptionToUIAction(opt: ActionOption): UIAction {
  return {
    id: opt.id,
    label: opt.label,
    variant: opt.variant ?? 'secondary',
    intent: opt.intent,
    href: opt.href,
    confirmCopy: opt.confirmCopy,
  };
}

/** Build a RecommendationPanel from a list of signals. */
export function signalsToRecommendationPanel(
  title: string,
  signals: RiskSignal[],
  maxItems = 6,
): RecommendationPanelBlock {
  const head = signals.slice(0, maxItems);
  return {
    id: randomUUID(),
    kind: 'RecommendationPanel',
    title,
    recommendations: head.map((s) => ({
      id: s.id,
      title: s.title,
      detail: `${s.summary} · ${s.recommendation}${
        s.policy_basis[0] ? ` · ${s.policy_basis[0].clauseRef ?? s.policy_basis[0].title}` : ''
      }`,
      severity: mapSeverity(s.severity),
    })),
    // Surface the top signal's actions so the user can resolve the most urgent
    // item without opening it. The rest are reachable via drill-in.
    actions:
      head[0]?.action_options
        ?.slice(0, 3)
        .map(actionOptionToUIAction) ?? undefined,
    meta: { intent: 'signals.panel' },
  };
}

/** Build an ActionBar block from a list of UIActions. */
export function buildActionBar(actions: UIAction[]): ActionBarBlock {
  return {
    id: randomUUID(),
    kind: 'ActionBar',
    actions,
  };
}

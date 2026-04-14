/**
 * AI-OS Decision Engine.
 *
 * decideExecutionMode(intent, context) → DecisionTrace
 *
 * Pure function. No side effects, no I/O. 100% unit testable.
 *
 * Rules:
 *   1. Compute risk via risk-policy.ts
 *   2. Collect required capabilities for (action, entity)
 *   3. Check each capability against context.permissions
 *   4. Apply confidence floor per mode
 *   5. Compute final mode:
 *      - mode = AUTO_COMPLETE iff risk=low AND all permissions granted AND confidence >= 0.8
 *      - mode = WORKSPACE     iff risk<=medium AND all permissions granted
 *      - mode = ESCALATE      otherwise (risk=high OR missing permissions OR action ESCALATE)
 */

import type { AgentContext } from '@/types';
import type { Intent } from '../intent/types';
import type {
  DecisionTrace,
  ExecutionMode,
  PermissionCheck,
} from './types';
import { computeRiskScore } from './risk-policy';

/**
 * Map (action, entity) → required capabilities.
 * These strings match the existing ROLE_CAPABILITIES in src/lib/auth/authorization.ts.
 */
function requiredCapabilities(intent: Intent): string[] {
  const { action, entity } = intent;

  const reads: Record<string, string[]> = {
    employee: ['employee:read'],
    address: ['employee:read'],
    leave: ['leave:read'],
    document: ['document:read'],
    policy: ['policy:read'],
    workflow: ['workflow:read'],
    onboarding: ['onboarding:read'],
    offboarding: ['offboarding:read'],
    milestone: ['milestone:read'],
    team: ['employee:read'],
    compensation: ['compensation:read'],
    report: ['report:read'],
    system: ['admin:read'],
    unknown: [],
  };

  const writes: Record<string, string[]> = {
    employee: ['employee:write'],
    address: ['employee:read'], // addresses use the self-write RLS path; capability is light
    leave: ['leave:write'],
    document: ['document:write'],
    policy: ['policy:write'],
    workflow: ['workflow:write'],
    onboarding: ['onboarding:write'],
    offboarding: ['offboarding:write'],
    milestone: ['milestone:write'],
    team: ['employee:write'],
    compensation: ['compensation:write'],
    report: ['report:generate'],
    system: ['admin:write'],
    unknown: [],
  };

  const approvals: Record<string, string[]> = {
    workflow: ['workflow:approve'],
    leave: ['leave:approve'],
  };

  if (action === 'READ' || action === 'ANALYZE' || action === 'RECOMMEND') {
    return reads[entity] ?? [];
  }
  if (action === 'UPDATE' || action === 'CREATE' || action === 'TRIGGER') {
    return writes[entity] ?? [];
  }
  if (action === 'ESCALATE') {
    return approvals[entity] ?? ['workflow:read'];
  }
  return [];
}

function checkPermissions(
  caps: string[],
  ctx: AgentContext,
): PermissionCheck[] {
  const have = new Set(ctx.permissions);
  return caps.map((cap) => ({
    capability: cap,
    granted: have.has(cap),
    reason: have.has(cap) ? undefined : `role=${ctx.role} lacks ${cap}`,
  }));
}

/**
 * SECURITY: Hard bounds on confidence floors. No caller — including tests —
 * can set a floor below these minimums or above these maximums. This prevents
 * a misconfigured caller from auto-completing everything (floor=0) or
 * blocking everything (floor=1).
 */
const MIN_AUTO_FLOOR = 0.6;
const MAX_AUTO_FLOOR = 0.99;
const MIN_WORKSPACE_FLOOR = 0.3;
const MAX_WORKSPACE_FLOOR = 0.9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface DecideOptions {
  /** Override the auto-complete confidence floor. Default 0.8. Clamped to [0.6, 0.99]. */
  autoConfidenceFloor?: number;
  /** Override the workspace confidence floor. Default 0.55. Clamped to [0.3, 0.9]. */
  workspaceConfidenceFloor?: number;
}

export function decideExecutionMode(
  intent: Intent,
  ctx: AgentContext,
  opts: DecideOptions = {},
): DecisionTrace {
  const autoFloor = clamp(opts.autoConfidenceFloor ?? 0.8, MIN_AUTO_FLOOR, MAX_AUTO_FLOOR);
  const workspaceFloor = clamp(opts.workspaceConfidenceFloor ?? 0.55, MIN_WORKSPACE_FLOOR, MAX_WORKSPACE_FLOOR);

  const risk = computeRiskScore(intent, ctx);
  const required = requiredCapabilities(intent);
  const permissionChecks = checkPermissions(required, ctx);
  const hasAllPerms = permissionChecks.every((p) => p.granted);

  const reasons: string[] = [];
  const blockers: string[] = [];

  let mode: ExecutionMode;

  if (!hasAllPerms) {
    mode = 'ESCALATE';
    blockers.push('missing_capabilities');
    reasons.push(
      `Missing capabilities: ${permissionChecks
        .filter((p) => !p.granted)
        .map((p) => p.capability)
        .join(', ')}`,
    );
  } else if (intent.clarificationsNeeded && intent.clarificationsNeeded.length > 0) {
    mode = 'WORKSPACE';
    reasons.push('Interpreter requested clarification');
  } else if (risk.value === 'high') {
    mode = 'ESCALATE';
    reasons.push(`High risk: ${risk.reasons.join('; ')}`);
    reasons.push(`Policy refs: ${risk.policyRefs.join(', ')}`);
  } else if (intent.action === 'ESCALATE') {
    mode = 'ESCALATE';
    reasons.push('Action = ESCALATE');
  } else if (
    risk.value === 'low' &&
    hasAllPerms &&
    intent.confidence >= autoFloor &&
    (intent.action === 'UPDATE' ||
      intent.action === 'CREATE' ||
      intent.action === 'TRIGGER')
  ) {
    mode = 'AUTO_COMPLETE';
    reasons.push(
      `Low risk write with confidence ${intent.confidence.toFixed(2)} ≥ ${autoFloor}`,
    );
  } else if (intent.confidence >= workspaceFloor) {
    mode = 'WORKSPACE';
    reasons.push(
      `Confidence ${intent.confidence.toFixed(2)} ≥ ${workspaceFloor}; delivering workspace`,
    );
  } else {
    mode = 'WORKSPACE';
    reasons.push('Low confidence — rendering clarification workspace');
  }

  return {
    intentId: intent.id,
    mode,
    risk,
    permissionChecks,
    confidenceFloor: mode === 'AUTO_COMPLETE' ? autoFloor : workspaceFloor,
    reasons,
    decidedAt: new Date().toISOString(),
    blockers: blockers.length ? blockers : undefined,
  };
}

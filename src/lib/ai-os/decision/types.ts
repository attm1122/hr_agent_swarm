/**
 * AI-OS Decision Engine — types.
 *
 * The decision engine is a pure function of (Intent, AgentContext, RiskPolicy).
 * It returns a DecisionTrace describing WHAT to do and WHY, without actually
 * doing anything. Execution consumes the trace.
 */

export type ExecutionMode = 'AUTO_COMPLETE' | 'WORKSPACE' | 'ESCALATE';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskScore {
  value: RiskLevel;
  reasons: string[];
  /** References into risk-policy.ts (e.g. "R-UPDATE-ADDRESS-SELF"). */
  policyRefs: string[];
}

export interface PermissionCheck {
  capability: string;
  granted: boolean;
  reason?: string;
}

export interface DecisionTrace {
  intentId: string;
  mode: ExecutionMode;
  risk: RiskScore;
  permissionChecks: PermissionCheck[];
  /** Minimum confidence threshold that applied for this mode. */
  confidenceFloor: number;
  reasons: string[];
  decidedAt: string;
  /** If set, mode was downgraded due to these blockers. */
  blockers?: string[];
}

/**
 * Signal / Decision / Action — the structured objects that turn this from a
 * chatbot into a role-aware HR operating system.
 *
 * A **RiskSignal** is a single observation about the org (probation ending,
 * leave balance out of range, document expiring, onboarding stalled, etc.)
 * It is derived from data, not from user chat. Every signal is enriched with:
 *
 *   - a deterministic id (stable across re-generations, useful for dedup)
 *   - severity + confidence
 *   - policy_basis + legal_basis (the defensibility anchor)
 *   - owner_role and visibility_roles (role projection)
 *   - action_options (deep links back into the AI-OS executor)
 *
 * The UI never renders a signal directly. It renders the projection of a
 * signal for a given viewer — that is how the same event becomes "You have
 * 18 days of leave" to an employee and "3 of your team are over 15 days" to
 * a manager and "Org-wide leave liability is $420k" to HR.
 */

import type { Role } from '@/types';

export type SignalKind =
  | 'probation_review_due'
  | 'high_leave_balance'
  | 'incomplete_onboarding'
  | 'expiring_document'
  | 'visa_expiry_soon'
  | 'pending_leave_request'
  | 'upcoming_anniversary'
  | 'termination_risk'
  | 'compliance_gap'
  | 'update_personal_details';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SignalStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'dismissed';

/** Every defensible action anchors on at least one policy and/or law. */
export interface PolicyBasis {
  /** Internal policy id/name (e.g. "probation.review-by-day-80"). */
  id: string;
  title: string;
  clauseRef?: string;
}

export interface LegalBasis {
  jurisdiction: 'AU' | 'NZ' | 'US' | 'UK' | 'GLOBAL';
  /** e.g. "Fair Work Act 2009 (Cth) s 382". */
  statute: string;
  note?: string;
}

/** A concrete next-step the viewer can take. */
export interface ActionOption {
  id: string;
  label: string;
  kind: 'navigate' | 'intent' | 'link';
  /** If kind === 'intent', this goes straight into the AI-OS executor. */
  intent?: {
    rawInput: string;
  };
  /** If kind === 'navigate' or 'link'. */
  href?: string;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  /** Requires confirmation modal before firing. */
  confirmCopy?: string;
}

/**
 * The canonical structured signal object. This is the contract between the
 * intelligence layer and every UI surface.
 */
export interface RiskSignal {
  /** Deterministic id — e.g. "probation-emp-021-2026-05-01". */
  id: string;
  kind: SignalKind;
  title: string;
  summary: string;
  severity: Severity;
  /** 0..1 — the system's confidence that this signal is real + actionable. */
  confidence: number;

  /** Plain-English recommendation the system is making. */
  recommendation: string;
  /** Why the system is making this recommendation. */
  rationale: string;

  /** Defensibility anchors — every medium+ signal should carry at least one. */
  policy_basis: PolicyBasis[];
  legal_basis: LegalBasis[];

  /**
   * The role that owns resolving this. Only used for routing — visibility
   * is controlled separately by `visibility_roles`.
   */
  owner_role: Role;
  /** Which roles can see this signal at all (pre-projection). */
  visibility_roles: Role[];

  /**
   * If set, this signal is scoped to a specific employee. Used by projection
   * to decide whether an employee/manager can see it (self vs report).
   */
  subjectEmployeeId?: string;
  /** If the signal is tied to a specific team (e.g. team leave liability). */
  subjectTeamId?: string;

  /** The actions the owner can take to resolve this. */
  action_options: ActionOption[];

  escalation_required: boolean;
  /** Due date in ISO if time-bound. */
  dueDate?: string;

  status: SignalStatus;
  createdAt: string;
  updatedAt: string;

  /**
   * Sensitivity tag. Used by projection to strip high-sensitivity signals
   * from lower-privileged viewers even if role matches.
   */
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
}

/**
 * A decision the AI-OS has made (or is proposing). Unlike a RiskSignal — which
 * is an ambient observation — a DecisionObject represents a *resolution*. It's
 * what gets persisted in the audit trail when a workflow branches.
 *
 * This is intentionally a thin wrapper around the same defensibility anchors
 * as RiskSignal so the audit UI can render either from the same renderer.
 */
export interface DecisionObject {
  id: string;
  signalId?: string;
  title: string;
  summary: string;
  outcome: 'auto_resolved' | 'routed_to_human' | 'blocked' | 'deferred';
  rationale: string;
  policy_basis: PolicyBasis[];
  legal_basis: LegalBasis[];
  actorRole: Role;
  approvalHistory: Array<{
    approverRole: Role;
    decision: 'approved' | 'rejected' | 'requested_changes';
    at: string;
    note?: string;
  }>;
  createdAt: string;
}

/** Signals as the generator emits them, before role projection. */
export interface SignalSet {
  generatedAt: string;
  signals: RiskSignal[];
}

/** Inputs that bound the projection — who is viewing, and what do they own. */
export interface ProjectionContext {
  role: Role;
  employeeId?: string;
  /** Employees the viewer directly manages (for scope='team' enforcement). */
  directReportIds?: string[];
  /** Indirect reports (their team's reports). */
  indirectReportIds?: string[];
  /** Team ids the viewer manages. */
  managedTeamIds?: string[];
}

/**
 * Result of projecting a SignalSet for a specific viewer. Keeps the signals
 * they can legitimately see, each re-copied and re-worded for their angle,
 * and the ones hidden from them (for audit completeness on the server side
 * — never sent to the client).
 */
export interface ProjectedSignalSet {
  viewer: ProjectionContext;
  visible: RiskSignal[];
  hiddenCount: number;
}

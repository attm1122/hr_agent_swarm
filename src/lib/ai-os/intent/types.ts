/**
 * AI-OS Intent Layer — types.
 *
 * An Intent is the structured representation of what a user is trying to do.
 * Natural language goes in, a strongly-typed Intent comes out. Every downstream
 * layer (decision, execution, UI composition, audit) consumes Intent — never
 * raw text.
 */

import type { Role } from '@/types';

/** What the user is trying to do, in verbs the system understands. */
export type ActionType =
  | 'READ'
  | 'UPDATE'
  | 'CREATE'
  | 'ANALYZE'
  | 'RECOMMEND'
  | 'TRIGGER'
  | 'ESCALATE';

/** The primary domain entity the action operates on. */
export type EntityType =
  | 'employee'
  | 'address'
  | 'leave'
  | 'document'
  | 'policy'
  | 'workflow'
  | 'onboarding'
  | 'offboarding'
  | 'milestone'
  | 'team'
  | 'compensation'
  | 'report'
  | 'system'
  | 'unknown';

/** Who/what the action targets relative to the actor. */
export type TargetScope = 'self' | 'team' | 'org' | 'specific';

/** Preferred presentation of the outcome. Used by UIComposer. */
export type OutputFormat =
  | 'confirmation'
  | 'table'
  | 'chart'
  | 'document'
  | 'spreadsheet'
  | 'timeline'
  | 'checklist'
  | 'form'
  | 'narrative';

export interface IntentActor {
  userId: string;
  role: Role;
  employeeId?: string;
}

export interface IntentTarget {
  scope: TargetScope;
  /** When scope === 'specific', this is the target employee/entity id. */
  subjectId?: string;
  /** Free-form descriptor of the target (e.g. "probation employees"). */
  description?: string;
}

export interface IntentConstraints {
  timeframe?: string; // e.g. "next_month", "q2_2026", "last_7_days"
  priority?: 'low' | 'normal' | 'urgent';
  deadline?: string; // ISO date
}

/**
 * Canonical structured intent.
 * `id` is a ULID-ish uuid created at interpretation time — use it as the
 * correlation id across DecisionTrace, AgentRun, ai_os_traces.
 */
export interface Intent {
  id: string;
  rawInput: string;
  actor: IntentActor;
  action: ActionType;
  entity: EntityType;
  /** Dot-paths into the entity, e.g. ["address.street", "address.postcode"]. */
  fields?: string[];
  /** Filters to apply when reading/analysing (e.g. { teamId: "eng", status: "active" }). */
  filters?: Record<string, unknown>;
  /** Additional write payload for UPDATE/CREATE (e.g. the new address values). */
  payload?: Record<string, unknown>;
  target: IntentTarget;
  outputFormat: OutputFormat;
  constraints?: IntentConstraints;
  /** 0..1 interpreter confidence. <0.55 short-circuits to clarification. */
  confidence: number;
  /** Short human-readable justification of the classification. */
  rationale: string;
  /** If set, interpreter wants a clarification before execution. */
  clarificationsNeeded?: string[];
  /** ISO timestamp. */
  createdAt: string;
}

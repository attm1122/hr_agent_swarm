/**
 * Zod schemas for Intent and all sub-shapes.
 * Validated at the server → client boundary and at the interpreter output.
 */

import { z } from 'zod';

export const ActionTypeSchema = z.enum([
  'READ',
  'UPDATE',
  'CREATE',
  'ANALYZE',
  'RECOMMEND',
  'TRIGGER',
  'ESCALATE',
]);

export const EntityTypeSchema = z.enum([
  'employee',
  'address',
  'leave',
  'document',
  'policy',
  'workflow',
  'onboarding',
  'offboarding',
  'milestone',
  'team',
  'compensation',
  'report',
  'system',
  'unknown',
]);

export const TargetScopeSchema = z.enum(['self', 'team', 'org', 'specific']);

export const OutputFormatSchema = z.enum([
  'confirmation',
  'table',
  'chart',
  'document',
  'spreadsheet',
  'timeline',
  'checklist',
  'form',
  'narrative',
]);

export const RoleSchema = z.enum([
  'admin',
  'manager',
  'team_lead',
  'employee',
  'payroll',
]);

export const IntentActorSchema = z.object({
  userId: z.string().min(1),
  role: RoleSchema,
  employeeId: z.string().optional(),
});

export const IntentTargetSchema = z.object({
  scope: TargetScopeSchema,
  subjectId: z.string().optional(),
  description: z.string().optional(),
});

export const IntentConstraintsSchema = z.object({
  timeframe: z.string().optional(),
  priority: z.enum(['low', 'normal', 'urgent']).optional(),
  deadline: z.string().optional(),
});

export const IntentSchema = z.object({
  id: z.string().uuid(),
  rawInput: z.string().min(1).max(8000),
  actor: IntentActorSchema,
  action: ActionTypeSchema,
  entity: EntityTypeSchema,
  fields: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  target: IntentTargetSchema,
  outputFormat: OutputFormatSchema,
  constraints: IntentConstraintsSchema.optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  clarificationsNeeded: z.array(z.string()).optional(),
  createdAt: z.string(),
});

/**
 * The subset Claude is allowed to emit.
 * Server fills in id/actor/rawInput/createdAt from verified session state.
 */
export const InterpreterOutputSchema = z.object({
  action: ActionTypeSchema,
  entity: EntityTypeSchema,
  fields: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  target: IntentTargetSchema,
  outputFormat: OutputFormatSchema,
  constraints: IntentConstraintsSchema.optional(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(2000),
  clarificationsNeeded: z.array(z.string()).optional(),
});

export type InterpreterOutput = z.infer<typeof InterpreterOutputSchema>;

/**
 * Intent catalogue used by the interpreter's system prompt as few-shot examples.
 * Keep this list short and high-signal — the LLM learns better from 6-8
 * diverse examples than from a hundred near-duplicates.
 */

import type { Intent } from './types';

/** A single few-shot pair. We show the model the *output* shape only. */
export interface IntentExample {
  input: string;
  output: Omit<Intent, 'id' | 'actor' | 'rawInput' | 'createdAt'>;
}

export const INTENT_EXAMPLES: IntentExample[] = [
  {
    input: 'Update my address to 14 Smith Street, Surry Hills NSW 2010',
    output: {
      action: 'UPDATE',
      entity: 'address',
      fields: ['street', 'suburb', 'state', 'postcode', 'country'],
      payload: {
        street: '14 Smith Street',
        suburb: 'Surry Hills',
        state: 'NSW',
        postcode: '2010',
        country: 'AU',
      },
      target: { scope: 'self' },
      outputFormat: 'confirmation',
      confidence: 0.95,
      rationale:
        'User is updating their own residential address; all fields extracted.',
    },
  },
  {
    input: 'What anniversaries are coming up next month? Send me a sheet.',
    output: {
      action: 'ANALYZE',
      entity: 'milestone',
      filters: { type: 'anniversary', timeframe: 'next_month' },
      target: { scope: 'team' },
      outputFormat: 'spreadsheet',
      confidence: 0.92,
      rationale:
        'User wants aggregated anniversary milestones for next month delivered as a spreadsheet.',
    },
  },
  {
    input: 'Can I terminate this probation employee?',
    output: {
      action: 'RECOMMEND',
      entity: 'employee',
      target: { scope: 'specific', description: 'probation employee' },
      constraints: { priority: 'urgent' },
      outputFormat: 'narrative',
      confidence: 0.88,
      rationale:
        'User is asking whether termination during probation is safe — requires policy + recommendations.',
      clarificationsNeeded: ['Which employee? Please provide name or id.'],
    },
  },
  {
    input: 'Show me who is on leave next week',
    output: {
      action: 'READ',
      entity: 'leave',
      filters: { status: 'approved', timeframe: 'next_week' },
      target: { scope: 'team' },
      outputFormat: 'table',
      confidence: 0.93,
      rationale:
        'Standard team-scope leave read with a next-week filter; tabular output.',
    },
  },
  {
    input: 'How many days of annual leave do I have left?',
    output: {
      action: 'READ',
      entity: 'leave',
      fields: ['balance.annual'],
      target: { scope: 'self' },
      outputFormat: 'narrative',
      confidence: 0.96,
      rationale: 'Self leave balance read.',
    },
  },
  {
    input: 'Draft a welcome letter for our new starter',
    output: {
      action: 'CREATE',
      entity: 'document',
      target: { scope: 'specific' },
      outputFormat: 'document',
      confidence: 0.78,
      rationale:
        'User wants a generated document; needs the new starter identity to complete.',
      clarificationsNeeded: ['Which new starter is this for?'],
    },
  },
  {
    input: 'Summarise my team',
    output: {
      action: 'ANALYZE',
      entity: 'team',
      target: { scope: 'team' },
      outputFormat: 'narrative',
      confidence: 0.9,
      rationale: 'Manager wants a narrative summary of their direct team.',
    },
  },
  {
    input: 'What does the policy say about parental leave?',
    output: {
      action: 'READ',
      entity: 'policy',
      filters: { topic: 'parental_leave' },
      target: { scope: 'org' },
      outputFormat: 'narrative',
      confidence: 0.94,
      rationale: 'Policy lookup with narrative answer + citations.',
    },
  },
];

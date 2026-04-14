/**
 * UI-composer deterministic tests.
 *
 * Asserts the block set produced for each of the three mandatory example
 * flows. These tests do not hit Claude or Supabase — they wire a fake
 * ExecutionResult + Intent + DecisionTrace directly into the composer.
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { compose } from './composer';
import type { Intent } from '../intent/types';
import type { DecisionTrace } from '../decision/types';
import type { ExecutionResult } from '../execution/types';

function intent(partial: Partial<Intent> = {}): Intent {
  return {
    id: randomUUID(),
    rawInput: 'test',
    actor: { userId: 'u1', role: 'employee' },
    action: 'READ',
    entity: 'employee',
    target: { scope: 'self' },
    outputFormat: 'narrative',
    confidence: 0.9,
    rationale: 'test',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function decision(mode: DecisionTrace['mode'], risk: 'low' | 'medium' | 'high' = 'low'): DecisionTrace {
  return {
    intentId: 'i1',
    mode,
    risk: { value: risk, reasons: risk === 'high' ? ['termination-during-probation'] : [], policyRefs: [] },
    permissionChecks: [],
    confidenceFloor: 0.8,
    reasons: [],
    decidedAt: new Date().toISOString(),
  };
}

function execResult(partial: Partial<ExecutionResult>): ExecutionResult {
  return {
    mode: 'AUTO_COMPLETE',
    swarmResponses: [],
    agentCalls: [],
    artifacts: [],
    data: {},
    ...partial,
  };
}

describe('compose — Example 1: self address update', () => {
  it('emits ConfirmationCard + ActionBar after successful write', () => {
    const out = compose(
      intent({ action: 'UPDATE', entity: 'address', target: { scope: 'self' } }),
      decision('AUTO_COMPLETE', 'low'),
      execResult({
        mode: 'AUTO_COMPLETE',
        data: {
          kind: 'address_update',
          before: null,
          after: {
            street: '14 Smith Street',
            suburb: 'Surry Hills',
            state: 'NSW',
            postcode: '2010',
            country: 'AU',
          },
          changedFields: ['street', 'suburb', 'state', 'postcode'],
        },
      }),
    );

    const kinds = out.blocks.map((b) => b.kind);
    expect(kinds).toContain('ConfirmationCard');
    expect(kinds).toContain('ActionBar');
    expect(out.headline).toMatch(/updated/i);
  });

  it('emits RiskBanner + EditableForm when write fails', () => {
    const out = compose(
      intent({ action: 'UPDATE', entity: 'address', target: { scope: 'self' } }),
      decision('AUTO_COMPLETE', 'low'),
      execResult({
        mode: 'AUTO_COMPLETE',
        error: { message: 'Postcode invalid', code: 'VALIDATION_FAILED' },
      }),
    );
    const kinds = out.blocks.map((b) => b.kind);
    expect(kinds).toEqual(expect.arrayContaining(['RiskBanner', 'EditableForm']));
    expect(out.headline).toMatch(/attention/i);
  });
});

describe('compose — Example 2: anniversaries spreadsheet', () => {
  it('emits SummaryCard/Table/ArtifactPreview when artifact present', () => {
    const out = compose(
      intent({
        action: 'ANALYZE',
        entity: 'milestone',
        outputFormat: 'spreadsheet',
        filters: { timeframe: 'next_month', type: 'anniversary' },
      }),
      decision('WORKSPACE', 'low'),
      execResult({
        mode: 'WORKSPACE',
        data: {
          kind: 'milestones',
          rows: [
            { employee: 'Alice', type: 'anniversary', date: '2026-05-03', years: 5 },
            { employee: 'Bob', type: 'anniversary', date: '2026-05-18', years: 2 },
          ],
          rowCount: 2,
          artifactId: 'a1',
        },
        artifacts: [
          {
            id: 'a1',
            kind: 'xlsx',
            filename: 'anniversaries.xlsx',
            href: 'https://example.invalid/signed.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            sizeBytes: 1234,
          },
        ],
      }),
    );

    const kinds = out.blocks.map((b) => b.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['SummaryCard', 'Table', 'ArtifactPreview']),
    );
  });
});

describe('compose — Example 3: probation termination escalation', () => {
  it('emits RiskBanner + TaskChecklist + ApprovalPanel', () => {
    const out = compose(
      intent({
        rawInput: 'Can I terminate this probation employee?',
        action: 'RECOMMEND',
        entity: 'employee',
        target: { scope: 'specific', subjectId: 'emp-42' },
        constraints: { priority: 'urgent' },
      }),
      decision('ESCALATE', 'high'),
      execResult({
        mode: 'ESCALATE',
        data: {
          kind: 'escalation',
          workflow: { id: 'wf-1' },
          risk: { value: 'high', reasons: ['termination-during-probation'], policyRefs: [] },
          subjectId: 'emp-42',
        },
      }),
    );

    const kinds = out.blocks.map((b) => b.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['RiskBanner', 'TaskChecklist', 'ApprovalPanel']),
    );
    expect(out.headline).toMatch(/escalated/i);

    // TaskChecklist must include the items we claim to verify, and must not
    // resurrect fabricated fields (hasRecentReview, hasTwoWarnings, pipCompleted).
    const checklist = out.blocks.find((b) => b.kind === 'TaskChecklist');
    expect(checklist).toBeDefined();
    if (checklist && checklist.kind === 'TaskChecklist') {
      const ids = checklist.items.map((i) => i.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          'employee-resolved',
          'probation-status',
          'performance-review',
          'written-warnings',
          'hr-consulted',
          'legal-reviewed',
        ]),
      );
    }
  });
});

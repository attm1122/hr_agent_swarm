/**
 * Decision engine — unit tests.
 * Pure function means no mocks needed; we just build intents + contexts.
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';

import { decideExecutionMode } from './engine';
import type { Intent, ActionType, EntityType } from '../intent/types';
import type { AgentContext } from '@/types';

function buildIntent(overrides: Partial<Intent> = {}): Intent {
  const base: Intent = {
    id: randomUUID(),
    rawInput: 'test input',
    actor: { userId: 'u1', role: 'employee' },
    action: 'READ' as ActionType,
    entity: 'employee' as EntityType,
    target: { scope: 'self' },
    outputFormat: 'narrative',
    confidence: 0.9,
    rationale: 'test',
    createdAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

function buildContext(overrides: Partial<AgentContext> = {}): AgentContext {
  const base: AgentContext = {
    userId: 'u1',
    role: 'employee',
    scope: 'self',
    sensitivityClearance: ['self_visible'],
    permissions: [
      'employee:read',
      'leave:read',
      'document:read',
      'policy:read',
      'workflow:read',
      'milestone:read',
      'agent:execute',
    ],
    sessionId: 's1',
    timestamp: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

describe('decideExecutionMode', () => {
  it('AUTO_COMPLETEs self address update with high confidence', () => {
    const intent = buildIntent({
      action: 'UPDATE',
      entity: 'address',
      target: { scope: 'self' },
      confidence: 0.94,
      payload: { street: '14 Smith Street', postcode: '2010' },
    });
    const ctx = buildContext();
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.mode).toBe('AUTO_COMPLETE');
    expect(trace.risk.value).toBe('low');
  });

  it('ESCALATEs termination-on-probation regardless of role', () => {
    const intent = buildIntent({
      action: 'RECOMMEND',
      entity: 'employee',
      target: { scope: 'specific', subjectId: 'e42' },
      rawInput: 'Can I terminate this probation employee?',
      confidence: 0.88,
    });
    const ctx = buildContext({
      role: 'admin',
      scope: 'all',
      permissions: ['employee:read', 'agent:execute'],
    });
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.mode).toBe('ESCALATE');
    expect(trace.risk.value).toBe('high');
    expect(trace.risk.policyRefs).toContain('R-TERMINATION-PROBATION');
  });

  it('WORKSPACEs ANALYZE milestones for manager', () => {
    const intent = buildIntent({
      action: 'ANALYZE',
      entity: 'milestone',
      target: { scope: 'team' },
      outputFormat: 'spreadsheet',
      filters: { timeframe: 'next_month', type: 'anniversary' },
      confidence: 0.92,
    });
    const ctx = buildContext({
      role: 'manager',
      scope: 'team',
      permissions: [
        'employee:read',
        'leave:read',
        'milestone:read',
        'agent:execute',
      ],
    });
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.mode).toBe('WORKSPACE');
  });

  it('ESCALATEs when caller lacks capability', () => {
    const intent = buildIntent({
      action: 'UPDATE',
      entity: 'compensation',
      target: { scope: 'specific', subjectId: 'e99' },
      confidence: 0.9,
    });
    const ctx = buildContext({ role: 'employee' }); // no compensation:write
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.mode).toBe('ESCALATE');
    expect(trace.blockers).toContain('missing_capabilities');
  });

  it('applies low-confidence rule to bump risk', () => {
    const intent = buildIntent({
      action: 'UPDATE',
      entity: 'address',
      target: { scope: 'self' },
      confidence: 0.4,
    });
    const ctx = buildContext();
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.risk.value).toBe('medium'); // R-LOW-CONFIDENCE bumps base
    expect(trace.mode).toBe('WORKSPACE');
  });

  it('ESCALATEs when pay-sensitive fields are in an export', () => {
    const intent = buildIntent({
      action: 'ANALYZE',
      entity: 'employee',
      target: { scope: 'team' },
      outputFormat: 'spreadsheet',
      fields: ['name', 'salary', 'email'],
      confidence: 0.9,
    });
    const ctx = buildContext({
      role: 'manager',
      scope: 'team',
      permissions: ['employee:read', 'agent:execute'],
    });
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.risk.value).toBe('high');
    expect(trace.mode).toBe('ESCALATE');
  });

  it('routes ESCALATE action straight to ESCALATE mode', () => {
    const intent = buildIntent({
      action: 'ESCALATE',
      entity: 'workflow',
      target: { scope: 'self' },
      confidence: 0.95,
    });
    const ctx = buildContext();
    const trace = decideExecutionMode(intent, ctx);
    expect(trace.mode).toBe('ESCALATE');
  });
});

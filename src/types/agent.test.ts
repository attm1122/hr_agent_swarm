import { describe, it, expect } from 'vitest';
import type {
  AgentResult,
  ProposedAction,
  Citation,
  AgentIntent,
  AgentContext,
  SwarmRequest,
  SwarmResponse,
  AgentType,
  AgentDefinition,
} from './agent';

describe('Agent Types - AgentResult', () => {
  it('constructs a valid successful result', () => {
    const result: AgentResult<{ name: string }> = {
      success: true,
      summary: 'Found employee',
      confidence: 0.98,
      data: { name: 'John Doe' },
      risks: [],
      requiresApproval: false,
    };
    expect(result.success).toBe(true);
    expect(result.confidence).toBe(0.98);
    expect(result.data.name).toBe('John Doe');
  });

  it('constructs a result with proposed actions and citations', () => {
    const result: AgentResult = {
      success: true,
      summary: 'Completed',
      confidence: 0.85,
      data: null,
      risks: ['minor risk'],
      requiresApproval: true,
      proposedActions: [{ type: 'approve', label: 'Approve', payload: {} }],
      citations: [{ source: 'HR3', reference: 'PAY-001' }],
    };
    expect(result.proposedActions?.length).toBe(1);
    expect(result.citations?.length).toBe(1);
    expect(result.risks.length).toBe(1);
  });

  it('constructs a failed result', () => {
    const result: AgentResult = {
      success: false,
      summary: 'Operation failed',
      confidence: 0,
      data: null,
      risks: ['system error'],
      requiresApproval: false,
    };
    expect(result.success).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('Agent Types - ProposedAction', () => {
  it('constructs a valid action', () => {
    const action: ProposedAction = {
      type: 'notify',
      label: 'Send notification',
      payload: { channel: 'slack', message: 'Hello' },
    };
    expect(action.type).toBe('notify');
    expect(action.payload.channel).toBe('slack');
  });
});

describe('Agent Types - Citation', () => {
  it('constructs a valid citation', () => {
    const citation: Citation = {
      source: 'BambooHR',
      reference: 'EMP-001',
    };
    expect(citation.source).toBe('BambooHR');
    expect(citation.reference).toBe('EMP-001');
  });
});

describe('Agent Types - AgentIntent', () => {
  it('covers all expected intents', () => {
    const intents: AgentIntent[] = [
      'employee_file_query', 'employee_file_summary', 'document_classification',
      'leave_balance_query', 'leave_request_submit', 'leave_request_approve',
      'salary_snapshot', 'salary_history', 'salary_variance',
      'compliance_check', 'anniversary_query', 'expiry_alert',
      'onboarding_progress', 'onboarding_task_update',
      'policy_query', 'policy_search',
      'workflow_initiate', 'workflow_approve',
      'report_generate', 'report_export',
      'dashboard_summary', 'unknown',
    ];
    expect(intents.length).toBe(22);
  });
});

describe('Agent Types - AgentContext', () => {
  it('constructs a valid context', () => {
    const ctx: AgentContext = {
      sessionId: 'sess-001',
      timestamp: '2025-04-01T00:00:00Z',
      permissions: ['read:employees', 'write:leave'],
      employeeId: 'emp-001',
      managerId: 'emp-002',
      hrUserId: 'emp-003',
      teamId: 'team-eng',
    };
    expect(ctx.sessionId).toBe('sess-001');
    expect(ctx.permissions.length).toBe(2);
  });

  it('works with minimal required fields', () => {
    const ctx: AgentContext = {
      sessionId: 'sess-002',
      timestamp: '2025-04-01T00:00:00Z',
      permissions: [],
    };
    expect(ctx.employeeId).toBeUndefined();
    expect(ctx.managerId).toBeUndefined();
  });
});

describe('Agent Types - SwarmRequest', () => {
  it('constructs a valid request', () => {
    const req: SwarmRequest = {
      intent: 'employee_file_query',
      payload: { employeeId: 'emp-001' },
      context: {
        sessionId: 'sess-001',
        timestamp: '2025-04-01T00:00:00Z',
        permissions: ['read:employees'],
      },
    };
    expect(req.intent).toBe('employee_file_query');
    expect(req.payload.employeeId).toBe('emp-001');
  });
});

describe('Agent Types - SwarmResponse', () => {
  it('constructs a valid response', () => {
    const res: SwarmResponse = {
      agentType: 'employee_file',
      result: {
        success: true,
        summary: 'Found',
        confidence: 0.95,
        data: {},
        risks: [],
        requiresApproval: false,
      },
      routingTime: 12,
      executionTime: 150,
    };
    expect(res.agentType).toBe('employee_file');
    expect(res.routingTime).toBe(12);
    expect(res.executionTime).toBe(150);
  });
});

describe('Agent Types - AgentType', () => {
  it('covers all agent types', () => {
    const types: AgentType[] = [
      'employee_file', 'leave', 'salary', 'reporting',
      'compliance', 'onboarding', 'policy', 'workflow', 'coordinator',
    ];
    expect(types.length).toBe(9);
  });
});

describe('Agent Types - AgentDefinition', () => {
  it('constructs a valid definition', () => {
    const def: AgentDefinition = {
      type: 'employee_file',
      name: 'Employee File Agent',
      description: 'Handles employee file queries',
      allowedIntents: ['employee_file_query', 'employee_file_summary'],
      requiredPermissions: ['read:employees'],
      maxConfidence: 1.0,
    };
    expect(def.type).toBe('employee_file');
    expect(def.allowedIntents.length).toBe(2);
    expect(def.maxConfidence).toBe(1.0);
  });
});

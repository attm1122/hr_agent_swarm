import { describe, it, expect } from 'vitest';
import type {
  Json,
  Employee,
  Team,
  Position,
  EmployeeDocument,
  DocumentRequirement,
  LeaveBalance,
  LeaveRequest,
  CompensationRecord,
  Milestone,
  OnboardingPlan,
  OnboardingTask,
  Workflow,
  ApprovalStep,
  AuditEvent,
  AgentRun,
  ReportDefinition,
  ReportRun,
  PolicyDocument,
  PolicyChunk,
  Database,
  Tables,
  Insertable,
  Updatable,
} from './database';

describe('Database Types - Json', () => {
  it('accepts string', () => {
    const val: Json = 'hello';
    expect(val).toBe('hello');
  });

  it('accepts number', () => {
    const val: Json = 42;
    expect(val).toBe(42);
  });

  it('accepts boolean', () => {
    const val: Json = true;
    expect(val).toBe(true);
  });

  it('accepts null', () => {
    const val: Json = null;
    expect(val).toBeNull();
  });

  it('accepts object', () => {
    const val: Json = { key: 'value', nested: { num: 1 } };
    expect(val).toEqual({ key: 'value', nested: { num: 1 } });
  });

  it('accepts array', () => {
    const val: Json = [1, 'two', true, null];
    expect(val).toEqual([1, 'two', true, null]);
  });
});

describe('Database Types - Employee (snake_case)', () => {
  it('constructs valid row', () => {
    const emp: Employee = {
      id: 'emp-001', email: 'test@test.com',
      first_name: 'Test', last_name: 'User',
      employee_number: 'EMP001', hire_date: '2020-01-01',
      termination_date: null, status: 'active',
      team_id: 'team-1', position_id: 'pos-1',
      manager_id: null, work_location: 'hybrid',
      employment_type: 'full_time',
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(emp.first_name).toBe('Test');
    expect(emp.employee_number).toBe('EMP001');
  });

  it('supports all status values', () => {
    const statuses: Employee['status'][] = ['active', 'inactive', 'on_leave', 'terminated', 'pending'];
    expect(statuses.length).toBe(5);
  });
});

describe('Database Types - Team', () => {
  it('constructs valid row', () => {
    const team: Team = {
      id: 'team-1', name: 'Engineering', code: 'ENG',
      parent_team_id: null, department: 'Tech', cost_center: 'CC-100',
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(team.code).toBe('ENG');
  });
});

describe('Database Types - Position', () => {
  it('constructs valid row', () => {
    const pos: Position = {
      id: 'pos-1', title: 'Engineer', level: 'L3',
      department: 'Tech', job_family: 'Engineering',
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(pos.job_family).toBe('Engineering');
  });
});

describe('Database Types - EmployeeDocument', () => {
  it('constructs valid row', () => {
    const doc: EmployeeDocument = {
      id: 'doc-1', employee_id: 'emp-1',
      onedrive_id: 'od-1', onedrive_path: '/path',
      file_name: 'test.pdf', file_type: 'application/pdf', file_size: 1000,
      category: 'contract', status: 'active',
      uploaded_at: '2020-01-01', expires_at: null, extracted_data: null,
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(doc.onedrive_id).toBe('od-1');
  });

  it('supports all categories', () => {
    const cats: EmployeeDocument['category'][] = ['contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other'];
    expect(cats.length).toBe(8);
  });
});

describe('Database Types - DocumentRequirement', () => {
  it('constructs valid row', () => {
    const req: DocumentRequirement = {
      id: 'req-1', category: 'visa',
      employment_types: ['full_time'], required: true,
      expires: true, expiration_warning_days: 60,
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(req.employment_types).toContain('full_time');
  });
});

describe('Database Types - LeaveBalance', () => {
  it('constructs valid row', () => {
    const bal: LeaveBalance = {
      id: 'lb-1', employee_id: 'emp-1',
      leave_type: 'annual', entitlement_days: 20,
      taken_days: 5, pending_days: 2, remaining_days: 13,
      period_start: '2025-01-01', period_end: '2025-12-31',
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(bal.remaining_days).toBe(13);
  });
});

describe('Database Types - LeaveRequest', () => {
  it('constructs valid row', () => {
    const lr: LeaveRequest = {
      id: 'lr-1', employee_id: 'emp-1',
      leave_type: 'annual', start_date: '2025-04-01',
      end_date: '2025-04-05', days_requested: 5,
      reason: 'Vacation', status: 'pending',
      approved_by: null, approved_at: null, rejection_reason: null,
      tenant_id: 'tenant-test',
      created_at: '2025-03-01', updated_at: '2025-03-01',
    };
    expect(lr.days_requested).toBe(5);
  });
});

describe('Database Types - CompensationRecord', () => {
  it('constructs valid row', () => {
    const comp: CompensationRecord = {
      id: 'comp-1', employee_id: 'emp-1',
      effective_date: '2025-01-01', base_salary: 100000,
      currency: 'USD', pay_frequency: 'monthly',
      end_date: null,
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(comp.pay_frequency).toBe('monthly');
  });
});

describe('Database Types - Milestone', () => {
  it('constructs valid row', () => {
    const ms: Milestone = {
      id: 'ms-1', employee_id: 'emp-1',
      milestone_type: 'probation_end',
      milestone_date: '2025-06-01',
      due_date: '2025-06-01',
      description: 'Probation ends', alert_days_before: 14,
      status: 'upcoming', acknowledged_at: null, acknowledged_by: null,
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(ms.alert_days_before).toBe(14);
  });
});

describe('Database Types - OnboardingPlan', () => {
  it('constructs valid row', () => {
    const plan: OnboardingPlan = {
      id: 'ob-1', employee_id: 'emp-1',
      template_name: 'Standard Onboarding',
      start_date: '2025-04-01',
      initiated_by: 'emp-2',
      assigned_to: 'emp-2',
      checklist_template: 'default',
      target_completion_date: '2025-05-01',
      actual_completion_date: null, status: 'in_progress',
      tenant_id: 'tenant-test',
      created_at: '2025-04-01', updated_at: '2025-04-01',
    };
    expect(plan.template_name).toBe('Standard Onboarding');
  });
});

describe('Database Types - OnboardingTask', () => {
  it('constructs valid row', () => {
    const task: OnboardingTask = {
      id: 'ot-1', plan_id: 'ob-1',
      task_name: 'Setup laptop',
      category: 'it_setup', assigned_to: 'emp-2',
      due_date: '2025-04-05', completed_at: null, completed_by: null,
      status: 'pending', priority: 'high', depends_on: null,
      tenant_id: 'tenant-test',
      created_at: '2025-04-01', updated_at: '2025-04-01',
    };
    expect(task.category).toBe('it_setup');
    expect(task.priority).toBe('high');
  });
});

describe('Database Types - Workflow', () => {
  it('constructs valid row', () => {
    const wf: Workflow = {
      id: 'wf-1', workflow_type: 'leave_approval',
      entity_type: 'leave_request', entity_id: 'lr-1',
      reference_type: 'leave_request', reference_id: 'lr-1',
      initiator_id: 'emp-1', initiated_by: 'emp-1', status: 'pending',
      current_step: 1, total_steps: 2,
      started_at: '2025-01-01', completed_at: null,
      context: null,
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(wf.current_step).toBe(1);
  });
});

describe('Database Types - ApprovalStep', () => {
  it('constructs valid row', () => {
    const step: ApprovalStep = {
      id: 'as-1', workflow_id: 'wf-1', step_number: 1,
      step_name: 'Manager Approval', approver_role: 'manager',
      approver_id: 'emp-2',
      status: 'approved', approved_at: '2025-01-05',
      rejection_reason: null, due_date: '2025-01-10',
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-05',
    };
    expect(step.approver_role).toBe('manager');
  });
});

describe('Database Types - AuditEvent', () => {
  it('constructs valid row', () => {
    const event: AuditEvent = {
      id: 'ae-1', event_type: 'update',
      entity_type: 'employee', entity_id: 'emp-1',
      actor_id: 'emp-2', actor_type: 'user',
      action: 'update_profile',
      previous_state: { name: 'Old' }, new_state: { name: 'New' },
      metadata: null, ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
      tenant_id: 'tenant-test',
      created_at: '2025-01-01',
    };
    expect(event.actor_type).toBe('user');
  });
});

describe('Database Types - AgentRun', () => {
  it('constructs valid row', () => {
    const run: AgentRun = {
      id: 'ar-1', agent_type: 'employee_file',
      intent: 'employee_file_query',
      input_payload: { employeeId: 'emp-1' },
      output_result: { name: 'John' },
      confidence: 0.95, execution_time_ms: 150,
      success: true, error_message: null,
      context: { sessionId: 'sess-1' },
      tenant_id: 'tenant-test',
      created_at: '2025-01-01',
    };
    expect(run.confidence).toBe(0.95);
    expect(run.execution_time_ms).toBe(150);
  });
});

describe('Database Types - ReportDefinition', () => {
  it('constructs valid row', () => {
    const report: ReportDefinition = {
      id: 'rd-1', name: 'Headcount Report',
      description: 'Monthly headcount', category: 'hr',
      query_config: { table: 'employees' },
      parameters: null, requires_approval: false,
      created_by: 'emp-1',
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(report.category).toBe('hr');
  });
});

describe('Database Types - ReportRun', () => {
  it('constructs valid row', () => {
    const run: ReportRun = {
      id: 'rr-1', report_definition_id: 'rd-1',
      parameters: null, status: 'completed',
      result_data: [{ name: 'John', count: 1 }],
      row_count: 1, generated_by: 'emp-1',
      generated_at: '2025-01-01', error_message: null,
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(run.row_count).toBe(1);
  });
});

describe('Database Types - PolicyDocument', () => {
  it('constructs valid row', () => {
    const policy: PolicyDocument = {
      id: 'pd-1', title: 'Leave Policy',
      category: 'hr', version: '1.0',
      effective_date: '2025-01-01',
      source_url: 'https://example.com/policy',
      content_hash: 'abc123',
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(policy.version).toBe('1.0');
  });
});

describe('Database Types - PolicyChunk', () => {
  it('constructs valid row', () => {
    const chunk: PolicyChunk = {
      id: 'pc-1', document_id: 'pd-1',
      chunk_index: 0, content: 'Section 1: Leave entitlement...',
      embedding: null, metadata: { section: 'overview' },
      tenant_id: 'tenant-test',
      created_at: '2025-01-01', updated_at: '2025-01-01',
    };
    expect(chunk.chunk_index).toBe(0);
  });
});

describe('Database Types - Helper types', () => {
  it('Tables helper resolves Employee row', () => {
    type EmpRow = Tables<'employees'>;
    const emp: EmpRow = {
      id: 'emp-1', email: 'test@test.com',
      first_name: 'Test', last_name: 'User',
      employee_number: 'EMP001', hire_date: '2020-01-01',
      termination_date: null, status: 'active',
      team_id: null, position_id: null, manager_id: null,
      work_location: null, employment_type: 'full_time',
      tenant_id: 'tenant-test',
      created_at: '2020-01-01', updated_at: '2020-01-01',
    };
    expect(emp.id).toBe('emp-1');
  });

  it('Insertable helper omits auto fields', () => {
    type EmpInsert = Insertable<'employees'>;
    const insert: EmpInsert = {
      email: 'test@test.com',
      first_name: 'Test', last_name: 'User',
      employee_number: 'EMP002', hire_date: '2025-01-01',
      termination_date: null, status: 'active',
      team_id: null, position_id: null, manager_id: null,
      work_location: null, employment_type: 'full_time',
      tenant_id: 'tenant-test',
    };
    expect(insert.email).toBe('test@test.com');
    expect((insert as Record<string, unknown>).id).toBeUndefined();
  });

  it('Updatable helper makes all fields optional', () => {
    type EmpUpdate = Updatable<'employees'>;
    const update: EmpUpdate = { first_name: 'Updated' };
    expect(update.first_name).toBe('Updated');
    expect(update.last_name).toBeUndefined();
  });

  it('Database type has public schema', () => {
    type DB = Database;
    const tableNames: (keyof DB['public']['Tables'])[] = [
      'employees', 'teams', 'positions', 'employee_documents',
      'document_requirements', 'leave_balances', 'leave_requests',
      'compensation_records', 'milestones', 'onboarding_plans',
      'onboarding_tasks', 'workflows', 'approval_steps',
      'audit_events', 'agent_runs', 'report_definitions',
      'report_runs', 'policy_documents', 'policy_chunks',
    ];
    expect(tableNames.length).toBe(19);
  });
});
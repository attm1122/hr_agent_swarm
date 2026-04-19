import { describe, it, expect } from 'vitest';
import type {
  Employee,
  Team,
  Position,
  EmployeeDocument,
  DocumentRequirement,
  LeaveBalance,
  LeaveRequest,
  CompensationRecord,
  Milestone,
  Workflow,
  ApprovalStep,
  ReviewCycle,
  ReviewInstance,
  Goal,
  CommunicationTemplate,
  CommunicationDraft,
  AuditEvent,
  AgentResult,
  ProposedAction,
  Citation,
  AgentType,
  AgentIntent,
  NavItem,
  DashboardMetric,
  ActionItem,
  EmployeeSummary,
  ReportColumn,
  Priority,
  WorkflowStatus,
} from './index';

// These tests validate that the type definitions compile and are structurally correct.
// They exercise every exported type by creating conforming objects.

describe('Domain Types - Employee', () => {
  it('Employee type is valid', () => {
    const employee: Employee = {
      id: 'emp-001',
      email: 'test@test.com',
      firstName: 'Test',
      lastName: 'User',
      employeeNumber: 'EMP001',
      hireDate: '2020-01-01',
      terminationDate: null,
      status: 'active',
      teamId: 'team-1',
      positionId: 'pos-1',
      managerId: null,
      workLocation: 'hybrid',
      employmentType: 'full_time',
      createdAt: '2020-01-01',
      updatedAt: '2020-01-01',
    };
    expect(employee.id).toBe('emp-001');
    expect(employee.status).toBe('active');
    expect(employee.terminationDate).toBeNull();
  });

  it('Employee supports all status values', () => {
    const statuses: Employee['status'][] = ['active', 'inactive', 'on_leave', 'terminated', 'pending'];
    expect(statuses.length).toBe(5);
  });

  it('Employee supports all employment types', () => {
    const types: Employee['employmentType'][] = ['full_time', 'part_time', 'contract', 'intern'];
    expect(types.length).toBe(4);
  });

  it('Employee supports all work locations', () => {
    const locations: Employee['workLocation'][] = ['onsite', 'remote', 'hybrid', null];
    expect(locations.length).toBe(4);
  });

  it('Employee avatarUrl is optional', () => {
    const emp: Employee = {
      id: 'x', email: 'x', firstName: 'x', lastName: 'x', employeeNumber: 'x',
      hireDate: 'x', terminationDate: null, status: 'active', teamId: null,
      positionId: null, managerId: null, workLocation: null, employmentType: 'full_time',
      createdAt: 'x', updatedAt: 'x',
    };
    expect(emp.avatarUrl).toBeUndefined();
  });
});

describe('Domain Types - Team', () => {
  it('Team type is valid', () => {
    const team: Team = {
      id: 'team-1', name: 'Engineering', code: 'ENG',
      parentTeamId: null, department: 'Tech', costCenter: 'CC-100',
      createdAt: '2020-01-01', updatedAt: '2020-01-01',
    };
    expect(team.name).toBe('Engineering');
    expect(team.parentTeamId).toBeNull();
  });
});

describe('Domain Types - Position', () => {
  it('Position type is valid', () => {
    const pos: Position = {
      id: 'pos-1', title: 'Engineer', level: 'L3',
      department: 'Tech', jobFamily: 'Engineering',
      createdAt: '2020-01-01', updatedAt: '2020-01-01',
    };
    expect(pos.title).toBe('Engineer');
  });
});

describe('Domain Types - Document', () => {
  it('EmployeeDocument type is valid', () => {
    const doc: EmployeeDocument = {
      id: 'doc-1', employeeId: 'emp-1', sourceId: 's1', sourcePath: '/path',
      fileName: 'test.pdf', fileType: 'application/pdf', fileSize: 1000,
      category: 'contract', status: 'active', uploadedAt: '2020-01-01',
      expiresAt: null, extractedData: null,
      createdAt: '2020-01-01', updatedAt: '2020-01-01',
    };
    expect(doc.category).toBe('contract');
  });

  it('EmployeeDocument supports all categories', () => {
    const categories: EmployeeDocument['category'][] = ['contract', 'visa', 'certification', 'id', 'medical', 'tax', 'performance', 'other'];
    expect(categories.length).toBe(8);
  });

  it('EmployeeDocument supports all statuses', () => {
    const statuses: EmployeeDocument['status'][] = ['active', 'expired', 'expiring', 'missing'];
    expect(statuses.length).toBe(4);
  });

  it('DocumentRequirement type is valid', () => {
    const req: DocumentRequirement = {
      id: 'req-1', category: 'visa', employmentTypes: ['full_time'],
      required: true, expires: true, expirationWarningDays: 60,
      createdAt: '2020-01-01', updatedAt: '2020-01-01',
    };
    expect(req.required).toBe(true);
  });
});

describe('Domain Types - Leave', () => {
  it('LeaveBalance type is valid', () => {
    const bal: LeaveBalance = {
      id: 'lb-1', employeeId: 'emp-1', leaveType: 'annual',
      entitlementDays: 20, takenDays: 5, pendingDays: 2, remainingDays: 13,
      periodStart: '2025-01-01', periodEnd: '2025-12-31',
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(bal.remainingDays).toBe(13);
  });

  it('LeaveRequest type is valid', () => {
    const req: LeaveRequest = {
      id: 'lr-1', employeeId: 'emp-1', leaveType: 'sick',
      startDate: '2025-04-01', endDate: '2025-04-02', daysRequested: 2,
      reason: null, status: 'pending', approvedBy: null, approvedAt: null,
      rejectionReason: null, createdAt: '2025-03-01', updatedAt: '2025-03-01',
    };
    expect(req.status).toBe('pending');
  });

  it('LeaveRequest supports all leave types', () => {
    const types: LeaveRequest['leaveType'][] = ['annual', 'sick', 'personal', 'parental', 'bereavement', 'unpaid', 'other'];
    expect(types.length).toBe(7);
  });

  it('LeaveRequest supports all statuses', () => {
    const statuses: LeaveRequest['status'][] = ['draft', 'pending', 'approved', 'rejected', 'cancelled'];
    expect(statuses.length).toBe(5);
  });
});

describe('Domain Types - Compensation', () => {
  it('CompensationRecord type is valid', () => {
    const comp: CompensationRecord = {
      id: 'comp-1', employeeId: 'emp-1', effectiveDate: '2025-01-01',
      baseSalary: 100000, currency: 'USD', salaryFrequency: 'annual',
      bonusAmount: null, bonusType: null, totalCompensation: 100000,
      externalSyncId: null, externalSyncedAt: null,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(comp.baseSalary).toBe(100000);
  });

  it('CompensationRecord supports all frequencies', () => {
    const freqs: CompensationRecord['salaryFrequency'][] = ['annual', 'monthly', 'biweekly', 'weekly'];
    expect(freqs.length).toBe(4);
  });
});

describe('Domain Types - Milestone', () => {
  it('Milestone type is valid', () => {
    const ms: Milestone = {
      id: 'ms-1', employeeId: 'emp-1', milestoneType: 'probation_end',
      milestoneDate: '2025-06-01', description: 'Probation ends',
      alertDaysBefore: 14, status: 'upcoming',
      acknowledgedAt: null, acknowledgedBy: null,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(ms.milestoneType).toBe('probation_end');
  });

  it('Milestone supports all types', () => {
    const types: Milestone['milestoneType'][] = ['work_anniversary', 'probation_end', 'visa_expiry', 'certification_expiry', 'contract_expiry', 'performance_review', 'promotion', 'role_change', 'team_change'];
    expect(types.length).toBe(9);
  });

  it('Milestone supports all statuses', () => {
    const statuses: Milestone['status'][] = ['upcoming', 'due', 'overdue', 'completed', 'acknowledged'];
    expect(statuses.length).toBe(5);
  });
});

describe('Domain Types - Workflow', () => {
  it('Workflow type is valid', () => {
    const wf: Workflow = {
      id: 'wf-1', workflowType: 'leave_approval', referenceType: 'leave_request',
      referenceId: 'lr-1', initiatorId: 'emp-1', status: 'pending',
      currentStep: 1, totalSteps: 2, startedAt: '2025-01-01',
      completedAt: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(wf.workflowType).toBe('leave_approval');
  });

  it('ApprovalStep type is valid', () => {
    const step: ApprovalStep = {
      id: 'as-1', workflowId: 'wf-1', stepNumber: 1,
      approverId: 'emp-2', approverRole: 'manager', status: 'pending',
      comments: null, actedAt: null, dueDate: '2025-01-15',
      escalatedTo: null, escalatedAt: null,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(step.status).toBe('pending');
  });
});

describe('Domain Types - Review', () => {
  it('ReviewCycle type is valid', () => {
    const cycle: ReviewCycle = {
      id: 'rc-1', name: 'Q1 2025 Review', reviewType: 'annual',
      startDate: '2025-01-01', endDate: '2025-03-31', status: 'active',
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(cycle.reviewType).toBe('annual');
  });

  it('ReviewInstance type is valid', () => {
    const ri: ReviewInstance = {
      id: 'ri-1', cycleId: 'rc-1', employeeId: 'emp-1', reviewerId: 'emp-2',
      status: 'in_progress', dueDate: '2025-02-28',
      submittedAt: null, completedAt: null,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(ri.status).toBe('in_progress');
  });

  it('Goal type is valid', () => {
    const goal: Goal = {
      id: 'g-1', employeeId: 'emp-1', title: 'Complete project',
      description: null, status: 'active',
      startDate: '2025-01-01', targetDate: '2025-06-01',
      completedAt: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(goal.status).toBe('active');
  });
});

describe('Domain Types - Communication', () => {
  it('CommunicationTemplate type is valid', () => {
    const tmpl: CommunicationTemplate = {
      id: 'ct-1', name: 'Welcome Email', category: 'onboarding',
      channel: 'email', subject: 'Welcome!', body: 'Hello {{name}}',
      variables: ['name'], createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(tmpl.channel).toBe('email');
  });

  it('CommunicationDraft type is valid', () => {
    const draft: CommunicationDraft = {
      id: 'cd-1', templateId: 'ct-1', channel: 'slack',
      recipientId: 'emp-1', subject: null, body: 'Hello!',
      variables: { name: 'John' }, status: 'draft',
      approvedBy: null, approvedAt: null, sentAt: null,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    expect(draft.status).toBe('draft');
  });
});

describe('Domain Types - Audit', () => {
  it('AuditEvent type is valid', () => {
    const event: AuditEvent = {
      id: 'ae-1', eventType: 'update', entityType: 'employee',
      entityId: 'emp-1', actorId: 'emp-2', actorType: 'user',
      action: 'update_profile', previousState: null, newState: null,
      metadata: null, ipAddress: null, userAgent: null,
      createdAt: '2025-01-01',
    };
    expect(event.actorType).toBe('user');
  });
});

describe('Agent Types', () => {
  it('AgentResult type is valid', () => {
    const result: AgentResult<string> = {
      success: true,
      summary: 'Operation completed',
      confidence: 0.95,
      data: 'test data',
      risks: ['potential risk'],
      requiresApproval: false,
      proposedActions: [{ type: 'notify', label: 'Send notification', payload: { to: 'user' } }],
      citations: [{ source: 'BambooHR', reference: 'EMP001' }],
    };
    expect(result.success).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.proposedActions?.length).toBe(1);
    expect(result.citations?.length).toBe(1);
  });

  it('AgentResult works without optional fields', () => {
    const result: AgentResult = {
      success: false, summary: 'Failed', confidence: 0,
      data: null, risks: [], requiresApproval: false,
    };
    expect(result.proposedActions).toBeUndefined();
    expect(result.citations).toBeUndefined();
  });

  it('ProposedAction type is valid', () => {
    const action: ProposedAction = {
      type: 'approve', label: 'Approve request', payload: { id: '123' },
    };
    expect(action.type).toBe('approve');
  });

  it('Citation type is valid', () => {
    const citation: Citation = { source: 'HR3', reference: 'PAY-001' };
    expect(citation.source).toBe('HR3');
  });

  it('AgentType covers all agents', () => {
    const types: AgentType[] = [
      'coordinator', 'employee_profile', 'document_compliance',
      'leave_milestones', 'compensation', 'reporting',
      'communications', 'reviews', 'performance',
    ];
    expect(types.length).toBe(9);
  });

  it('AgentIntent covers all intents', () => {
    const intents: AgentIntent[] = [
      'employee_search', 'employee_summary', 'document_list',
      'document_classify', 'leave_balance', 'leave_request_submit',
      'milestone_list', 'pending_workflows',
    ];
    expect(intents.length).toBe(8);
  });
});

describe('UI Types', () => {
  it('NavItem type supports children', () => {
    const item: NavItem = {
      title: 'Parent', href: '/parent', icon: 'folder', badge: 5,
      children: [{ title: 'Child', href: '/child' }],
    };
    expect(item.children?.length).toBe(1);
  });

  it('DashboardMetric type is valid', () => {
    const metric: DashboardMetric = {
      label: 'Users', value: 100, change: 5, trend: 'up', prefix: '$', suffix: 'k',
    };
    expect(metric.label).toBe('Users');
  });

  it('ActionItem type is valid', () => {
    const item: ActionItem = {
      id: '1', type: 'task', title: 'Do thing', description: 'desc',
      priority: 'high', dueDate: '2025-01-01', assignee: 'user',
      entityType: 'task', entityId: 't-1',
    };
    expect(item.priority).toBe('high');
  });

  it('EmployeeSummary type is valid', () => {
    const summary: EmployeeSummary = {
      id: '1', name: 'John', email: 'j@t.com', position: 'Dev',
      team: 'Eng', status: 'active', hireDate: '2020-01-01', manager: 'Jane',
    };
    expect(summary.status).toBe('active');
  });

  it('ReportColumn type is valid', () => {
    const col: ReportColumn = {
      key: 'name', label: 'Name', type: 'text', format: 'uppercase', width: 200,
    };
    expect(col.type).toBe('text');
  });

  it('Priority type covers all values', () => {
    const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];
    expect(priorities.length).toBe(4);
  });

  it('WorkflowStatus type covers all values', () => {
    const statuses: WorkflowStatus[] = ['pending', 'in_progress', 'completed', 'rejected', 'cancelled'];
    expect(statuses.length).toBe(5);
  });
});
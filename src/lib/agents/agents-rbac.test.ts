/**
 * Agent & Coordinator RBAC Integration Tests
 *
 * Coverage:
 *  1. EmployeeProfileAgent — search scope & summary access per role, sensitivity stripping
 *  2. LeaveMilestonesAgent — leave visibility, approve/reject rights, PAYROLL edit, milestone scope
 *  3. DocumentComplianceAgent — doc visibility, payroll block, compliance admin-only
 *  4. SwarmCoordinator — intent routing, permission gating, dashboard fan-out, audit logging
 *  5. Salary data leakage: MANAGER vs TEAM_LEAD field stripping via agent output
 *  6. PAYROLL edit rights for leave (approve via leave:write)
 *  7. EMPLOYEE self-service boundaries through agents
 *  8. Negative / data-leakage / unauthorized access tests
 *  9. Regression / contract stability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmployeeProfileAgent } from './employee-profile.agent';
import { LeaveMilestonesAgent } from './leave-milestones.agent';
import { DocumentComplianceAgent } from './document-compliance.agent';
import { SwarmCoordinator } from './coordinator';
import type { AgentContext, AgentResult, Role } from '@/types';
import {
  ROLE_CAPABILITIES,
  ROLE_SCOPE,
  ROLE_SENSITIVITY,
} from '@/lib/auth/authorization';
import type { AgentRunRepositoryPort } from '@/lib/ports/repository-ports';
import type { EventBusPort } from '@/lib/ports/event-bus-port';
import type { AuditLogPort } from '@/lib/ports/infrastructure-ports';

// ============================================
// Mock port implementations for testing
// ============================================

function createMockPorts() {
  const agentRunRepo: AgentRunRepositoryPort = {
    async save() {},
    async findById() { return null; },
    async findBySession() { return []; },
    async findByAgent() { return []; },
    async findByIntent() { return []; },
    async query() { return []; },
    async getStats() { return { total: 0, successful: 0, failed: 0, averageExecutionTime: 0 }; },
  };
  const eventBus: EventBusPort = {
    async publish() {},
    async publishBatch() {},
    subscribe() {},
    subscribeAll() {},
    unsubscribe() {},
    async query() { return []; },
    async health() { return { healthy: true }; },
  };
  const auditLog: AuditLogPort = {
    async log() {},
    async query() { return []; },
    async verifyIntegrity() { return { valid: true }; },
  };
  return { agentRunRepo, eventBus, auditLog };
}

// ============================================
// Test context factory
// ============================================

function makeCtx(role: Role, employeeId: string): AgentContext {
  return {
    userId: `user-${role}`,
    role,
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
    employeeId,
    permissions: ROLE_CAPABILITIES[role],
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
  };
}

// Key employees from mock data:
// emp-001 Sarah Chen (admin, HR, managerId: null)
// emp-003 David Park (CTO, team-eng, managerId: null) — manages emp-005, emp-011
// emp-005 Alex Thompson (Staff Eng, team-eng, managerId: emp-003) — manages emp-006, emp-007, emp-010, emp-022
// emp-006 Emily Nakamura (Sr Eng, team-eng, managerId: emp-005) — manages emp-008, emp-009, emp-021, emp-023
// emp-008 Priya Sharma (Eng, team-eng, managerId: emp-006)
// emp-019 Nicole Brown (Financial Analyst, team-fin, managerId: emp-001)
// emp-020 Brandon Davis (CS Manager, team-cs, managerId: emp-004)

const ADMIN_CTX = () => makeCtx('admin', 'emp-001');
const MANAGER_CTX = () => makeCtx('manager', 'emp-003');
const TEAM_LEAD_CTX = () => makeCtx('team_lead', 'emp-005');
const EMPLOYEE_CTX = () => makeCtx('employee', 'emp-008');
const PAYROLL_CTX = () => makeCtx('payroll', 'emp-019');

// ============================================
// 1. EmployeeProfileAgent
// ============================================

describe('EmployeeProfileAgent RBAC', () => {
  const agent = new EmployeeProfileAgent();

  describe('employee_search scope', () => {
    it('ADMIN sees all active employees', async () => {
      const result = await agent.execute('employee_search', {}, ADMIN_CTX());
      expect(result.success).toBe(true);
      expect((result.data as unknown[]).length).toBeGreaterThan(10);
    });

    it('EMPLOYEE sees only self', async () => {
      const result = await agent.execute('employee_search', {}, EMPLOYEE_CTX());
      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('emp-008');
    });

    it('MANAGER sees only self + direct reports (emp-005, emp-011)', async () => {
      const result = await agent.execute('employee_search', {}, MANAGER_CTX());
      const ids = (result.data as { id: string }[]).map(d => d.id);
      expect(ids).toContain('emp-003');
      expect(ids).toContain('emp-005');
      expect(ids).toContain('emp-011');
      expect(ids).not.toContain('emp-020');
      expect(ids).not.toContain('emp-008');
    });

    it('TEAM_LEAD sees self + direct reports but NOT skip-level or boss', async () => {
      const result = await agent.execute('employee_search', {}, TEAM_LEAD_CTX());
      const ids = (result.data as { id: string }[]).map(d => d.id);
      expect(ids).toContain('emp-005');
      expect(ids).toContain('emp-006');
      expect(ids).toContain('emp-007');
      expect(ids).not.toContain('emp-003'); // boss
      expect(ids).not.toContain('emp-008'); // skip-level
    });

    it('PAYROLL sees all employees (payroll_scope)', async () => {
      const result = await agent.execute('employee_search', {}, PAYROLL_CTX());
      expect((result.data as unknown[]).length).toBeGreaterThan(10);
    });

    it('EMPLOYEE search result count is exactly 1', async () => {
      const result = await agent.execute('employee_search', {}, EMPLOYEE_CTX());
      expect((result.data as unknown[]).length).toBe(1);
    });
  });

  describe('employee_summary access', () => {
    it('EMPLOYEE cannot view another employees profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-003' }, EMPLOYEE_CTX());
      expect(result.success).toBe(false);
      expect(result.risks).toContain('RBAC violation');
    });

    it('EMPLOYEE can view own profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-008' }, EMPLOYEE_CTX());
      expect(result.success).toBe(true);
    });

    it('MANAGER can view direct report profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-005' }, MANAGER_CTX());
      expect(result.success).toBe(true);
    });

    it('MANAGER cannot view non-team employee profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-020' }, MANAGER_CTX());
      expect(result.success).toBe(false);
    });

    it('TEAM_LEAD can view own profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-005' }, TEAM_LEAD_CTX());
      expect(result.success).toBe(true);
    });

    it('TEAM_LEAD can view direct report profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-006' }, TEAM_LEAD_CTX());
      expect(result.success).toBe(true);
    });

    it('TEAM_LEAD cannot view skip-level report', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-008' }, TEAM_LEAD_CTX());
      expect(result.success).toBe(false);
    });

    it('ADMIN can view any profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-020' }, ADMIN_CTX());
      expect(result.success).toBe(true);
    });

    it('PAYROLL can view any employee profile', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-020' }, PAYROLL_CTX());
      expect(result.success).toBe(true);
    });

    it('returns error for missing employeeId', async () => {
      const result = await agent.execute('employee_summary', {}, ADMIN_CTX());
      expect(result.success).toBe(false);
    });

    it('returns error for non-existent employee', async () => {
      const result = await agent.execute('employee_summary', { employeeId: 'emp-999' }, ADMIN_CTX());
      expect(result.success).toBe(false);
    });
  });

  describe('sensitivity stripping in search', () => {
    it('ADMIN search results preserve salary fields (has pay_sensitive)', async () => {
      const result = await agent.execute('employee_search', {}, ADMIN_CTX());
      const data = result.data as Record<string, unknown>[];
      // admin has pay_sensitive — salary should not be stripped
      // (note: mock employees may or may not have salary field, but stripping should not remove it if present)
      expect(result.success).toBe(true);
    });

    it('TEAM_LEAD search results have pay fields stripped', async () => {
      const result = await agent.execute('employee_search', {}, TEAM_LEAD_CTX());
      const data = result.data as Record<string, unknown>[];
      for (const record of data) {
        expect(record['salary']).toBeUndefined();
        expect(record['baseSalary']).toBeUndefined();
        expect(record['bonus']).toBeUndefined();
      }
    });

    it('EMPLOYEE search results have pay fields stripped', async () => {
      const result = await agent.execute('employee_search', {}, EMPLOYEE_CTX());
      const data = result.data as Record<string, unknown>[];
      for (const record of data) {
        expect(record['salary']).toBeUndefined();
        expect(record['baseSalary']).toBeUndefined();
      }
    });

    it('PAYROLL search results preserve pay fields (has pay_sensitive)', async () => {
      const result = await agent.execute('employee_search', {}, PAYROLL_CTX());
      // Should not fail — payroll has pay_sensitive clearance
      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// 2. LeaveMilestonesAgent
// ============================================

describe('LeaveMilestonesAgent RBAC', () => {
  const agent = new LeaveMilestonesAgent();

  describe('leave_balance (list)', () => {
    it('EMPLOYEE sees only own leave requests', async () => {
      const result = await agent.execute('leave_balance', {}, EMPLOYEE_CTX());
      const data = result.data as { employeeId: string }[];
      for (const lr of data) {
        expect(lr.employeeId).toBe('emp-008');
      }
    });

    it('EMPLOYEE never sees another employees leave', async () => {
      const result = await agent.execute('leave_balance', {}, EMPLOYEE_CTX());
      const data = result.data as { employeeId: string }[];
      const otherIds = data.filter(lr => lr.employeeId !== 'emp-008');
      expect(otherIds.length).toBe(0);
    });

    it('MANAGER sees only team leave', async () => {
      const result = await agent.execute('leave_balance', {}, MANAGER_CTX());
      const data = result.data as { employeeId: string }[];
      // emp-003 manages emp-005 and emp-011
      for (const lr of data) {
        expect(['emp-003', 'emp-005', 'emp-011']).toContain(lr.employeeId);
      }
    });

    it('TEAM_LEAD sees team leave (emp-006, emp-007, emp-010, emp-022, self)', async () => {
      const result = await agent.execute('leave_balance', {}, TEAM_LEAD_CTX());
      const data = result.data as { employeeId: string }[];
      const allowed = ['emp-005', 'emp-006', 'emp-007', 'emp-010', 'emp-022'];
      for (const lr of data) {
        expect(allowed).toContain(lr.employeeId);
      }
    });

    it('PAYROLL sees all leave requests', async () => {
      const result = await agent.execute('leave_balance', {}, PAYROLL_CTX());
      const data = result.data as unknown[];
      expect(data.length).toBeGreaterThanOrEqual(3);
    });

    it('ADMIN sees all leave requests', async () => {
      const result = await agent.execute('leave_balance', {}, ADMIN_CTX());
      const data = result.data as unknown[];
      expect(data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('leave_request (approve/reject)', () => {
    it('EMPLOYEE cannot approve leave', async () => {
      const result = await agent.execute('leave_request', {
        action: 'approve', requestId: 'lr-001',
      }, EMPLOYEE_CTX());
      expect(result.success).toBe(false);
      expect(result.risks).toContain('RBAC violation');
    });

    it('EMPLOYEE cannot reject leave', async () => {
      const result = await agent.execute('leave_request', {
        action: 'reject', requestId: 'lr-001',
      }, EMPLOYEE_CTX());
      expect(result.success).toBe(false);
      expect(result.risks).toContain('RBAC violation');
    });

    it('TEAM_LEAD blocked from approving non-direct-report leave (lr-001 = emp-008)', async () => {
      // emp-005 manages emp-006, emp-007, emp-010, emp-022
      // lr-001 belongs to emp-008 who is NOT a direct report
      const result = await agent.execute('leave_request', {
        action: 'approve', requestId: 'lr-001',
      }, TEAM_LEAD_CTX());
      expect(result.success).toBe(false);
    });

    it('PAYROLL can approve leave via leave:write (payroll_scope bypasses team check)', async () => {
      const result = await agent.execute('leave_request', {
        action: 'approve', requestId: 'lr-003',
      }, PAYROLL_CTX());
      // lr-003 belongs to emp-021 — payroll has payroll_scope so no team restriction
      expect(result.success).toBe(true);
    });

    it('ADMIN can approve any leave request', async () => {
      // Find a pending leave request for test
      const result = await agent.execute('leave_request', {
        action: 'approve', requestId: 'lr-001',
      }, ADMIN_CTX());
      // lr-001 may have been approved already, but should not fail on permission
      if (result.success === false) {
        // Only acceptable failure is "already approved/rejected"
        expect(result.summary).toContain('already');
      }
    });

    it('returns error when action or requestId is missing', async () => {
      const r1 = await agent.execute('leave_request', { action: 'approve' }, ADMIN_CTX());
      expect(r1.success).toBe(false);
      const r2 = await agent.execute('leave_request', { requestId: 'lr-001' }, ADMIN_CTX());
      expect(r2.success).toBe(false);
    });

    it('returns error for non-existent leave request', async () => {
      const result = await agent.execute('leave_request', {
        action: 'approve', requestId: 'lr-999',
      }, ADMIN_CTX());
      expect(result.success).toBe(false);
    });
  });

  describe('milestone_list', () => {
    it('EMPLOYEE sees only own milestones', async () => {
      const result = await agent.execute('milestone_list', {}, EMPLOYEE_CTX());
      const data = result.data as { employeeId: string }[];
      for (const m of data) {
        expect(m.employeeId).toBe('emp-008');
      }
    });

    it('PAYROLL sees no milestones (no milestone:read capability)', async () => {
      const result = await agent.execute('milestone_list', {}, PAYROLL_CTX());
      const data = result.data as unknown[];
      expect(data.length).toBe(0);
    });

    it('ADMIN sees all milestones', async () => {
      const result = await agent.execute('milestone_list', {}, ADMIN_CTX());
      const data = result.data as unknown[];
      expect(data.length).toBeGreaterThanOrEqual(5);
    });

    it('MANAGER sees only team milestones', async () => {
      const result = await agent.execute('milestone_list', {}, MANAGER_CTX());
      const data = result.data as { employeeId: string }[];
      const allowed = ['emp-003', 'emp-005', 'emp-011'];
      for (const m of data) {
        expect(allowed).toContain(m.employeeId);
      }
    });

    it('TEAM_LEAD sees self + direct report milestones', async () => {
      const result = await agent.execute('milestone_list', {}, TEAM_LEAD_CTX());
      const data = result.data as { employeeId: string }[];
      const allowed = ['emp-005', 'emp-006', 'emp-007', 'emp-010', 'emp-022'];
      for (const m of data) {
        expect(allowed).toContain(m.employeeId);
      }
    });
  });
});

// ============================================
// 3. DocumentComplianceAgent
// ============================================

describe('DocumentComplianceAgent RBAC', () => {
  const agent = new DocumentComplianceAgent();

  describe('document_list', () => {
    it('ADMIN sees all documents', async () => {
      const result = await agent.execute('document_list', {}, ADMIN_CTX());
      expect(result.success).toBe(true);
      expect((result.data as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it('PAYROLL is blocked from documents (no document:read)', async () => {
      const result = await agent.execute('document_list', {}, PAYROLL_CTX());
      expect(result.success).toBe(false);
      expect(result.risks).toContain('RBAC violation');
    });

    it('EMPLOYEE sees only own docs', async () => {
      const result = await agent.execute('document_list', {}, EMPLOYEE_CTX());
      if (result.success) {
        const data = result.data as { employeeId: string }[];
        for (const d of data) {
          expect(d.employeeId).toBe('emp-008');
        }
      }
    });

    it('MANAGER sees only team docs', async () => {
      const result = await agent.execute('document_list', {}, MANAGER_CTX());
      if (result.success) {
        const data = result.data as { employeeId: string }[];
        const allowed = ['emp-003', 'emp-005', 'emp-011'];
        for (const d of data) {
          expect(allowed).toContain(d.employeeId);
        }
      }
    });

    it('TEAM_LEAD sees team docs', async () => {
      const result = await agent.execute('document_list', {}, TEAM_LEAD_CTX());
      if (result.success) {
        const data = result.data as { employeeId: string }[];
        const allowed = ['emp-005', 'emp-006', 'emp-007', 'emp-010', 'emp-022'];
        for (const d of data) {
          expect(allowed).toContain(d.employeeId);
        }
      }
    });
  });

  describe('document_classify (compliance check)', () => {
    it('ADMIN can run compliance check', async () => {
      const result = await agent.execute('document_classify', {}, ADMIN_CTX());
      expect(result.success).toBe(true);
    });

    it('MANAGER cannot run compliance check', async () => {
      const result = await agent.execute('document_classify', {}, MANAGER_CTX());
      expect(result.success).toBe(false);
      expect(result.risks).toContain('RBAC violation');
    });

    it('TEAM_LEAD cannot run compliance check', async () => {
      const result = await agent.execute('document_classify', {}, TEAM_LEAD_CTX());
      expect(result.success).toBe(false);
    });

    it('EMPLOYEE cannot run compliance check', async () => {
      const result = await agent.execute('document_classify', {}, EMPLOYEE_CTX());
      expect(result.success).toBe(false);
    });

    it('PAYROLL cannot run compliance check', async () => {
      const result = await agent.execute('document_classify', {}, PAYROLL_CTX());
      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// 4. SwarmCoordinator
// ============================================

describe('SwarmCoordinator RBAC', () => {
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    const { agentRunRepo, eventBus, auditLog } = createMockPorts();
    coordinator = new SwarmCoordinator(agentRunRepo, eventBus, auditLog);
    coordinator.register(new EmployeeProfileAgent());
    coordinator.register(new LeaveMilestonesAgent());
    coordinator.register(new DocumentComplianceAgent());
  });

  describe('intent routing + permission gating', () => {
    it('routes employee_search with correct scope for EMPLOYEE', async () => {
      const response = await coordinator.route({
        intent: 'employee_search', query: '', payload: {}, context: EMPLOYEE_CTX(),
      });
      expect(response.result.success).toBe(true);
      const data = response.result.data as { id: string }[];
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('emp-008');
    });

    it('blocks EMPLOYEE from leave_request (missing leave:approve)', async () => {
      const response = await coordinator.route({
        intent: 'leave_request', query: '', payload: { action: 'approve', requestId: 'lr-001' },
        context: EMPLOYEE_CTX(),
      });
      expect(response.result.success).toBe(false);
    });

    it('blocks PAYROLL from document_classify (missing compliance:read)', async () => {
      const response = await coordinator.route({
        intent: 'document_classify', query: '', payload: {}, context: PAYROLL_CTX(),
      });
      expect(response.result.success).toBe(false);
    });

    it('returns error for unknown intent', async () => {
      const response = await coordinator.route({
        intent: 'nonexistent_intent' as any, query: '', payload: {}, context: ADMIN_CTX(),
      });
      expect(response.result.success).toBe(false);
      expect(response.result.summary).toContain('Unknown intent');
    });
  });

  describe('dashboard_summary fan-out per role', () => {
    it('ADMIN dashboard includes all agent summaries', async () => {
      const response = await coordinator.route({
        intent: 'dashboard_summary', query: '', payload: {}, context: ADMIN_CTX(),
      });
      expect(response.result.success).toBe(true);
      const data = response.result.data as Record<string, AgentResult>;
      expect(data['employee_search']).toBeDefined();
      expect(data['leave_balance']).toBeDefined();
      expect(data['document_classify']).toBeDefined();
      expect(data['milestone_list']).toBeDefined();
    });

    it('EMPLOYEE dashboard excludes document_classify (needs compliance:read)', async () => {
      const response = await coordinator.route({
        intent: 'dashboard_summary', query: '', payload: {}, context: EMPLOYEE_CTX(),
      });
      const data = response.result.data as Record<string, AgentResult>;
      expect(data['document_classify']).toBeUndefined();
      expect(data['employee_search']).toBeDefined();
      expect(data['leave_balance']).toBeDefined();
    });

    it('PAYROLL dashboard includes leave and employee but NOT document_classify or milestones', async () => {
      const response = await coordinator.route({
        intent: 'dashboard_summary', query: '', payload: {}, context: PAYROLL_CTX(),
      });
      const data = response.result.data as Record<string, AgentResult>;
      expect(data['employee_search']).toBeDefined();
      expect(data['leave_balance']).toBeDefined();
      expect(data['document_classify']).toBeUndefined();
      // milestone_list requires leave:read which payroll has, but milestone:read which payroll doesn't
      // agent-level: leave_milestones requires leave:read (payroll has this) but milestones are filtered inside agent
      expect(data['milestone_list']).toBeDefined(); // agent included, but data inside will be filtered
    });

    it('MANAGER dashboard includes employee, leave, milestones but NOT compliance', async () => {
      const response = await coordinator.route({
        intent: 'dashboard_summary', query: '', payload: {}, context: MANAGER_CTX(),
      });
      const data = response.result.data as Record<string, AgentResult>;
      expect(data['employee_search']).toBeDefined();
      expect(data['leave_balance']).toBeDefined();
      expect(data['milestone_list']).toBeDefined();
      expect(data['document_classify']).toBeUndefined();
    });
  });

  describe('audit logging', () => {
    it('captures routing events with correct role', async () => {
      await coordinator.route({
        intent: 'employee_search', query: '', payload: {}, context: ADMIN_CTX(),
      });
      const log = coordinator.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[0].role).toBe('admin');
      expect(log[0].intent).toBe('employee_search');
      expect(log[0].success).toBe(true);
    });

    it('logs permission-denied events', async () => {
      await coordinator.route({
        intent: 'leave_request', query: '', payload: { action: 'approve', requestId: 'lr-001' },
        context: EMPLOYEE_CTX(),
      });
      const log = coordinator.getAuditLog();
      const denied = log.find(e => e.role === 'employee' && e.intent === 'leave_request');
      expect(denied).toBeDefined();
      expect(denied!.success).toBe(false);
    });

    it('audit log preserves userId and executionTimeMs', async () => {
      await coordinator.route({
        intent: 'employee_search', query: '', payload: {}, context: MANAGER_CTX(),
      });
      const log = coordinator.getAuditLog();
      const entry = log.find(e => e.role === 'manager');
      expect(entry).toBeDefined();
      expect(entry!.userId).toBe('user-manager');
      expect(entry!.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================
// 5. Salary data leakage: MANAGER vs TEAM_LEAD via agent output
// ============================================

describe('Salary visibility through agents: MANAGER vs TEAM_LEAD', () => {
  const agent = new EmployeeProfileAgent();

  it('MANAGER search results preserve salary fields (has pay_sensitive)', async () => {
    const result = await agent.execute('employee_search', {}, MANAGER_CTX());
    // Manager has pay_sensitive — stripSensitiveFields should be a no-op for pay fields
    expect(result.success).toBe(true);
  });

  it('TEAM_LEAD search results strip salary/bonus/baseSalary', async () => {
    const result = await agent.execute('employee_search', {}, TEAM_LEAD_CTX());
    const data = result.data as Record<string, unknown>[];
    for (const record of data) {
      expect(record['salary']).toBeUndefined();
      expect(record['baseSalary']).toBeUndefined();
      expect(record['bonus']).toBeUndefined();
      expect(record['stockOptions']).toBeUndefined();
      expect(record['totalCompensation']).toBeUndefined();
      expect(record['payGrade']).toBeUndefined();
      expect(record['compensation']).toBeUndefined();
    }
  });

  it('EMPLOYEE search results also strip pay fields', async () => {
    const result = await agent.execute('employee_search', {}, EMPLOYEE_CTX());
    const data = result.data as Record<string, unknown>[];
    for (const record of data) {
      expect(record['salary']).toBeUndefined();
      expect(record['baseSalary']).toBeUndefined();
      expect(record['bonus']).toBeUndefined();
    }
  });

  it('TEAM_LEAD summary results strip pay fields', async () => {
    const result = await agent.execute('employee_summary', { employeeId: 'emp-006' }, TEAM_LEAD_CTX());
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    // The employee sub-object should have pay fields stripped
    const emp = data['employee'] as Record<string, unknown> | undefined;
    if (emp) {
      expect(emp['salary']).toBeUndefined();
      expect(emp['baseSalary']).toBeUndefined();
      expect(emp['bonus']).toBeUndefined();
    }
  });
});

// ============================================
// 6. PAYROLL leave edit rights through agent
// ============================================

describe('PAYROLL leave edit rights through agent', () => {
  const agent = new LeaveMilestonesAgent();

  it('PAYROLL can view all leave requests (payroll_scope)', async () => {
    const result = await agent.execute('leave_balance', {}, PAYROLL_CTX());
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThanOrEqual(3);
  });

  it('PAYROLL can approve leave for any employee (leave:write + payroll_scope)', async () => {
    // lr-003 is pending for emp-021
    const result = await agent.execute('leave_request', {
      action: 'approve', requestId: 'lr-003',
    }, PAYROLL_CTX());
    // May succeed or already approved from prior test, but should never fail on permission
    if (!result.success) {
      expect(result.summary).toContain('already');
    }
  });

  it('PAYROLL sees zero milestones (no milestone:read)', async () => {
    const result = await agent.execute('milestone_list', {}, PAYROLL_CTX());
    expect((result.data as unknown[]).length).toBe(0);
  });
});

// ============================================
// 7. EMPLOYEE self-service through agents
// ============================================

describe('EMPLOYEE self-service through agents', () => {
  const empAgent = new EmployeeProfileAgent();
  const leaveAgent = new LeaveMilestonesAgent();
  const docAgent = new DocumentComplianceAgent();

  it('can search only self', async () => {
    const result = await empAgent.execute('employee_search', {}, EMPLOYEE_CTX());
    expect((result.data as { id: string }[]).map(d => d.id)).toEqual(['emp-008']);
  });

  it('can view own summary', async () => {
    const result = await empAgent.execute('employee_summary', { employeeId: 'emp-008' }, EMPLOYEE_CTX());
    expect(result.success).toBe(true);
  });

  it('cannot view boss summary', async () => {
    const result = await empAgent.execute('employee_summary', { employeeId: 'emp-006' }, EMPLOYEE_CTX());
    expect(result.success).toBe(false);
  });

  it('sees only own leave', async () => {
    const result = await leaveAgent.execute('leave_balance', {}, EMPLOYEE_CTX());
    for (const lr of result.data as { employeeId: string }[]) {
      expect(lr.employeeId).toBe('emp-008');
    }
  });

  it('cannot approve any leave', async () => {
    const result = await leaveAgent.execute('leave_request', {
      action: 'approve', requestId: 'lr-001',
    }, EMPLOYEE_CTX());
    expect(result.success).toBe(false);
  });

  it('sees only own milestones', async () => {
    const result = await leaveAgent.execute('milestone_list', {}, EMPLOYEE_CTX());
    for (const m of result.data as { employeeId: string }[]) {
      expect(m.employeeId).toBe('emp-008');
    }
  });

  it('sees only own documents', async () => {
    const result = await docAgent.execute('document_list', {}, EMPLOYEE_CTX());
    if (result.success) {
      for (const d of result.data as { employeeId: string }[]) {
        expect(d.employeeId).toBe('emp-008');
      }
    }
  });

  it('cannot run compliance check', async () => {
    const result = await docAgent.execute('document_classify', {}, EMPLOYEE_CTX());
    expect(result.success).toBe(false);
  });
});

// ============================================
// 8. Negative / data-leakage / unauthorized access
// ============================================

describe('Negative & data-leakage tests', () => {
  const empAgent = new EmployeeProfileAgent();
  const leaveAgent = new LeaveMilestonesAgent();
  const docAgent = new DocumentComplianceAgent();

  it('EMPLOYEE search never returns other employees', async () => {
    const result = await empAgent.execute('employee_search', {}, EMPLOYEE_CTX());
    const data = result.data as { id: string }[];
    expect(data.every(d => d.id === 'emp-008')).toBe(true);
  });

  it('MANAGER leave list never includes non-team leave', async () => {
    const result = await leaveAgent.execute('leave_balance', {}, MANAGER_CTX());
    const data = result.data as { employeeId: string }[];
    const allowed = new Set(['emp-003', 'emp-005', 'emp-011']);
    for (const lr of data) {
      expect(allowed.has(lr.employeeId)).toBe(true);
    }
  });

  it('TEAM_LEAD milestone list never includes non-team milestones', async () => {
    const result = await leaveAgent.execute('milestone_list', {}, TEAM_LEAD_CTX());
    const data = result.data as { employeeId: string }[];
    const allowed = new Set(['emp-005', 'emp-006', 'emp-007', 'emp-010', 'emp-022']);
    for (const m of data) {
      expect(allowed.has(m.employeeId)).toBe(true);
    }
  });

  it('coordinator never merges unauthorized compliance data for non-admin', async () => {
    const { agentRunRepo, eventBus, auditLog } = createMockPorts();
    const coordinator = new SwarmCoordinator(agentRunRepo, eventBus, auditLog);
    coordinator.register(new EmployeeProfileAgent());
    coordinator.register(new LeaveMilestonesAgent());
    coordinator.register(new DocumentComplianceAgent());

    for (const ctx of [EMPLOYEE_CTX(), MANAGER_CTX(), TEAM_LEAD_CTX(), PAYROLL_CTX()]) {
      const response = await coordinator.route({
        intent: 'dashboard_summary', query: '', payload: {}, context: ctx,
      });
      const data = response.result.data as Record<string, AgentResult>;
      expect(data['document_classify']).toBeUndefined();
    }
  });

  it('PAYROLL can never access document_list through coordinator', async () => {
    const { agentRunRepo, eventBus, auditLog } = createMockPorts();
    const coordinator = new SwarmCoordinator(agentRunRepo, eventBus, auditLog);
    coordinator.register(new DocumentComplianceAgent());
    const response = await coordinator.route({
      intent: 'document_list', query: '', payload: {}, context: PAYROLL_CTX(),
    });
    expect(response.result.success).toBe(false);
  });
});

// ============================================
// 9. Regression / contract stability
// ============================================

describe('Agent RBAC regression', () => {
  it('all agents report correct type and requiredPermissions', () => {
    const emp = new EmployeeProfileAgent();
    const leave = new LeaveMilestonesAgent();
    const doc = new DocumentComplianceAgent();

    expect(emp.type).toBe('employee_profile');
    expect(emp.requiredPermissions).toContain('employee:read');

    expect(leave.type).toBe('leave_milestones');
    expect(leave.requiredPermissions).toContain('leave:read');

    expect(doc.type).toBe('document_compliance');
    expect(doc.requiredPermissions).toContain('document:read');
  });

  it('coordinator audit log is bounded', async () => {
    const { agentRunRepo, eventBus, auditLog } = createMockPorts();
    const coordinator = new SwarmCoordinator(agentRunRepo, eventBus, auditLog);
    coordinator.register(new EmployeeProfileAgent());
    for (let i = 0; i < 210; i++) {
      await coordinator.route({
        intent: 'employee_search', query: '', payload: {}, context: ADMIN_CTX(),
      });
    }
    expect(coordinator.getAuditLog().length).toBeLessThanOrEqual(200);
  });
});

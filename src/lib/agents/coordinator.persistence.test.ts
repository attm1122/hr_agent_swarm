/**
 * Coordinator Persistence Tests
 * 
 * Tests for durable agent run persistence in the coordinator.
 * Covers:
 * - Agent run recording with context, timing, success state
 * - Memory fallback when Supabase unavailable
 * - Query capabilities for observability
 * - Statistics generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SwarmCoordinator } from './coordinator';
import { AgentRunRepository, AgentRunRecord } from '@/lib/repositories/agent-run-repository';
import type { Agent, AgentContext, AgentIntent, AgentResult } from '@/types';
import { createAgentResult } from './base';
import type { AgentRunRepositoryPort } from '@/lib/ports/repository-ports';
import type { EventBusPort } from '@/lib/ports/event-bus-port';
import type { AuditLogPort } from '@/lib/ports/infrastructure-ports';

// ============================================
// Mock port implementations for testing
// ============================================

function createMockEventBus(): EventBusPort {
  return {
    async publish() {},
    async publishBatch() {},
    subscribe() {},
    subscribeAll() {},
    unsubscribe() {},
    async query() { return []; },
    async health() { return { healthy: true }; },
  };
}

function createMockAuditLog(): AuditLogPort {
  return {
    async log() {},
    async query() { return []; },
    async verifyIntegrity() { return { valid: true }; },
  };
}

function createMockAgentRunRepo(): AgentRunRepositoryPort {
  return {
    async save() {},
    async findById() { return null; },
    async findBySession() { return []; },
    async findByAgent() { return []; },
    async findByIntent() { return []; },
    async query() { return []; },
    async getStats() { return { total: 0, successful: 0, failed: 0, averageExecutionTime: 0 }; },
  };
}

// Mock agent for testing
class MockAgent implements Agent {
  readonly type = 'employee_profile' as const;
  readonly name = 'Mock Employee Agent';
  readonly supportedIntents: AgentIntent[] = ['employee_search', 'employee_summary'];
  readonly requiredPermissions = ['employee:read'];

  canHandle(intent: AgentIntent): boolean {
    return this.supportedIntents.includes(intent);
  }

  async execute(
    intent: AgentIntent,
    payload: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    return createAgentResult(
      { employees: [] },
      {
        summary: `Mock ${intent} executed`,
        confidence: 0.95,
      }
    );
  }
}

// Test context
const createTestContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  userId: 'user-001',
  role: 'manager',
  scope: 'team',
  sensitivityClearance: ['self_visible', 'team_visible'],
  employeeId: 'emp-001',
  managerId: 'mgr-001',
  teamId: 'team-001',
  permissions: ['employee:read', 'manager:read'],
  sessionId: 'session-001',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('SwarmCoordinator Persistence', () => {
  let coordinator: SwarmCoordinator;
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Memory-only mode (no persistence)', () => {
    beforeEach(() => {
      coordinator = new SwarmCoordinator(
        createMockAgentRunRepo(), createMockEventBus(), createMockAuditLog(),
        { enablePersistence: false }
      );
      coordinator.register(mockAgent);
    });

    it('should record agent runs to memory', async () => {
      const context = createTestContext();
      const request = {
        intent: 'employee_search' as AgentIntent,
        query: 'find employees',
        payload: { department: 'engineering' },
        context,
      };

      const response = await coordinator.route(request);

      expect(response.result.success).toBe(true);
      expect(response.auditId).toBeDefined();
      expect(response.result.success).toBe(true);

      // Verify in-memory audit log
      const auditLog = coordinator.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[auditLog.length - 1].intent).toBe('employee_search');
      expect(auditLog[auditLog.length - 1].success).toBe(true);
    });

    it('should query agent runs from memory', async () => {
      const context = createTestContext();

      // Execute multiple requests
      await coordinator.route({
        intent: 'employee_search',
        query: 'search 1',
        payload: {},
        context,
      });

      await coordinator.route({
        intent: 'employee_search',
        query: 'search 2',
        payload: {},
        context: createTestContext({ userId: 'user-002' }),
      });

      const result = await coordinator.queryAgentRuns({ userId: 'user-001' });

      expect(result.records.length).toBeGreaterThan(0);
      expect(result.records.every(r => r.context.userId === 'user-001')).toBe(true);
    });

    it('should track success statistics', async () => {
      const context = createTestContext();

      // Execute requests
      await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: {},
        context,
      });

      const stats = await coordinator.getSuccessStats(24);

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.avgExecutionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should report not using persistence', () => {
      expect(coordinator.isUsingPersistence()).toBe(false);
    });
  });

  describe('Persistence mode (via port)', () => {
    let storedRecords: Array<Record<string, unknown>>;
    let spyRepo: AgentRunRepositoryPort;

    beforeEach(() => {
      storedRecords = [];
      spyRepo = {
        async save(record: Record<string, unknown>) { storedRecords.push(record); },
        async findById() { return null; },
        async findBySession() { return []; },
        async findByAgent() { return []; },
        async findByIntent() { return []; },
        async query() { return []; },
        async getStats() { return { total: 0, successful: 0, failed: 0, averageExecutionTime: 0 }; },
      };
      coordinator = new SwarmCoordinator(spyRepo, createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);
    });

    it('should persist agent runs via repository port', async () => {
      const context = createTestContext();
      const request = {
        intent: 'employee_search' as AgentIntent,
        query: 'find employees',
        payload: { department: 'engineering' },
        context,
      };

      const response = await coordinator.route(request);

      expect(response.result.success).toBe(true);

      // Wait for non-blocking persistence
      await new Promise(r => setTimeout(r, 50));

      // Verify data was stored via port
      expect(storedRecords.length).toBeGreaterThan(0);
      const stored = storedRecords[0] as Record<string, unknown>;
      expect(stored.agentType).toBe('employee_profile');
      expect(stored.intent).toBe('employee_search');
      expect(stored.success).toBe(true);
      expect(stored.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include full context in persisted data', async () => {
      const context = createTestContext({
        userId: 'user-test',
        role: 'admin',
        permissions: ['employee:read', 'employee:write'],
      });

      await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: {},
        context,
      });

      // Wait for non-blocking persistence
      await new Promise(r => setTimeout(r, 50));

      const stored = storedRecords[0] as Record<string, unknown>;
      const storedContext = stored.context as Record<string, unknown>;
      expect(storedContext.userId).toBe('user-test');
      expect(storedContext.role).toBe('admin');
      expect(storedContext.permissions).toEqual(['employee:read', 'employee:write']);
      expect(storedContext.sessionId).toBe('session-001');
    });

    it('should include result data in persisted record', async () => {
      const context = createTestContext();

      await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: { filter: 'active' },
        context,
      });

      // Wait for non-blocking persistence
      await new Promise(r => setTimeout(r, 50));

      const stored = storedRecords[0] as Record<string, unknown>;
      expect(stored.inputPayload).toEqual({ filter: 'active' });
      const outputResult = stored.outputResult as Record<string, unknown>;
      expect(outputResult).toBeDefined();
      expect(outputResult.success).toBe(true);
      expect(outputResult.confidence).toBe(0.95);
    });

    it('should report using persistence', () => {
      expect(coordinator.isUsingPersistence()).toBe(true);
    });

    it('should handle repository failures gracefully', async () => {
      // Create coordinator with a failing repo
      const failingRepo: AgentRunRepositoryPort = {
        async save() { throw new Error('DB connection failed'); },
        async findById() { return null; },
        async findBySession() { return []; },
        async findByAgent() { return []; },
        async findByIntent() { return []; },
        async query() { return []; },
        async getStats() { return { total: 0, successful: 0, failed: 0, averageExecutionTime: 0 }; },
      };
      coordinator = new SwarmCoordinator(failingRepo, createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);

      const context = createTestContext();

      // Should not throw even if repo fails
      const response = await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: {},
        context,
      });

      expect(response.result.success).toBe(true);
      // Falls back to in-memory audit log
      expect(coordinator.getAuditLog().length).toBeGreaterThan(0);
    });
  });

  describe('Agent run record structure', () => {
    beforeEach(() => {
      coordinator = new SwarmCoordinator(createMockAgentRunRepo(), createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);
    });

    it('should capture execution timing', async () => {
      const context = createTestContext();
      const startTime = Date.now();
      
      const response = await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: {},
        context,
      });

      expect(response.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.executionTimeMs).toBeLessThan(1000); // Should be fast in tests
    });

    it('should generate unique audit IDs', async () => {
      const context = createTestContext();
      
      const response1 = await coordinator.route({
        intent: 'employee_search',
        query: 'test 1',
        payload: {},
        context,
      });

      const response2 = await coordinator.route({
        intent: 'employee_search',
        query: 'test 2',
        payload: {},
        context,
      });

      expect(response1.auditId).not.toBe(response2.auditId);
      expect(response1.auditId).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
    });

    it('should record failed executions', async () => {
      // Create failing agent
      const failingAgent: Agent = {
        ...mockAgent,
        type: 'document_compliance',
        supportedIntents: ['document_classify'],
        canHandle(intent: AgentIntent) {
          return (this.supportedIntents as AgentIntent[]).includes(intent);
        },
        async execute() {
          throw new Error('Classification failed');
        },
      };
      
      coordinator.register(failingAgent);
      
      const context = createTestContext({ permissions: ['employee:read', 'compliance:read'] });
      const response = await coordinator.route({
        intent: 'document_classify',
        query: 'classify',
        payload: {},
        context,
      });

      expect(response.result.success).toBe(false);
      expect(response.result.summary).toContain('failed');
    });
  });

  describe('Observability queries', () => {
    beforeEach(async () => {
      coordinator = new SwarmCoordinator(createMockAgentRunRepo(), createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);

      // Seed with test data
      const contexts = [
        createTestContext({ userId: 'user-a' }),
        createTestContext({ userId: 'user-b' }),
        createTestContext({ userId: 'user-a' }),
      ];

      for (const ctx of contexts) {
        await coordinator.route({
          intent: 'employee_search',
          query: 'test',
          payload: {},
          context: ctx,
        });
      }
    });

    it('should filter by user ID', async () => {
      const result = await coordinator.queryAgentRuns({ userId: 'user-a' });
      expect(result.records.length).toBe(2);
      expect(result.records.every(r => r.context.userId === 'user-a')).toBe(true);
    });

    it('should limit results', async () => {
      const result = await coordinator.queryAgentRuns({ limit: 2 });
      expect(result.records.length).toBeLessThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const page1 = await coordinator.queryAgentRuns({ limit: 2, offset: 0 });
      const page2 = await coordinator.queryAgentRuns({ limit: 2, offset: 2 });
      
      expect(page1.records.length).toBe(2);
      expect(page2.records.length).toBe(1);
    });
  });
});

describe('AgentRunRepository', () => {
  describe('Memory storage', () => {
    let repo: AgentRunRepository;

    beforeEach(() => {
      repo = new AgentRunRepository();
    });

    it('should store and retrieve records', async () => {
      const record: AgentRunRecord = {
        id: 'test-001',
        agentType: 'employee_profile',
        intent: 'employee_search',
        inputPayload: {},
        outputResult: null,
        confidence: 0.9,
        executionTimeMs: 100,
        success: true,
        errorMessage: null,
        context: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['read'],
          sessionId: 'session-001',
          timestamp: new Date().toISOString(),
        },
        metadata: {
          isModelBacked: true,
          isFallback: false,
        },
        createdAt: new Date().toISOString(),
      };

      await repo.saveAgentRun(record);
      const retrieved = await repo.getAgentRun('test-001');

      expect(retrieved).toEqual(record);
    });

    it('should enforce max memory size', async () => {
      // Create repo with small limit
      const smallRepo = new AgentRunRepository();
      (smallRepo as unknown as { maxMemorySize: number }).maxMemorySize = 5;

      // Add more records than limit
      for (let i = 0; i < 10; i++) {
        await smallRepo.saveAgentRun({
          id: `test-${i}`,
          agentType: 'employee_profile',
          intent: 'employee_search',
          inputPayload: {},
          outputResult: null,
          confidence: 0.9,
          executionTimeMs: 100,
          success: true,
          errorMessage: null,
          context: {
            userId: 'user-001',
            role: 'manager',
            permissions: ['read'],
            sessionId: 'session-001',
            timestamp: new Date().toISOString(),
          },
          metadata: { isModelBacked: true, isFallback: false },
          createdAt: new Date().toISOString(),
        });
      }

      const { records } = await smallRepo.queryAgentRuns({ limit: 100 });
      expect(records.length).toBeLessThanOrEqual(5);
    });

    it('should calculate success statistics', async () => {
      // Add mixed success/failure records
      const baseRecord = {
        agentType: 'employee_profile' as const,
        intent: 'employee_search' as const,
        inputPayload: {},
        outputResult: null,
        confidence: 0.9,
        executionTimeMs: 100,
        errorMessage: null,
        context: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['read'],
          sessionId: 'session-001',
          timestamp: new Date().toISOString(),
        },
        metadata: { isModelBacked: true, isFallback: false },
        createdAt: new Date().toISOString(),
      };

      await repo.saveAgentRun({ ...baseRecord, id: '1', success: true });
      await repo.saveAgentRun({ ...baseRecord, id: '2', success: true });
      await repo.saveAgentRun({ ...baseRecord, id: '3', success: false });

      const stats = await repo.getSuccessStats(24);

      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate agent type distribution', async () => {
      const baseRecord = {
        intent: 'employee_search' as const,
        inputPayload: {},
        outputResult: null,
        confidence: 0.9,
        executionTimeMs: 100,
        success: true,
        errorMessage: null,
        context: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['read'],
          sessionId: 'session-001',
          timestamp: new Date().toISOString(),
        },
        metadata: { isModelBacked: true, isFallback: false },
        createdAt: new Date().toISOString(),
      };

      await repo.saveAgentRun({ ...baseRecord, id: '1', agentType: 'employee_profile' as const });
      await repo.saveAgentRun({ ...baseRecord, id: '2', agentType: 'employee_profile' as const });
      await repo.saveAgentRun({ ...baseRecord, id: '3', agentType: 'onboarding' as const });

      const distribution = await repo.getAgentTypeDistribution(24);

      expect(distribution.length).toBe(2);
      expect(distribution.find(d => d.agentType === 'employee_profile')?.count).toBe(2);
      expect(distribution.find(d => d.agentType === 'onboarding')?.count).toBe(1);
    });

    it('should cleanup old records', async () => {
      const oldRecord = {
        id: 'old-001',
        agentType: 'employee_profile' as const,
        intent: 'employee_search' as const,
        inputPayload: {},
        outputResult: null,
        confidence: 0.9,
        executionTimeMs: 100,
        success: true,
        errorMessage: null,
        context: {
          userId: 'user-001',
          role: 'manager',
          permissions: ['read'],
          sessionId: 'session-001',
          timestamp: new Date().toISOString(),
        },
        metadata: { isModelBacked: true, isFallback: false },
        createdAt: '2020-01-01T00:00:00Z', // Very old
      };

      await repo.saveAgentRun(oldRecord);
      const deleted = await repo.cleanupOldRecords(30); // 30 days retention

      expect(deleted).toBe(1);
      expect(await repo.getAgentRun('old-001')).toBeNull();
    });
  });
});

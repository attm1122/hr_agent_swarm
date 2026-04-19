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
import type { AgentContext, AgentIntent, AgentResult } from '@/types';
import type { Agent } from './base';
import { createAgentResult } from './base';
import type { AgentRunRepositoryPort, EventBusPort, AuditLogPort } from '@/lib/ports';

// Mock port factories
const createMockAgentRunRepo = (): AgentRunRepositoryPort => ({
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn().mockResolvedValue(null),
  findBySession: vi.fn().mockResolvedValue([]),
  findByAgent: vi.fn().mockResolvedValue([]),
  findByIntent: vi.fn().mockResolvedValue([]),
  query: vi.fn().mockResolvedValue([]),
  getStats: vi.fn().mockResolvedValue({ total: 0, successful: 0, failed: 0, averageExecutionTime: 0 }),
});

const createMockEventBus = (): EventBusPort => ({
  publish: vi.fn().mockResolvedValue(undefined),
  publishBatch: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
  subscribeAll: vi.fn(),
  unsubscribe: vi.fn(),
  query: vi.fn().mockResolvedValue([]),
  health: vi.fn().mockResolvedValue({ healthy: true }),
});

const createMockAuditLog = (): AuditLogPort => ({
  log: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  verifyIntegrity: vi.fn().mockResolvedValue({ valid: true }),
});

// Adapter to use legacy AgentRunRepository with the new port interface
function adaptRepo(repo: AgentRunRepository): AgentRunRepositoryPort {
  return {
    save: async (record) => { await repo.saveAgentRun(record as never); },
    findById: async (id) => repo.getAgentRun(id) as ReturnType<AgentRunRepositoryPort['findById']>,
    findBySession: vi.fn(),
    findByAgent: vi.fn(),
    findByIntent: vi.fn(),
    query: vi.fn(),
    getStats: vi.fn(),
  };
}

// Mock Supabase client type
type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
  _storedData: Array<Record<string, unknown>>;
};

// Mock Supabase client
const createMockSupabaseClient = (shouldFail: boolean = false): MockSupabaseClient => {
  const storedData: Array<Record<string, unknown>> = [];
  
  const createQueryBuilder = () => {
    const queryState = {
      filters: [] as Array<() => unknown>,
      orderCol: '',
      orderAsc: true,
      rangeStart: 0,
      rangeEnd: Infinity,
    };

    const queryBuilder = {
      eq: vi.fn(() => queryBuilder),
      contains: vi.fn(() => queryBuilder),
      gte: vi.fn(() => queryBuilder),
      lte: vi.fn(() => queryBuilder),
      order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
        queryState.orderCol = col;
        queryState.orderAsc = opts?.ascending ?? false;
        return queryBuilder;
      }),
      range: vi.fn((start: number, end: number) => {
        queryState.rangeStart = start;
        queryState.rangeEnd = end;
        return Promise.resolve({
          error: shouldFail ? new Error('Query failed') : null,
          data: shouldFail ? null : storedData.slice(start, end + 1).map(d => ({
            id: d.id,
            agent_type: d.agent_type,
            intent: d.intent,
            success: d.success,
            execution_time_ms: d.execution_time_ms,
            created_at: d.created_at,
            input_payload: d.input_payload,
            output_result: d.output_result,
            confidence: d.confidence,
            error_message: d.error_message,
            context: d.context,
          })),
          count: shouldFail ? 0 : storedData.length,
        });
      }),
    };

    return queryBuilder;
  };

  return {
    from: vi.fn(() => ({
      insert: vi.fn(async (data: Record<string, unknown>) => {
        if (shouldFail) {
          return { error: new Error('DB connection failed'), data: null };
        }
        storedData.push(data);
        return { error: null, data };
      }),
      select: vi.fn(() => createQueryBuilder()),
    })),
    _storedData: storedData,
  };
};

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
  tenantId: 'tenant-001',
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

  describe('Memory-only mode (no Supabase)', () => {
    let repo: AgentRunRepository;

    beforeEach(() => {
      repo = new AgentRunRepository(); // No supabase = memory mode
      coordinator = new SwarmCoordinator(adaptRepo(repo), createMockEventBus(), createMockAuditLog());
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
    });

    it('should report not using persistence', () => {
      expect(repo.isUsingPersistence()).toBe(false);
    });
  });

  describe('Supabase persistence mode', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
    let repo: AgentRunRepository;

    beforeEach(() => {
      mockSupabase = createMockSupabaseClient(false);
      repo = new AgentRunRepository(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);
      coordinator = new SwarmCoordinator(adaptRepo(repo), createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);
    });

    it('should persist agent runs to Supabase', async () => {
      const context = createTestContext();
      const request = {
        intent: 'employee_search' as AgentIntent,
        query: 'find employees',
        payload: { department: 'engineering' },
        context,
      };

      const response = await coordinator.route(request);

      expect(response.result.success).toBe(true);
      
      // Verify Supabase was called
      expect(mockSupabase.from).toHaveBeenCalledWith('agent_runs');
      
      // Verify data was stored
      expect(mockSupabase._storedData.length).toBeGreaterThan(0);
      const stored = mockSupabase._storedData[0];
      expect(stored.agent_type).toBe('employee_profile');
      expect(stored.intent).toBe('employee_search');
      expect(stored.success).toBe(true);
      expect(stored.execution_time_ms).toBeGreaterThanOrEqual(0);
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

      const stored = mockSupabase._storedData[0];
      expect(stored.context).toEqual({
        userId: 'user-test',
        role: 'admin',
        permissions: ['employee:read', 'employee:write'],
        sessionId: 'session-001',
        timestamp: context.timestamp,
      });
    });

    it('should include result data in persisted record', async () => {
      const context = createTestContext();
      
      await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: { filter: 'active' },
        context,
      });

      const stored = mockSupabase._storedData[0];
      expect(stored.input_payload).toEqual({ filter: 'active' });
      expect(stored.output_result).toBeDefined();
      expect((stored.output_result as Record<string, unknown>).success).toBe(true);
      expect((stored.output_result as Record<string, unknown>).confidence).toBe(0.95);
    });

    it('should report using persistence', () => {
      expect(repo.isUsingPersistence()).toBe(true);
    });

    it('should handle Supabase failures gracefully', async () => {
      // Create failing mock
      const failingMock = createMockSupabaseClient(true);
      const failingRepo = new AgentRunRepository(failingMock as unknown as import('@supabase/supabase-js').SupabaseClient);
      coordinator = new SwarmCoordinator(adaptRepo(failingRepo), createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);

      const context = createTestContext();
      
      // Should not throw even if DB fails
      const response = await coordinator.route({
        intent: 'employee_search',
        query: 'test',
        payload: {},
        context,
      });

      expect(response.result.success).toBe(true);
    });
  });

  describe('Agent run record structure', () => {
    beforeEach(() => {
      const repo = new AgentRunRepository();
      coordinator = new SwarmCoordinator(adaptRepo(repo), createMockEventBus(), createMockAuditLog());
      coordinator.register(mockAgent);
    });

    it('should capture execution timing', async () => {
      const context = createTestContext();
      
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
      // Create failing agent using a valid intent from INTENT_ROUTING
      const failingAgent: Agent = {
        ...mockAgent,
        type: 'document_compliance',
        name: 'Failing Doc Agent',
        supportedIntents: ['document_find'],
        canHandle(intent: AgentIntent) {
          return this.supportedIntents.includes(intent);
        },
        async execute() {
          throw new Error('Find failed');
        },
      };
      
      coordinator.register(failingAgent);
      
      const context = createTestContext({ permissions: ['employee:read', 'document:read'] });
      const response = await coordinator.route({
        intent: 'document_find',
        query: 'find',
        payload: {},
        context,
      });

      expect(response.result.success).toBe(false);
      expect(response.result.summary).toContain('failed');
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

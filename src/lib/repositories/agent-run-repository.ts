/**
 * Agent Run Repository
 * 
 * Durable persistence for agent execution traces.
 * Records every agent run with full context, timing, success state,
 * and whether the result was model-backed or fallback.
 * 
 * Security: Requires SUPABASE_SERVICE_ROLE_KEY for write access.
 * Falls back to in-memory storage when not configured.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database';
import type { AgentType, AgentIntent, AgentContext, AgentResult } from '@/types';

export interface AgentRunRecord {
  id: string;
  agentType: AgentType;
  intent: AgentIntent;
  inputPayload: Record<string, unknown>;
  outputResult: AgentResult | null;
  confidence: number | null;
  executionTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  context: {
    userId: string;
    role: string;
    permissions: string[];
    sessionId: string;
    timestamp: string;
  };
  metadata: {
    isModelBacked: boolean;
    isFallback: boolean;
    dataSource?: 'supabase' | 'local' | 'hybrid';
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface AgentRunQueryOptions {
  agentType?: AgentType;
  intent?: AgentIntent;
  userId?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AgentRunRepository {
  private supabase: SupabaseClient<Database> | null = null;
  private isPersistent: boolean = false;
  private memoryStore: AgentRunRecord[] = [];
  private maxMemorySize: number = 1000;

  constructor(supabase?: SupabaseClient<Database>) {
    if (supabase) {
      this.supabase = supabase;
      this.isPersistent = true;
    }
  }

  /**
   * Check if repository can persist to database
   */
  isUsingPersistence(): boolean {
    return this.isPersistent;
  }

  /**
   * Persist an agent run record
   */
  async saveAgentRun(record: AgentRunRecord): Promise<boolean> {
    if (this.isPersistent) {
      try {
        const insertData = {
          agent_type: record.agentType,
          intent: record.intent,
          input_payload: record.inputPayload as Record<string, unknown>,
          output_result: record.outputResult as Record<string, unknown> | null,
          confidence: record.confidence,
          execution_time_ms: record.executionTimeMs,
          success: record.success,
          error_message: record.errorMessage,
          context: record.context as Record<string, unknown>,
        };
        const { error } = await this.supabase!.from('agent_runs').insert(insertData as never);

        if (error) {
          console.error('Failed to persist agent run:', error);
          // Fall through to memory storage
        } else {
          return true;
        }
      } catch (err) {
        console.error('Exception persisting agent run:', err);
        // Fall through to memory storage
      }
    }

    // Memory fallback
    this.memoryStore.push(record);
    
    // Trim if needed
    if (this.memoryStore.length > this.maxMemorySize) {
      this.memoryStore = this.memoryStore.slice(-this.maxMemorySize);
    }

    return true;
  }

  /**
   * Get a specific agent run by ID
   */
  async getAgentRun(id: string): Promise<AgentRunRecord | null> {
    if (this.isPersistent) {
      const { data, error } = await this.supabase!
        .from('agent_runs')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return this.mapDbToRecord(data);
    }

    return this.memoryStore.find(r => r.id === id) || null;
  }

  /**
   * Query agent runs with filters
   */
  async queryAgentRuns(options: AgentRunQueryOptions = {}): Promise<{
    records: AgentRunRecord[];
    total: number;
  }> {
    const {
      agentType,
      intent,
      userId,
      success,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = options;

    if (this.isPersistent) {
      let query = this.supabase!.from('agent_runs').select('*', { count: 'exact' });

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }
      if (intent) {
        query = query.eq('intent', intent);
      }
      if (userId) {
        query = query.contains('context', { userId });
      }
      if (success !== undefined) {
        query = query.eq('success', success);
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { records: [], total: 0 };
      }

      return {
        records: (data as Tables<'agent_runs'>[] || []).map(this.mapDbToRecord),
        total: count || 0,
      };
    }

    // Memory query
    let filtered = [...this.memoryStore];

    if (agentType) {
      filtered = filtered.filter(r => r.agentType === agentType);
    }
    if (intent) {
      filtered = filtered.filter(r => r.intent === intent);
    }
    if (userId) {
      filtered = filtered.filter(r => r.context.userId === userId);
    }
    if (success !== undefined) {
      filtered = filtered.filter(r => r.success === success);
    }
    if (startDate) {
      filtered = filtered.filter(r => r.createdAt >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.createdAt <= endDate);
    }

    // Sort by created_at desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const records = filtered.slice(offset, offset + limit);

    return { records, total };
  }

  /**
   * Get recent agent runs for a user
   */
  async getRecentRunsForUser(userId: string, limit: number = 20): Promise<AgentRunRecord[]> {
    const { records } = await this.queryAgentRuns({ userId, limit });
    return records;
  }

  /**
   * Get success rate statistics
   */
  async getSuccessStats(timeRangeHours: number = 24): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgExecutionTimeMs: number;
  }> {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

    if (this.isPersistent) {
      const { data, error } = await this.supabase!
        .from('agent_runs')
        .select('success, execution_time_ms')
        .gte('created_at', since) as { data: { success: boolean; execution_time_ms: number | null }[] | null; error: Error | null };

      const rows = data || [];
      if (error || rows.length === 0) {
        return { total: 0, successful: 0, failed: 0, successRate: 0, avgExecutionTimeMs: 0 };
      }

      const total = rows.length;
      const successful = rows.filter(r => r.success).length;
      const failed = total - successful;
      const successRate = total > 0 ? (successful / total) * 100 : 0;
      const avgExecutionTimeMs = rows.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) / total;

      return { total, successful, failed, successRate, avgExecutionTimeMs };
    }

    // Memory stats
    const filtered = this.memoryStore.filter(r => r.createdAt >= since);
    const total = filtered.length;
    const successful = filtered.filter(r => r.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const avgExecutionTimeMs = total > 0 
      ? filtered.reduce((sum, r) => sum + r.executionTimeMs, 0) / total 
      : 0;

    return { total, successful, failed, successRate, avgExecutionTimeMs };
  }

  /**
   * Get agent type distribution
   */
  async getAgentTypeDistribution(timeRangeHours: number = 24): Promise<{
    agentType: AgentType;
    count: number;
    successRate: number;
  }[]> {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

    if (this.isPersistent) {
      const { data, error } = await this.supabase!
        .from('agent_runs')
        .select('agent_type, success')
        .gte('created_at', since) as { data: { agent_type: string; success: boolean; execution_time_ms: number }[] | null; error: Error | null };

      if (error || !data || !data.length) return [];

      const grouped = data.reduce((acc, row) => {
        if (!acc[row.agent_type]) {
          acc[row.agent_type] = { total: 0, successful: 0 };
        }
        acc[row.agent_type].total++;
        if (row.success) acc[row.agent_type].successful++;
        return acc;
      }, {} as Record<string, { total: number; successful: number }>);

      return Object.entries(grouped).map(([agentType, stats]) => ({
        agentType: agentType as AgentType,
        count: stats.total,
        successRate: (stats.successful / stats.total) * 100,
      }));
    }

    // Memory distribution
    const filtered = this.memoryStore.filter(r => r.createdAt >= since);
    const grouped = filtered.reduce((acc, row) => {
      if (!acc[row.agentType]) {
        acc[row.agentType] = { total: 0, successful: 0 };
      }
      acc[row.agentType].total++;
      if (row.success) acc[row.agentType].successful++;
      return acc;
    }, {} as Record<string, { total: number; successful: number }>);

    return Object.entries(grouped).map(([agentType, stats]) => ({
      agentType: agentType as AgentType,
      count: stats.total,
      successRate: (stats.successful / stats.total) * 100,
    }));
  }

  /**
   * Clean old records (maintenance operation)
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    if (this.isPersistent) {
      const { error, count } = await this.supabase!
        .from('agent_runs')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff);

      if (error) return 0;
      return count || 0;
    }

    // Memory cleanup
    const beforeCount = this.memoryStore.length;
    this.memoryStore = this.memoryStore.filter(r => r.createdAt >= cutoff);
    return beforeCount - this.memoryStore.length;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapDbToRecord(db: Tables<'agent_runs'>): AgentRunRecord {
    return {
      id: db.id,
      agentType: db.agent_type as AgentType,
      intent: db.intent as AgentIntent,
      inputPayload: (db.input_payload as Record<string, unknown>) || {},
      outputResult: (db.output_result as unknown as AgentResult) || null,
      confidence: db.confidence,
      executionTimeMs: db.execution_time_ms || 0,
      success: db.success,
      errorMessage: db.error_message,
      context: (db.context as AgentRunRecord['context']) || {
        userId: '',
        role: '',
        permissions: [],
        sessionId: '',
        timestamp: db.created_at,
      },
      metadata: {
        isModelBacked: db.confidence !== null && db.confidence > 0,
        isFallback: db.confidence === null || db.confidence === 0,
      }, // Metadata reconstructed from DB fields
      createdAt: db.created_at,
    };
  }
}

// Singleton instance
let defaultRepository: AgentRunRepository | null = null;

export function getAgentRunRepository(supabase?: SupabaseClient<Database>): AgentRunRepository {
  if (supabase) {
    return new AgentRunRepository(supabase);
  }
  if (!defaultRepository) {
    defaultRepository = new AgentRunRepository();
  }
  return defaultRepository;
}

/**
 * Create a service role client for agent run persistence
 * Only works server-side with SUPABASE_SERVICE_ROLE_KEY
 */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    return createClient<Database>(supabaseUrl, serviceRoleKey);
  } catch (err) {
    console.warn('Failed to create service role client:', err);
    return null;
  }
}

// Import at end to avoid circular dependency issues
import { createClient } from '@supabase/supabase-js';

import type { AgentRunRepositoryPort } from '@/lib/ports';
import type { AgentRunRecord } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseAgentRunRepository
  extends BaseSupabaseRepository
  implements AgentRunRepositoryPort
{
  async save(record: AgentRunRecord, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('agent_runs')
      .insert({
        id: record.id,
        agent_type: record.agentType,
        intent: record.intent,
        input_payload: record.inputPayload,
        output_result: record.outputResult,
        confidence: record.confidence,
        execution_time_ms: record.executionTimeMs,
        success: record.success,
        error_message: record.errorMessage,
        context: record.context,
        metadata: record.metadata,
        tenant_id: tenantId,
        createdAt: record.createdAt,
      } as unknown as never);

    if (error) throw error;
  }

  async findById(id: string, tenantId: string): Promise<AgentRunRecord | null> {
    const { data, error } = await this.supabase
      .from('agent_runs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return this.mapFromDb(data);
  }

  async findBySession(sessionId: string, tenantId: string): Promise<AgentRunRecord[]> {
    const { data, error } = await this.supabase
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .filter('context->>sessionId', 'eq', sessionId);

    if (error) return [];
    return (data || []).map(this.mapFromDb);
  }

  async findByAgent(
    agentType: string,
    tenantId: string,
    limit = 100
  ): Promise<AgentRunRecord[]> {
    const { data, error } = await this.supabase
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map(this.mapFromDb);
  }

  async findByIntent(
    intent: string,
    tenantId: string,
    limit = 100
  ): Promise<AgentRunRecord[]> {
    const { data, error } = await this.supabase
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('intent', intent)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map(this.mapFromDb);
  }

  async query(params: {
    tenantId: string;
    agentType?: string;
    intent?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentRunRecord[]> {
    let query = this.supabase
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', params.tenantId);

    if (params.agentType) {
      query = query.eq('agent_type', params.agentType);
    }
    if (params.intent) {
      query = query.eq('intent', params.intent);
    }
    if (params.success !== undefined) {
      query = query.eq('success', params.success);
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    query = query.order('created_at', { ascending: false });

    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(this.mapFromDb);
  }

  async getStats(
    tenantId: string,
    params?: {
      agentType?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  }> {
    let query = this.supabase
      .from('agent_runs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (params?.agentType) {
      query = query.eq('agent_type', params.agentType);
    }
    if (params?.startDate) {
      query = query.gte('created_at', params.startDate);
    }
    if (params?.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { total: 0, successful: 0, failed: 0, averageExecutionTime: 0 };
    }

    const records = data as Array<{
      success: boolean;
      execution_time_ms: number;
    }>;

    const total = records.length;
    const successful = records.filter(r => r.success).length;
    const failed = total - successful;
    const averageExecutionTime =
      total > 0
        ? records.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) / total
        : 0;

    return { total, successful, failed, averageExecutionTime };
  }

  private mapFromDb(data: Record<string, unknown>): AgentRunRecord {
    return {
      id: data.id as string,
      agentType: data.agent_type as string,
      intent: data.intent as string,
      inputPayload: data.input_payload as Record<string, unknown>,
      outputResult: data.output_result as Record<string, unknown> | null,
      confidence: data.confidence as number | null,
      executionTimeMs: data.execution_time_ms as number,
      success: data.success as boolean,
      errorMessage: data.error_message as string | null,
      context: data.context as Record<string, unknown>,
      metadata: data.metadata as Record<string, unknown>,
      createdAt: data.created_at as string,
    };
  }
}

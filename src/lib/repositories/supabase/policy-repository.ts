import type { PolicyRepositoryPort } from '@/lib/ports';
import type { PolicyDocument, PolicyChunk } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabasePolicyRepository
  extends BaseSupabaseRepository
  implements PolicyRepositoryPort
{
  async findById(id: string, tenantId: string): Promise<PolicyDocument | null> {
    const { data, error } = await this.supabase
      .from('policy_documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as PolicyDocument;
  }

  async findByIds(ids: string[], tenantId: string): Promise<PolicyDocument[]> {
    const { data, error } = await this.supabase
      .from('policy_documents')
      .select('*')
      .in('id', ids)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as PolicyDocument[]) || [];
  }

  async findAll(params: {
    tenantId: string;
    category?: string;
    jurisdiction?: string;
    status?: string;
  }): Promise<PolicyDocument[]> {
    let query = this.supabase
      .from('policy_documents')
      .select('*')
      .eq('tenant_id', params.tenantId);

    if (params.category) {
      query = query.eq('category', params.category);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as PolicyDocument[]) || [];
  }

  async findChunks(params: {
    tenantId: string;
    documentId?: string;
    zone?: string;
    jurisdiction?: string;
    audience?: string;
  }): Promise<PolicyChunk[]> {
    let query = this.supabase
      .from('policy_chunks')
      .select('*')
      .eq('tenant_id', params.tenantId);

    if (params.documentId) {
      query = query.eq('document_id', params.documentId);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as PolicyChunk[]) || [];
  }

  async searchContent(params: {
    tenantId: string;
    query: string;
    filters?: {
      zone?: string;
      jurisdiction?: string;
      audience?: string;
    };
    limit?: number;
  }): Promise<Array<{ chunk: PolicyChunk; score: number }>> {
    // Full-text search implementation
    const { data, error } = await this.supabase
      .from('policy_chunks')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .textSearch('content', params.query);

    if (error) return [];
    return (data as PolicyChunk[]).map(chunk => ({ chunk, score: 1.0 }));
  }

  async save(document: PolicyDocument, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('policy_documents')
      .insert({ ...document, tenant_id: tenantId });
    if (error) throw error;
  }

  async saveChunk(chunk: PolicyChunk, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('policy_chunks')
      .insert({ ...chunk, tenant_id: tenantId });
    if (error) throw error;
  }

  async update(
    id: string,
    data: Partial<PolicyDocument>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('policy_documents')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('policy_documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }
}

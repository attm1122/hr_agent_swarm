import type { DocumentRepositoryPort } from '@/lib/ports';
import type { EmployeeDocument } from '@/lib/domain/document/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseDocumentRepository
  extends BaseSupabaseRepository
  implements DocumentRepositoryPort
{
  async findById(id: string, tenantId: string): Promise<EmployeeDocument | null> {
    const { data, error } = await this.supabase
      .from('employee_documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as EmployeeDocument;
  }

  async findByEmployee(employeeId: string, tenantId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await this.supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as EmployeeDocument[]) || [];
  }

  async findExpiring(params: {
    tenantId: string;
    days: number;
    category?: string;
  }): Promise<EmployeeDocument[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + params.days);

    let query = this.supabase
      .from('employee_documents')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .lte('expires_at', cutoffDate.toISOString())
      .gt('expires_at', new Date().toISOString());

    if (params.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as EmployeeDocument[]) || [];
  }

  async save(document: EmployeeDocument, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('employee_documents')
      .insert({ ...document, tenant_id: tenantId } as unknown as never);
    if (error) throw error;
  }

  async update(
    id: string,
    data: Partial<EmployeeDocument>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('employee_documents')
      .update(data as unknown as never)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('employee_documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }
}

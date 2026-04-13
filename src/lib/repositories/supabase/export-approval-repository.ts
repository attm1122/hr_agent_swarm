import type { ExportApprovalRepositoryPort } from '@/lib/ports';
import type { ExportApproval } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseExportApprovalRepository
  extends BaseSupabaseRepository
  implements ExportApprovalRepositoryPort
{
  async create(approval: ExportApproval, tenantId: string): Promise<void> {
    const { error } = await this.table('export_approvals')
      .insert({ ...approval, tenant_id: tenantId });

    if (error) throw error;
  }

  async findById(id: string, tenantId: string): Promise<ExportApproval | null> {
    const { data, error } = await this.table('export_approvals')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as ExportApproval;
  }

  async findPendingForApprover(
    approverId: string,
    tenantId: string
  ): Promise<ExportApproval[]> {
    const { data, error } = await this.table('export_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    if (error) return [];
    return (data as ExportApproval[]) || [];
  }

  async findPendingForRequester(
    requesterId: string,
    tenantId: string
  ): Promise<ExportApproval[]> {
    const { data, error } = await this.table('export_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('requester_id', requesterId);

    if (error) return [];
    return (data as ExportApproval[]) || [];
  }

  async approve(id: string, approverId: string, tenantId: string): Promise<void> {
    const { error } = await this.table('export_approvals')
      .update({
        status: 'approved',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }

  async reject(
    id: string,
    approverId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('export_approvals')
      .update({
        status: 'rejected',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }

  async complete(id: string, downloadUrl: string, tenantId: string): Promise<void> {
    const { error } = await this.table('export_approvals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        download_url: downloadUrl,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }

  async cancel(id: string, tenantId: string): Promise<void> {
    const { error } = await this.table('export_approvals')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }
}

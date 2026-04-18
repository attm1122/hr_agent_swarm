import type { MilestoneRepositoryPort } from '@/lib/ports';
import type { Milestone } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseMilestoneRepository
  extends BaseSupabaseRepository
  implements MilestoneRepositoryPort
{
  async findById(id: string, tenantId: string): Promise<Milestone | null> {
    const { data, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as Milestone;
  }

  async findByEmployee(employeeId: string, tenantId: string): Promise<Milestone[]> {
    const { data, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as Milestone[]) || [];
  }

  async findUpcoming(params: {
    tenantId: string;
    days: number;
    types?: string[];
  }): Promise<Milestone[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + params.days);

    let query = this.supabase
      .from('milestones')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .lte('milestone_date', cutoffDate.toISOString())
      .eq('status', 'pending');

    if (params.types && params.types.length > 0) {
      query = query.in('milestone_type', params.types);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as Milestone[]) || [];
  }

  async findOverdue(tenantId: string): Promise<Milestone[]> {
    const today = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('milestones')
      .select('*')
      .eq('tenant_id', tenantId)
      .lt('milestone_date', today)
      .eq('status', 'pending');

    if (error) return [];
    return (data as Milestone[]) || [];
  }

  async save(milestone: Milestone, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('milestones')
      .insert({ ...milestone, tenant_id: tenantId } as unknown as never);
    if (error) throw error;
  }

  async update(
    id: string,
    data: Partial<Milestone>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('milestones')
      .update(data as unknown as never)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async acknowledge(
    id: string,
    acknowledgedBy: string,
    tenantId: string
  ): Promise<void> {
    await this.update(
      id,
      {
        status: 'acknowledged',
        acknowledgedBy: acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
      } as any,
      tenantId
    );
  }
}

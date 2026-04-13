import type { LeaveRepositoryPort } from '@/lib/ports';
import type { LeaveBalance, LeaveRequest } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseLeaveRepository
  extends BaseSupabaseRepository
  implements LeaveRepositoryPort
{
  async findBalance(
    employeeId: string,
    leaveType: string,
    tenantId: string
  ): Promise<LeaveBalance | null> {
    const { data, error } = await this.table('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_type', leaveType)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as LeaveBalance;
  }

  async findBalances(employeeId: string, tenantId: string): Promise<LeaveBalance[]> {
    const { data, error } = await this.table('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as LeaveBalance[]) || [];
  }

  async findRequests(params: {
    tenantId: string;
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRequest[]> {
    let query = this.table('leave_requests')
      .select('*')
      .eq('tenant_id', params.tenantId);

    if (params.employeeId) {
      query = query.eq('employee_id', params.employeeId);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.startDate) {
      query = query.gte('start_date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('end_date', params.endDate);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as LeaveRequest[]) || [];
  }

  async findPendingRequestsForApprover(
    approverId: string,
    tenantId: string
  ): Promise<LeaveRequest[]> {
    // Simplified - in reality would check manager relationship
    const { data, error } = await this.table('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as LeaveRequest[]) || [];
  }

  async saveRequest(request: LeaveRequest, tenantId: string): Promise<void> {
    const { error } = await this.table('leave_requests')
      .insert({ ...request, tenant_id: tenantId });
    if (error) throw error;
  }

  async updateRequest(
    id: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('leave_requests')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async approveRequest(id: string, approverId: string, tenantId: string): Promise<void> {
    await this.updateRequest(
      id,
      { status: 'approved', approved_by: approverId, approved_at: new Date().toISOString() },
      tenantId
    );
  }

  async rejectRequest(
    id: string,
    approverId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    await this.updateRequest(
      id,
      { status: 'rejected', approved_by: approverId, rejection_reason: reason },
      tenantId
    );
  }

  async updateBalance(
    employeeId: string,
    leaveType: string,
    delta: number,
    tenantId: string
  ): Promise<void> {
    // Get current balance
    const balance = await this.findBalance(employeeId, leaveType, tenantId);
    if (!balance) throw new Error('Balance not found');

    const { error } = await this.table('leave_balances')
      .update({ taken_days: balance.takenDays + delta })
      .eq('employee_id', employeeId)
      .eq('leave_type', leaveType)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }
}

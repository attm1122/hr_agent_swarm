import type { LeaveRepositoryPort } from '@/lib/ports';
import type { LeaveBalance, LeaveRequest } from '@/lib/domain/leave/types';
import { calculateLeaveBalance } from '@/lib/domain/leave/leave-calculation';
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
    const { data, error } = await this.supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_type', leaveType)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as LeaveBalance;
  }

  async findBalances(employeeId: string, tenantId: string): Promise<LeaveBalance[]> {
    const { data, error } = await this.supabase
      .from('leave_balances')
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
    let query = this.supabase
      .from('leave_requests')
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
    const { data, error } = await this.supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as LeaveRequest[]) || [];
  }

  async saveRequest(request: LeaveRequest, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('leave_requests')
      .insert({ ...request, tenant_id: tenantId } as unknown as never);
    if (error) throw error;
  }

  async updateRequest(
    id: string,
    data: Partial<LeaveRequest>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('leave_requests')
      .update(data as unknown as never)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async approveRequest(id: string, approverId: string, tenantId: string): Promise<void> {
    await this.updateRequest(
      id,
      { status: 'approved', approvedBy: approverId, approvedAt: new Date().toISOString() },
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
      { status: 'rejected', approvedBy: approverId, rejectionReason: reason },
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

    const newTaken = balance.takenDays + delta;
    const newRemaining = calculateLeaveBalance(
      balance.entitlementDays,
      newTaken,
      balance.pendingDays
    );

    const { error } = await this.supabase
      .from('leave_balances')
      .update({
        taken_days: newTaken,
        remaining_days: newRemaining,
      } as unknown as never)
      .eq('employee_id', employeeId)
      .eq('leave_type', leaveType)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  }
}

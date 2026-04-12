import type { OffboardingRepositoryPort } from '@/lib/ports';
import type { OffboardingPlan, OffboardingTask } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseOffboardingRepository
  extends BaseSupabaseRepository
  implements OffboardingRepositoryPort
{
  async findPlanById(id: string, tenantId: string): Promise<OffboardingPlan | null> {
    const { data, error } = await this.supabase
      .from('offboarding_plans')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as OffboardingPlan;
  }

  async findPlansByEmployee(employeeId: string, tenantId: string): Promise<OffboardingPlan[]> {
    const { data, error } = await this.supabase
      .from('offboarding_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OffboardingPlan[]) || [];
  }

  async findPendingPlans(tenantId: string): Promise<OffboardingPlan[]> {
    const { data, error } = await this.supabase
      .from('offboarding_plans')
      .select('*')
      .eq('status', 'in_progress')
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OffboardingPlan[]) || [];
  }

  async findTasks(planId: string, tenantId: string): Promise<OffboardingTask[]> {
    const { data, error } = await this.supabase
      .from('offboarding_tasks')
      .select('*')
      .eq('plan_id', planId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OffboardingTask[]) || [];
  }

  async savePlan(plan: OffboardingPlan, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('offboarding_plans')
      .insert({ ...plan, tenant_id: tenantId });
    if (error) throw error;
  }

  async saveTask(task: OffboardingTask, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('offboarding_tasks')
      .insert({ ...task, tenant_id: tenantId });
    if (error) throw error;
  }

  async updatePlan(
    id: string,
    data: Partial<OffboardingPlan>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('offboarding_plans')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async updateTask(
    id: string,
    data: Partial<OffboardingTask>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('offboarding_tasks')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async completeTask(taskId: string, completedBy: string, tenantId: string): Promise<void> {
    await this.updateTask(
      taskId,
      {
        status: 'completed',
        completed_by: completedBy,
        completed_at: new Date().toISOString(),
      },
      tenantId
    );
  }
}

import type { OnboardingRepositoryPort } from '@/lib/ports';
import type { OnboardingPlan, OnboardingTask } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseOnboardingRepository
  extends BaseSupabaseRepository
  implements OnboardingRepositoryPort
{
  async findPlanById(id: string, tenantId: string): Promise<OnboardingPlan | null> {
    const { data, error } = await this.table('onboarding_plans')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as OnboardingPlan;
  }

  async findPlansByEmployee(employeeId: string, tenantId: string): Promise<OnboardingPlan[]> {
    const { data, error } = await this.table('onboarding_plans')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OnboardingPlan[]) || [];
  }

  async findPendingPlans(tenantId: string): Promise<OnboardingPlan[]> {
    const { data, error } = await this.table('onboarding_plans')
      .select('*')
      .eq('status', 'in_progress')
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OnboardingPlan[]) || [];
  }

  async findTasks(planId: string, tenantId: string): Promise<OnboardingTask[]> {
    const { data, error } = await this.table('onboarding_tasks')
      .select('*')
      .eq('plan_id', planId)
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as OnboardingTask[]) || [];
  }

  async findTaskById(taskId: string, tenantId: string): Promise<OnboardingTask | null> {
    const { data, error } = await this.table('onboarding_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as OnboardingTask;
  }

  async savePlan(plan: OnboardingPlan, tenantId: string): Promise<void> {
    const { error } = await this.table('onboarding_plans')
      .insert({ ...plan, tenant_id: tenantId });
    if (error) throw error;
  }

  async saveTask(task: OnboardingTask, tenantId: string): Promise<void> {
    const { error } = await this.table('onboarding_tasks')
      .insert({ ...task, tenant_id: tenantId });
    if (error) throw error;
  }

  async updatePlan(
    id: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('onboarding_plans')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async updateTask(
    id: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('onboarding_tasks')
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

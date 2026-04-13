import type { WorkflowRepositoryPort } from '@/lib/ports';
import type { WorkflowInstance, WorkflowStep } from '@/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseWorkflowRepository
  extends BaseSupabaseRepository
  implements WorkflowRepositoryPort
{
  async findInstanceById(id: string, tenantId: string): Promise<WorkflowInstance | null> {
    const { data, error } = await this.table('workflows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as WorkflowInstance;
  }

  async findInstances(params: {
    tenantId: string;
    referenceId?: string;
    employeeId?: string;
    type?: string;
    status?: string;
  }): Promise<WorkflowInstance[]> {
    let query = this.table('workflows')
      .select('*')
      .eq('tenant_id', params.tenantId);

    if (params.referenceId) {
      query = query.eq('reference_id', params.referenceId);
    }
    if (params.type) {
      query = query.eq('type', params.type);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as WorkflowInstance[]) || [];
  }

  async findPendingForApprover(approverId: string, tenantId: string): Promise<WorkflowInstance[]> {
    const { data, error } = await this.table('workflows')
      .select('*')
      .eq('status', 'pending')
      .eq('tenant_id', tenantId);

    if (error) return [];
    return (data as WorkflowInstance[]) || [];
  }

  async findSteps(workflowId: string, tenantId: string): Promise<WorkflowStep[]> {
    const { data, error } = await this.table('workflow_steps')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('tenant_id', tenantId)
      .order('step_number', { ascending: true });

    if (error) return [];
    return (data as WorkflowStep[]) || [];
  }

  async findStepById(stepId: string, tenantId: string): Promise<WorkflowStep | null> {
    const { data, error } = await this.table('workflow_steps')
      .select('*')
      .eq('id', stepId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as WorkflowStep;
  }

  async saveInstance(instance: WorkflowInstance, tenantId: string): Promise<void> {
    const { error } = await this.table('workflows')
      .insert({ ...instance, tenant_id: tenantId });
    if (error) throw error;
  }

  async saveStep(step: WorkflowStep, tenantId: string): Promise<void> {
    const { error } = await this.table('workflow_steps')
      .insert({ ...step, tenant_id: tenantId });
    if (error) throw error;
  }

  async updateInstance(
    id: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('workflows')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async updateStep(
    id: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    const { error } = await this.table('workflow_steps')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  }

  async approveStep(stepId: string, approverId: string, tenantId: string): Promise<void> {
    await this.updateStep(
      stepId,
      {
        status: 'approved',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
      },
      tenantId
    );
  }

  async rejectStep(
    stepId: string,
    approverId: string,
    reason: string,
    tenantId: string
  ): Promise<void> {
    await this.updateStep(
      stepId,
      {
        status: 'rejected',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      },
      tenantId
    );
  }
}

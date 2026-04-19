/**
 * Supabase Employee Repository
 */

import type { EmployeeRepositoryPort } from '@/lib/ports';
import type { Employee, EmployeeSummary } from '@/lib/domain/employee/types';
import { BaseSupabaseRepository } from './base-repository';

export class SupabaseEmployeeRepository
  extends BaseSupabaseRepository
  implements EmployeeRepositoryPort
{
  async findById(id: string, tenantId: string): Promise<Employee | null> {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      return data as Employee | null;
    });
  }

  async findByIds(ids: string[], tenantId: string): Promise<Employee[]> {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .in('id', ids)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data as Employee[]) || [];
    });
  }

  async findByTeam(teamId: string, tenantId: string): Promise<Employee[]> {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .eq('team_id', teamId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data as Employee[]) || [];
    });
  }

  async findByManager(managerId: string, tenantId: string): Promise<Employee[]> {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .eq('manager_id', managerId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data as Employee[]) || [];
    });
  }

  async findDirectReports(managerId: string, tenantId: string): Promise<Employee[]> {
    return this.findByManager(managerId, tenantId);
  }

  async findAll(params: {
    tenantId: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<Employee[]> {
    return this.executeWithRetry(async () => {
      let query = this.supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', params.tenantId);

      if (params.status) {
        query = query.eq('status', params.status);
      }

      if (params.department) {
        query = query.eq('department', params.department);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as Employee[]) || [];
    });
  }

  async search(params: {
    tenantId: string;
    query: string;
    filters?: Record<string, unknown>;
  }): Promise<Employee[]> {
    return this.executeWithRetry(async () => {
      let dbQuery = this.supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', params.tenantId)
        .or(`first_name.ilike.%${params.query.replace(/[,.]/g, '')}%,last_name.ilike.%${params.query.replace(/[,.]/g, '')}%,email.ilike.%${params.query.replace(/[,.]/g, '')}%`);

      if (params.filters?.teamId) {
        dbQuery = dbQuery.eq('team_id', params.filters.teamId);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;
      return (data as Employee[]) || [];
    });
  }

  async save(employee: Employee, tenantId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('employees')
        .insert({ ...employee, tenant_id: tenantId } as unknown as never);

      if (error) throw error;
    });
  }

  async update(id: string, data: Partial<Employee>, tenantId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('employees')
        .update(data as unknown as never)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const { error } = await this.supabase
        .from('employees')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    });
  }
}

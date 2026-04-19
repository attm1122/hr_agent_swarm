/**
 * Tenant Isolation Service
 * 
 * Enforces strict tenant isolation at the application layer.
 * All database operations must filter by tenant_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

/**
 * Validates that a tenant ID is present and valid
 */
export function validateTenantId(tenantId: string | null | undefined): asserts tenantId is string {
  if (!tenantId) {
    throw new TenantIsolationError('Tenant ID is required for all database operations');
  }
  
  if (typeof tenantId !== 'string' || tenantId.length < 10) {
    throw new TenantIsolationError('Invalid tenant ID format');
  }
}

/**
 * Ensures a query result belongs to the expected tenant
 */
export function enforceTenantIsolation<T extends { tenant_id?: string }>(
  record: T | null,
  expectedTenantId: string,
  operation: string
): void {
  if (!record) {
    return; // Record not found - will be handled by caller
  }
  
  if (record.tenant_id !== expectedTenantId) {
    throw new TenantIsolationError(
      `Tenant isolation violation in ${operation}: ` +
      `Expected tenant ${expectedTenantId}, got ${record.tenant_id}`
    );
  }
}

/**
 * Wrapper for Supabase queries that enforces tenant isolation
 */
export class TenantIsolatedQueryBuilder<T extends { tenant_id: string }> {
  constructor(
    private query: ReturnType<SupabaseClient<Database>['from']>,
    private tenantId: string,
    private tableName: string
  ) {
    // Apply tenant filter to all queries
    this.query = this.query.eq('tenant_id', tenantId);
  }

  /**
   * Select specific columns
   */
  select(columns: string = '*'): this {
    this.query = this.query.select(columns);
    return this;
  }

  /**
   * Add equality filter
   */
  eq(column: keyof T, value: unknown): this {
    // Prevent filtering by tenant_id again (already applied in constructor)
    if (column === 'tenant_id') {
      throw new TenantIsolationError('Cannot override tenant_id filter');
    }
    this.query = this.query.eq(column as string, value);
    return this;
  }

  /**
   * Add "in" filter
   */
  in(column: keyof T, values: unknown[]): this {
    this.query = this.query.in(column as string, values);
    return this;
  }

  /**
   * Add order
   */
  order(column: keyof T, options?: { ascending?: boolean }): this {
    this.query = this.query.order(column as string, options);
    return this;
  }

  /**
   * Add limit
   */
  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  /**
   * Add range
   */
  range(from: number, to: number): this {
    this.query = this.query.range(from, to);
    return this;
  }

  /**
   * Execute single row query
   */
  async single(): Promise<T | null> {
    const { data, error } = await this.query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows returned
      }
      throw new Error(`Query failed: ${error.message}`);
    }
    
    return data as T;
  }

  /**
   * Execute multi-row query
   */
  async many(): Promise<T[]> {
    const { data, error } = await this.query;
    
    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
    
    return (data || []) as T[];
  }
}

/**
 * Create a tenant-isolated query
 */
export function tenantQuery<T extends { tenant_id: string }>(
  supabase: SupabaseClient<Database>,
  table: keyof Database['public']['Tables'],
  tenantId: string
): TenantIsolatedQueryBuilder<T> {
  validateTenantId(tenantId);
  const baseQuery = supabase.from(table);
  return new TenantIsolatedQueryBuilder<T>(baseQuery, tenantId, table as string);
}

/**
 * Tenant context for request handling
 */
export interface TenantContext {
  tenantId: string;
  isSystemContext?: boolean; // For admin operations that bypass tenant checks
}

/**
 * Validates user can access requested tenant
 */
export function validateTenantAccess(
  userTenantId: string,
  requestedTenantId: string,
  userRole: string
): void {
  // Admin can access any tenant (with proper authorization)
  if (userRole === 'admin') {
    return;
  }
  
  // Regular users can only access their own tenant
  if (userTenantId !== requestedTenantId) {
    throw new TenantIsolationError(
      `Access denied: Cannot access tenant ${requestedTenantId}`
    );
  }
}

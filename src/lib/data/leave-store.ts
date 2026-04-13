/**
 * Leave data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `leave_requests` / `leave_balances` tables (in production) or the
 * in-memory `mock-data.ts` (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getLeaveStore();
 *   const reqs = await store.listRequests({}, 'tenant-leap');
 */

import type { LeaveRequest, LeaveBalance } from '@/types';
import { leaveRequests as mockLeaveRequests } from './mock-data';
import { leaveRequestFromRow, leaveBalanceFromRow } from './mappers';

export interface LeaveRequestFilters {
  employeeId?: string;
  status?: string;
  leaveType?: string;
}

export interface LeaveStore {
  readonly backend: 'supabase' | 'mock';
  listRequests(filters: LeaveRequestFilters, tenantId: string): Promise<LeaveRequest[]>;
  findRequestById(id: string, tenantId: string): Promise<LeaveRequest | null>;
  updateRequestStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy: string | null,
    tenantId: string,
  ): Promise<LeaveRequest | null>;
  listBalances(employeeId: string, tenantId: string): Promise<LeaveBalance[]>;
}

// ---------- Derived mock balances ----------

/**
 * Since mock-data.ts does not export leaveBalances, we derive them from the
 * leave request entries. Each employee gets a synthetic annual + sick balance.
 */
function deriveMockBalances(employeeId: string): LeaveBalance[] {
  const requests = mockLeaveRequests.filter((r) => r.employeeId === employeeId);

  const byType = new Map<string, { taken: number; pending: number }>();
  for (const r of requests) {
    const cur = byType.get(r.leaveType) ?? { taken: 0, pending: 0 };
    if (r.status === 'approved') cur.taken += r.daysRequested;
    if (r.status === 'pending') cur.pending += r.daysRequested;
    byType.set(r.leaveType, cur);
  }

  // Ensure at least annual + sick entries
  if (!byType.has('annual')) byType.set('annual', { taken: 0, pending: 0 });
  if (!byType.has('sick')) byType.set('sick', { taken: 0, pending: 0 });

  const now = new Date().toISOString();
  const balances: LeaveBalance[] = [];
  let idx = 0;
  for (const [type, counts] of byType) {
    const entitlement = type === 'annual' ? 20 : type === 'sick' ? 10 : 5;
    balances.push({
      id: `lb-mock-${employeeId}-${idx++}`,
      employeeId,
      leaveType: type as LeaveBalance['leaveType'],
      entitlementDays: entitlement,
      takenDays: counts.taken,
      pendingDays: counts.pending,
      remainingDays: entitlement - counts.taken - counts.pending,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      createdAt: now,
      updatedAt: now,
    });
  }
  return balances;
}

// ---------- Mock-backed implementation ----------

const mockStore: LeaveStore = {
  backend: 'mock',

  async listRequests(filters: LeaveRequestFilters) {
    let rows = [...mockLeaveRequests];
    if (filters.employeeId) {
      rows = rows.filter((r) => r.employeeId === filters.employeeId);
    }
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.leaveType && filters.leaveType !== 'all') {
      rows = rows.filter((r) => r.leaveType === filters.leaveType);
    }
    return rows;
  },

  async findRequestById(id: string) {
    return mockLeaveRequests.find((r) => r.id === id) ?? null;
  },

  async updateRequestStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy: string | null,
  ) {
    const idx = mockLeaveRequests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    // Mutate in-memory for POC
    const req = mockLeaveRequests[idx] as LeaveRequest;
    req.status = status;
    req.approvedBy = approvedBy;
    req.approvedAt = new Date().toISOString();
    return { ...req };
  },

  async listBalances(employeeId: string) {
    return deriveMockBalances(employeeId);
  },
};

// ---------- Supabase-backed implementation ----------

function createSupabaseStore(): LeaveStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async listRequests(filters: LeaveRequestFilters, tenantId: string) {
      const t = (await table('leave_requests')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          } & Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      // Build query chain; start with tenant filter
      let chain = t.select('*').eq('tenant_id', tenantId) as unknown as Record<string, unknown> & {
        eq: (c: string, v: string) => typeof chain & Promise<{ data: unknown[]; error: unknown }>;
      };
      if (filters.employeeId) {
        chain = chain.eq('employee_id', filters.employeeId);
      }
      if (filters.status && filters.status !== 'all') {
        chain = chain.eq('status', filters.status);
      }
      if (filters.leaveType && filters.leaveType !== 'all') {
        chain = chain.eq('leave_type', filters.leaveType);
      }
      const { data, error } = (await (chain as unknown as Promise<{
        data: unknown[];
        error: unknown;
      }>)) as { data: unknown[]; error: unknown };
      if (error) throw error;
      return (data ?? []).map((r) => leaveRequestFromRow(r as never));
    },

    async findRequestById(id: string, tenantId: string) {
      const t = (await table('leave_requests')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? leaveRequestFromRow(data as never) : null;
    },

    async updateRequestStatus(
      id: string,
      status: 'approved' | 'rejected',
      approvedBy: string | null,
      tenantId: string,
    ) {
      const t = (await table('leave_requests')) as {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              select: (c: string) => {
                maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
              };
            };
          };
        };
      };
      const { data, error } = await t
        .update({
          status,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? leaveRequestFromRow(data as never) : null;
    },

    async listBalances(employeeId: string, tenantId: string) {
      const t = (await table('leave_balances')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId);
      if (error) throw error;
      return (data ?? []).map((r) => leaveBalanceFromRow(r as never));
    },
  };
}

// ---------- Resolver ----------

function isSupabaseConfigured(): boolean {
  return (
    typeof window === 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

let cachedStore: LeaveStore | null = null;

export function getLeaveStore(): LeaveStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetLeaveStore(): void {
  cachedStore = null;
}

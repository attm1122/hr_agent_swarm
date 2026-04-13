/**
 * Milestone data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `milestones` table (in production) or the in-memory `mock-data.ts`
 * (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getMilestoneStore();
 *   const items = await store.list({}, 'tenant-leap');
 */

import type { Milestone } from '@/types';
import { milestones as mockMilestones } from './mock-data';
import { milestoneFromRow } from './mappers';

export interface MilestoneFilters {
  employeeId?: string;
  milestoneType?: string;
  status?: string;
}

export interface MilestoneStore {
  readonly backend: 'supabase' | 'mock';
  list(filters: MilestoneFilters, tenantId: string): Promise<Milestone[]>;
  findByEmployee(employeeId: string, tenantId: string): Promise<Milestone[]>;
  acknowledge(id: string, acknowledgedBy: string, tenantId: string): Promise<Milestone | null>;
}

// ---------- Mock-backed implementation ----------

const mockStore: MilestoneStore = {
  backend: 'mock',

  async list(filters: MilestoneFilters) {
    let rows = [...mockMilestones];
    if (filters.employeeId) {
      rows = rows.filter((m) => m.employeeId === filters.employeeId);
    }
    if (filters.milestoneType && filters.milestoneType !== 'all') {
      rows = rows.filter((m) => m.milestoneType === filters.milestoneType);
    }
    // Note: status filtering is intentionally left to the caller (agent) so it
    // can apply the derived-state logic from `getDerivedMilestoneState`.
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((m) => m.status === filters.status);
    }
    return rows;
  },

  async findByEmployee(employeeId: string) {
    return mockMilestones.filter((m) => m.employeeId === employeeId);
  },

  async acknowledge(id: string, acknowledgedBy: string) {
    const idx = mockMilestones.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    // Mutate in-memory for POC
    const ms = mockMilestones[idx] as Milestone;
    ms.status = 'acknowledged';
    ms.acknowledgedBy = acknowledgedBy;
    ms.acknowledgedAt = new Date().toISOString();
    return { ...ms };
  },
};

// ---------- Supabase-backed implementation ----------

function createSupabaseStore(): MilestoneStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async list(filters: MilestoneFilters, tenantId: string) {
      const t = (await table('milestones')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Record<string, unknown> & {
            eq: (c: string, v: string) => typeof chain & Promise<{ data: unknown[]; error: unknown }>;
          } & Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      type Chain = Record<string, unknown> & {
        eq: (c: string, v: string) => Chain & Promise<{ data: unknown[]; error: unknown }>;
      };
      let chain = t.select('*').eq('tenant_id', tenantId) as unknown as Chain;
      if (filters.employeeId) {
        chain = chain.eq('employee_id', filters.employeeId);
      }
      if (filters.milestoneType && filters.milestoneType !== 'all') {
        chain = chain.eq('milestone_type', filters.milestoneType);
      }
      if (filters.status && filters.status !== 'all') {
        chain = chain.eq('status', filters.status);
      }
      const { data, error } = (await (chain as unknown as Promise<{
        data: unknown[];
        error: unknown;
      }>)) as { data: unknown[]; error: unknown };
      if (error) throw error;
      return (data ?? []).map((r) => milestoneFromRow(r as never));
    },

    async findByEmployee(employeeId: string, tenantId: string) {
      const t = (await table('milestones')) as {
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
      return (data ?? []).map((r) => milestoneFromRow(r as never));
    },

    async acknowledge(id: string, acknowledgedBy: string, tenantId: string) {
      const t = (await table('milestones')) as {
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
          status: 'acknowledged',
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? milestoneFromRow(data as never) : null;
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

let cachedStore: MilestoneStore | null = null;

export function getMilestoneStore(): MilestoneStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetMilestoneStore(): void {
  cachedStore = null;
}

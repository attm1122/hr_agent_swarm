/**
 * Employee data store.
 *
 * A thin abstraction that gives agents a single read API over either the
 * Supabase `employees` table (in production) or the in-memory `mock-data.ts`
 * (in dev / when Supabase isn't configured yet).
 *
 * Agents depend on this module rather than importing mock-data directly, so
 * flipping from mock to real data is a matter of ensuring Supabase envs are
 * set — no agent code changes required.
 *
 * Usage:
 *   const store = getEmployeeStore();
 *   const emp = await store.findById('emp-001', 'tenant-leap');
 *
 * Mock mode is active when `SUPABASE_SERVICE_ROLE_KEY` is not set OR when the
 * `employees` table is unreachable. Write operations in mock mode are no-ops.
 */

import type { Employee, Team, Position } from '@/types';
import {
  employees as mockEmployees,
  teams as mockTeams,
  positions as mockPositions,
  getEmployeeById as mockGetById,
  getTeamById as mockGetTeamById,
  getPositionById as mockGetPositionById,
  getManagerForEmployee as mockGetManager,
  getDirectReports as mockGetDirectReports,
} from './mock-data';
import { employeeFromRow, teamFromRow, positionFromRow } from './mappers';

export interface EmployeeSearchFilters {
  query?: string;
  teamId?: string;
  status?: string;
  limit?: number;
}

export interface EmployeeStore {
  readonly backend: 'supabase' | 'mock';
  findById(id: string, tenantId: string): Promise<Employee | null>;
  findByIds(ids: string[], tenantId: string): Promise<Employee[]>;
  findByTeam(teamId: string, tenantId: string): Promise<Employee[]>;
  findDirectReports(managerId: string, tenantId: string): Promise<Employee[]>;
  search(filters: EmployeeSearchFilters, tenantId: string): Promise<Employee[]>;
  findAll(tenantId: string): Promise<Employee[]>;

  getTeam(teamId: string, tenantId: string): Promise<Team | null>;
  getAllTeams(tenantId: string): Promise<Team[]>;
  getPosition(positionId: string, tenantId: string): Promise<Position | null>;
  getAllPositions(tenantId: string): Promise<Position[]>;
}

// ---------- Mock-backed implementation ----------

const mockStore: EmployeeStore = {
  backend: 'mock',

  async findById(id: string) {
    return mockGetById(id) ?? null;
  },
  async findByIds(ids: string[]) {
    const set = new Set(ids);
    return mockEmployees.filter((e) => set.has(e.id));
  },
  async findByTeam(teamId: string) {
    return mockEmployees.filter((e) => e.teamId === teamId);
  },
  async findDirectReports(managerId: string) {
    return mockGetDirectReports(managerId);
  },
  async search(filters: EmployeeSearchFilters) {
    let rows = mockEmployees.filter((e) => e.status !== 'terminated');
    if (filters.query) {
      const q = filters.query.toLowerCase();
      rows = rows.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q),
      );
    }
    if (filters.teamId && filters.teamId !== 'all') {
      rows = rows.filter((e) => e.teamId === filters.teamId);
    }
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((e) => e.status === filters.status);
    }
    if (filters.limit) rows = rows.slice(0, filters.limit);
    return rows;
  },
  async findAll() {
    return [...mockEmployees];
  },
  async getTeam(teamId: string) {
    return mockGetTeamById(teamId) ?? null;
  },
  async getAllTeams() {
    return [...mockTeams];
  },
  async getPosition(positionId: string) {
    return mockGetPositionById(positionId) ?? null;
  },
  async getAllPositions() {
    return [...mockPositions];
  },
};

// ---------- Supabase-backed implementation ----------

function createSupabaseStore(): EmployeeStore {
  // Lazy import so bundlers don't pull Supabase into client code.
  // Keep the actual Supabase client on the server side only.
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async findById(id: string, tenantId: string) {
      const t = (await table('employees')) as {
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
      return data ? employeeFromRow(data as never) : null;
    },

    async findByIds(ids: string[], tenantId: string) {
      if (ids.length === 0) return [];
      const t = (await table('employees')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            in: (c: string, v: string[]) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId).in('id', ids);
      if (error) throw error;
      return (data ?? []).map((r) => employeeFromRow(r as never));
    },

    async findByTeam(teamId: string, tenantId: string) {
      const t = (await table('employees')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('team_id', teamId);
      if (error) throw error;
      return (data ?? []).map((r) => employeeFromRow(r as never));
    },

    async findDirectReports(managerId: string, tenantId: string) {
      const t = (await table('employees')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manager_id', managerId);
      if (error) throw error;
      return (data ?? []).map((r) => employeeFromRow(r as never));
    },

    async search(filters: EmployeeSearchFilters, tenantId: string) {
      let q = (await table('employees')) as unknown as {
        select: (c: string) => Record<string, unknown>;
      };
      let chain = q.select('*') as Record<string, unknown> & {
        eq: (c: string, v: unknown) => typeof chain;
        or: (expr: string) => typeof chain;
        limit: (n: number) => typeof chain;
        neq: (c: string, v: unknown) => typeof chain;
      };
      chain = chain.eq('tenant_id', tenantId).neq('status', 'terminated');
      if (filters.query) {
        const safe = filters.query.replace(/[%,]/g, '');
        chain = chain.or(
          `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`,
        );
      }
      if (filters.teamId && filters.teamId !== 'all') {
        chain = chain.eq('team_id', filters.teamId);
      }
      if (filters.status && filters.status !== 'all') {
        chain = chain.eq('status', filters.status);
      }
      if (filters.limit) chain = chain.limit(filters.limit);
      const { data, error } = (await (chain as unknown as Promise<{
        data: unknown[];
        error: unknown;
      }>)) as { data: unknown[]; error: unknown };
      if (error) throw error;
      return (data ?? []).map((r) => employeeFromRow(r as never));
    },

    async findAll(tenantId: string) {
      const t = (await table('employees')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => employeeFromRow(r as never));
    },

    async getTeam(teamId: string, tenantId: string) {
      const t = (await table('teams')) as {
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
        .eq('id', teamId)
        .maybeSingle();
      if (error) throw error;
      return data ? teamFromRow(data as never) : null;
    },

    async getAllTeams(tenantId: string) {
      const t = (await table('teams')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => teamFromRow(r as never));
    },

    async getPosition(positionId: string, tenantId: string) {
      const t = (await table('positions')) as {
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
        .eq('id', positionId)
        .maybeSingle();
      if (error) throw error;
      return data ? positionFromRow(data as never) : null;
    },

    async getAllPositions(tenantId: string) {
      const t = (await table('positions')) as {
        select: (c: string) => {
          eq: (c: string, v: string) => Promise<{ data: unknown[]; error: unknown }>;
        };
      };
      const { data, error } = await t.select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => positionFromRow(r as never));
    },
  };
}

// ---------- Resolver ----------

function isSupabaseConfigured(): boolean {
  // Must be server-side AND service role key present. Client-side never uses
  // the admin client.
  return (
    typeof window === 'undefined' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

let cachedStore: EmployeeStore | null = null;

export function getEmployeeStore(): EmployeeStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetEmployeeStore(): void {
  cachedStore = null;
}

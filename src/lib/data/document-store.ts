/**
 * Document data store.
 *
 * A thin abstraction that gives agents a single read/write API over either the
 * Supabase `employee_documents` table (in production) or the in-memory
 * `mock-data.ts` (in dev / when Supabase isn't configured yet).
 *
 * Usage:
 *   const store = getDocumentStore();
 *   const docs = await store.list({}, 'tenant-leap');
 */

import type { EmployeeDocument } from '@/types';
import { documents as mockDocuments } from './mock-data';
import { documentFromRow, documentToRow } from './mappers';

export interface DocumentFilters {
  employeeId?: string;
  status?: string;
  category?: string;
}

export interface DocumentStore {
  readonly backend: 'supabase' | 'mock';
  list(filters: DocumentFilters, tenantId: string): Promise<EmployeeDocument[]>;
  findById(id: string, tenantId: string): Promise<EmployeeDocument | null>;
  findByEmployee(employeeId: string, tenantId: string): Promise<EmployeeDocument[]>;
  save(doc: Partial<EmployeeDocument>, tenantId: string): Promise<EmployeeDocument | null>;
}

// ---------- Mock-backed implementation ----------

const mockStore: DocumentStore = {
  backend: 'mock',

  async list(filters: DocumentFilters) {
    let rows = [...mockDocuments];
    if (filters.employeeId) {
      rows = rows.filter((d) => d.employeeId === filters.employeeId);
    }
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((d) => d.status === filters.status);
    }
    if (filters.category && filters.category !== 'all') {
      rows = rows.filter((d) => d.category === filters.category);
    }
    return rows;
  },

  async findById(id: string) {
    return mockDocuments.find((d) => d.id === id) ?? null;
  },

  async findByEmployee(employeeId: string) {
    return mockDocuments.filter((d) => d.employeeId === employeeId);
  },

  async save(doc: Partial<EmployeeDocument>) {
    // In mock mode, upsert into the in-memory array
    if (!doc.id) return null;
    const idx = mockDocuments.findIndex((d) => d.id === doc.id);
    if (idx === -1) {
      // Insert — require all mandatory fields to be present
      const full = doc as EmployeeDocument;
      mockDocuments.push(full);
      return { ...full };
    }
    // Update existing
    const existing = mockDocuments[idx] as EmployeeDocument;
    Object.assign(existing, doc, { updatedAt: new Date().toISOString() });
    return { ...existing };
  },
};

// ---------- Supabase-backed implementation ----------

function createSupabaseStore(): DocumentStore {
  const adminClientPromise = import('@/infrastructure/database/client').then(
    (m) => m.createAdminClient(),
  );

  const table = async (name: string) => {
    const client = await adminClientPromise;
    return (client as unknown as { from: (n: string) => unknown }).from(name);
  };

  return {
    backend: 'supabase',

    async list(filters: DocumentFilters, tenantId: string) {
      const t = (await table('employee_documents')) as {
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
      if (filters.status && filters.status !== 'all') {
        chain = chain.eq('status', filters.status);
      }
      if (filters.category && filters.category !== 'all') {
        chain = chain.eq('category', filters.category);
      }
      const { data, error } = (await (chain as unknown as Promise<{
        data: unknown[];
        error: unknown;
      }>)) as { data: unknown[]; error: unknown };
      if (error) throw error;
      return (data ?? []).map((r) => documentFromRow(r as never));
    },

    async findById(id: string, tenantId: string) {
      const t = (await table('employee_documents')) as {
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
      return data ? documentFromRow(data as never) : null;
    },

    async findByEmployee(employeeId: string, tenantId: string) {
      const t = (await table('employee_documents')) as {
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
      return (data ?? []).map((r) => documentFromRow(r as never));
    },

    async save(doc: Partial<EmployeeDocument>, tenantId: string) {
      const row = documentToRow(doc);
      const payload = { ...row, tenant_id: tenantId, updated_at: new Date().toISOString() };

      if (doc.id) {
        // Upsert by id
        const t = (await table('employee_documents')) as {
          upsert: (v: Record<string, unknown>) => {
            select: (c: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
        const { data, error } = await t
          .upsert(payload)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        return data ? documentFromRow(data as never) : null;
      }

      // Insert new
      const t = (await table('employee_documents')) as {
        insert: (v: Record<string, unknown>) => {
          select: (c: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      const { data, error } = await t
        .insert(payload)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? documentFromRow(data as never) : null;
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

let cachedStore: DocumentStore | null = null;

export function getDocumentStore(): DocumentStore {
  if (cachedStore) return cachedStore;
  cachedStore = isSupabaseConfigured() ? createSupabaseStore() : mockStore;
  return cachedStore;
}

/** For tests: reset the cached singleton so env changes take effect. */
export function __resetDocumentStore(): void {
  cachedStore = null;
}

/**
 * Address persistence with graceful fallback.
 *
 * - Preferred: Supabase `employee_addresses` via service-role client.
 * - Fallback: process-local in-memory map (for dev + when Supabase unavailable).
 *
 * The write adapter above this layer owns validation and audit — this is
 * purely persistence.
 */

import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';

export interface AddressRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  type: 'home' | 'postal' | 'emergency';
  street: string;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country: string;
  isCurrent: boolean;
  updatedAt: string;
}

export interface AddressStore {
  readonly backend: 'supabase' | 'memory';
  getCurrent(
    employeeId: string,
    tenantId: string,
    type: AddressRecord['type'],
  ): Promise<AddressRecord | null>;
  upsertCurrent(record: Omit<AddressRecord, 'id' | 'updatedAt' | 'isCurrent'>): Promise<AddressRecord>;
}

// --- in-memory fallback ----------------------------------------------------

const memoryStore = new Map<string, AddressRecord>();
const memoryKey = (
  tenantId: string,
  employeeId: string,
  type: AddressRecord['type'],
) => `${tenantId}::${employeeId}::${type}`;

const memoryBackend: AddressStore = {
  backend: 'memory',
  async getCurrent(employeeId, tenantId, type) {
    return memoryStore.get(memoryKey(tenantId, employeeId, type)) ?? null;
  },
  async upsertCurrent(partial) {
    const key = memoryKey(partial.tenantId, partial.employeeId, partial.type);
    const existing = memoryStore.get(key);
    const record: AddressRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      tenantId: partial.tenantId,
      employeeId: partial.employeeId,
      type: partial.type,
      street: partial.street,
      suburb: partial.suburb ?? null,
      state: partial.state ?? null,
      postcode: partial.postcode ?? null,
      country: partial.country,
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.set(key, record);
    return record;
  },
};

// --- Supabase-backed -------------------------------------------------------

function createSupabaseBackend(): AddressStore | null {
  const baseClient = createServiceRoleClient();
  if (!baseClient) return null;
  // The generated Database type does not yet include `employee_addresses`
  // (migration applied out-of-band). Cast through `unknown` so we can call
  // `.from('employee_addresses')` without dropping the rest of typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = baseClient as unknown as { from: (t: string) => any };

  return {
    backend: 'supabase',
    async getCurrent(employeeId, tenantId, type) {
      const { data, error } = await client
        .from('employee_addresses')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('type', type)
        .eq('is_current', true)
        .maybeSingle();

      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        employeeId: String(row.employee_id),
        type: row.type as AddressRecord['type'],
        street: String(row.street),
        suburb: (row.suburb as string | null) ?? null,
        state: (row.state as string | null) ?? null,
        postcode: (row.postcode as string | null) ?? null,
        country: String(row.country ?? 'AU'),
        isCurrent: Boolean(row.is_current),
        updatedAt: String(row.updated_at),
      };
    },
    async upsertCurrent(partial) {
      // Mark previous addresses of this type as non-current, then insert.
      await client
        .from('employee_addresses')
        .update({ is_current: false })
        .eq('tenant_id', partial.tenantId)
        .eq('employee_id', partial.employeeId)
        .eq('type', partial.type);

      const insertPayload = {
        tenant_id: partial.tenantId,
        employee_id: partial.employeeId,
        type: partial.type,
        street: partial.street,
        suburb: partial.suburb ?? null,
        state: partial.state ?? null,
        postcode: partial.postcode ?? null,
        country: partial.country,
        is_current: true,
      };

      const { data, error } = await client
        .from('employee_addresses')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        throw new Error(
          `Supabase address upsert failed: ${error?.message ?? 'no row returned'}`,
        );
      }
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        employeeId: String(row.employee_id),
        type: row.type as AddressRecord['type'],
        street: String(row.street),
        suburb: (row.suburb as string | null) ?? null,
        state: (row.state as string | null) ?? null,
        postcode: (row.postcode as string | null) ?? null,
        country: String(row.country ?? 'AU'),
        isCurrent: Boolean(row.is_current),
        updatedAt: String(row.updated_at),
      };
    },
  };
}

let resolvedStore: AddressStore | null = null;

export function getAddressStore(): AddressStore {
  if (resolvedStore) return resolvedStore;
  resolvedStore = createSupabaseBackend() ?? memoryBackend;
  return resolvedStore;
}

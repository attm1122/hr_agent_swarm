/**
 * RecordsWriteAdapter.
 *
 * Handles UPDATE/CREATE on employee records. For this slice we focus on
 * self-address updates (Example 1). The adapter:
 *   1. Validates the payload with a strict Zod schema.
 *   2. Verifies the acting user has capability (defence in depth; the
 *      DecisionEngine already gated the request).
 *   3. Performs the write via AddressStore (Supabase or in-memory fallback).
 *   4. Returns { before, after } for UIComposer to render a ConfirmationCard.
 */

import { z } from 'zod';
import { hasCapability } from '@/lib/auth/authorization';
import type { AgentContext } from '@/types';
import type { Intent } from '../../intent/types';
import { getAddressStore, type AddressRecord } from './address-store';

// AU-first; extendable. Postcode is 4 digits for AU; more permissive for others.
const AddressPayloadSchema = z.object({
  street: z.string().trim().min(2).max(200),
  suburb: z.string().trim().min(1).max(100).optional(),
  state: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .optional(),
  postcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\- ]{3,10}$/, 'Invalid postcode')
    .optional(),
  country: z.string().trim().min(2).max(56).default('AU'),
});

export type AddressPayload = z.infer<typeof AddressPayloadSchema>;

export interface AddressUpdateResult {
  before: AddressRecord | null;
  after: AddressRecord;
  changedFields: string[];
}

export class RecordsWriteError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RecordsWriteError';
    this.code = code;
  }
}

function pickAddressFromIntent(intent: Intent): Record<string, unknown> {
  const source = intent.payload ?? {};
  // Interpreter might nest under "address".
  const nested = source.address as Record<string, unknown> | undefined;
  return nested ?? source;
}

function diffAddresses(
  before: AddressRecord | null,
  after: AddressRecord,
): string[] {
  if (!before) {
    return ['street', 'suburb', 'state', 'postcode', 'country'];
  }
  const changed: string[] = [];
  (['street', 'suburb', 'state', 'postcode', 'country'] as const).forEach(
    (field) => {
      if ((before[field] ?? null) !== (after[field] ?? null)) {
        changed.push(field);
      }
    },
  );
  return changed;
}

export async function updateOwnAddress(
  intent: Intent,
  ctx: AgentContext,
): Promise<AddressUpdateResult> {
  if (intent.target.scope !== 'self') {
    throw new RecordsWriteError(
      'updateOwnAddress only supports target.scope=self',
      'WRITE_SCOPE_INVALID',
    );
  }

  if (!ctx.employeeId) {
    throw new RecordsWriteError(
      'Acting session has no employeeId; cannot update self address',
      'NO_EMPLOYEE_ID',
    );
  }

  // Defence in depth — the DecisionEngine already allowed this, but we never
  // trust a single gate.
  if (!hasCapability(ctx.role, 'employee:read')) {
    throw new RecordsWriteError(
      `role=${ctx.role} cannot update own record`,
      'FORBIDDEN',
    );
  }

  const parsed = AddressPayloadSchema.safeParse(pickAddressFromIntent(intent));
  if (!parsed.success) {
    throw new RecordsWriteError(
      `Invalid address payload: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
      'VALIDATION_FAILED',
    );
  }

  const payload: AddressPayload = parsed.data;
  const tenantId = ctx.tenantId || 'default';
  const store = getAddressStore();

  const before = await store.getCurrent(ctx.employeeId, tenantId, 'home');

  const after = await store.upsertCurrent({
    tenantId,
    employeeId: ctx.employeeId,
    type: 'home',
    street: payload.street,
    suburb: payload.suburb,
    state: payload.state,
    postcode: payload.postcode,
    country: payload.country,
  });

  const changedFields = diffAddresses(before, after);

  return { before, after, changedFields };
}

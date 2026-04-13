/**
 * POST /api/admin/seed
 *
 * One-off initialization endpoint for a fresh Supabase project. Creates the
 * tenant row and optionally seeds teams + positions so that the directory
 * sync has something to join employees to.
 *
 * Request body (all optional):
 *   {
 *     "tenant": { "id": "leap", "name": "LEAP Legal Software", "slug": "leap" },
 *     "teams": [{ "name": "Engineering", "code": "ENG", "department": "Technology" }],
 *     "positions": [{ "title": "Software Engineer", "level": "IC3",
 *                     "department": "Technology", "jobFamily": "engineering" }]
 *   }
 *
 * GET /api/admin/seed returns current counts so the admin UI can show progress.
 *
 * Idempotent: all inserts use upsert-on-conflict semantics.
 * Admin-only. Requires SUPABASE_SERVICE_ROLE_KEY to be configured.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import {
  addSecurityHeaders,
  securityMiddleware,
  validateRequestBody,
} from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import { createAdminClient } from '@/infrastructure/database/client';

interface TenantInput {
  id?: string;
  name: string;
  slug: string;
}

interface TeamInput {
  name: string;
  code: string;
  department: string;
  costCenter?: string;
  parentTeamCode?: string;
}

interface PositionInput {
  title: string;
  level: string;
  department: string;
  jobFamily: string;
}

interface SeedBody {
  tenant?: TenantInput;
  teams?: TeamInput[];
  positions?: PositionInput[];
}

interface SeedResult {
  tenantId: string | null;
  tenantCreated: boolean;
  teamsUpserted: number;
  positionsUpserted: number;
  counts: {
    tenants: number;
    teams: number;
    positions: number;
    employees: number;
  };
  errors: string[];
}

function isSupabaseReady(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function GET(req: NextRequest) {
  try {
    const { session, securityContext } = requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: false,
      validateInput: false,
    });
    if (securityCheck) return addSecurityHeaders(securityCheck);

    if (!hasCapability(session.role, 'admin:read')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }),
      );
    }

    if (!isSupabaseReady()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            configured: false,
            error:
              'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
          },
          { status: 200 },
        ),
      );
    }

    const admin = createAdminClient();
    const counts = await getCounts(admin);
    return addSecurityHeaders(
      NextResponse.json({ configured: true, counts }, { status: 200 }),
    );
  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        ),
      );
    }
    const message = error instanceof Error ? error.message : 'Seed inspection failed';
    return addSecurityHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, context, securityContext } = requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 256 * 1024,
    });
    if (securityCheck) return addSecurityHeaders(securityCheck);

    if (!hasCapability(session.role, 'admin:write')) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden — admin write access required' },
          { status: 403 },
        ),
      );
    }

    if (!isSupabaseReady()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error:
              'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
          },
          { status: 503 },
        ),
      );
    }

    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: bodyValidation.error || 'Invalid request body' },
          { status: 400 },
        ),
      );
    }
    const body = (bodyValidation.body ?? {}) as SeedBody;

    const admin = createAdminClient();
    const errors: string[] = [];

    // ---------- Tenant ----------
    const tenantInput: TenantInput = body.tenant ?? {
      id: context.tenantId || 'default',
      name: 'LEAP Legal Software',
      slug: context.tenantId || 'leap',
    };

    let tenantId: string | null = null;
    let tenantCreated = false;
    try {
      const result = await upsertTenant(admin, tenantInput);
      tenantId = result.id;
      tenantCreated = result.created;
    } catch (err) {
      errors.push(
        `tenant: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // ---------- Teams ----------
    let teamsUpserted = 0;
    if (tenantId && body.teams?.length) {
      for (const team of body.teams) {
        try {
          await upsertTeam(admin, tenantId, team);
          teamsUpserted++;
        } catch (err) {
          errors.push(
            `team "${team.code}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      // Second pass for parent_team_id resolution once all codes exist.
      for (const team of body.teams) {
        if (!team.parentTeamCode) continue;
        try {
          await linkTeamParent(admin, tenantId, team.code, team.parentTeamCode);
        } catch (err) {
          errors.push(
            `team parent "${team.code}" → "${team.parentTeamCode}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    // ---------- Positions ----------
    let positionsUpserted = 0;
    if (tenantId && body.positions?.length) {
      for (const pos of body.positions) {
        try {
          await upsertPosition(admin, tenantId, pos);
          positionsUpserted++;
        } catch (err) {
          errors.push(
            `position "${pos.title}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    const counts = await getCounts(admin);

    const result: SeedResult = {
      tenantId,
      tenantCreated,
      teamsUpserted,
      positionsUpserted,
      counts,
      errors,
    };

    return addSecurityHeaders(
      NextResponse.json({ success: errors.length === 0, result }, { status: 200 }),
    );
  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        ),
      );
    }
    const message = error instanceof Error ? error.message : 'Seed failed';
    return addSecurityHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

// ---------------------------------------------------------------------------
// Helpers — thin wrappers around supabase-js with `unknown` casts to avoid
// pulling the Database type into this route. The schema contract is:
//   tenants(id, name, slug)
//   teams(id, tenant_id, name, code, department, cost_center, parent_team_id)
//   positions(id, tenant_id, title, level, department, job_family)
// ---------------------------------------------------------------------------

type MinimalClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (c: string, v: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> & {
      select: (cols: string) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error: unknown }>;
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => Promise<{ error: unknown }>;
      };
    };
  };
};

async function upsertTenant(
  client: unknown,
  input: TenantInput,
): Promise<{ id: string; created: boolean }> {
  const c = client as MinimalClient;
  // Try to locate an existing tenant by slug (stable human-friendly key).
  const { data: existing, error: selErr } = await c
    .from('tenants')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle();
  if (selErr) throw asError(selErr);

  if (existing && (existing as { id: string }).id) {
    return { id: (existing as { id: string }).id, created: false };
  }

  // Insert with an explicit id if the caller supplied one (e.g. 'leap' for
  // backwards compat with mock data); otherwise let Postgres generate a UUID.
  const row: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
  };
  if (input.id) row.id = input.id;

  const { data, error } = await c
    .from('tenants')
    .insert(row)
    .select('id')
    .single();
  if (error) throw asError(error);
  return { id: (data as { id: string }).id, created: true };
}

async function upsertTeam(
  client: unknown,
  tenantId: string,
  team: TeamInput,
): Promise<void> {
  const c = client as MinimalClient;
  const { error } = await c.from('teams').upsert(
    {
      tenant_id: tenantId,
      name: team.name,
      code: team.code,
      department: team.department,
      cost_center: team.costCenter ?? null,
    },
    { onConflict: 'tenant_id,code' },
  );
  if (error) throw asError(error);
}

async function linkTeamParent(
  client: unknown,
  tenantId: string,
  childCode: string,
  parentCode: string,
): Promise<void> {
  // supabase-js chains `.eq(...).eq(...).maybeSingle()` fluently. Use a
  // narrow duck-type so we don't need to import the supabase types here.
  const raw = client as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => Promise<{ error: unknown }>;
        };
      };
    };
  };

  const { data: parentRow, error: pErr } = await raw
    .from('teams')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', parentCode)
    .maybeSingle();
  if (pErr) throw asError(pErr);
  if (!parentRow) throw new Error(`parent team "${parentCode}" not found`);

  const { error: uErr } = await raw
    .from('teams')
    .update({ parent_team_id: (parentRow as { id: string }).id })
    .eq('tenant_id', tenantId)
    .eq('code', childCode);
  if (uErr) throw asError(uErr);
}

async function upsertPosition(
  client: unknown,
  tenantId: string,
  pos: PositionInput,
): Promise<void> {
  const c = client as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  // No unique constraint on (tenant_id, title) in the schema, so insert if
  // the title doesn't exist for this tenant to keep the op idempotent.
  const raw = client as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
  const { data: existing, error: selErr } = await raw
    .from('positions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('title', pos.title)
    .maybeSingle();
  if (selErr) throw asError(selErr);
  if (existing) return;

  const { error } = await c.from('positions').insert({
    tenant_id: tenantId,
    title: pos.title,
    level: pos.level,
    department: pos.department,
    job_family: pos.jobFamily,
  });
  if (error) throw asError(error);
}

async function getCounts(client: unknown): Promise<SeedResult['counts']> {
  const raw = client as unknown as {
    from: (t: string) => {
      select: (cols: string, opts: { count: 'exact'; head: true }) => Promise<{
        count: number | null;
        error: unknown;
      }>;
    };
  };
  const tables = ['tenants', 'teams', 'positions', 'employees'] as const;
  const result = { tenants: 0, teams: 0, positions: 0, employees: 0 };
  for (const table of tables) {
    try {
      const { count } = await raw
        .from(table)
        .select('*', { count: 'exact', head: true });
      result[table] = count ?? 0;
    } catch {
      // Table might not exist yet — treat as zero so the UI can still render.
      result[table] = 0;
    }
  }
  return result;
}

function asError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(String(err));
}

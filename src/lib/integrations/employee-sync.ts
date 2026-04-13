/**
 * Employee sync: Microsoft Graph directory → Supabase `employees` table.
 *
 * Pulls every user from Azure AD / Entra (optionally filtered by UPN domain),
 * maps Graph fields to our domain model, and upserts into Supabase. Designed
 * to be run:
 *   1. On-demand via `POST /api/admin/sync/employees` (admin only)
 *   2. On a schedule (cron / Vercel cron) for steady-state sync
 *
 * Idempotent: upsert is keyed on email. Users not found in Graph are NOT
 * deleted from Supabase — set status='terminated' manually or via a
 * termination workflow.
 */

import { createAdminClient } from '@/infrastructure/database/client';
import { listAllUsers, getManager, type GraphUser } from '@/lib/graph/users';
import { isGraphConfigured } from '@/lib/graph/client';

export interface EmployeeSyncOptions {
  tenantId: string;
  /** UPN domain filter, e.g. 'leap.com.au'. Empty string = all users. */
  upnDomain?: string;
  /** Include disabled accounts (default: false). */
  includeDisabled?: boolean;
  /** Dry run — compute diffs without writing. */
  dryRun?: boolean;
}

export interface EmployeeSyncResult {
  totalFetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ upn: string; message: string }>;
  dryRun: boolean;
}

/**
 * Maps a Graph user to our Supabase row shape. We intentionally only populate
 * fields available from the directory — team/position assignment is the HR
 * admin's job and lives in Supabase, not Graph.
 */
function graphUserToEmployeeRow(
  user: GraphUser,
  tenantId: string,
  managerGraphToEmployeeId: Map<string, string>,
): Record<string, unknown> {
  const email = (user.mail ?? user.userPrincipalName).toLowerCase();
  const status: 'active' | 'inactive' | 'pending' = user.accountEnabled
    ? 'active'
    : 'inactive';

  return {
    tenant_id: tenantId,
    email,
    first_name: user.givenName ?? user.displayName.split(' ')[0] ?? '',
    last_name:
      user.surname ??
      user.displayName.split(' ').slice(1).join(' ') ??
      '',
    employee_number: user.employeeId ?? `M365-${user.id.slice(0, 8)}`,
    hire_date:
      user.employeeHireDate?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    termination_date: null,
    status,
    team_id: null, // Set via HR admin tool
    position_id: null, // Set via HR admin tool
    manager_id: managerGraphToEmployeeId.get(user.id) ?? null,
    work_location: null,
    employment_type: (user.employeeType?.toLowerCase() === 'contract'
      ? 'contract'
      : 'full_time') as 'full_time' | 'contract',
    auth_provider_id: user.id, // Link to Azure AD object id
    updated_at: new Date().toISOString(),
  };
}

/**
 * Runs the sync. Throws if Graph is not configured (callers should check first).
 */
export async function syncEmployeesFromGraph(
  options: EmployeeSyncOptions,
): Promise<EmployeeSyncResult> {
  if (!isGraphConfigured()) {
    throw new Error(
      'Microsoft Graph is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.',
    );
  }

  const result: EmployeeSyncResult = {
    totalFetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dryRun: options.dryRun ?? false,
  };

  const supabase = createAdminClient();

  // Phase 1: buffer all users so we can resolve managers in a second pass.
  const users: GraphUser[] = [];
  for await (const user of listAllUsers({
    upnDomain: options.upnDomain,
    onlyEnabled: !options.includeDisabled,
  })) {
    users.push(user);
    result.totalFetched += 1;
  }

  // Phase 2: resolve manager Graph IDs for each user.
  const managerMap = new Map<string, string>(); // userGraphId -> managerGraphId
  await Promise.all(
    users.map(async (u) => {
      try {
        const mgr = await getManager(u.id);
        if (mgr) managerMap.set(u.id, mgr.id);
      } catch {
        // 404 / permission errors ignored — manager is optional
      }
    }),
  );

  // Phase 3: upsert users. We do two passes so we can link managers by our
  // own employee id (Graph ids are stored in auth_provider_id).
  const graphIdToEmployeeId = new Map<string, string>();

  for (const user of users) {
    try {
      const email = (user.mail ?? user.userPrincipalName).toLowerCase();
      // Lookup existing employee by email (tenant-scoped).
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', options.tenantId)
        .eq('email', email)
        .maybeSingle();

      if (options.dryRun) {
        if (existing?.id) result.updated += 1;
        else result.inserted += 1;
        if (existing?.id) graphIdToEmployeeId.set(user.id, existing.id as string);
        continue;
      }

      const row = graphUserToEmployeeRow(user, options.tenantId, new Map());
      if (existing?.id) {
        const { error } = await supabase
          .from('employees')
          .update(row)
          .eq('id', existing.id);
        if (error) throw error;
        result.updated += 1;
        graphIdToEmployeeId.set(user.id, existing.id as string);
      } else {
        const { data: inserted, error } = await supabase
          .from('employees')
          .insert(row)
          .select('id')
          .single();
        if (error) throw error;
        result.inserted += 1;
        if (inserted?.id) {
          graphIdToEmployeeId.set(user.id, inserted.id as string);
        }
      }
    } catch (err) {
      result.errors.push({
        upn: user.userPrincipalName,
        message: err instanceof Error ? err.message : String(err),
      });
      result.skipped += 1;
    }
  }

  // Phase 4: second pass to set manager_id links now that everyone has an id.
  if (!options.dryRun) {
    for (const user of users) {
      const managerGraphId = managerMap.get(user.id);
      const employeeId = graphIdToEmployeeId.get(user.id);
      const managerEmployeeId = managerGraphId
        ? graphIdToEmployeeId.get(managerGraphId)
        : null;
      if (!employeeId || !managerEmployeeId) continue;
      await supabase
        .from('employees')
        .update({ manager_id: managerEmployeeId })
        .eq('id', employeeId);
    }
  }

  return result;
}

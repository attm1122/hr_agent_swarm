/**
 * Document sync — OneDrive → `employee_documents`.
 *
 * For each employee with a known UPN / email, walk their OneDrive "HR" folder
 * (configurable path) and upsert file metadata into Supabase. We do NOT copy
 * file bytes; we just index the metadata so the document-compliance agent
 * can surface "missing contract", "expiring visa", etc. When a file needs to
 * be served to a user, a signed link is generated at read-time using
 * `getDriveItem` + `webUrl`.
 *
 * Usage — scheduled via `POST /api/admin/sync/documents`:
 *   {
 *     "folderPath": "/HR",           // default
 *     "upnDomain": "leap.com.au",    // only process employees on this domain
 *     "employeeIds": ["emp-001"],    // optional subset (e.g. after onboarding)
 *     "dryRun": false
 *   }
 *
 * Idempotent: uses ON CONFLICT (tenant_id, onedrive_id) to update existing
 * rows with latest size/timestamp/category. Deleted OneDrive items are left
 * in place — run a separate reconciliation job if you want hard deletes.
 */

import { isGraphConfigured } from '@/lib/graph/client';
import { listUserDriveItems, searchUserDrive, type DriveItem } from '@/lib/graph/onedrive';
import type { Employee } from '@/types';

export interface DocumentSyncOptions {
  tenantId: string;
  folderPath?: string;
  employeeIds?: string[];
  upnDomain?: string;
  dryRun?: boolean;
}

export interface DocumentSyncResult {
  employeesProcessed: number;
  filesIndexed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ employeeId?: string; file?: string; error: string }>;
  dryRun: boolean;
}

/**
 * Very rough keyword-based classifier. Good enough for the initial
 * index — employees can override the category from the UI later, and
 * the extraction pipeline (future work) will replace this with proper
 * OCR + NER.
 */
export function classifyDocumentName(fileName: string): string {
  const n = fileName.toLowerCase();
  if (/(contract|employment|agreement|offer)/.test(n)) return 'contract';
  if (/(visa|work[- ]?permit|right[- ]?to[- ]?work)/.test(n)) return 'visa';
  if (/(cert|certificat|diploma|degree)/.test(n)) return 'certification';
  if (/(passport|licence|license|id[- ]?card|driver)/.test(n)) return 'id';
  if (/(medical|health|vaccin|clearance)/.test(n)) return 'medical';
  if (/(tax|w-?2|w-?4|p60|tfn|payg)/.test(n)) return 'tax';
  if (/(review|performance|1[- ]?on[- ]?1|goals)/.test(n)) return 'performance';
  return 'other';
}

/**
 * Extract an expiry date from the filename (e.g. "visa-2027-03-15.pdf").
 * Returns an ISO date or null. Conservative on purpose — false positives
 * here cause bogus "expiring" alerts, so we only match clear YYYY-MM-DD.
 */
export function extractExpiryFromName(fileName: string): string | null {
  const m = fileName.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo}-${d}`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return iso;
}

/**
 * Main entry point. Lazy-imports the admin client so this module stays
 * safe to import from edge routes that never actually run sync.
 */
export async function syncDocumentsFromOneDrive(
  opts: DocumentSyncOptions,
): Promise<DocumentSyncResult> {
  const result: DocumentSyncResult = {
    employeesProcessed: 0,
    filesIndexed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dryRun: Boolean(opts.dryRun),
  };

  if (!isGraphConfigured()) {
    result.errors.push({ error: 'Microsoft Graph is not configured' });
    return result;
  }

  const employees = await loadEmployees(opts);
  const folderPath = opts.folderPath ?? '/HR';

  for (const emp of employees) {
    if (!emp.email) {
      result.skipped++;
      continue;
    }
    result.employeesProcessed++;
    try {
      for await (const item of iterateDocuments(emp.email, folderPath)) {
        result.filesIndexed++;
        if (result.dryRun) continue;
        try {
          const { wasInsert } = await upsertDocument(opts.tenantId, emp, item);
          if (wasInsert) result.inserted++;
          else result.updated++;
        } catch (err) {
          result.errors.push({
            employeeId: emp.id,
            file: item.name,
            error: errorMessage(err),
          });
        }
      }
    } catch (err) {
      result.errors.push({ employeeId: emp.id, error: errorMessage(err) });
    }
  }

  return result;
}

/**
 * Walk the user's HR folder. If the folder doesn't exist (common for new
 * hires), fall back to searching the drive for HR-related keywords at the
 * root so we still pick up files placed loosely.
 */
async function* iterateDocuments(
  upn: string,
  folderPath: string,
): AsyncIterableIterator<DriveItem> {
  try {
    for await (const item of listUserDriveItems(upn, folderPath)) {
      // Skip folders; only yield files.
      if (item.folder) continue;
      yield item;
    }
  } catch (err) {
    // Folder-not-found is the common case. Fall back to keyword search.
    const msg = errorMessage(err).toLowerCase();
    if (msg.includes('not found') || msg.includes('itemnotfound')) {
      for await (const item of searchUserDrive(upn, 'contract OR visa OR tax')) {
        if (item.folder) continue;
        yield item;
      }
    } else {
      throw err;
    }
  }
}

async function loadEmployees(opts: DocumentSyncOptions): Promise<Employee[]> {
  const { getEmployeeStore } = await import('@/lib/data/employee-store');
  const store = getEmployeeStore();
  const base = opts.employeeIds?.length
    ? await store.findByIds(opts.employeeIds, opts.tenantId)
    : await store.findAll(opts.tenantId);

  const domain = opts.upnDomain?.toLowerCase();
  return base.filter((e) => {
    if (e.status === 'terminated') return false;
    if (!e.email) return false;
    if (domain && !e.email.toLowerCase().endsWith(`@${domain}`)) return false;
    return true;
  });
}

async function upsertDocument(
  tenantId: string,
  employee: Employee,
  item: DriveItem,
): Promise<{ wasInsert: boolean }> {
  const { createAdminClient } = await import('@/infrastructure/database/client');
  const client = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: unknown }>;
      };
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };

  const row = {
    tenant_id: tenantId,
    employee_id: employee.id,
    onedrive_id: item.id,
    onedrive_path: item.parentReference?.path ?? '',
    file_name: item.name,
    file_type: item.file?.mimeType ?? 'application/octet-stream',
    file_size: item.size,
    category: classifyDocumentName(item.name),
    status: deriveStatus(item.name),
    uploaded_at: item.createdDateTime,
    expires_at: extractExpiryFromName(item.name),
    extracted_data: { webUrl: item.webUrl, lastModified: item.lastModifiedDateTime },
  };

  // Two-step upsert so we can distinguish insert vs update for reporting.
  const { data: existing, error: selErr } = await client
    .from('employee_documents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('onedrive_id', item.id)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const id = (existing as { id: string }).id;
    const { error: updErr } = await client
      .from('employee_documents')
      .update(row)
      .eq('id', id);
    if (updErr) throw updErr;
    return { wasInsert: false };
  }

  const { error: insErr } = await client.from('employee_documents').insert(row);
  if (insErr) throw insErr;
  return { wasInsert: true };
}

function deriveStatus(fileName: string): string {
  const expires = extractExpiryFromName(fileName);
  if (!expires) return 'active';
  const days = Math.floor(
    (new Date(expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/**
 * ArtifactXlsxAdapter — generates an XLSX workbook from structured rows.
 *
 * Uses `exceljs`. Stores the file in Supabase Storage under the `ai-os-artifacts`
 * bucket and returns a signed download URL. Falls back to a data: URL and an
 * in-memory metadata row when Supabase isn't reachable (dev mode).
 */

import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import type { ArtifactRef } from '../../orchestrator/events';
import { createServiceRoleClient } from '@/lib/repositories/agent-run-repository';

const BUCKET = 'ai-os-artifacts';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export interface XlsxColumn {
  key: string;
  header: string;
  width?: number;
  format?: 'text' | 'number' | 'date' | 'currency';
}

export interface XlsxBuildInput {
  filename: string; // without extension
  sheetName?: string;
  columns: XlsxColumn[];
  rows: Array<Record<string, string | number | Date | null | undefined>>;
  tenantId: string;
  userId: string;
  traceId?: string;
}

function formatCell(
  value: string | number | Date | null | undefined,
): string | number | Date | null {
  if (value === undefined) return null;
  return value;
}

export async function buildXlsxArtifact(
  input: XlsxBuildInput,
): Promise<ArtifactRef> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI-OS — LEAP Legal';
  wb.created = new Date();
  const ws = wb.addWorksheet(input.sheetName ?? 'Sheet1');

  ws.columns = input.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 20,
  }));

  for (const row of input.rows) {
    const rowObj: Record<string, string | number | Date | null> = {};
    for (const col of input.columns) {
      rowObj[col.key] = formatCell(row[col.key]);
    }
    ws.addRow(rowObj);
  }

  // Header row styling — light emerald, bold.
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' },
  };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `${input.filename}.xlsx`;
  const storagePath = `${input.tenantId}/${input.userId}/${randomUUID()}/${filename}`;

  const supabase = createServiceRoleClient();

  if (supabase) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (signError || !signed?.signedUrl) throw signError ?? new Error('sign failed');

      const artifact: ArtifactRef = {
        id: randomUUID(),
        kind: 'xlsx',
        filename,
        href: signed.signedUrl,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: buffer.byteLength,
        expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      };

      // Best-effort metadata row — don't fail the request if storage write
      // succeeded but the trace row can't be created.
      try {
        // The generated Database type does not yet include `ai_os_artifacts`
        // (migration applied out-of-band). Cast through unknown to bypass.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const looseClient = supabase as unknown as { from: (t: string) => any };
        await looseClient.from('ai_os_artifacts').insert({
          id: artifact.id,
          tenant_id: input.tenantId,
          user_id: input.userId,
          trace_id: input.traceId ?? null,
          kind: 'xlsx',
          filename,
          storage_path: storagePath,
          mime_type: artifact.mimeType,
          size_bytes: buffer.byteLength,
          row_count: input.rows.length,
          signed_url_expires_at: artifact.expiresAt,
          metadata: { columns: input.columns.map((c) => c.key) },
        });
      } catch {
        // ignore — metadata is a nice-to-have
      }

      return artifact;
    } catch {
      // fall through to data-URL fallback
    }
  }

  // --- fallback: inline data URL. Tiny sheets only; large sheets should
  // live in storage. This keeps dev/demo paths unblocked.
  const base64 = buffer.toString('base64');
  return {
    id: randomUUID(),
    kind: 'xlsx',
    filename,
    href: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: buffer.byteLength,
  };
}

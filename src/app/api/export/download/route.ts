/**
 * GET /api/export/download?id=<exportId>&token=<signature>
 *
 * Serves approved export files via signed, time-limited download URLs.
 * Replaces the previous data-URI approach which embedded full export data
 * in base64 URLs — polluting browser history, proxy logs, and exceeding
 * URL length limits.
 *
 * Security:
 * - Token is an HMAC-SHA256 signature binding (exportId, expiry, userId)
 * - Tokens expire after 10 minutes
 * - Only the user who triggered the export can download
 * - File is streamed, never stored in a URL
 */

import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { requireResolvedSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** How long a download link remains valid. */
const DOWNLOAD_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory export content store.
 * In production this should be a temporary object store (S3/GCS/R2) with
 * auto-expiry. For now, entries are cleaned up after DOWNLOAD_TTL_MS * 2.
 */
interface ExportFile {
  content: string;
  contentType: string;
  filename: string;
  userId: string;
  createdAt: number;
}

const exportFiles = new Map<string, ExportFile>();

/** Periodic cleanup of expired exports. */
setInterval(() => {
  const cutoff = Date.now() - DOWNLOAD_TTL_MS * 2;
  for (const [key, file] of exportFiles) {
    if (file.createdAt < cutoff) {
      exportFiles.delete(key);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Signing utilities
// ---------------------------------------------------------------------------

function getSigningSecret(): string {
  // Use CRON_SECRET as signing key (available in all environments).
  // In production, use a dedicated EXPORT_SIGNING_SECRET.
  return process.env.EXPORT_SIGNING_SECRET || process.env.CRON_SECRET || 'dev-signing-key';
}

/** Create a time-limited HMAC signature for a download URL. */
export function signDownloadUrl(
  exportId: string,
  userId: string,
  expiresAt: number = Date.now() + DOWNLOAD_TTL_MS,
): { token: string; expiresAt: number; url: string } {
  const payload = `${exportId}:${userId}:${expiresAt}`;
  const token = createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');

  const url = `/api/export/download?id=${encodeURIComponent(exportId)}&expires=${expiresAt}&token=${token}`;

  return { token, expiresAt, url };
}

/** Verify a download signature. */
function verifySignature(
  exportId: string,
  userId: string,
  expiresAt: number,
  token: string,
): boolean {
  const payload = `${exportId}:${userId}:${expiresAt}`;
  const expected = createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');

  // Constant-length comparison (both are hex digests of same hash, so same length)
  if (token.length !== expected.length) return false;

  // Use timing-safe comparison
  const { timingSafeEqual } = require('crypto');
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** Store export content for later download. */
export function storeExportFile(
  exportId: string,
  content: string,
  contentType: string,
  filename: string,
  userId: string,
): void {
  exportFiles.set(exportId, {
    content,
    contentType,
    filename,
    userId,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth required
  let session;
  try {
    session = await requireResolvedSession();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }

  const url = new URL(req.url);
  const exportId = url.searchParams.get('id');
  const expiresAtStr = url.searchParams.get('expires');
  const token = url.searchParams.get('token');

  if (!exportId || !expiresAtStr || !token) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const expiresAt = parseInt(expiresAtStr, 10);

  // Check expiry
  if (Date.now() > expiresAt) {
    return new Response(
      JSON.stringify({ error: 'Download link has expired' }),
      { status: 410, headers: { 'content-type': 'application/json' } },
    );
  }

  // Verify signature (binds exportId + userId + expiry)
  if (!verifySignature(exportId, session.userId, expiresAt, token)) {
    return new Response(
      JSON.stringify({ error: 'Invalid download token' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }

  // Retrieve stored file
  const file = exportFiles.get(exportId);
  if (!file) {
    return new Response(
      JSON.stringify({ error: 'Export file not found or expired' }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }

  // Verify user owns this export
  if (file.userId !== session.userId) {
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }

  // Stream file content
  return new Response(file.content, {
    status: 200,
    headers: {
      'content-type': file.contentType,
      'content-disposition': `attachment; filename="${file.filename}"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}

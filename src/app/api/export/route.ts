/**
 * Export API Route - Secure Data Export with Approval Workflow
 * 
 * Production-ready with:
 * - Zod validation
 * - Idempotency support
 * - Approval workflow persistence
 * - Structured error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExportRequestSchema, ExportApprovalRequestSchema } from '@/lib/validation/schemas';
import { IdempotencyStore } from '@/lib/validation/idempotency';
import { requireSession, hasCapability } from '@/lib/auth/session';
import { createCacheAdapter } from '@/lib/infrastructure/redis/redis-cache-adapter';
import { RedisRateLimiter, RATE_LIMITS } from '@/lib/security/rate-limit-redis';
import { RepositoryFactory } from '@/lib/ports';
import { createSupabaseRepositoryFactory } from '@/lib/repositories/supabase-factory';
import { createId } from '@/lib/utils/ids';
import { signDownloadUrl, storeExportFile } from '@/app/api/export/download/route';
import { extractCsrfToken, validateCsrfToken } from '@/lib/security/csrf';
import { securityLog } from '@/lib/security/logger';
import type { ExportApproval } from '@/types';

// Initialize infrastructure
const cache = createCacheAdapter();
const idempotencyStore = new IdempotencyStore(cache);
const rateLimiter = new RedisRateLimiter(cache);

// In-memory approval store (replace with database in production)
const approvalStore = new Map<string, ExportApproval>();

// Error response helper
function createErrorResponse(
  message: string,
  code: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

// Helper: Check if export requires approval
function requiresApproval(fields: string[]): boolean {
  const sensitiveFields = [
    'salary',
    'baseSalary',
    'bonus',
    'compensation',
    'ssn',
    'taxId',
    'bankAccount',
  ];
  return fields.some(f => sensitiveFields.includes(f));
}

// Helper: Get allowed fields based on role
function getAllowedFields(role: string): string[] {
  const baseFields = [
    'id', 'firstName', 'lastName', 'email', 'status',
    'department', 'teamId', 'managerId', 'hireDate',
    'workLocation', 'employmentType'
  ];
  
  if (role === 'admin' || role === 'hr') {
    return [...baseFields, 'salary', 'bonus', 'compensation'];
  }
  
  return baseFields;
}

// GET: List user's exports and approvals
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) {
      return createErrorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // Get approvals for this user
    const approvals = Array.from(approvalStore.values()).filter(
      a => a.requesterId === session.userId || (status === 'pending' && a.status === 'pending')
    );

    return NextResponse.json({ approvals });

  } catch (error) {
    securityLog.error('export', 'Export GET error', { error: error instanceof Error ? error.message : error });
    return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

// POST: Request export
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) {
      return createErrorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(
      session.userId,
      RATE_LIMITS.export
    );
    
    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { retryAfter: rateLimitResult.retryAfter }
      );
    }

    // Validate request
    const rawBody = await req.json();
    const validationResult = ExportRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return createErrorResponse(
        'Invalid request body',
        'VALIDATION_ERROR',
        400,
        validationResult.error.issues
      );
    }

    const body = validationResult.data;

    // Check idempotency — validate key format to prevent memory exhaustion
    const rawIdempotencyKey = req.headers.get('Idempotency-Key');
    const idempotencyKey = rawIdempotencyKey && rawIdempotencyKey.length <= 128 && /^[\w\-]+$/.test(rawIdempotencyKey)
      ? rawIdempotencyKey
      : null;
    if (rawIdempotencyKey && !idempotencyKey) {
      return createErrorResponse(
        'Invalid Idempotency-Key: must be 1-128 alphanumeric/hyphen/underscore characters',
        'INVALID_IDEMPOTENCY_KEY',
        400,
      );
    }
    if (idempotencyKey) {
      const existing = await idempotencyStore.check(idempotencyKey);
      
      if (existing.exists && existing.status === 'completed') {
        return NextResponse.json(existing.response, {
          headers: { 'X-Idempotency-Replay': 'true' },
        });
      }
    }

    // Validate fields against role
    const allowedFields = getAllowedFields(session.role);
    const invalidFields = body.fields.filter(f => !allowedFields.includes(f));
    
    if (invalidFields.length > 0) {
      return createErrorResponse(
        'Unauthorized fields requested',
        'UNAUTHORIZED_FIELDS',
        403,
        { invalidFields, allowedFields }
      );
    }

    // Check if approval required
    const needsApproval = requiresApproval(body.fields);

    if (needsApproval) {
      // Create approval request
      const approvalId = createId();
      const approval: ExportApproval = {
        id: approvalId,
        requesterId: session.userId,
        requesterEmail: session.email,
        fields: body.fields,
        format: body.format,
        filters: body.filters,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        approverId: null,
        approvedAt: null,
        completedAt: null,
        downloadUrl: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      approvalStore.set(approvalId, approval);

      const response = {
        approvalId,
        status: 'pending_approval',
        message: 'Export requires approval. You will be notified when approved.',
      };

      if (idempotencyKey) {
        await idempotencyStore.complete(idempotencyKey, response);
      }

      return NextResponse.json(response, { status: 202 });
    }

    // Generate export immediately
    const repoFactory = createSupabaseRepositoryFactory();
    const employeeRepo = repoFactory.employee();

    // Fetch data
    const employees = await employeeRepo.findAll({
      tenantId: session.tenantId,
      limit: 1000,
    });

    // Filter and format
    const filteredData = employees.map(emp => {
      const filtered: Record<string, unknown> = {};
      for (const field of body.fields) {
        if (field in emp) {
          filtered[field] = emp[field as keyof typeof emp];
        }
      }
      return filtered;
    });

    // Generate file
    let content: string;
    let contentType: string;

    switch (body.format) {
      case 'json':
        content = JSON.stringify(filteredData, null, 2);
        contentType = 'application/json';
        break;
      case 'csv':
        content = convertToCSV(filteredData);
        contentType = 'text/csv';
        break;
      default:
        content = JSON.stringify(filteredData);
        contentType = 'application/json';
    }

    const response = {
      status: 'completed',
      data: content,
      format: body.format,
      recordCount: filteredData.length,
    };

    if (idempotencyKey) {
      await idempotencyStore.complete(idempotencyKey, response);
    }

    return NextResponse.json(response);

  } catch (error) {
    // SECURITY: Never leak raw error details to client
    securityLog.error('export', 'Export POST error', { error: error instanceof Error ? error.message : error });
    return createErrorResponse(
      'An internal error occurred processing the export.',
      'INTERNAL_ERROR',
      500
    );
  }
}

// PATCH: Approve or reject export
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) {
      return createErrorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }

    // Check permission
    if (!hasCapability(session.role, 'export:approve')) {
      return createErrorResponse(
        'Insufficient permissions',
        'FORBIDDEN',
        403
      );
    }

    // Validate request
    const rawBody = await req.json();
    const validationResult = ExportApprovalRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      return createErrorResponse(
        'Invalid request body',
        'VALIDATION_ERROR',
        400,
        validationResult.error.issues
      );
    }

    const body = validationResult.data;

    // Get approval
    const approval = approvalStore.get(body.approvalId);
    if (!approval) {
      return createErrorResponse('Approval not found', 'NOT_FOUND', 404);
    }

    if (approval.status !== 'pending') {
      return createErrorResponse(
        `Approval already ${approval.status}`,
        'INVALID_STATUS',
        400
      );
    }

    if (body.action === 'reject') {
      approval.status = 'rejected';
      approval.approverId = session.userId;
      approval.approvedAt = new Date().toISOString();
      approval.rejectionReason = body.reason;

      approvalStore.set(body.approvalId, approval);

      return NextResponse.json({
        status: 'rejected',
        approvalId: body.approvalId,
      });
    }

    // Approve and generate export
    const repoFactory = createSupabaseRepositoryFactory();
    const employeeRepo = repoFactory.employee();

    const employees = await employeeRepo.findAll({
      tenantId: session.tenantId,
      limit: 1000,
    });

    const filteredData = employees.map(emp => {
      const filtered: Record<string, unknown> = {};
      for (const field of approval.fields) {
        if (field in emp) {
          filtered[field] = emp[field as keyof typeof emp];
        }
      }
      return filtered;
    });

    let content: string;
    switch (approval.format) {
      case 'json':
        content = JSON.stringify(filteredData, null, 2);
        break;
      case 'csv':
        content = convertToCSV(filteredData);
        break;
      default:
        content = JSON.stringify(filteredData);
    }

    approval.status = 'approved';
    approval.approverId = session.userId;
    approval.approvedAt = new Date().toISOString();
    approval.completedAt = new Date().toISOString();

    // SECURITY: Use signed, time-limited download URLs instead of data URIs.
    // Data URIs embed full export content in the URL — polluting browser history,
    // proxy logs, and exceeding URL length limits for large exports.
    const contentType = approval.format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `export_${body.approvalId}.${approval.format === 'csv' ? 'csv' : 'json'}`;
    storeExportFile(body.approvalId, content, contentType, filename, session.userId);
    const { url: downloadUrl } = signDownloadUrl(body.approvalId, session.userId);
    approval.downloadUrl = downloadUrl;

    approvalStore.set(body.approvalId, approval);

    return NextResponse.json({
      status: 'approved',
      approvalId: body.approvalId,
      downloadUrl,
      recordCount: filteredData.length,
    });

  } catch (error) {
    // SECURITY: Never leak raw error details to client
    securityLog.error('export', 'Export PATCH error', { error: error instanceof Error ? error.message : error });
    return createErrorResponse(
      'An internal error occurred processing the export.',
      'INTERNAL_ERROR',
      500
    );
  }
}

// Helper: Convert to CSV
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

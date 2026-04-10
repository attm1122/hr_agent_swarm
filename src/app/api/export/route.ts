/**
 * POST /api/export
 * Secure export endpoint with approval workflow
 * 
 * SECURITY: Protected by:
 * - Rate limiting (report tier: 10/min)
 * - CSRF token validation
 * - RBAC permission checks
 * - Approval workflow for sensitive data
 * - Field-level filtering based on role
 * - Audit logging for all exports
 * - Security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAgentContext } from '@/lib/auth/session';
import { securityMiddleware, validateRequestBody, addSecurityHeaders } from '@/lib/security';
import { logSecurityEvent, logSensitiveAction } from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import { getEmployeeList } from '@/lib/services/employee.service';
import { getCoordinator } from '@/lib/agents';
import type { AgentContext, Employee } from '@/types';

interface ExportRequestBody {
  type: 'employees' | 'documents' | 'leave' | 'compliance';
  format: 'csv' | 'json';
  filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    teamId?: string;
  };
  fields?: string[]; // Requested fields (filtered by RBAC)
  requiresApproval?: boolean;
}

interface ExportApproval {
  exportId: string;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  approvedAt?: string;
  requestedFields: string[];
  allowedFields: string[];
}

// In-memory approval store for POC (replace with database in production)
const pendingApprovals = new Map<string, ExportApproval>();

/**
 * Determine which fields are allowed for export based on role
 */
function getAllowedExportFields(
  context: AgentContext,
  exportType: string
): string[] {
  const { role, sensitivityClearance } = context;

  // Base fields all roles can see
  const baseFields = ['id', 'firstName', 'lastName', 'email', 'status', 'teamId', 'positionId'];

  switch (exportType) {
    case 'employees': {
      if (role === 'admin') {
        return [...baseFields, 'hireDate', 'salary', 'phone', 'address', 'birthDate', 'taxId'];
      }
      if (role === 'payroll') {
        return [...baseFields, 'hireDate', 'salary', 'taxId'];
      }
      if (role === 'manager') {
        return [...baseFields, 'hireDate']; // No salary for manager export
      }
      // Employee, team_lead - minimal fields
      return baseFields;
    }

    case 'documents': {
      // Document exports have their own RBAC
      return ['id', 'type', 'status', 'expiryDate', 'employeeId', 'fileName'];
    }

    case 'leave': {
      return ['id', 'employeeId', 'type', 'startDate', 'endDate', 'status', 'days'];
    }

    case 'compliance': {
      if (role === 'admin' || role === 'manager') {
        return ['id', 'employeeId', 'milestoneType', 'dueDate', 'status', 'notes'];
      }
      return [];
    }

    default:
      return baseFields;
  }
}

/**
 * Filter fields based on approval status and role
 */
function filterExportFields(
  data: Record<string, unknown>[],
  requestedFields: string[],
  allowedFields: string[],
  context: AgentContext
): Record<string, unknown>[] {
  // Intersection of requested and allowed fields
  const permittedFields = requestedFields.filter(f => allowedFields.includes(f));

  // If no fields specified, use all allowed fields
  const fieldsToInclude = permittedFields.length > 0 ? permittedFields : allowedFields;

  return data.map(record => {
    const filtered: Record<string, unknown> = {};
    for (const field of fieldsToInclude) {
      if (field in record) {
        filtered[field] = record[field];
      }
    }
    return filtered;
  });
}

/**
 * Check if export requires approval workflow
 */
function requiresApproval(
  context: AgentContext,
  exportType: string,
  requestedFields: string[]
): boolean {
  const { role } = context;

  // Always require approval for:
  // - Salary/compensation data
  // - SSN/tax ID
  // - Admin-level exports by non-admins
  const sensitiveFields = ['salary', 'taxId', 'ssn', 'bankAccount'];
  const requestedSensitive = requestedFields.filter(f => sensitiveFields.includes(f));

  if (requestedSensitive.length > 0 && role !== 'admin' && role !== 'payroll') {
    return true;
  }

  // Bulk exports (more than 50 records implied by type)
  if (exportType === 'employees' && role === 'manager') {
    return true; // Managers need approval for employee exports
  }

  // Compliance exports always require approval
  if (exportType === 'compliance') {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession();
    const context = getAgentContext(session);

    // 1. Security middleware (rate limit, CSRF, size checks)
    const securityContext = {
      userId: session.employeeId || 'unknown',
      role: session.role,
      sessionId: session.userId,
    };

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'report', // Stricter limit for exports
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 512 * 1024, // 512KB for export requests
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // 2. RBAC permission check
    if (!hasCapability(session.role, 'report:generate')) {
      logSecurityEvent(
        'auth_failure',
        context,
        { reason: 'User lacks report:generate capability for export', resourceType: 'export' }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden - insufficient permissions' },
          { status: 403 }
        )
      );
    }

    // 3. Validate and sanitize request body
    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      logSecurityEvent(
        'security_blocked',
        context,
        { reason: bodyValidation.error || 'Body validation failed for export', resourceType: 'export' }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: bodyValidation.error || 'Invalid request body' },
          { status: 400 }
        )
      );
    }

    const body = bodyValidation.body as unknown as ExportRequestBody;

    if (!body.type || !body.format) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Missing required fields: type and format' },
          { status: 400 }
        )
      );
    }

    // 4. Determine allowed fields for this role/export type
    const allowedFields = getAllowedExportFields(context, body.type);
    const requestedFields = body.fields || allowedFields;

    // 5. Check if approval is required
    const needsApproval = requiresApproval(context, body.type, requestedFields);

    if (needsApproval) {
      // Create approval request
      const exportId = crypto.randomUUID();
      const approval: ExportApproval = {
        exportId,
        status: 'pending',
        requestedFields,
        allowedFields,
      };

      pendingApprovals.set(exportId, approval);

      // Log sensitive action
      logSensitiveAction(
        context,
        'export_requested',
        body.type,
        exportId,
        true,
        'pending'
      );

      // Return pending status
      return addSecurityHeaders(
        NextResponse.json({
          status: 'pending_approval',
          exportId,
          message: 'Export requires approval due to sensitive data access',
          requestedFields,
          approverRole: context.role === 'manager' ? 'admin' : 'manager',
        }, { status: 202 })
      );
    }

    // 6. Execute export (no approval needed)
    let exportData: Record<string, unknown>[] = [];

    switch (body.type) {
      case 'employees': {
        const result = await getEmployeeList(context, {
          status: (body.filters?.status as 'active' | 'inactive' | 'on_leave' | 'terminated' | 'pending') || 'active',
          limit: 1000,
        });
        exportData = result.employees.map(e => ({ ...e } as Record<string, unknown>));
        break;
      }

      // TODO: Add other export types (documents, leave, compliance)
      default:
        return addSecurityHeaders(
          NextResponse.json(
            { error: `Export type '${body.type}' not implemented` },
            { status: 501 }
          )
        );
    }

    // 7. Filter fields based on RBAC
    const filteredData = filterExportFields(
      exportData,
      requestedFields,
      allowedFields,
      context
    );

    // 8. Log the export
    logSensitiveAction(
      context,
      'export_completed',
      body.type,
      'bulk_export',
      false
    );

    // 9. Return export data
    if (body.format === 'csv') {
      // Simple CSV generation
      const headers = Object.keys(filteredData[0] || {}).join(',');
      const rows = filteredData.map(row =>
        Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      return addSecurityHeaders(
        new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${body.type}_export_${new Date().toISOString().split('T')[0]}.csv"`,
          },
        })
      );
    }

    // JSON format
    return addSecurityHeaders(
      NextResponse.json({
        status: 'success',
        type: body.type,
        format: body.format,
        recordCount: filteredData.length,
        fields: Object.keys(filteredData[0] || {}),
        data: filteredData,
        exportedAt: new Date().toISOString(),
        exportedBy: session.employeeId,
      })
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    console.error('Export error:', err);

    const errorResponse = NextResponse.json(
      { error: message },
      { status: 500 }
    );
    return addSecurityHeaders(errorResponse);
  }
}

/**
 * GET /api/export/approval/:exportId
 * Check export approval status
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSession();
    const context = getAgentContext(session);

    // Security middleware
    const securityContext = {
      userId: session.employeeId || 'unknown',
      role: session.role,
      sessionId: session.userId,
    };

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: false,
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // Get exportId from query params
    const { searchParams } = new URL(req.url);
    const exportId = searchParams.get('exportId');

    if (!exportId) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Missing exportId parameter' },
          { status: 400 }
        )
      );
    }

    const approval = pendingApprovals.get(exportId);

    if (!approval) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Export not found' },
          { status: 404 }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        exportId,
        status: approval.status,
        requestedFields: approval.requestedFields,
        allowedFields: approval.allowedFields,
        approverId: approval.approverId,
        approvedAt: approval.approvedAt,
      })
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

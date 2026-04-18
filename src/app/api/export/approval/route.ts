/**
 * Export Approval API
 * 
 * PATCH /api/export/approval - Approve or reject an export request
 * GET /api/export/approval - List pending approvals (for approvers)
 * 
 * Security:
 * - Requires 'export:approve' capability
 * - Audit logs all approval decisions
 * - Only approvers can see/review pending exports
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import { securityMiddleware, addSecurityHeaders } from '@/lib/security';
import { logSecurityEvent, logSensitiveAction } from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import { getEmployeeList } from '@/lib/services/employee.service';
import type { AgentContext } from '@/types';
import { toDateOnlyString } from '@/lib/date-only';

// In-memory store - replace with database in production
interface ExportApproval {
  exportId: string;
  requesterId: string;
  requesterRole: string;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  approverRole?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  requestedFields: string[];
  allowedFields: string[];
  exportType: string;
  exportFormat: string;
  filters?: Record<string, unknown>;
  createdAt: string;
}

const pendingApprovals = new Map<string, ExportApproval>();

// Export for sharing with main route
export { pendingApprovals };

/**
 * Filter fields based on approval status and role
 */
function filterExportFields(
  data: Record<string, unknown>[],
  requestedFields: string[],
  allowedFields: string[],
): Record<string, unknown>[] {
  const permittedFields = requestedFields.filter(f => allowedFields.includes(f));
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
 * Get allowed fields for export type
 */
function getAllowedExportFields(
  context: AgentContext,
  exportType: string
): string[] {
  const { role } = context;
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
        return [...baseFields, 'hireDate'];
      }
      return baseFields;
    }
    case 'documents': {
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
 * Check if user can approve this export request
 */
function canApprove(
  approverContext: AgentContext,
  approval: ExportApproval
): boolean {
  const { role, userId } = approverContext;

  if (role === 'admin') return true;
  if (role === 'payroll' && approval.requestedFields.includes('salary')) return true;
  if (role === 'manager' && approval.requesterRole === 'employee') return true;
  if (approval.requesterId === userId) return false;

  return false;
}

/**
 * GET /api/export/approval
 * List pending approvals for the current approver
 */
export async function GET(req: NextRequest) {
  try {
    const { session, context, securityContext } = await requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: false,
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    if (!hasCapability(session.role, 'export:approve')) {
      logSecurityEvent(
        'auth_failure',
        context,
        { reason: 'User lacks export:approve capability', resourceType: 'export_approval' }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden - insufficient permissions to view approvals' },
          { status: 403 }
        )
      );
    }

    const { searchParams } = new URL(req.url);
    const exportId = searchParams.get('exportId');

    if (exportId) {
      const approval = pendingApprovals.get(exportId);

      if (!approval) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Export approval not found' },
            { status: 404 }
          )
        );
      }

      if (!canApprove(context, approval) && approval.requesterId !== context.userId) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - cannot view this approval' },
            { status: 403 }
          )
        );
      }

      return addSecurityHeaders(
        NextResponse.json({
          exportId: approval.exportId,
          status: approval.status,
          requesterId: approval.requesterId,
          requesterRole: approval.requesterRole,
          exportType: approval.exportType,
          exportFormat: approval.exportFormat,
          requestedFields: approval.requestedFields,
          allowedFields: approval.allowedFields,
          createdAt: approval.createdAt,
          approvedAt: approval.approvedAt,
          rejectedAt: approval.rejectedAt,
          rejectionReason: approval.rejectionReason,
          canApprove: canApprove(context, approval),
        })
      );
    }

    const allApprovals = Array.from(pendingApprovals.values());
    const visibleApprovals = allApprovals.filter(approval => {
      if (canApprove(context, approval)) return true;
      if (approval.requesterId === context.userId) return true;
      return false;
    });

    const pending = visibleApprovals.filter(a => a.status === 'pending');
    const approved = visibleApprovals.filter(a => a.status === 'approved');
    const rejected = visibleApprovals.filter(a => a.status === 'rejected');

    return addSecurityHeaders(
      NextResponse.json({
        approvals: visibleApprovals.map(a => ({
          exportId: a.exportId,
          status: a.status,
          requesterId: a.requesterId,
          requesterRole: a.requesterRole,
          exportType: a.exportType,
          createdAt: a.createdAt,
          canApprove: canApprove(context, a),
        })),
        summary: {
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length,
          total: visibleApprovals.length,
        },
      })
    );

  } catch (err) {
    if (isSessionResolutionError(err)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status }
        )
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

/**
 * PATCH /api/export/approval
 * Approve or reject an export request
 */
export async function PATCH(req: NextRequest) {
  try {
    const { session, context, securityContext } = await requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 64 * 1024,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    if (!hasCapability(session.role, 'export:approve')) {
      logSecurityEvent(
        'auth_failure',
        context,
        { reason: 'User lacks export:approve capability', resourceType: 'export_approval' }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden - insufficient permissions to approve exports' },
          { status: 403 }
        )
      );
    }

    const body = await req.json();
    const { exportId, action, rejectionReason } = body;

    if (!exportId || !action || !['approve', 'reject'].includes(action)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Missing required fields: exportId and action (approve/reject)' },
          { status: 400 }
        )
      );
    }

    const approval = pendingApprovals.get(exportId);

    if (!approval) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Export approval not found' },
          { status: 404 }
        )
      );
    }

    if (approval.status !== 'pending') {
      return addSecurityHeaders(
        NextResponse.json(
          { error: `Export already ${approval.status}`, status: approval.status },
          { status: 409 }
        )
      );
    }

    if (!canApprove(context, approval)) {
      logSecurityEvent(
        'security_blocked',
        context,
        { 
          reason: 'User attempted to approve export without proper authorization',
          resourceType: 'export_approval',
          resourceId: exportId,
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Forbidden - cannot approve this export request' },
          { status: 403 }
        )
      );
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      approval.status = 'rejected';
      approval.rejectedAt = now;
      approval.rejectionReason = rejectionReason || 'No reason provided';

      logSensitiveAction(
        context,
        'export_rejected',
        approval.exportType,
        exportId,
        false
      );

      return addSecurityHeaders(
        NextResponse.json({
          status: 'rejected',
          exportId,
          rejectedAt: now,
          rejectionReason: approval.rejectionReason,
          message: 'Export request has been rejected',
        })
      );
    }

    // Approve and generate export
    approval.status = 'approved';
    approval.approverId = context.userId;
    approval.approverRole = context.role;
    approval.approvedAt = now;

    logSensitiveAction(
      context,
      'export_approved',
      approval.exportType,
      exportId,
      false
    );

    let exportData: Record<string, unknown>[] = [];

    switch (approval.exportType) {
      case 'employees': {
        const result = await getEmployeeList(context, {
          status: 'active',
          limit: 1000,
        });
        exportData = result.employees.map(e => ({ ...e } as Record<string, unknown>));
        break;
      }
      default:
        return addSecurityHeaders(
          NextResponse.json(
            { error: `Export type '${approval.exportType}' not implemented` },
            { status: 501 }
          )
        );
    }

    const allowedFields = getAllowedExportFields(context, approval.exportType);
    const filteredData = filterExportFields(
      exportData,
      approval.requestedFields,
      allowedFields,
    );

    logSensitiveAction(
      context,
      'export_completed',
      approval.exportType,
      exportId,
      false
    );

    if (approval.exportFormat === 'csv') {
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
            'Content-Disposition': `attachment; filename="${approval.exportType}_export_${toDateOnlyString()}.csv"`,
            'X-Export-Id': exportId,
            'X-Approved-By': context.userId,
          },
        })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        status: 'approved_and_generated',
        exportId,
        approvedAt: now,
        approvedBy: context.userId,
        type: approval.exportType,
        format: approval.exportFormat,
        recordCount: filteredData.length,
        fields: Object.keys(filteredData[0] || {}),
        data: filteredData,
      })
    );

  } catch (err) {
    if (isSessionResolutionError(err)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status }
        )
      );
    }

    const message = err instanceof Error ? err.message : 'Approval action failed';
    console.error('Export approval error:', err);

    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

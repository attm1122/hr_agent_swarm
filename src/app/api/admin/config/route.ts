/**
 * Admin Configuration API
 * 
 * CRUD operations for platform configuration:
 * - Document requirement rules
 * - Approval routing rules
 * - Communication templates
 * - Policy access rules
 * 
 * SECURITY:
 * - Admin-only access (admin:read/admin:write required)
 * - All changes are audited
 * - Input validation on all mutations
 * - Rate limited
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedSessionContext,
  isSessionResolutionError,
} from '@/lib/auth/session';
import { securityMiddleware, validateRequestBody, addSecurityHeaders } from '@/lib/security';
import { logSecurityEvent } from '@/lib/security';
import { hasCapability } from '@/lib/auth/authorization';
import {
  getDocumentRules,
  createDocumentRule,
  updateDocumentRule,
  deleteDocumentRule,
  getApprovalRules,
  createApprovalRule,
  updateApprovalRule,
  getTemplates,
  createTemplate,
  getPolicyRules,
  createPolicyRule,
  type DocumentRequirementRule,
  type ApprovalRoutingRule,
  type CommunicationTemplate,
  type PolicyAccessRule,
} from '@/lib/admin/config-store';

// ============================================
// GET - List all configuration
// ============================================
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

    // Admin read check
    if (!hasCapability(session.role, 'admin:read')) {
      logSecurityEvent(
        'auth_failure',
        context,
        { reason: 'Non-admin attempted to access config', resourceType: 'admin_config' }
      );
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden - admin access required' }, { status: 403 })
      );
    }

    // Get configuration type from query param
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';

    const result: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    if (type === 'all' || type === 'documents') {
      result.documentRules = getDocumentRules(context);
    }
    if (type === 'all' || type === 'approvals') {
      result.approvalRules = getApprovalRules(context);
    }
    if (type === 'all' || type === 'templates') {
      result.templates = getTemplates(context);
    }
    if (type === 'all' || type === 'policies') {
      result.policyRules = getPolicyRules(context);
    }

    return addSecurityHeaders(NextResponse.json(result));

  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to fetch configuration';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

// ============================================
// POST - Create configuration
// ============================================
export async function POST(req: NextRequest) {
  try {
    const { session, context, securityContext } = await requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 256 * 1024, // 256KB for config
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // Admin write check
    if (!hasCapability(session.role, 'admin:write')) {
      logSecurityEvent(
        'auth_failure',
        context,
        { reason: 'Non-admin attempted to modify config', resourceType: 'admin_config' }
      );
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden - admin write access required' }, { status: 403 })
      );
    }

    // Validate body
    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: bodyValidation.error || 'Invalid request body' },
          { status: 400 }
        )
      );
    }

    const body = bodyValidation.body as {
      type: 'document' | 'approval' | 'template' | 'policy';
      data: Record<string, unknown>;
    };

    if (!body.type || !body.data) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Missing type or data field' },
          { status: 400 }
        )
      );
    }

    // Handle each type separately to avoid union type issues
    const responseData: Record<string, unknown> = { success: true };

    switch (body.type) {
      case 'document': {
        const result = createDocumentRule(context, body.data as Parameters<typeof createDocumentRule>[1]);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.document = result.rule;
        break;
      }
      case 'approval': {
        const result = createApprovalRule(context, body.data as Parameters<typeof createApprovalRule>[1]);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.approval = result.rule;
        break;
      }
      case 'template': {
        const result = createTemplate(context, body.data as Parameters<typeof createTemplate>[1]);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.template = result.template;
        break;
      }
      case 'policy': {
        const result = createPolicyRule(context, body.data as Parameters<typeof createPolicyRule>[1]);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.policy = result.rule;
        break;
      }
      default:
        return addSecurityHeaders(
          NextResponse.json({ error: `Unknown config type: ${body.type}` }, { status: 400 })
        );
    }

    return addSecurityHeaders(
      NextResponse.json(responseData, { status: 201 })
    );

  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to create configuration';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

// ============================================
// PATCH - Update configuration
// ============================================
export async function PATCH(req: NextRequest) {
  try {
    const { session, context, securityContext } = await requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: true,
      maxBodySize: 256 * 1024,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // Admin write check
    if (!hasCapability(session.role, 'admin:write')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    // Validate body
    const bodyValidation = await validateRequestBody(req, securityContext);
    if (!bodyValidation.success) {
      return addSecurityHeaders(
        NextResponse.json({ error: bodyValidation.error }, { status: 400 })
      );
    }

    const body = bodyValidation.body as {
      type: 'document' | 'approval';
      id: string;
      updates: Record<string, unknown>;
    };

    if (!body.type || !body.id || !body.updates) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Missing type, id, or updates' }, { status: 400 })
      );
    }

    const responseData: Record<string, unknown> = { success: true };

    switch (body.type) {
      case 'document': {
        const result = updateDocumentRule(context, body.id, body.updates);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.document = result.rule;
        break;
      }
      case 'approval': {
        const result = updateApprovalRule(context, body.id, body.updates);
        if (!result.success) {
          return addSecurityHeaders(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        responseData.approval = result.rule;
        break;
      }
      default:
        return addSecurityHeaders(
          NextResponse.json({ error: `Update not supported for type: ${body.type}` }, { status: 400 })
        );
    }

    return addSecurityHeaders(
      NextResponse.json(responseData)
    );

  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      );
    }

    const message = error instanceof Error ? error.message : 'Update failed';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

// ============================================
// DELETE - Soft delete configuration
// ============================================
export async function DELETE(req: NextRequest) {
  try {
    const { session, context, securityContext } = await requireVerifiedSessionContext();

    const securityCheck = await securityMiddleware(req, securityContext, {
      rateLimitTier: 'agent',
      requireCsrf: true,
      validateInput: false,
    });

    if (securityCheck) {
      return addSecurityHeaders(securityCheck);
    }

    // Admin write check
    if (!hasCapability(session.role, 'admin:write')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    // Get params from query string
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Missing type or id' }, { status: 400 })
      );
    }

    if (type !== 'document') {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Delete only supported for document rules' }, { status: 400 })
      );
    }

    const result = deleteDocumentRule(context, id);

    if (!result.success) {
      return addSecurityHeaders(
        NextResponse.json({ error: result.error }, { status: 400 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, message: 'Rule deleted' })
    );

  } catch (error) {
    if (isSessionResolutionError(error)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        )
      );
    }

    const message = error instanceof Error ? error.message : 'Delete failed';
    return addSecurityHeaders(
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}

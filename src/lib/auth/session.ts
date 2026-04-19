/**
 * Auth Session - Production Ready
 * Supabase Auth integration with fail-closed security
 *
 * CRITICAL SECURITY PRINCIPLES:
 * - Fail closed: No session = no access
 * - Tenant isolation enforced at auth layer
 * - JWT validation handled by Supabase
 * - No hardcoded fallbacks in production
 */

import type { Role, AgentContext, RecordScope, DataSensitivity } from '@/types';
import {
  ROLE_CAPABILITIES,
  ROLE_SCOPE,
  ROLE_SENSITIVITY,
} from './authorization';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createLogger } from '@/lib/observability/logger';

export interface Session {
  userId: string;
  employeeId: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  permissions: string[];
  scope: RecordScope;
  sensitivityClearance: DataSensitivity[];
  sessionId: string;
}

export type SessionResolutionErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_CONFIG_INVALID'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'SESSION_EXPIRED';

export class SessionResolutionError extends Error {
  readonly code: SessionResolutionErrorCode;
  readonly status: number;

  constructor(code: SessionResolutionErrorCode, message: string, status: number) {
    super(message);
    this.name = 'SessionResolutionError';
    this.code = code;
    this.status = status;
  }
}

const MOCK_AUTH_FIELDS = [
  'MOCK_AUTH_USER_ID',
  'MOCK_AUTH_EMPLOYEE_ID',
  'MOCK_AUTH_NAME',
  'MOCK_AUTH_EMAIL',
  'MOCK_AUTH_ROLE',
  'MOCK_AUTH_TITLE',
] as const;

function isProductionAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRODUCTION_AUTH === 'true';
}

function isMockAuthEnabled(): boolean {
  // Security: If production auth is explicitly enabled, NEVER allow mock auth
  if (process.env.NEXT_PUBLIC_PRODUCTION_AUTH === 'true') {
    return false;
  }
  return process.env.MOCK_AUTH_ENABLED === 'true';
}

const logger = createLogger('auth-session');

function isRole(value: string): value is Role {
  return ['admin', 'manager', 'team_lead', 'employee', 'payroll'].includes(value);
}

/** Build a fully-populated session from user data */
export function buildSession(
  userId: string,
  employeeId: string,
  name: string,
  email: string,
  role: Role,
  title: string,
  tenantId: string,
): Session {
  return {
    userId,
    employeeId,
    tenantId,
    name,
    email,
    role,
    title,
    permissions: ROLE_CAPABILITIES[role],
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
    sessionId: crypto.randomUUID(),
  };
}

function getMockSession(): Session {
  const missingFields = MOCK_AUTH_FIELDS.filter((field) => !process.env[field]);
  if (missingFields.length > 0) {
    throw new SessionResolutionError(
      'AUTH_CONFIG_INVALID',
      `Mock authentication is enabled but missing required variables: ${missingFields.join(', ')}`,
      503,
    );
  }

  const role = process.env.MOCK_AUTH_ROLE!;
  if (!isRole(role)) {
    throw new SessionResolutionError(
      'AUTH_CONFIG_INVALID',
      `Mock authentication role '${role}' is invalid`,
      503,
    );
  }

  return buildSession(
    process.env.MOCK_AUTH_USER_ID!,
    process.env.MOCK_AUTH_EMPLOYEE_ID!,
    process.env.MOCK_AUTH_NAME!,
    process.env.MOCK_AUTH_EMAIL!,
    role,
    process.env.MOCK_AUTH_TITLE!,
    process.env.MOCK_AUTH_TENANT_ID || '00000000-0000-0000-0000-000000000000',
  );
}

/**
 * PRODUCTION: Get session from Supabase Auth (Server-side)
 * Use this in Server Components and API routes
 */
export async function getSession(): Promise<Session | null> {
  const inProduction = process.env.NODE_ENV === 'production';
  const productionAuthEnabled = isProductionAuthEnabled();
  const mockAuthEnabled = isMockAuthEnabled();

  // Security: Prevent mock auth in production
  if (inProduction && mockAuthEnabled) {
    throw new SessionResolutionError(
      'AUTH_CONFIG_INVALID',
      'Mock authentication is forbidden in production',
      503,
    );
  }

  // Development: Allow mock auth if explicitly enabled
  if (!inProduction && mockAuthEnabled && !productionAuthEnabled) {
    return getMockSession();
  }

  // Production or when production auth is explicitly enabled
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Validate user has required metadata
    const metadata = user.user_metadata || {};
    const role = metadata.role;
    
    if (!role || !isRole(role)) {
      logger.error('User missing valid role in metadata:', { userId: user.id });
      return null;
    }

    // Tenant isolation: Must have tenant_id
    const tenantId = metadata.tenant_id;
    if (!tenantId) {
      logger.error('User missing tenant_id in metadata:', { userId: user.id });
      return null;
    }

    return buildSession(
      user.id,
      metadata.employee_id || user.id,
      metadata.name || metadata.full_name || 'Unknown',
      user.email || 'unknown@company.com',
      role,
      metadata.title || 'Employee',
      tenantId,
    );
  } catch (error) {
    logger.error('Session resolution error:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * PRODUCTION: Get session from Supabase Auth (Client-side)
 * Use this in Client Components
 */
export async function getBrowserSession(): Promise<Session | null> {
  const inProduction = process.env.NODE_ENV === 'production';
  const mockAuthEnabled = isMockAuthEnabled();

  // Security: Prevent mock auth in production
  if (inProduction && mockAuthEnabled) {
    throw new SessionResolutionError(
      'AUTH_CONFIG_INVALID',
      'Mock authentication is forbidden in production',
      503,
    );
  }

  // Development: Allow mock auth if explicitly enabled
  if (!inProduction && mockAuthEnabled) {
    return getMockSession();
  }

  try {
    const supabase = createBrowserClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const metadata = user.user_metadata || {};
    const role = metadata.role;
    
    if (!role || !isRole(role)) {
      return null;
    }

    const tenantId = metadata.tenant_id;
    if (!tenantId) {
      return null;
    }

    return buildSession(
      user.id,
      metadata.employee_id || user.id,
      metadata.name || metadata.full_name || 'Unknown',
      user.email || 'unknown@company.com',
      role,
      metadata.title || 'Employee',
      tenantId,
    );
  } catch (error) {
    logger.error('Browser session resolution error:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Require a valid session or throw
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new SessionResolutionError('AUTH_REQUIRED', 'Authentication required', 401);
  }
  return session;
}

export function isSessionResolutionError(error: unknown): error is SessionResolutionError {
  return error instanceof SessionResolutionError;
}

/**
 * Get complete verified session context with security info
 */
export async function requireVerifiedSessionContext(): Promise<{
  session: Session;
  context: AgentContext;
  securityContext: {
    userId: string;
    role: Role;
    sessionId: string;
    tenantId: string;
  };
}> {
  const session = await requireSession();
  return {
    session,
    context: getAgentContext(session),
    securityContext: {
      userId: session.employeeId,
      role: session.role,
      sessionId: session.userId,
      tenantId: session.tenantId,
    },
  };
}

/**
 * Verify authentication is properly configured
 * Call this at application startup
 */
export function verifyAuthConfiguration(): {
  isConfigured: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const inProduction = process.env.NODE_ENV === 'production';
  const productionAuthEnabled = isProductionAuthEnabled();
  const mockAuthEnabled = isMockAuthEnabled();

  if (mockAuthEnabled && inProduction) {
    errors.push('MOCK_AUTH_ENABLED cannot be true in production');
  }

  if (mockAuthEnabled && productionAuthEnabled) {
    errors.push('MOCK_AUTH_ENABLED and NEXT_PUBLIC_PRODUCTION_AUTH cannot both be true');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
  }

  if (inProduction) {
    if (!productionAuthEnabled) {
      errors.push(
        'Production environment detected but NEXT_PUBLIC_PRODUCTION_AUTH is not set to true.'
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is not configured (needed for admin operations)');
    }
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('NEXT_PUBLIC_')) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY appears to have NEXT_PUBLIC_ prefix. ' +
      'Service role key must NEVER be exposed to client.'
    );
  }

  if (mockAuthEnabled) {
    const missingMockFields = MOCK_AUTH_FIELDS.filter((field) => !process.env[field]);
    if (missingMockFields.length > 0) {
      errors.push(
        `Mock authentication is enabled but missing required variables: ${missingMockFields.join(', ')}`
      );
    }

    if (process.env.MOCK_AUTH_ROLE && !isRole(process.env.MOCK_AUTH_ROLE)) {
      errors.push(`MOCK_AUTH_ROLE '${process.env.MOCK_AUTH_ROLE}' is invalid`);
    }
  }

  return {
    isConfigured: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Tenant isolation validation
 * Ensures user can only access their tenant's data
 */
export function validateTenantAccess(
  session: Session,
  requestedTenantId: string
): void {
  if (session.tenantId !== requestedTenantId) {
    throw new SessionResolutionError(
      'TENANT_ISOLATION_VIOLATION',
      'Access denied: tenant isolation violation',
      403
    );
  }
}

/** Build an AgentContext from a verified session */
export function getAgentContext(session: Session): AgentContext {
  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    scope: session.scope,
    sensitivityClearance: session.sensitivityClearance,
    employeeId: session.employeeId,
    permissions: session.permissions,
    sessionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

export function getPermissionsForRole(role: Role): string[] {
  return ROLE_CAPABILITIES[role] || [];
}

export function hasPermission(session: Session, permission: string): boolean {
  return session.permissions.includes(permission);
}

// Re-export authorization utilities for convenience
export { hasCapability, hasAllCapabilities } from './authorization';

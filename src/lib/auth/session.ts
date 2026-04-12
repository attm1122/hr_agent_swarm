/**
 * Auth Session
 * Session resolution fails closed by default.
 * A session exists only when explicit mock auth is configured for
 * non-production use, or when real production auth is implemented.
 *
 * Delegates capability/scope/sensitivity definitions to authorization.ts
 *
 * PRODUCTION MIGRATION:
 * 1. Replace getSession() with Supabase Auth call
 * 2. Keep getAgentContext() bound to a verified session only
 * 3. Remove mock auth env usage before release
 * 4. Enable JWT validation
 *
 * CRITICAL:
 * - There is no hard-coded fallback identity.
 * - Missing or invalid auth configuration must not grant access.
 * - Production auth remains release-blocking until implemented.
 */

import type { Role, AgentContext, RecordScope, DataSensitivity } from '@/types';
import {
  ROLE_CAPABILITIES,
  ROLE_SCOPE,
  ROLE_SENSITIVITY,
} from './authorization';

export interface Session {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  permissions: string[];
  scope: RecordScope;
  sensitivityClearance: DataSensitivity[];
}

export type SessionResolutionErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_CONFIG_INVALID';

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
  return process.env.MOCK_AUTH_ENABLED === 'true';
}

function isRole(value: string): value is Role {
  return ['admin', 'manager', 'team_lead', 'employee', 'payroll'].includes(value);
}

/** Build a fully-populated session for a given role */
export function buildSession(
  userId: string,
  employeeId: string,
  name: string,
  email: string,
  role: Role,
  title: string,
): Session {
  return {
    userId,
    employeeId,
    name,
    email,
    role,
    title,
    permissions: ROLE_CAPABILITIES[role],
    scope: ROLE_SCOPE[role],
    sensitivityClearance: ROLE_SENSITIVITY[role],
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
  );
}

/**
 * Resolve the current session.
 *
 * Behavior:
 * - Production: fail closed until real auth exists
 * - Non-production: only explicit mock auth may create a session
 * - No explicit auth: return null (unauthenticated)
 */
export function getSession(): Session | null {
  const inProduction = process.env.NODE_ENV === 'production';
  const productionAuthEnabled = isProductionAuthEnabled();
  const mockAuthEnabled = isMockAuthEnabled();

  if (inProduction) {
    if (mockAuthEnabled) {
      // Mock auth is forbidden in production - fail closed
      return null;
    }

    // In production, synchronous getSession() returns null.
    // Callers should use getProductionSession() for async Supabase auth.
    // Returning null (instead of throwing) enables graceful "auth required" UI
    // during SSG builds and when auth is not yet configured.
    return null;
  }

  if (productionAuthEnabled) {
    // Production auth enabled outside production - allow for staging/testing
    return null;
  }

  if (!mockAuthEnabled) {
    return null;
  }

  return getMockSession();
}

export function requireSession(): Session {
  const session = getSession();
  if (!session) {
    throw new SessionResolutionError('AUTH_REQUIRED', 'Authentication required', 401);
  }
  return session;
}

export function isSessionResolutionError(error: unknown): error is SessionResolutionError {
  return error instanceof SessionResolutionError;
}

export function requireVerifiedSessionContext(): {
  session: Session;
  context: AgentContext;
  securityContext: {
    userId: string;
    role: Role;
    sessionId: string;
  };
} {
  const session = requireSession();
  return {
    session,
    context: getAgentContext(session),
    securityContext: {
      userId: session.employeeId || 'unknown',
      role: session.role,
      sessionId: session.userId,
    },
  };
}

/**
 * Production authentication - Supabase Auth integration
 * Uses cookie-based session from Supabase SSR
 */
export async function getProductionSession(): Promise<Session | null> {
  try {
    const { createServerClient: createSupabaseSSRClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');

    const cookieStore = await cookies();

    const supabase = createSupabaseSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookies can only be set in Server Actions or Route Handlers
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return mapSupabaseUserToSession(user);
  } catch (error) {
    // Log but don't throw - return null for unauthenticated
    // eslint-disable-next-line no-console
    console.error('[AUTH] Failed to resolve production session:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
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

  if (inProduction) {
    if (!productionAuthEnabled) {
      errors.push(
        'Production environment detected but NEXT_PUBLIC_PRODUCTION_AUTH is not set to true. ' +
        'Requests will fail closed until real authentication is configured.'
      );
    } else {
      errors.push(
        'Production authentication is enabled but not implemented. ' +
        'Configure real authentication before release.'
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is not configured (needed for admin operations)');
    }
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('NEXT_PUBLIC_')) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY appears to have NEXT_PUBLIC_ prefix. ' +
      'Service role key must NEVER be exposed to client. ' +
      'Remove NEXT_PUBLIC_ prefix immediately.'
    );
  }

  if (productionAuthEnabled && !inProduction) {
    warnings.push(
      'NEXT_PUBLIC_PRODUCTION_AUTH is enabled outside production, but real production auth is not implemented.'
    );
  }

  return {
    isConfigured: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Map Supabase user to internal Session type
 * Use this when implementing Supabase Auth
 */
export function mapSupabaseUserToSession(
  supabaseUser: {
    id: string;
    email?: string;
    user_metadata?: {
      employee_id?: string;
      name?: string;
      role?: Role;
      title?: string;
    };
  }
): Session {
  const role = supabaseUser.user_metadata?.role || 'employee';

  return buildSession(
    supabaseUser.id,
    supabaseUser.user_metadata?.employee_id || supabaseUser.id,
    supabaseUser.user_metadata?.name || 'Unknown',
    supabaseUser.email || 'unknown@company.com',
    role,
    supabaseUser.user_metadata?.title || 'Employee'
  );
}

/** Build an AgentContext from a verified session */
export function getAgentContext(session: Session): AgentContext {
  return {
    userId: session.userId,
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

/**
 * Auth Session
 * POC: returns a mock session. Production replaces with Supabase Auth / SSO.
 * Single source of truth for "who is the current user and what can they do."
 *
 * Delegates capability/scope/sensitivity definitions to authorization.ts
 * 
 * PRODUCTION MIGRATION:
 * 1. Replace getSession() with Supabase Auth call
 * 2. Replace getAgentContext() to use real session
 * 3. Remove mock session fallback
 * 4. Enable JWT validation
 * 
 * CRITICAL: The mock session below grants ADMIN access to ALL users.
 * This must be replaced before production deployment.
 */

import type { Role, AgentContext, RecordScope, DataSensitivity } from '@/types';
import {
  ROLE_CAPABILITIES,
  ROLE_SCOPE,
  ROLE_SENSITIVITY,
} from './authorization';

// PRODUCTION WARNING: Set to true when migrating to real auth
const IS_PRODUCTION_AUTH_ENABLED = process.env.NEXT_PUBLIC_PRODUCTION_AUTH === 'true';

// Production safety check
if (process.env.NODE_ENV === 'production' && !IS_PRODUCTION_AUTH_ENABLED) {
  console.error(
    '[CRITICAL SECURITY WARNING] ' +
    'Running in production with MOCK AUTHENTICATION. ' +
    'All users have ADMIN access. ' +
    'Set NEXT_PUBLIC_PRODUCTION_AUTH=true after configuring Supabase Auth. ' +
    'See MIGRATION_GUIDE.md for instructions.'
  );
}

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

/**
 * Mock session — always returns Sarah Chen (Admin) for the POC
 * 
 * PRODUCTION: Replace with Supabase Auth
 * Example:
 *   import { createServerClient } from '@supabase/ssr';
 *   const supabase = createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   return mapUserToSession(user);
 */
export function getSession(): Session {
  // PRODUCTION GUARD: Warn about mock auth
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[SECURITY] Using mock authentication. ' +
      'All requests are treated as ADMIN. ' +
      'This is a CRITICAL security issue in production.'
    );
  }
  
  return buildSession(
    'user-001', 'emp-001',
    'Sarah Chen', 'sarah.chen@company.com',
    'admin', 'Chief People Officer',
  );
}

/**
 * Production authentication - Supabase Auth integration
 * Replace getSession() with this function for production
 */
export async function getProductionSession(): Promise<Session | null> {
  // This is a placeholder for Supabase Auth integration
  // Implementation steps:
  // 1. Install @supabase/ssr: npm install @supabase/ssr
  // 2. Configure cookie handling
  // 3. Map Supabase user to Session type
  // 4. Handle JWT refresh
  
  throw new Error(
    'Production authentication not implemented. ' +
    'Configure Supabase Auth before enabling production mode. ' +
    'See MIGRATION_GUIDE.md'
  );
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
  
  // Check environment
  if (process.env.NODE_ENV === 'production') {
    if (!IS_PRODUCTION_AUTH_ENABLED) {
      errors.push(
        'Production environment detected but NEXT_PUBLIC_PRODUCTION_AUTH is not set to true. ' +
        'Currently using MOCK AUTHENTICATION which grants ADMIN to ALL users.'
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
  
  // Check for common misconfigurations
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('NEXT_PUBLIC_')) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY appears to have NEXT_PUBLIC_ prefix. ' +
      'Service role key must NEVER be exposed to client. ' +
      'Remove NEXT_PUBLIC_ prefix immediately.'
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

/** Build an AgentContext from the current session */
export function getAgentContext(session?: Session): AgentContext {
  const s = session || getSession();
  return {
    userId: s.userId,
    role: s.role,
    scope: s.scope,
    sensitivityClearance: s.sensitivityClearance,
    employeeId: s.employeeId,
    permissions: s.permissions,
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

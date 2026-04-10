/**
 * Security Middleware
 * Combined security controls for API routes:
 * - Rate limiting
 * - CSRF protection
 * - Input validation
 * - Security headers
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Role, AgentContext } from '@/types';
import { checkRateLimit, generateRateLimitKey } from './rate-limit';
import { validateCsrfToken, extractCsrfToken, requiresCsrfProtection } from './csrf';
import { sanitizeObject, containsXss, containsSqlInjection } from './sanitize';
import { logSecurityEvent } from './audit-logger';

// Minimal context for security logging
interface SecurityContext {
  userId: string;
  role: Role | string;
  sessionId: string;
  scope?: string;
  sensitivityClearance?: string[];
  permissions?: string[];
  timestamp?: string;
}

interface SecurityConfig {
  rateLimitTier?: 'auth' | 'agent' | 'communication' | 'report' | 'file' | 'search';
  requireCsrf?: boolean;
  validateInput?: boolean;
  maxBodySize?: number;
}

const DEFAULT_CONFIG: SecurityConfig = {
  rateLimitTier: 'agent',
  requireCsrf: true,
  validateInput: true,
  maxBodySize: 1024 * 1024, // 1MB
};

/**
 * Security middleware for API routes
 * Returns null if request passes all checks, or a Response if blocked
 */
export async function securityMiddleware(
  request: NextRequest,
  userContext: { userId: string; role: Role; sessionId: string },
  config: SecurityConfig = {}
): Promise<NextResponse | null> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const clientIp = getClientIp(request);
  
  // 1. Rate Limiting
  if (mergedConfig.rateLimitTier) {
    const rateLimitKey = generateRateLimitKey(userContext.userId, clientIp, userContext.sessionId);
    const rateLimit = checkRateLimit(rateLimitKey, mergedConfig.rateLimitTier, userContext.role);
    
    if (!rateLimit.allowed) {
      logSecurityEvent(
        'rate_limit_hit',
        userContext as unknown as AgentContext,
        { reason: `Rate limit exceeded for ${mergedConfig.rateLimitTier}`, ipAddress: clientIp }
      );
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          },
        }
      );
    }
  }
  
  // 2. CSRF Protection (for state-changing methods)
  if (mergedConfig.requireCsrf && requiresCsrfProtection(request.method)) {
    const csrfToken = extractCsrfToken(request.headers);
    
    if (!csrfToken || !validateCsrfToken(csrfToken, userContext.sessionId)) {
      logSecurityEvent(
        'csrf_violation',
        userContext as unknown as AgentContext,
        { reason: csrfToken ? 'Invalid CSRF token' : 'Missing CSRF token', ipAddress: clientIp }
      );
      
      return new NextResponse(
        JSON.stringify({
          error: 'CSRF token missing or invalid',
          code: 'CSRF_VIOLATION',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
  
  // 3. Body Size Limit
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > mergedConfig.maxBodySize!) {
    return new NextResponse(
      JSON.stringify({
        error: 'Request body too large',
        maxSize: mergedConfig.maxBodySize,
      }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  // All checks passed
  return null;
}

/**
 * Validate and sanitize request body
 */
export async function validateRequestBody(
  request: NextRequest,
  userContext: { userId: string; role: string; sessionId: string }
): Promise<{ success: boolean; body?: Record<string, unknown>; error?: string }> {
  try {
    const body = await request.json() as Record<string, unknown>;
    
    // Check for XSS patterns
    const bodyString = JSON.stringify(body);
    if (containsXss(bodyString)) {
      logSecurityEvent(
        'security_blocked',
        userContext as unknown as AgentContext,
        { reason: 'XSS pattern detected in request body', ipAddress: getClientIp(request) }
      );
      return { success: false, error: 'Invalid content in request body' };
    }
    
    // Check for SQL injection patterns
    if (containsSqlInjection(bodyString)) {
      logSecurityEvent(
        'security_blocked',
        userContext as unknown as AgentContext,
        { reason: 'SQL injection pattern detected', ipAddress: getClientIp(request) }
      );
      return { success: false, error: 'Invalid content in request body' };
    }
    
    // Sanitize the body
    const sanitized = sanitizeObject(body);
    
    return { success: true, body: sanitized };
  } catch (error) {
    return { success: false, error: 'Invalid JSON in request body' };
  }
}

/**
 * Extract client IP from request
 */
function getClientIp(request: NextRequest): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback - Next.js doesn't expose IP directly in all versions
  return 'unknown';
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );
  
  // Content Security Policy (strict for API responses)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';"
  );
  
  return response;
}

/**
 * Create standardized security error response
 */
export function createSecurityErrorResponse(
  message: string,
  code: string,
  status: number = 400
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: message,
      code,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders(),
      },
    }
  );
}

/**
 * Get security headers object (for spread usage)
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

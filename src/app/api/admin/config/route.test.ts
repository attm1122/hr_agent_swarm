import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireVerifiedSessionContext = vi.fn();
const mockSecurityMiddleware = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireVerifiedSessionContext: () => mockRequireVerifiedSessionContext(),
  isSessionResolutionError: (error: unknown) =>
    Boolean(error) &&
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'status' in error &&
    'message' in error,
}));

vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security')>('@/lib/security');
  return {
    ...actual,
    securityMiddleware: (...args: unknown[]) => mockSecurityMiddleware(...args),
    validateRequestBody: vi.fn(),
    addSecurityHeaders: (response: Response) => response,
    logSecurityEvent: vi.fn(),
  };
});

vi.mock('@/lib/admin/config-store', () => ({
  getDocumentRules: vi.fn(),
  createDocumentRule: vi.fn(),
  updateDocumentRule: vi.fn(),
  deleteDocumentRule: vi.fn(),
  getApprovalRules: vi.fn(),
  createApprovalRule: vi.fn(),
  updateApprovalRule: vi.fn(),
  getTemplates: vi.fn(),
  createTemplate: vi.fn(),
  getPolicyRules: vi.fn(),
  createPolicyRule: vi.fn(),
}));

import { GET } from './route';

describe('/api/admin/config auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 when no verified session exists and never reaches config logic', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw { code: 'AUTH_REQUIRED', status: 401, message: 'Authentication required' };
    });

    const request = new NextRequest('http://localhost/api/admin/config', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    expect(mockSecurityMiddleware).not.toHaveBeenCalled();
  });

  it('GET returns 503 when auth configuration is invalid and never exposes config state', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw {
        code: 'AUTH_CONFIG_INVALID',
        status: 503,
        message: 'Production authentication is not configured; requests must fail closed until real auth is enabled',
      };
    });

    const request = new NextRequest('http://localhost/api/admin/config?type=all', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTH_CONFIG_INVALID',
    });
    expect(mockSecurityMiddleware).not.toHaveBeenCalled();
  });
});

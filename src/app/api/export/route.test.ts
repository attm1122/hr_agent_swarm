import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireVerifiedSessionContext = vi.fn();
const mockSecurityMiddleware = vi.fn();
const mockValidateRequestBody = vi.fn();
const mockGetEmployeeList = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireVerifiedSessionContext: () => mockRequireVerifiedSessionContext(),
  isSessionResolutionError: (error: unknown) =>
    Boolean(error) &&
    typeof error === 'object' &&
    'code' in error &&
    'status' in error &&
    'message' in error,
}));

vi.mock('@/lib/security', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security')>('@/lib/security');
  return {
    ...actual,
    securityMiddleware: (...args: unknown[]) => mockSecurityMiddleware(...args),
    validateRequestBody: (...args: unknown[]) => mockValidateRequestBody(...args),
    addSecurityHeaders: (response: Response) => response,
    logSecurityEvent: vi.fn(),
    logSensitiveAction: vi.fn(),
  };
});

vi.mock('@/lib/services/employee.service', () => ({
  getEmployeeList: (...args: unknown[]) => mockGetEmployeeList(...args),
}));

vi.mock('@/lib/agents', () => ({
  getCoordinator: vi.fn(),
}));

import { GET, POST } from './route';

describe('/api/export auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when no verified session exists and never reaches export logic', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw { code: 'AUTH_REQUIRED', status: 401, message: 'Authentication required' };
    });

    const request = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ type: 'employees', format: 'json' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    expect(mockSecurityMiddleware).not.toHaveBeenCalled();
    expect(mockValidateRequestBody).not.toHaveBeenCalled();
    expect(mockGetEmployeeList).not.toHaveBeenCalled();
  });

  it('GET returns 503 on auth misconfiguration and never discloses approval state', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw {
        code: 'AUTH_CONFIG_INVALID',
        status: 503,
        message: 'Mock authentication is forbidden in production',
      };
    });

    const request = new NextRequest('http://localhost/api/export?exportId=test-export', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTH_CONFIG_INVALID',
    });
    expect(mockSecurityMiddleware).not.toHaveBeenCalled();
    expect(mockGetEmployeeList).not.toHaveBeenCalled();
  });
});

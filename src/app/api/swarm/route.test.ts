import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireVerifiedSessionContext = vi.fn();
const mockSecurityMiddleware = vi.fn();
const mockValidateRequestBody = vi.fn();
const mockCoordinatorRoute = vi.fn();

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
  };
});

vi.mock('@/lib/agents', () => ({
  getCoordinator: () => ({
    route: (...args: unknown[]) => mockCoordinatorRoute(...args),
    getAuditLog: vi.fn(() => []),
  }),
}));

import { GET, POST } from './route';

describe('/api/swarm auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when no verified session exists and never reaches middleware or coordinator', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw { code: 'AUTH_REQUIRED', status: 401, message: 'Authentication required' };
    });

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'POST',
      body: JSON.stringify({ intent: 'employee_search' }),
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
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });

  it('GET returns 503 on auth misconfiguration and never exposes audit data', async () => {
    mockRequireVerifiedSessionContext.mockImplementation(() => {
      throw {
        code: 'AUTH_CONFIG_INVALID',
        status: 503,
        message: 'Production authentication is not configured; requests must fail closed until real auth is enabled',
      };
    });

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTH_CONFIG_INVALID',
    });
    expect(mockSecurityMiddleware).not.toHaveBeenCalled();
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });
});

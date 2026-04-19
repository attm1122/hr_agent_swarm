import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireSession = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireSession: () => mockRequireSession(),
  hasCapability: () => true,
  isSessionResolutionError: (error: unknown) =>
    error instanceof Error && error.name === 'SessionResolutionError',
}));

import { GET, POST } from './route';

describe('/api/export auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when no verified session exists and never reaches export logic', async () => {
    mockRequireSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ format: 'json', fields: ['id', 'firstName'] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  });

  it('GET returns 500 on auth misconfiguration and never discloses approval state', async () => {
    mockRequireSession.mockRejectedValue(
      new Error('Mock authentication is forbidden in production')
    );

    const request = new NextRequest('http://localhost/api/export?exportId=test-export', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: expect.stringMatching(/^AUTH_|INTERNAL_ERROR$/),
      },
    });
  });
});

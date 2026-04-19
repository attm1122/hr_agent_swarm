import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireSession = vi.fn();
const mockCoordinatorRoute = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireSession: () => mockRequireSession(),
  isSessionResolutionError: (error: unknown) =>
    error instanceof Error && error.name === 'SessionResolutionError',
}));

vi.mock('@/lib/agents/factory', () => ({
  createCoordinator: () => ({
    route: (...args: unknown[]) => mockCoordinatorRoute(...args),
    getAuditLog: vi.fn(() => []),
  }),
}));

import { POST } from './route';

describe('/api/swarm auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when no verified session exists and never reaches coordinator', async () => {
    mockRequireSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'POST',
      body: JSON.stringify({ intent: 'employee_search' }),
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
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });

  it('POST returns 500 on auth misconfiguration and never exposes audit data', async () => {
    mockRequireSession.mockRejectedValue(
      new Error('Mock authentication is forbidden in production')
    );

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'POST',
      body: JSON.stringify({ intent: 'employee_search' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: expect.stringMatching(/^AUTH_|INTERNAL_ERROR$/),
      },
    });
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });
});

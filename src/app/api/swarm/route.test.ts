import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireSession = vi.fn();
const mockCoordinatorRoute = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireSession: () => mockRequireSession(),
  hasCapability: vi.fn(() => true),
}));

vi.mock('@/lib/agents/coordinator', () => ({
  getCoordinator: () => ({
    route: (...args: unknown[]) => mockCoordinatorRoute(...args),
    getAuditLog: vi.fn(() => []),
  }),
}));

vi.mock('@/lib/infrastructure/redis/redis-cache-adapter', () => ({
  createCacheAdapter: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    increment: vi.fn(),
    expire: vi.fn(),
    rateLimitCheck: vi.fn(() => ({ allowed: true, remaining: 99, resetTime: Date.now() + 60000 })),
  }),
}));

vi.mock('@/lib/security/rate-limit-redis', () => {
  return {
    RedisRateLimiter: class {
      check = vi.fn().mockResolvedValue({ allowed: true, remaining: 99, limit: 100, resetTime: Date.now() + 60000 });
    },
    RATE_LIMITS: { swarm: { maxRequests: 100, windowMs: 60000 } },
  };
});

vi.mock('@/lib/validation/idempotency', () => {
  return {
    IdempotencyStore: class {
      check = vi.fn().mockResolvedValue({ exists: false });
      complete = vi.fn();
    },
  };
});

import { POST } from './route';

describe('/api/swarm auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when requireSession returns null and never reaches coordinator', async () => {
    // requireSession returns null => route returns 401
    mockRequireSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'POST',
      body: JSON.stringify({ intent: 'employee_search' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });

  it('POST returns 500 when requireSession throws and never reaches coordinator', async () => {
    // requireSession throws => generic catch => 500
    mockRequireSession.mockRejectedValue(new Error('Auth service unavailable'));

    const request = new NextRequest('http://localhost/api/swarm', {
      method: 'POST',
      body: JSON.stringify({ intent: 'employee_search' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockCoordinatorRoute).not.toHaveBeenCalled();
  });
});

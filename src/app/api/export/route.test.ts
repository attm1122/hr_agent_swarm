import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireSession = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requireSession: () => mockRequireSession(),
  hasCapability: vi.fn(() => true),
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
    RATE_LIMITS: { export: { maxRequests: 50, windowMs: 60000 } },
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

vi.mock('@/lib/repositories/supabase-factory', () => ({
  createSupabaseRepositoryFactory: () => ({
    employee: () => ({
      findAll: vi.fn().mockResolvedValue([]),
    }),
    agentRun: () => ({}),
  }),
}));

import { GET, POST } from './route';

describe('/api/export auth hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST returns 401 when requireSession returns null and never reaches export logic', async () => {
    mockRequireSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ type: 'employees', format: 'json', fields: ['id', 'firstName'] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('GET returns 401 when requireSession returns null', async () => {
    mockRequireSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/export?exportId=test-export', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('POST returns 500 when requireSession throws', async () => {
    mockRequireSession.mockRejectedValue(new Error('Auth service unavailable'));

    const request = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ type: 'employees', format: 'json', fields: ['id'] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('GET returns 500 when requireSession throws', async () => {
    mockRequireSession.mockRejectedValue(new Error('Auth service unavailable'));

    const request = new NextRequest('http://localhost/api/export', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

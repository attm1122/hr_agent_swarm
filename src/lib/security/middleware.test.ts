/**
 * Global Proxy (Security Middleware) Tests
 *
 * Tests the Edge proxy that runs on every request,
 * covering attack-probe blocking, global rate limiting,
 * security headers, and body-size guards.
 */

import { describe, it, expect } from 'vitest';
import { proxy } from '@/proxy';
import { NextRequest } from 'next/server';

function makeRequest(
  path: string,
  opts?: { method?: string; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, {
    method: opts?.method || 'GET',
    headers: opts?.headers,
  });
}

// ============================================
// Attack Probe Detection
// ============================================

describe('Global Proxy: Attack Probe Detection', () => {
  it('blocks path traversal in URL', async () => {
    const res = await proxy(makeRequest('/api/files/../../etc/passwd'));
    expect(res.status).toBe(400);
  });

  it('blocks script tags in URL', async () => {
    const res = await proxy(makeRequest('/search?q=<script>alert(1)</script>'));
    expect(res.status).toBe(400);
  });

  it('blocks SQL injection in URL', async () => {
    const res = await proxy(makeRequest("/api/users?id=' UNION SELECT * FROM passwords"));
    expect(res.status).toBe(400);
  });

  it('blocks null bytes in URL', async () => {
    const res = await proxy(makeRequest('/api/files/test%00.php'));
    expect(res.status).toBe(400);
  });

  it('blocks WordPress scanner probes', async () => {
    const res = await proxy(makeRequest('/wp-admin/install.php'));
    expect(res.status).toBe(400);
  });

  it('blocks .env file probes', async () => {
    const res = await proxy(makeRequest('/.env'));
    expect(res.status).toBe(400);
  });

  it('blocks /etc/passwd LFI probes', async () => {
    const res = await proxy(makeRequest('/api/read?file=/etc/passwd'));
    expect(res.status).toBe(400);
  });

  it('allows normal paths through', async () => {
    const res = await proxy(makeRequest('/api/chat'));
    expect(res.status).toBe(200);
  });

  it('allows dashboard paths through', async () => {
    const res = await proxy(makeRequest('/hr'));
    expect(res.status).toBe(200);
  });
});

// ============================================
// Security Headers
// ============================================

describe('Global Proxy: Security Headers', () => {
  it('adds X-Request-ID to all responses', async () => {
    const res = await proxy(makeRequest('/dashboard'));
    expect(res.headers.get('X-Request-ID')).toBeDefined();
    expect(res.headers.get('X-Request-ID')!.length).toBeGreaterThan(0);
  });

  it('adds X-Content-Type-Options', async () => {
    const res = await proxy(makeRequest('/api/test'));
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('adds X-Frame-Options', async () => {
    const res = await proxy(makeRequest('/api/test'));
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('adds Referrer-Policy', async () => {
    const res = await proxy(makeRequest('/api/test'));
    expect(res.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('adds Permissions-Policy', async () => {
    const res = await proxy(makeRequest('/api/test'));
    const pp = res.headers.get('Permissions-Policy');
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
  });
});

// ============================================
// Bypass paths
// ============================================

describe('Global Proxy: Bypass Paths', () => {
  it('bypasses _next/ static assets', async () => {
    const res = await proxy(makeRequest('/_next/static/chunk.js'));
    expect(res.headers.get('X-Request-ID')).toBeDefined();
    expect(res.status).toBe(200);
  });

  it('bypasses health endpoint', async () => {
    const res = await proxy(makeRequest('/api/health'));
    expect(res.status).toBe(200);
  });
});

// ============================================
// Body Size
// ============================================

describe('Global Proxy: Body Size Guard', () => {
  it('rejects API requests with Content-Length > 5MB', async () => {
    const res = await proxy(
      makeRequest('/api/upload', {
        method: 'POST',
        headers: { 'content-length': String(6 * 1024 * 1024) },
      }),
    );
    expect(res.status).toBe(413);
  });

  it('allows API requests within size limit', async () => {
    const res = await proxy(
      makeRequest('/api/upload', {
        method: 'POST',
        headers: { 'content-length': '1024' },
      }),
    );
    expect(res.status).toBe(200);
  });
});

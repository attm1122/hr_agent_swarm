/**
 * Testing Utilities
 * 
 * Shared utilities for testing React components and API routes.
 */

import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock session context for components
export const mockSession = {
  userId: 'user-001',
  role: 'manager' as const,
  permissions: ['employee:read', 'leave:read', 'export:request'],
  sessionId: 'session-001',
  employeeId: 'emp-001',
  tenantId: 'tenant-001',
};

// Mock agent context
export const mockAgentContext = {
  userId: 'user-001',
  role: 'manager' as const,
  scope: 'team' as const,
  sensitivityClearance: ['self_visible', 'team_visible'],
  employeeId: 'emp-001',
  managerId: 'mgr-001',
  teamId: 'team-001',
  permissions: ['employee:read', 'leave:read'],
  sessionId: 'session-001',
  timestamp: new Date().toISOString(),
};

// Custom render with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: typeof mockSession;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { session = mockSession, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    // In a real implementation, you'd wrap with your app providers
    return <>{children}</>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock fetch for API tests
export function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
    headers: new Headers(),
  });
}

// Create mock Supabase client
export function createMockSupabaseClient() {
  const mockData: Record<string, unknown[]> = {};

  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: mockData[table]?.[0] || null,
            error: null,
          }),
          limit: async (n: number) => ({
            data: (mockData[table] || []).slice(0, n),
            error: null,
          }),
        }),
        limit: async (n: number) => ({
          data: (mockData[table] || []).slice(0, n),
          error: null,
        }),
      }),
      insert: async (data: unknown) => {
        if (!mockData[table]) mockData[table] = [];
        mockData[table].push(data as Record<string, unknown>);
        return { data, error: null };
      },
      update: async (data: unknown) => ({
        data,
        error: null,
      }),
      delete: async () => ({ data: null, error: null }),
    }),
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-001' } } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    // Store for test inspection
    _mockData: mockData,
  };
}

// Wait for async operations in tests
export function waitForMs(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create mock NextRequest
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Request {
  const { method = 'GET', body, headers = {} } = options;

  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Generate test IDs consistently
export function generateTestId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

// Deep clone for test data
export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Mock date for consistent testing
export function mockDate(isoDate: string) {
  const date = new Date(isoDate);
  vi.setSystemTime(date);
  return date;
}

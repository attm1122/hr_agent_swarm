import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock supabase before importing client
const mockCreateClient = vi.fn(() => ({
  from: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
  SupabaseClient: vi.fn(),
}));

describe('database client', () => {
  beforeAll(() => {
    // Mock window as undefined (server environment) for admin client tests
    vi.stubGlobal('window', undefined);
    // Mock required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
  });

  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
    // Re-stub window after module reset
    vi.stubGlobal('window', undefined);
  });

  it('createBrowserClient returns a supabase client', async () => {
    const { createBrowserClient } = await import('./client');
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it('createBrowserClient returns singleton on second call', async () => {
    const { createBrowserClient } = await import('./client');
    const client1 = createBrowserClient();
    const client2 = createBrowserClient();
    expect(client1).toBe(client2);
    // Only called once because of singleton
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('createAdminClient returns a new client each time', async () => {
    const { createAdminClient } = await import('./client');
    const client1 = createAdminClient();
    const client2 = createAdminClient();
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    // Each call creates a new client
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  it('createServerClient returns a supabase client', async () => {
    const { createServerClient } = await import('./client');
    const client = createServerClient();
    expect(client).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it('createServerClient creates a new client each time', async () => {
    const { createServerClient } = await import('./client');
    createServerClient();
    createServerClient();
    // Server client is not a singleton
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  it('clients are called with environment variables', async () => {
    const { createServerClient } = await import('./client');
    createServerClient();
    // Called with url and key (which are empty strings in test env)
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String)
    );
  });
});

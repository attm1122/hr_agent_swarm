/**
 * Microsoft Graph API client.
 *
 * Uses the Azure AD client-credentials flow (application permissions) so the
 * backend can read directory, mail, and files without a signed-in user. This
 * is the correct flow for background jobs: employee sync, notifications,
 * SharePoint/OneDrive document listings.
 *
 * Required environment variables (server-side):
 *   AZURE_TENANT_ID          LEAP's Azure AD tenant (GUID)
 *   AZURE_CLIENT_ID          App registration client ID
 *   AZURE_CLIENT_SECRET      App registration client secret
 *
 * Required application permissions (admin-consented in Azure portal):
 *   User.Read.All            List users / directory sync
 *   Group.Read.All           Team structure via Groups
 *   Directory.Read.All       Manager / org chart
 *   Mail.Send                Send notifications from a shared mailbox
 *   Files.Read.All           OneDrive/SharePoint files
 *   Sites.Read.All           SharePoint lists & libraries
 *
 * This module deliberately avoids adding `@azure/msal-node` as a dependency —
 * the client-credentials flow is a single HTTP POST. If we later need
 * delegated (per-user) tokens, revisit.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_ENDPOINT = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let cachedToken: TokenCache | null = null;

export class GraphNotConfiguredError extends Error {
  constructor() {
    super(
      'Microsoft Graph is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.',
    );
    this.name = 'GraphNotConfiguredError';
  }
}

export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

export function isGraphConfigured(): boolean {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET,
  );
}

/**
 * Acquires an application-only access token via client-credentials grant.
 * Caches the token in-process until 60s before expiry.
 *
 * NOTE: In a multi-instance deployment this will acquire a token per instance
 * — that's fine (the token endpoint is not rate limited heavily and tokens
 * are bearer-valid for ~60 minutes). For a shared token cache, move to Redis.
 */
export async function getGraphAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new GraphNotConfiguredError();
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(TOKEN_ENDPOINT(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new GraphApiError(
      `Failed to acquire Graph access token: ${response.status}`,
      response.status,
      text,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

/** For tests: clear the in-process token cache. */
export function __clearGraphTokenCache(): void {
  cachedToken = null;
}

export interface GraphFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * If true, returns the raw Response (do not parse JSON). Useful for binary
   * downloads (e.g. $value endpoint).
   */
  raw?: boolean;
}

/**
 * Low-level Graph API call. Path is relative to https://graph.microsoft.com/v1.0.
 * Caller is responsible for throttling; we don't retry 429s automatically here
 * — add a backoff wrapper in each caller that needs it.
 */
export async function graphFetch<T = unknown>(
  path: string,
  options: GraphFetchOptions = {},
): Promise<T> {
  const token = await getGraphAccessToken();
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (options.raw) {
    return response as unknown as T;
  }

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new GraphApiError(
      `Graph API ${options.method ?? 'GET'} ${path} failed: ${response.status}`,
      response.status,
      errorBody,
    );
  }

  // 204 No Content
  if (response.status === 204) return undefined as unknown as T;

  return (await response.json()) as T;
}

/**
 * Follows Graph's @odata.nextLink pagination and yields every page of values.
 */
export async function* graphPaginate<T>(
  path: string,
  options: GraphFetchOptions = {},
): AsyncIterableIterator<T> {
  let nextPath: string | null = path;
  while (nextPath) {
    const page = (await graphFetch<{ value: T[]; '@odata.nextLink'?: string }>(
      nextPath,
      options,
    )) as { value: T[]; '@odata.nextLink'?: string };
    for (const item of page.value) {
      yield item;
    }
    nextPath = page['@odata.nextLink'] ?? null;
    // Reset options.body on subsequent pages (nextLink already encodes filters)
    options = { method: options.method ?? 'GET' };
  }
}

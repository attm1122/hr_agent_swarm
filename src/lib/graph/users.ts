/**
 * Microsoft Graph — Users and Directory.
 *
 * Reads LEAP's employee directory from Azure AD / Entra ID. Used by the
 * sync pipeline to populate the `employees` table in Supabase.
 *
 * Requires application permissions: User.Read.All, Directory.Read.All.
 */

import { graphFetch, graphPaginate } from './client';

/** Shape returned by Graph `/users` with standard columns we care about. */
export interface GraphUser {
  id: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  employeeId: string | null;
  employeeHireDate: string | null; // ISO 8601
  employeeType: string | null;
  accountEnabled: boolean;
  companyName: string | null;
  usageLocation: string | null;
  businessPhones: string[];
  mobilePhone: string | null;
}

const SELECT_FIELDS = [
  'id',
  'userPrincipalName',
  'mail',
  'displayName',
  'givenName',
  'surname',
  'jobTitle',
  'department',
  'officeLocation',
  'employeeId',
  'employeeHireDate',
  'employeeType',
  'accountEnabled',
  'companyName',
  'usageLocation',
  'businessPhones',
  'mobilePhone',
].join(',');

/**
 * Lists all users in the tenant. Server-side paginated; yields one user at a
 * time so callers can stream-process large tenants without buffering.
 *
 * Filters to a single UPN domain if provided (e.g. `leap.com.au`), otherwise
 * returns every user in the tenant.
 */
export async function* listAllUsers(options: {
  upnDomain?: string;
  onlyEnabled?: boolean;
  pageSize?: number;
} = {}): AsyncIterableIterator<GraphUser> {
  const params = new URLSearchParams();
  params.set('$select', SELECT_FIELDS);
  params.set('$top', String(options.pageSize ?? 100));

  const filters: string[] = [];
  if (options.upnDomain) {
    filters.push(`endsWith(userPrincipalName, '@${options.upnDomain}')`);
  }
  if (options.onlyEnabled) {
    filters.push('accountEnabled eq true');
  }
  if (filters.length > 0) {
    params.set('$filter', filters.join(' and '));
    // $filter with endsWith requires advanced query
    params.set('$count', 'true');
  }

  const path = `/users?${params.toString()}`;
  const headers = filters.some((f) => f.includes('endsWith'))
    ? { ConsistencyLevel: 'eventual' }
    : undefined;

  yield* graphPaginate<GraphUser>(path, { headers });
}

/**
 * Fetches a single user by id or userPrincipalName.
 */
export async function getUser(idOrUpn: string): Promise<GraphUser | null> {
  try {
    return await graphFetch<GraphUser>(
      `/users/${encodeURIComponent(idOrUpn)}?$select=${SELECT_FIELDS}`,
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetches the manager of a given user, if any. Graph returns 404 if no manager
 * is set — we translate that to `null`.
 */
export async function getManager(userId: string): Promise<GraphUser | null> {
  try {
    return await graphFetch<GraphUser>(
      `/users/${encodeURIComponent(userId)}/manager?$select=${SELECT_FIELDS}`,
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Lists direct reports. Returns empty array if user has none.
 */
export async function getDirectReports(userId: string): Promise<GraphUser[]> {
  const response = await graphFetch<{ value: GraphUser[] }>(
    `/users/${encodeURIComponent(userId)}/directReports?$select=${SELECT_FIELDS}`,
  );
  return response.value ?? [];
}

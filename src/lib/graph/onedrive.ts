/**
 * Microsoft Graph — OneDrive / SharePoint files.
 *
 * Used by the Document Compliance agent to list and download employee
 * documents stored in OneDrive for Business or SharePoint document libraries.
 *
 * Requires application permissions: Files.Read.All, Sites.Read.All.
 */

import { graphFetch, graphPaginate } from './client';

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: {
    driveId: string;
    path?: string;
  };
}

/**
 * Lists items in a user's OneDrive root (or a specific folder path).
 * `path` is optional and uses OneDrive path syntax, e.g. '/HR/Contracts'.
 */
export async function* listUserDriveItems(
  userId: string,
  path?: string,
): AsyncIterableIterator<DriveItem> {
  const segment = path
    ? `/users/${encodeURIComponent(userId)}/drive/root:${path}:/children`
    : `/users/${encodeURIComponent(userId)}/drive/root/children`;
  yield* graphPaginate<DriveItem>(segment);
}

/**
 * Lists items in a SharePoint document library (drive) by drive id.
 */
export async function* listDriveItems(driveId: string): AsyncIterableIterator<DriveItem> {
  yield* graphPaginate<DriveItem>(
    `/drives/${encodeURIComponent(driveId)}/root/children`,
  );
}

/**
 * Downloads the raw content of a drive item. Returns a Response so the caller
 * can stream, pipe to Supabase Storage, or buffer as needed.
 */
export async function downloadDriveItem(
  driveId: string,
  itemId: string,
): Promise<Response> {
  return graphFetch<Response>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    { raw: true },
  );
}

/**
 * Returns the metadata for a single drive item.
 */
export async function getDriveItem(
  driveId: string,
  itemId: string,
): Promise<DriveItem> {
  return graphFetch<DriveItem>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
  );
}

/**
 * Searches across a user's drive for files matching a query string.
 */
export async function* searchUserDrive(
  userId: string,
  query: string,
): AsyncIterableIterator<DriveItem> {
  yield* graphPaginate<DriveItem>(
    `/users/${encodeURIComponent(userId)}/drive/root/search(q='${encodeURIComponent(query)}')`,
  );
}

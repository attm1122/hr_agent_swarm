/**
 * Microsoft Graph integration — public exports.
 */

export {
  getGraphAccessToken,
  graphFetch,
  graphPaginate,
  isGraphConfigured,
  GraphApiError,
  GraphNotConfiguredError,
} from './client';

export {
  listAllUsers,
  getUser,
  getManager,
  getDirectReports,
  type GraphUser,
} from './users';

export {
  listUserDriveItems,
  listDriveItems,
  downloadDriveItem,
  getDriveItem,
  searchUserDrive,
  type DriveItem,
} from './onedrive';

export { sendMail, type SendMailOptions } from './mail';

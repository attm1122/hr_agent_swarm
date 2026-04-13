/**
 * Notifications — public exports.
 */

export { sendEmail, isEmailConfigured, type EmailMessage } from './email';
export {
  sendTeamsMessage,
  isTeamsConfigured,
  type TeamsMessage,
} from './teams';
export { registerNotificationHandlers } from './bus';
export * from './templates';

/**
 * In-app notification types.
 */

export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'teams';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'unread' | 'read' | 'dismissed' | 'actioned';

export interface InAppNotification {
  id: string;
  tenantId: string;
  /** The user who should see this notification. */
  recipientId: string;
  /** Optional: the user/system that triggered it. */
  senderId?: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  /** Category for grouping/filtering. */
  category: 'leave' | 'workflow' | 'escalation' | 'document' | 'system';
  /** Optional deep-link intent — clicking the notification fires this. */
  actionIntent?: { rawInput: string };
  /** Optional href for navigation. */
  actionHref?: string;
  /** Metadata bag for filtering, audit. */
  metadata?: Record<string, unknown>;
  status: NotificationStatus;
  createdAt: string;
  readAt?: string | null;
}

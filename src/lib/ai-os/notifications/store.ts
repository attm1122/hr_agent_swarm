/**
 * In-memory notification store.
 *
 * Keeps up to MAX_NOTIFICATIONS entries. Newest notifications are pushed to the
 * end; when the cap is hit the oldest entries are evicted. Replace the backing
 * array with a Supabase table for persistence in a follow-up.
 */

import { randomUUID } from 'node:crypto';

import type {
  InAppNotification,
  NotificationStatus,
} from './types';

const MAX_NOTIFICATIONS = 1000;

/** Module-level in-memory store. */
const notifications: InAppNotification[] = [];

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create and store a new notification.
 * `id`, `createdAt`, and `status` are generated automatically.
 */
export function addNotification(
  n: Omit<InAppNotification, 'id' | 'createdAt' | 'status'>,
): InAppNotification {
  const notification: InAppNotification = {
    ...n,
    id: randomUUID(),
    status: 'unread',
    createdAt: new Date().toISOString(),
  };

  notifications.push(notification);

  // Evict oldest entries when we exceed the cap.
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.splice(0, notifications.length - MAX_NOTIFICATIONS);
  }

  return notification;
}

export interface GetNotificationsOptions {
  status?: NotificationStatus;
  limit?: number;
  category?: InAppNotification['category'];
}

/**
 * Retrieve notifications for a given recipient, newest first.
 */
export function getNotifications(
  recipientId: string,
  opts: GetNotificationsOptions = {},
): InAppNotification[] {
  let results = notifications.filter((n) => n.recipientId === recipientId);

  if (opts.status) {
    results = results.filter((n) => n.status === opts.status);
  }

  if (opts.category) {
    results = results.filter((n) => n.category === opts.category);
  }

  // Newest first.
  results = results.slice().reverse();

  if (opts.limit !== undefined && opts.limit > 0) {
    results = results.slice(0, opts.limit);
  }

  return results;
}

/**
 * Mark a single notification as read.
 */
export function markRead(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (notification) {
    notification.status = 'read';
    notification.readAt = new Date().toISOString();
  }
}

/**
 * Mark every unread notification for a recipient as read.
 */
export function markAllRead(recipientId: string): void {
  const now = new Date().toISOString();
  for (const n of notifications) {
    if (n.recipientId === recipientId && n.status === 'unread') {
      n.status = 'read';
      n.readAt = now;
    }
  }
}

/**
 * Return the count of unread notifications for a recipient.
 */
export function getUnreadCount(recipientId: string): number {
  return notifications.filter(
    (n) => n.recipientId === recipientId && n.status === 'unread',
  ).length;
}

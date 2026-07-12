// noti-api notification inbox + realtime SSE.

export type NotificationType =
  | 'MENTION_IN_COMMENT'
  | 'COMMENT_REPLY'
  | 'COMMENT_ON_ERROR_CASE'
  | 'NEW_FOLLOWER'
  | 'WORKSPACE_INVITATION'
  | 'CASE_RESOLVED'

/** NotificationResponse (GET /users/me/notifications, SSE 'notification' event). */
export interface AppNotification {
  id: number
  type: NotificationType
  actorUserId: number | null
  payload: Record<string, unknown>
  /** in-app URL built by the server per type (core path, e.g. /error-cases/12#comment-3). Null = no navigation. */
  deepLink: string | null
  readAt: string | null
  createdAt: string
}

// ── Settings (still on the legacy shape; BE alignment is a separate task) ──
export interface NotificationSettings {
  comment: boolean
  reaction: boolean
  invitation: boolean
  follow: boolean
  watchUpdate: boolean
}

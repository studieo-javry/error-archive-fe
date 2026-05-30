import type { ErrorCaseSummary } from './error'

export type NotificationType =
  | 'COMMENT'
  | 'REACTION'
  | 'INVITATION'
  | 'FOLLOW'
  | 'WATCH_UPDATE'
  | 'STEP_ADDED'
  | 'STATUS_CHANGED'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  deepLink: string
  isRead: boolean
  createdAt: string
}

export interface NotificationSettings {
  comment: boolean
  reaction: boolean
  invitation: boolean
  follow: boolean
  watchUpdate: boolean
}

export interface Watch {
  id: string
  errorCaseId: string
  errorCase: ErrorCaseSummary
  createdAt: string
}

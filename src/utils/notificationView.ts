import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
  AtSymbolIcon,
  ArrowUturnLeftIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  EnvelopeIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import type { AppNotification, NotificationType } from '@/types/notification'

interface TypeMeta {
  icon: Component
  tone: string // icon color class
}

const META: Record<NotificationType, TypeMeta> = {
  MENTION_IN_COMMENT: { icon: AtSymbolIcon, tone: 'text-violet-500' },
  COMMENT_REPLY: { icon: ArrowUturnLeftIcon, tone: 'text-blue-500' },
  COMMENT_ON_ERROR_CASE: { icon: ChatBubbleLeftRightIcon, tone: 'text-blue-500' },
  NEW_FOLLOWER: { icon: UserPlusIcon, tone: 'text-emerald-500' },
  WORKSPACE_INVITATION: { icon: EnvelopeIcon, tone: 'text-amber-500' },
  CASE_RESOLVED: { icon: CheckCircleIcon, tone: 'text-emerald-500' },
}

export function notificationMeta(type: NotificationType): TypeMeta {
  return META[type] ?? { icon: ChatBubbleLeftRightIcon, tone: 'text-zinc-400' }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

/** Human title. We only get actorUserId (not a name), so lean on payload where present. */
export function notificationTitle(n: AppNotification): string {
  const p = n.payload
  switch (n.type) {
    case 'MENTION_IN_COMMENT': return 'Mentioned you in a comment'
    case 'COMMENT_REPLY': return 'Replied to your comment'
    case 'COMMENT_ON_ERROR_CASE': return 'Commented on your case'
    case 'NEW_FOLLOWER': return str(p.followerName) ? `${str(p.followerName)} followed you` : 'New follower'
    case 'WORKSPACE_INVITATION': return str(p.workspaceName) ? `Invited you to ${str(p.workspaceName)}` : 'Workspace invitation'
    case 'CASE_RESOLVED': return 'A case you watch was resolved'
    default: return 'New notification'
  }
}

export function notificationSnippet(n: AppNotification): string | undefined {
  const p = n.payload
  return str(p.snippet) ?? str(p.commentPreview) ?? str(p.caseTitle) ?? str(p.message)
}

/**
 * Map the server deepLink (core paths) to a FE route.
 * - /error-cases/{id}(#anchor) → workspace-scoped error detail (current slug context)
 * - /users/{id}               → profile
 * - /workspaces/...           → no direct FE route; fall back to home
 */
export function notificationRoute(deepLink: string | null, currentSlug: string): RouteLocationRaw | null {
  if (!deepLink) return null

  const caseMatch = deepLink.match(/^\/error-cases\/(\d+)(#.+)?$/)
  if (caseMatch) {
    return { name: 'errorDetail', params: { slug: currentSlug, id: Number(caseMatch[1]) }, hash: caseMatch[2] ?? '' }
  }

  const userMatch = deepLink.match(/^\/users\/(\d+)$/)
  if (userMatch) {
    return { name: 'profile', params: { id: userMatch[1] } }
  }

  if (deepLink.startsWith('/workspaces/')) {
    return { name: 'home', params: { slug: 'public' } }
  }

  return null
}

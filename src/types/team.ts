export type WorkspaceRole = 'READ' | 'WRITE' | 'ADMIN'
export type InvitationType = 'EMAIL' | 'LINK'

export interface Workspace {
  workspaceId: number
  name: string
  slug: string
  createdByUserId: number
  notificationEnabled: boolean
  defaultTimezone: string
  createdAt: string
  updatedAt: string
  viewerRole: string
}

export interface WorkspaceListItem {
  workspaceId: number
  name: string
  role: string
  createdByUserId: number
  slug: string
}

// iam-api CreateWorkspaceRequest takes only name + slug. Timezone/notifications are
// workspace settings adjusted after creation via PATCH (WorkspaceUpdateRequest).
export interface WorkspaceCreateRequest {
  name: string
  slug: string
}

export interface WorkspaceUpdateRequest {
  name?: string | null
  notificationEnabled?: boolean | null
  defaultTimezone?: string | null
}

export interface WorkspaceMember {
  userId: number
  displayName: string
  avatarUrl: string | null
  role: string
  joinedAt: string
  profileHref: string
}

export interface CreateInvitationRequest {
  type: InvitationType
  role: string
  email?: string | null
  expiresInHours?: number | null
}

export interface CreateInvitationResponse {
  invitationId: number
  type: string
  role: string
  expiresAt: string
  inviteToken: string | null
  inviteUrl: string | null
}

export interface InvitationItem {
  invitationId: number
  type: string
  email: string | null
  role: string
  expiresAt: string
  createdAt: string
}

export interface InvitationPreview {
  workspaceId: number
  workspaceName: string
  role: string
  expiresAt: string
  usable: boolean
}

export interface AcceptInvitationResponse {
  workspaceId: number
  workspaceName: string
  /** 수락 직후 `/w/{slug}/home` 이동에 사용 (iam-api 가 응답에 포함). */
  slug: string
  role: string
}

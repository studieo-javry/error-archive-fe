import type { UserSummary } from './user'

export type MemberRole = 'ADMIN' | 'WRITER' | 'VIEWER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface Workspace {
  id: string
  name: string
  description?: string
  memberCount: number
  errorCount: number
  creatorId: string
  myRole: MemberRole
  createdAt: string
}

export interface WorkspaceCreateRequest {
  name: string
  description?: string
}

export interface Member {
  id: string
  userId: string
  user: UserSummary
  role: MemberRole
  joinedAt: string
}

export interface Invitation {
  id: string
  token: string
  role: MemberRole
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface InvitationCreateRequest {
  role: MemberRole
  expiresInDays: number
}

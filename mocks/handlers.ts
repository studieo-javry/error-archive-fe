import { http, HttpResponse } from 'msw'
import type { MyProfile } from '@/types/user'
import type { ErrorCaseSummary } from '@/types/error'

const mockUser: MyProfile = {
  userId: 1,
  email: 'devkim@example.com',
  displayName: 'Kim Developer',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim',
  bio: 'Full-stack developer who loves solving tricky bugs',
  status: 'ACTIVE',
  pendingDeletionAt: null,
  language: 'ko',
  timezone: 'Asia/Seoul',
  theme: 'SYSTEM',
  defaultWorkspaceId: null,
}

const mockErrors: ErrorCaseSummary[] = [
  {
    id: 1,
    ownerUserId: 1,
    title: 'CORS policy blocking API requests in production',
    status: 'RESOLVED',
    visibility: 'PUBLIC',
    severity: 2,
    workspaceId: null,
    fingerprint: 'cors-nginx-001',
    exceptionClass: 'CORSError',
    createdAt: '2026-04-28T14:30:00Z',
    occurredAt: '2026-04-28T14:00:00Z',
  },
  {
    id: 2,
    ownerUserId: 1,
    title: 'TypeScript strict mode breaks third-party library types',
    status: 'IN_PROGRESS',
    visibility: 'PRIVATE',
    severity: 3,
    workspaceId: null,
    fingerprint: null,
    exceptionClass: 'TypeError',
    createdAt: '2026-05-01T10:15:00Z',
    occurredAt: null,
  },
  {
    id: 3,
    ownerUserId: 2,
    title: 'Memory leak in WebSocket connection handler',
    status: 'OPEN',
    visibility: 'PUBLIC',
    severity: 1,
    workspaceId: null,
    fingerprint: 'ws-memleak-001',
    exceptionClass: 'OutOfMemoryError',
    createdAt: '2026-05-03T16:45:00Z',
    occurredAt: '2026-05-03T16:00:00Z',
  },
]

export const handlers = [
  // Auth - OAuth flow
  http.post('/api/v1/auth/oauth/github/authorize', () => {
    return HttpResponse.json({
      authorizationUrl: 'https://github.com/login/oauth/authorize?client_id=mock&state=mock-state',
    })
  }),

  http.post('/api/v1/auth/oauth/github/callback', () => {
    return HttpResponse.json({
      tokenType: 'Bearer',
      accessToken: 'mock-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 1800000).toISOString(),
      userId: 1,
      redirectTo: null,
    })
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      tokenType: 'Bearer',
      accessToken: 'mock-access-token-new',
      accessTokenExpiresAt: new Date(Date.now() + 1800000).toISOString(),
      userId: 1,
      redirectTo: null,
    })
  }),

  http.post('/api/v1/auth/logout', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Users
  http.get('/api/v1/users/me', () => {
    return HttpResponse.json(mockUser)
  }),

  http.patch('/api/v1/users/me', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockUser, ...body })
  }),

  http.get('/api/v1/users/:id', () => {
    return HttpResponse.json({
      userId: 2,
      displayName: 'Park Dev',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev',
      bio: 'Backend developer',
      status: 'ACTIVE',
      isDeleted: false,
    })
  }),

  http.get('/api/v1/users/:id/follow-status', () => {
    return HttpResponse.json({
      userId: 2,
      followersCount: 15,
      followingCount: 8,
      viewerFollowsTarget: false,
      targetFollowsViewer: false,
      isMutual: false,
      isSelf: false,
    })
  }),

  http.put('/api/v1/users/:id/follow', () => {
    return HttpResponse.json({ followerId: 1, followeeId: 2, following: true, changed: true })
  }),

  http.delete('/api/v1/users/:id/follow', () => {
    return HttpResponse.json({ followerId: 1, followeeId: 2, following: false, changed: true })
  }),

  // Error cases
  http.get('/api/v1/error-cases', () => {
    return HttpResponse.json({
      items: mockErrors,
      nextCursor: null,
      hasNext: false,
    })
  }),

  http.get('/api/v1/error-cases/:id', ({ params }) => {
    const found = mockErrors.find((e) => e.id === Number(params.id))
    if (!found) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...found,
      scope: 'production',
      description: 'Occurred during production deployment after nginx config change',
      snapshot: {
        exceptionClass: found.exceptionClass,
        exceptionMessage: 'TypeError: Cannot read properties of undefined',
        rawStackTrace: 'at Object.<anonymous> (/app/server.js:42:15)\n  at Module._compile (node:internal/modules:1376:14)',
        fingerprint: found.fingerprint,
        rawPaste: null,
      },
      tags: ['nginx', 'cors', 'production'],
      snippets: [],
      attachments: [],
      environment: 'production',
      updatedAt: found.createdAt,
    })
  }),

  http.post('/api/v1/error-cases', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: Date.now(),
      title: body.title,
      status: 'OPEN',
      fingerprint: null,
      snippetMarkerIds: (body.snippetMarkerIds as string[]) || [],
      attachmentMarkerIds: (body.attachmentMarkerIds as string[]) || [],
      createdAt: new Date().toISOString(),
    })
  }),

  http.patch('/api/v1/error-cases/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: Number(params.id),
      ownerUserId: 1,
      title: body.title || 'Updated',
      scope: body.scope || null,
      status: 'OPEN',
      visibility: body.visibility || 'PRIVATE',
      description: body.description || null,
      workspaceId: null,
      severity: null,
      environment: null,
      occurredAt: null,
      createdAt: '2026-04-28T14:30:00Z',
      updatedAt: new Date().toISOString(),
      snapshot: null,
      snippets: [],
      attachments: [],
    })
  }),

  http.delete('/api/v1/error-cases/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Steps
  http.get('/api/v1/error-cases/:caseId/steps', () => {
    return HttpResponse.json([
      { id: 1, errorCaseId: 1, authorUserId: 1, orderIndex: 0, title: 'Tried adding CORS headers to nginx.conf', status: 'FAILED', attemptType: 'CONFIG', body: 'Headers were overwritten by upstream proxy', insight: null, createdAt: '2026-04-28T15:00:00Z', updatedAt: '2026-04-28T15:00:00Z' },
      { id: 2, errorCaseId: 1, authorUserId: 1, orderIndex: 1, title: 'Checked browser devtools — preflight OPTIONS request was blocked', status: 'IN_PROGRESS', attemptType: 'INVESTIGATION', body: null, insight: null, createdAt: '2026-04-28T16:30:00Z', updatedAt: '2026-04-28T16:30:00Z' },
      { id: 3, errorCaseId: 1, authorUserId: 1, orderIndex: 2, title: 'Added map $http_origin to allowed origins list in nginx', status: 'RESOLVED', attemptType: 'CONFIG', body: null, insight: 'The map directive allows dynamic origin matching', createdAt: '2026-04-29T09:00:00Z', updatedAt: '2026-04-29T09:00:00Z' },
    ])
  }),

  http.post('/api/v1/error-cases/:caseId/steps', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      step: {
        id: Date.now(),
        errorCaseId: 1,
        authorUserId: 1,
        orderIndex: 3,
        title: body.title,
        status: body.status,
        attemptType: body.attemptType || null,
        body: body.body || null,
        insight: body.insight || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      caseStatus: 'IN_PROGRESS',
      suggestResolve: false,
    })
  }),

  // Solutions
  http.get('/api/v1/error-cases/:caseId/solutions', () => {
    return HttpResponse.json([
      {
        id: 1,
        errorCaseId: 1,
        authorUserId: 1,
        title: 'Nginx CORS Origin Map',
        stepIds: [2, 3],
        createdAt: '2026-04-29T10:00:00Z',
        updatedAt: '2026-04-29T10:00:00Z',
      },
    ])
  }),

  http.post('/api/v1/error-cases/:caseId/solutions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: Date.now(),
      errorCaseId: 1,
      authorUserId: 1,
      title: body.title,
      stepIds: body.stepIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  // Comments
  http.get('/api/v1/error-cases/:caseId/comments', () => {
    return HttpResponse.json({
      items: [
        { id: 1, errorCaseId: 1, authorUserId: 2, isAuthorOfCase: false, parentCommentId: null, body: 'Have you tried checking the upstream proxy headers?', quote: null, reactions: [], helpful: { count: 1, userIds: [1], helpedByMe: true }, mentions: [], suggestion: null, editedAt: null, deletedAt: null, createdAt: '2026-04-28T16:00:00Z', updatedAt: '2026-04-28T16:00:00Z', replies: [] },
      ],
      nextCursor: null,
      hasNext: false,
      quoteSummary: { general: 1, caseBody: 0, steps: [] },
    })
  }),

  // Snippets (independent)
  http.post('/api/v1/error-snippets', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const markerId = `snp-${Math.random().toString(16).slice(2, 10)}`
    return HttpResponse.json({
      markerId,
      embedToken: `embed-${markerId}`,
      title: body.title || null,
      language: body.language,
      caption: body.caption || null,
    })
  }),

  http.delete('/api/v1/error-snippets/:markerId', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Attachments (independent)
  http.post('/api/v1/error-attachments', async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const markerId = `att-${Math.random().toString(16).slice(2, 10)}`
    return HttpResponse.json({
      markerId,
      embedToken: `embed-${markerId}`,
      fileName: file?.name || 'upload.bin',
      contentType: file?.type || 'application/octet-stream',
      size: file?.size || 0,
      kind: file?.type?.startsWith('image/') ? 'image' : 'file',
      storageUrl: 'https://placehold.co/800x400/f4f4f5/71717a?text=Uploaded+File',
    })
  }),

  http.delete('/api/v1/error-attachments/:markerId', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Dashboard
  http.get('/api/v1/dashboard', () => {
    return HttpResponse.json({
      recentErrors: mockErrors,
      stats: { totalErrors: 23, totalSteps: 67, totalSolutions: 15, resolvedRate: 0.65, avgResolutionTime: 4.2 },
    })
  }),

  // Workspaces
  http.get('/api/v1/workspaces', () => {
    return HttpResponse.json([
      { workspaceId: 1, name: 'Frontend Team', role: 'ADMIN', createdByUserId: 1 },
      { workspaceId: 2, name: 'Backend Team', role: 'WRITE', createdByUserId: 2 },
    ])
  }),

  http.post('/api/v1/workspaces', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      workspaceId: Date.now(),
      name: body.name,
      createdByUserId: 1,
      notificationEnabled: true,
      defaultTimezone: 'Asia/Seoul',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewerRole: 'ADMIN',
    })
  }),

  http.get('/api/v1/workspaces/:id/members', () => {
    return HttpResponse.json([
      { userId: 1, displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim', role: 'ADMIN', joinedAt: '2026-03-01T00:00:00Z', profileHref: '/profile/1' },
      { userId: 2, displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev', role: 'WRITE', joinedAt: '2026-03-05T00:00:00Z', profileHref: '/profile/2' },
    ])
  }),

  http.patch('/api/v1/workspaces/:id/members/:userId', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/workspaces/:id/invitations', () => {
    return HttpResponse.json({
      invitationId: 1,
      type: 'LINK',
      role: 'WRITE',
      expiresAt: '2026-05-12T00:00:00Z',
      inviteToken: 'abc123def456',
      inviteUrl: null,
    })
  }),

  http.post('/api/v1/invitations/accept', () => {
    return HttpResponse.json({
      workspaceId: 1,
      workspaceName: 'Frontend Team',
      role: 'WRITE',
    })
  }),

  // Insights
  http.get('/api/v1/insights/activity', () => {
    const days = Array.from({ length: 365 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (364 - i))
      const count = Math.floor(Math.random() * 8)
      return { date: date.toISOString().split('T')[0], count, level: Math.min(4, Math.floor(count / 2)) as 0 | 1 | 2 | 3 | 4 }
    })
    return HttpResponse.json(days)
  }),

  http.get('/api/v1/insights/kpi', () => {
    return HttpResponse.json({ totalErrors: 23, totalSteps: 67, totalSolutions: 15, resolvedRate: 0.65, avgResolutionTime: 4.2 })
  }),

  http.get('/api/v1/insights/leaderboard', () => {
    return HttpResponse.json([
      { rank: 1, user: { id: 1, displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, score: 142, errorCount: 23, solutionCount: 15 },
      { rank: 2, user: { id: 2, displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' }, score: 98, errorCount: 18, solutionCount: 9 },
      { rank: 3, user: { id: 3, displayName: 'Lee Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=leedev' }, score: 76, errorCount: 14, solutionCount: 7 },
    ])
  }),

  // Notifications
  http.get('/api/v1/notifications/unread-count', () => {
    return HttpResponse.json({ count: 3 })
  }),

  http.get('/api/v1/notifications', () => {
    return HttpResponse.json({
      items: [
        { id: 'notif-1', type: 'COMMENT', title: 'New comment', message: 'Park Dev commented on your error case', deepLink: '/errors/1', isRead: false, createdAt: '2026-05-05T08:00:00Z' },
        { id: 'notif-2', type: 'REACTION', title: 'New reaction', message: 'Lee Dev reacted to your error case', deepLink: '/errors/2', isRead: false, createdAt: '2026-05-04T14:00:00Z' },
        { id: 'notif-3', type: 'FOLLOW', title: 'New follower', message: 'Park Dev started following you', deepLink: '/profile/2', isRead: true, createdAt: '2026-05-03T10:00:00Z' },
      ],
      total: 3,
    })
  }),

  http.patch('/api/v1/notifications/:id/read', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('/api/v1/notifications/read-all', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/notifications/settings', () => {
    return HttpResponse.json({ comment: true, reaction: true, invitation: true, follow: true, watchUpdate: true })
  }),

  http.put('/api/v1/notifications/settings', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body)
  }),

  // Reports
  http.post('/api/v1/error-cases/:id/reports', () => {
    return HttpResponse.json({
      id: 1,
      errorCaseId: 1,
      snapshotData: { title: 'CORS policy fix', steps: 3, solution: 'Nginx Origin Map' },
      shareToken: 'share-abc123',
      shareUrl: '/report/share-abc123',
      createdAt: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/reports/:shareToken', () => {
    return HttpResponse.json({
      id: 1,
      errorCaseId: 1,
      snapshotData: { title: 'CORS policy blocking API requests in production' },
      shareToken: 'share-abc123',
      shareUrl: '/report/share-abc123',
      createdAt: '2026-04-30T12:00:00Z',
    })
  }),
]

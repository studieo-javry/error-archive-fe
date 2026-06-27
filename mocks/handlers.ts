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
  createdAt: '2026-01-10T09:00:00Z',
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
    project: 'api-gateway',
    descriptionPreview: 'Detailed analysis of CORS header issues within nginx reverse proxy configuration in production environment.',
    status: 'RESOLVED',
    visibility: 'PUBLIC',
    severity: 2,
    tags: ['nginx', 'cors', 'production'],
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
    project: 'error-archive-fe',
    descriptionPreview: 'Solved by adjusting tsconfig strict flags and adding type declarations for incompatible libraries.',
    status: 'IN_PROGRESS',
    visibility: 'PRIVATE',
    severity: 3,
    tags: ['typescript', 'strict-mode'],
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
    project: 'realtime-service',
    descriptionPreview: 'Investigating memory growth in long-lived WebSocket connections under high concurrency load.',
    status: 'OPEN',
    visibility: 'PUBLIC',
    severity: 1,
    tags: ['websocket', 'memory-leak'],
    workspaceId: null,
    fingerprint: 'ws-memleak-001',
    exceptionClass: 'OutOfMemoryError',
    createdAt: '2026-05-03T16:45:00Z',
    occurredAt: '2026-05-03T16:00:00Z',
  },
  {
    id: 4,
    ownerUserId: 1,
    title: 'Vite HMR full reload loop on case-sensitive paths',
    project: 'frontend-team-app',
    descriptionPreview: 'HMR repeatedly triggers full page reloads due to a case mismatch in import paths.',
    status: 'RESOLVED',
    visibility: 'PUBLIC',
    severity: 3,
    tags: ['vite', 'hmr'],
    workspaceId: 1,
    fingerprint: null,
    exceptionClass: 'Error',
    createdAt: '2026-05-04T09:00:00Z',
    occurredAt: null,
  },
  {
    id: 5,
    ownerUserId: 2,
    title: 'Pinia store state reset on nested route change',
    project: 'frontend-team-app',
    descriptionPreview: 'Store unexpectedly reset when navigating between nested child routes.',
    status: 'OPEN',
    visibility: 'PRIVATE',
    severity: 2,
    tags: ['pinia', 'vue-router'],
    workspaceId: 1,
    fingerprint: null,
    exceptionClass: 'TypeError',
    createdAt: '2026-05-05T11:00:00Z',
    occurredAt: null,
  },
  {
    id: 6,
    ownerUserId: 2,
    title: 'JPA N+1 query on order aggregation endpoint',
    project: 'backend-team-svc',
    descriptionPreview: 'Lazy associations triggering N+1 selects under load; resolved with a fetch join.',
    status: 'RESOLVED',
    visibility: 'PUBLIC',
    severity: 1,
    tags: ['jpa', 'performance'],
    workspaceId: 2,
    fingerprint: null,
    exceptionClass: 'LazyInitializationException',
    createdAt: '2026-05-06T13:00:00Z',
    occurredAt: null,
  },
  {
    id: 7,
    ownerUserId: 1,
    title: 'Kafka consumer rebalance storms during rolling deploy',
    project: 'backend-team-svc',
    descriptionPreview: 'Frequent rebalances during deploys causing consumer lag spikes.',
    status: 'IN_PROGRESS',
    visibility: 'PRIVATE',
    severity: 2,
    tags: ['kafka', 'deploy'],
    workspaceId: 2,
    fingerprint: null,
    exceptionClass: 'RebalanceInProgressException',
    createdAt: '2026-05-07T15:00:00Z',
    occurredAt: null,
  },
]

// Author display info per owner (search shows other users' cases too).
const MOCK_AUTHORS: Record<number, { userId: number; displayName: string; avatarUrl: string }> = {
  1: { userId: 1, displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
  2: { userId: 2, displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' },
}

function withAuthor(e: ErrorCaseSummary) {
  return { ...e, author: MOCK_AUTHORS[e.ownerUserId] ?? null }
}

// Mutable so newly created workspaces show up in the switcher and resolve by slug.
const mockWorkspaces = [
  { workspaceId: 1, name: 'Frontend Team', role: 'ADMIN', createdByUserId: 1, slug: 'frontend-team' },
  { workspaceId: 2, name: 'Backend Team', role: 'WRITE', createdByUserId: 2, slug: 'backend-team' },
]
let nextWorkspaceId = 3

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
  http.get('/api/v1/error-cases/search', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() || ''
    const wsParam = url.searchParams.get('workspaceId')
    // Team search → that workspace's cases; Public search → all PUBLIC cases (community discovery).
    const pool = wsParam != null
      ? mockErrors.filter(e => e.workspaceId === Number(wsParam))
      : mockErrors.filter(e => e.visibility === 'PUBLIC')
    const filtered = q
      ? pool.filter(e => e.title.toLowerCase().includes(q) || e.project?.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q)))
      : pool
    return HttpResponse.json({ items: filtered.map(withAuthor), nextCursor: null, hasNext: false })
  }),

  http.get('/api/v1/error-cases', ({ request }) => {
    const url = new URL(request.url)
    const wsParam = url.searchParams.get('workspaceId')
    const status = url.searchParams.get('status')
    // workspaceId present → that workspace's cases; absent → personal (null workspace).
    let items = wsParam != null
      ? mockErrors.filter((e) => e.workspaceId === Number(wsParam))
      : mockErrors.filter((e) => e.workspaceId == null)
    if (status) items = items.filter((e) => e.status === status)
    return HttpResponse.json({
      items: items.map(withAuthor),
      nextCursor: null,
      hasNext: false,
    })
  }),

  http.get('/api/v1/error-cases/:id', ({ params }) => {
    const found = mockErrors.find((e) => e.id === Number(params.id))
    if (!found) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...found,
      project: 'production',
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
      project: body.project || null,
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
        { id: 1, errorCaseId: 1, authorUserId: 1, isAuthorOfCase: true, parentCommentId: null, body: 'I spent hours debugging this. The root cause was the **upstream proxy** overwriting the CORS headers silently.', quote: { kind: 'CASE_BODY', sourceId: null, snapshot: 'Occurred during production deployment after nginx config change', truncated: false }, reactions: [], helpful: { count: 6, userIds: [2, 3, 5, 7, 8, 11], helpedByMe: false }, mentions: [], suggestion: null, editedAt: null, deletedAt: null, createdAt: '2026-04-28T16:00:00Z', updatedAt: '2026-04-28T16:00:00Z', replies: [
          { id: 3, errorCaseId: 1, authorUserId: 2, isAuthorOfCase: false, parentCommentId: 1, body: 'That makes sense. Did you also check the `Access-Control-Allow-Origin` header?', quote: null, reactions: [], helpful: { count: 0, userIds: [], helpedByMe: false }, mentions: [], suggestion: null, editedAt: null, deletedAt: null, createdAt: '2026-04-28T17:30:00Z', updatedAt: '2026-04-28T17:30:00Z', replies: [] },
        ] },
        { id: 2, errorCaseId: 1, authorUserId: 2, isAuthorOfCase: false, parentCommentId: null, body: 'Have you tried checking the upstream proxy headers? The `map $http_origin` approach is much cleaner than hardcoding.', quote: { kind: 'STEP', sourceId: 1, snapshot: 'Headers were overwritten by upstream proxy', truncated: false }, reactions: [], helpful: { count: 4, userIds: [1, 4, 6, 9], helpedByMe: true }, mentions: [], suggestion: null, editedAt: '2026-04-28T18:00:00Z', deletedAt: null, createdAt: '2026-04-28T17:00:00Z', updatedAt: '2026-04-28T18:00:00Z', replies: [] },
        { id: 4, errorCaseId: 1, authorUserId: 3, isAuthorOfCase: false, parentCommentId: null, body: 'Deleted test comment', quote: null, reactions: [], helpful: { count: 0, userIds: [], helpedByMe: false }, mentions: [], suggestion: null, editedAt: null, deletedAt: '2026-04-29T10:00:00Z', createdAt: '2026-04-29T09:00:00Z', updatedAt: '2026-04-29T10:00:00Z', replies: [] },
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
    return HttpResponse.json(mockWorkspaces)
  }),

  http.post('/api/v1/workspaces', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const workspaceId = nextWorkspaceId++
    const slug = String(body.slug || `workspace-${workspaceId}`)
    // Persist so the new workspace appears in the switcher and is reachable by slug.
    mockWorkspaces.push({ workspaceId, name: String(body.name), role: 'ADMIN', createdByUserId: 1, slug })
    return HttpResponse.json({
      workspaceId,
      name: body.name,
      slug,
      createdByUserId: 1,
      notificationEnabled: body.notificationEnabled ?? true,
      defaultTimezone: body.defaultTimezone || 'Asia/Seoul',
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

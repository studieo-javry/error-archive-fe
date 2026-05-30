import { http, HttpResponse } from 'msw'
import type { UserProfile } from '@/types/user'
import type { ErrorCaseSummary } from '@/types/error'

const mockUser: UserProfile = {
  id: 'user-1',
  username: 'devkim',
  displayName: 'Kim Developer',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim',
  bio: 'Full-stack developer who loves solving tricky bugs',
  githubUrl: 'https://github.com/devkim',
  followerCount: 42,
  followingCount: 18,
  errorCount: 23,
  solutionCount: 15,
  isFollowing: false,
  createdAt: '2025-01-15T09:00:00Z',
}

const mockErrors: ErrorCaseSummary[] = [
  {
    id: 'err-1',
    title: 'CORS policy blocking API requests in production',
    status: 'RESOLVED',
    tags: [
      { id: 'tag-1', name: 'CORS', usageCount: 45 },
      { id: 'tag-2', name: 'nginx', usageCount: 32 },
    ],
    author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
    reactionCount: 12,
    commentCount: 5,
    createdAt: '2026-04-28T14:30:00Z',
  },
  {
    id: 'err-2',
    title: 'TypeScript strict mode breaks third-party library types',
    status: 'IN_PROGRESS',
    tags: [
      { id: 'tag-3', name: 'TypeScript', usageCount: 89 },
      { id: 'tag-4', name: 'types', usageCount: 56 },
    ],
    author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
    reactionCount: 8,
    commentCount: 3,
    createdAt: '2026-05-01T10:15:00Z',
  },
  {
    id: 'err-3',
    title: 'Memory leak in WebSocket connection handler',
    status: 'OPEN',
    tags: [
      { id: 'tag-5', name: 'WebSocket', usageCount: 22 },
      { id: 'tag-6', name: 'memory-leak', usageCount: 18 },
    ],
    author: { id: 'user-2', username: 'parkdev', displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' },
    reactionCount: 5,
    commentCount: 2,
    createdAt: '2026-05-03T16:45:00Z',
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
    })
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      tokenType: 'Bearer',
      accessToken: 'mock-access-token-new',
      accessTokenExpiresAt: new Date(Date.now() + 1800000).toISOString(),
      userId: 1,
    })
  }),

  http.post('/api/v1/auth/logout', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Users
  http.get('/api/v1/users/me', () => {
    return HttpResponse.json(mockUser)
  }),

  // Errors list
  http.get('/api/errors', () => {
    return HttpResponse.json({
      success: true,
      data: { items: mockErrors, total: mockErrors.length, page: 1, size: 20, hasNext: false },
      timestamp: new Date().toISOString(),
    })
  }),

  // Dashboard
  http.get('/api/dashboard', () => {
    return HttpResponse.json({
      success: true,
      data: {
        recentErrors: mockErrors,
        stats: { totalErrors: 23, totalSteps: 67, totalSolutions: 15, resolvedRate: 0.65, avgResolutionTime: 4.2 },
      },
      timestamp: new Date().toISOString(),
    })
  }),

  // Error detail
  http.get('/api/errors/:id', ({ params }) => {
    const found = mockErrors.find((e) => e.id === params.id)
    if (!found) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      success: true,
      data: {
        ...found,
        errorMessage: 'TypeError: Cannot read properties of undefined',
        context: 'Occurred during production deployment after nginx config change',
        stackTrace: 'at Object.<anonymous> (/app/server.js:42:15)\n  at Module._compile (node:internal/modules:1376:14)',
        visibility: 'DISCOVERABLE',
        authorId: found.author.id,
        workspaceId: null,
        hasReacted: false,
        stepCount: 3,
        isWatching: false,
        updatedAt: found.createdAt,
      },
      timestamp: new Date().toISOString(),
    })
  }),

  // Error create
  http.post('/api/errors', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: `err-${Date.now()}`,
        ...body,
        status: 'OPEN',
        tags: ((body.tags as string[]) || []).map((t, i) => ({ id: `tag-new-${i}`, name: t, usageCount: 1 })),
        author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
        authorId: 'user-1',
        reactionCount: 0,
        hasReacted: false,
        commentCount: 0,
        stepCount: 0,
        isWatching: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    })
  }),

  // Error update
  http.put('/api/errors/:id', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: { id: 'err-1', ...body, updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  // Error delete
  http.delete('/api/errors/:id', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),

  // Reaction toggle
  http.post('/api/errors/:id/react', () => {
    return HttpResponse.json({
      success: true,
      data: { hasReacted: true, reactionCount: 13 },
      timestamp: new Date().toISOString(),
    })
  }),

  // Watch toggle
  http.post('/api/errors/:id/watch', () => {
    return HttpResponse.json({
      success: true,
      data: { isWatching: true },
      timestamp: new Date().toISOString(),
    })
  }),

  // Steps
  http.get('/api/errors/:errorId/steps', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'step-1', errorCaseId: 'err-1', content: 'Tried adding CORS headers to nginx.conf', status: 'FAILED', failureReason: 'Headers were overwritten by upstream proxy', linkedErrorId: null, linkedError: null, authorId: 'user-1', author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, commentCount: 1, order: 1, createdAt: '2026-04-28T15:00:00Z', updatedAt: '2026-04-28T15:00:00Z' },
        { id: 'step-2', errorCaseId: 'err-1', content: 'Checked browser devtools — preflight OPTIONS request was blocked', status: 'IN_PROGRESS', failureReason: null, linkedErrorId: null, linkedError: null, authorId: 'user-1', author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, commentCount: 0, order: 2, createdAt: '2026-04-28T16:30:00Z', updatedAt: '2026-04-28T16:30:00Z' },
        { id: 'step-3', errorCaseId: 'err-1', content: 'Added map $http_origin to allowed origins list in nginx', status: 'RESOLVED', failureReason: null, linkedErrorId: null, linkedError: null, authorId: 'user-1', author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, commentCount: 2, order: 3, createdAt: '2026-04-29T09:00:00Z', updatedAt: '2026-04-29T09:00:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/errors/:errorId/steps', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: `step-${Date.now()}`,
        errorCaseId: 'err-1',
        ...body,
        linkedError: null,
        authorId: 'user-1',
        author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
        commentCount: 0,
        order: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    })
  }),

  // Solutions
  http.get('/api/errors/:errorId/solutions', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'sol-1',
          errorCaseId: 'err-1',
          name: 'Nginx CORS Origin Map',
          rootCause: 'Upstream proxy was stripping custom CORS headers',
          selectedStepIds: ['step-2', 'step-3'],
          steps: [],
          authorId: 'user-1',
          author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
          isBookmarked: false,
          bookmarkCount: 3,
          forkCount: 1,
          createdAt: '2026-04-29T10:00:00Z',
        },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/errors/:errorId/solutions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: {
        id: `sol-${Date.now()}`,
        errorCaseId: 'err-1',
        ...body,
        steps: [],
        authorId: 'user-1',
        author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' },
        isBookmarked: false,
        bookmarkCount: 0,
        forkCount: 0,
        createdAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    })
  }),

  // Search
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() || ''
    const filtered = mockErrors.filter((e) => e.title.toLowerCase().includes(q) || e.tags.some((t) => t.name.toLowerCase().includes(q)))
    return HttpResponse.json({
      success: true,
      data: { items: filtered, total: filtered.length, page: 1, size: 20, hasNext: false },
      timestamp: new Date().toISOString(),
    })
  }),

  // Users
  http.get('/api/users/:id', () => {
    return HttpResponse.json({
      success: true,
      data: { ...mockUser, id: 'user-2', username: 'parkdev', displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev', isFollowing: false },
      timestamp: new Date().toISOString(),
    })
  }),

  http.patch('/api/v1/users/me', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockUser, ...body })
  }),

  http.post('/api/users/:id/follow', () => {
    return HttpResponse.json({ success: true, data: { isFollowing: true }, timestamp: new Date().toISOString() })
  }),

  // Workspaces
  http.get('/api/workspaces', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'ws-1', name: 'Frontend Team', description: 'Vue.js development team', memberCount: 5, errorCount: 12, creatorId: 'user-1', myRole: 'ADMIN', createdAt: '2026-03-01T00:00:00Z' },
        { id: 'ws-2', name: 'Backend Team', description: 'Spring Boot team', memberCount: 3, errorCount: 8, creatorId: 'user-2', myRole: 'WRITER', createdAt: '2026-03-15T00:00:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.get('/api/workspaces/:id/members', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'mem-1', userId: 'user-1', user: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, role: 'ADMIN', joinedAt: '2026-03-01T00:00:00Z' },
        { id: 'mem-2', userId: 'user-2', user: { id: 'user-2', username: 'parkdev', displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' }, role: 'WRITER', joinedAt: '2026-03-05T00:00:00Z' },
        { id: 'mem-3', userId: 'user-3', user: { id: 'user-3', username: 'leedev', displayName: 'Lee Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=leedev' }, role: 'VIEWER', joinedAt: '2026-04-01T00:00:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.put('/api/workspaces/:id/members/:memberId', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ success: true, data: { id: 'mem-2', role: body.role }, timestamp: new Date().toISOString() })
  }),

  http.post('/api/workspaces/:id/invitations', () => {
    return HttpResponse.json({
      success: true,
      data: { id: 'inv-1', token: 'abc123def456', role: 'WRITER', status: 'PENDING', expiresAt: '2026-05-12T00:00:00Z', createdAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  // Comments
  http.get('/api/comments', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'cmt-1', targetType: 'ERROR_CASE', targetId: 'err-1', content: 'Have you tried checking the upstream proxy headers?', authorId: 'user-2', author: { id: 'user-2', username: 'parkdev', displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' }, parentId: null, replies: [{ id: 'cmt-2', targetType: 'ERROR_CASE', targetId: 'err-1', content: 'Yes! That was the issue.', authorId: 'user-1', author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, parentId: 'cmt-1', replies: [], isDeleted: false, createdAt: '2026-04-28T17:00:00Z', updatedAt: '2026-04-28T17:00:00Z' }], isDeleted: false, createdAt: '2026-04-28T16:00:00Z', updatedAt: '2026-04-28T16:00:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/comments', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: { id: `cmt-${Date.now()}`, ...body, authorId: 'user-1', author: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, replies: [], isDeleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  http.delete('/api/comments/:id', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),

  // Reports
  http.post('/api/errors/:id/reports', () => {
    return HttpResponse.json({
      success: true,
      data: { id: 'rpt-1', errorCaseId: 'err-1', snapshotData: { title: 'CORS policy fix', steps: 3, solution: 'Nginx Origin Map' }, shareToken: 'share-abc123', shareUrl: '/report/share-abc123', createdAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  http.get('/api/reports/:shareToken', () => {
    return HttpResponse.json({
      success: true,
      data: { id: 'rpt-1', errorCaseId: 'err-1', snapshotData: { title: 'CORS policy blocking API requests in production', steps: [{ content: 'Checked devtools', status: 'IN_PROGRESS' }, { content: 'Fixed nginx config', status: 'RESOLVED' }], solution: { name: 'Nginx CORS Origin Map', rootCause: 'Upstream proxy stripping headers' } }, shareToken: 'share-abc123', shareUrl: '/report/share-abc123', createdAt: '2026-04-30T12:00:00Z' },
      timestamp: new Date().toISOString(),
    })
  }),

  // Fork & Bookmark
  http.post('/api/solutions/:id/fork', () => {
    return HttpResponse.json({ success: true, data: { forkedErrorId: 'err-forked-1' }, timestamp: new Date().toISOString() })
  }),

  http.post('/api/solutions/:id/bookmark', () => {
    return HttpResponse.json({ success: true, data: { isBookmarked: true }, timestamp: new Date().toISOString() })
  }),

  // Insights
  http.get('/api/insights/activity', () => {
    const days = Array.from({ length: 365 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (364 - i))
      const count = Math.floor(Math.random() * 8)
      return { date: date.toISOString().split('T')[0], count, level: Math.min(4, Math.floor(count / 2)) as 0 | 1 | 2 | 3 | 4 }
    })
    return HttpResponse.json({ success: true, data: days, timestamp: new Date().toISOString() })
  }),

  http.get('/api/insights/kpi', () => {
    return HttpResponse.json({
      success: true,
      data: { totalErrors: 23, totalSteps: 67, totalSolutions: 15, resolvedRate: 0.65, avgResolutionTime: 4.2 },
      timestamp: new Date().toISOString(),
    })
  }),

  http.get('/api/insights/leaderboard', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { rank: 1, user: { id: 'user-1', username: 'devkim', displayName: 'Kim Developer', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devkim' }, score: 142, errorCount: 23, solutionCount: 15 },
        { rank: 2, user: { id: 'user-2', username: 'parkdev', displayName: 'Park Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=parkdev' }, score: 98, errorCount: 18, solutionCount: 9 },
        { rank: 3, user: { id: 'user-3', username: 'leedev', displayName: 'Lee Dev', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=leedev' }, score: 76, errorCount: 14, solutionCount: 7 },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  // Notifications
  http.get('/api/notifications/unread-count', () => {
    return HttpResponse.json({ success: true, data: { count: 3 }, timestamp: new Date().toISOString() })
  }),

  http.get('/api/notifications', () => {
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          { id: 'notif-1', type: 'COMMENT', title: 'New comment', message: 'Park Dev commented on your error case', deepLink: '/errors/err-1', isRead: false, createdAt: '2026-05-05T08:00:00Z' },
          { id: 'notif-2', type: 'REACTION', title: 'New reaction', message: 'Lee Dev reacted to your error case', deepLink: '/errors/err-2', isRead: false, createdAt: '2026-05-04T14:00:00Z' },
          { id: 'notif-3', type: 'FOLLOW', title: 'New follower', message: 'Park Dev started following you', deepLink: '/profile/user-2', isRead: true, createdAt: '2026-05-03T10:00:00Z' },
        ],
        total: 3,
        page: 1,
        size: 20,
        hasNext: false,
      },
      timestamp: new Date().toISOString(),
    })
  }),

  http.patch('/api/notifications/:id/read', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),

  http.patch('/api/notifications/read-all', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),

  http.get('/api/notifications/settings', () => {
    return HttpResponse.json({
      success: true,
      data: { comment: true, reaction: true, invitation: true, follow: true, watchUpdate: true },
      timestamp: new Date().toISOString(),
    })
  }),

  http.put('/api/notifications/settings', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ success: true, data: body, timestamp: new Date().toISOString() })
  }),

  // Snippets
  http.get('/api/errors/:errorId/snippets', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'snp-a1b2c3d4', errorCaseId: 'err-1', title: 'nginx.conf CORS config', language: 'bash', filePath: '/etc/nginx/nginx.conf', lineRange: '42-58', caption: 'The final working CORS configuration', code: 'location /api/ {\n  if ($request_method = OPTIONS) {\n    add_header Access-Control-Allow-Origin $http_origin;\n    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";\n    add_header Access-Control-Allow-Headers "Authorization, Content-Type";\n    return 204;\n  }\n  proxy_pass http://upstream;\n}', authorId: 'user-1', createdAt: '2026-04-29T09:30:00Z', updatedAt: '2026-04-29T09:30:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/errors/:errorId/snippets', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const id = Math.random().toString(16).slice(2, 10)
    return HttpResponse.json({
      success: true,
      data: { id: `snp-${id}`, errorCaseId: 'err-1', ...body, authorId: 'user-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  http.put('/api/errors/:errorId/snippets/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: { id: params.id, errorCaseId: 'err-1', ...body, authorId: 'user-1', createdAt: '2026-04-29T09:30:00Z', updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  http.delete('/api/errors/:errorId/snippets/:id', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),

  // Attachments
  http.get('/api/errors/:errorId/attachments', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'att-e5f6g7h8', errorCaseId: 'err-1', title: 'Browser DevTools screenshot', fileName: 'cors-error.png', mimeType: 'image/png', fileSize: 245000, url: 'https://placehold.co/800x400/f4f4f5/71717a?text=CORS+Error+Screenshot', caption: 'The CORS error shown in browser console', kind: 'image', authorId: 'user-1', createdAt: '2026-04-28T15:30:00Z', updatedAt: '2026-04-28T15:30:00Z' },
      ],
      timestamp: new Date().toISOString(),
    })
  }),

  http.post('/api/errors/:errorId/attachments', async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const id = Math.random().toString(16).slice(2, 10)
    return HttpResponse.json({
      success: true,
      data: {
        id: `att-${id}`,
        errorCaseId: 'err-1',
        title: formData.get('title') || null,
        fileName: file?.name || 'upload.bin',
        mimeType: file?.type || 'application/octet-stream',
        fileSize: file?.size || 0,
        url: 'https://placehold.co/800x400/f4f4f5/71717a?text=Uploaded+File',
        caption: formData.get('caption') || null,
        kind: file?.type?.startsWith('image/') ? 'image' : 'file',
        authorId: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    })
  }),

  http.put('/api/errors/:errorId/attachments/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      success: true,
      data: { id: params.id, errorCaseId: 'err-1', fileName: 'cors-error.png', mimeType: 'image/png', fileSize: 245000, url: 'https://placehold.co/800x400/f4f4f5/71717a?text=Updated+File', kind: 'image', authorId: 'user-1', ...body, createdAt: '2026-04-28T15:30:00Z', updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
  }),

  http.delete('/api/errors/:errorId/attachments/:id', () => {
    return HttpResponse.json({ success: true, data: null, timestamp: new Date().toISOString() })
  }),
]

import { http, HttpResponse } from 'msw'
import type { MyProfile } from '@/types/user'
import type { ErrorCaseSummary } from '@/types/error'

// Synthesize ~1 year of activity-grass data in the insight-api ActivityGrassResponse shape.
function buildGrass() {
  const TYPES = ['CASE_CREATED', 'CASE_RESOLVED', 'CASE_PUBLISHED', 'STEP_ADDED', 'SOLUTION_ADDED', 'COMMENT_POSTED', 'COMMENT_REACTION', 'COMMENT_HELPFUL', 'FOLLOWED_USER']
  const days: { date: string; count: number; score: number; level: 0 | 1 | 2 | 3 | 4; breakdown: Record<string, number> }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const from = new Date(today); from.setDate(today.getDate() - 364)
  let events = 0, score = 0, activeDays = 0
  let best: { date: string; score: number } | null = null
  for (const d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) {
    const r = Math.random()
    let count = 0, sc = 0
    const breakdown: Record<string, number> = {}
    if (r > 0.62) {
      count = r > 0.9 ? 4 + Math.floor(Math.random() * 8) : r > 0.8 ? 2 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i++) {
        const t = TYPES[Math.floor(Math.random() * TYPES.length)]
        breakdown[t] = (breakdown[t] ?? 0) + 1
        sc += t === 'SOLUTION_ADDED' || t === 'CASE_RESOLVED' ? 5 : 2
      }
    }
    const level: 0 | 1 | 2 | 3 | 4 = sc > 20 ? 4 : sc > 10 ? 3 : sc > 4 ? 2 : sc > 0 ? 1 : 0
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ date, count, score: sc, level, breakdown })
    events += count; score += sc
    if (count > 0) activeDays++
    if (sc > 0 && (!best || sc > best.score)) best = { date, score: sc }
  }
  let longest = 0, run = 0, current = 0
  for (const dd of days) { if (dd.count > 0) { run++; longest = Math.max(longest, run) } else run = 0 }
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].count > 0) current++; else break }
  const currentStartDate = current > 0 ? days[days.length - current].date : null
  return {
    rangeFrom: days[0].date,
    rangeTo: days[days.length - 1].date,
    timezone: 'Asia/Seoul',
    days,
    streak: { current, longest, currentStartDate },
    totals: { events, score, activeDays },
    bestDay: best,
    thresholds: { mode: 'relative', l1: 1, l2: 5, l3: 11, l4: 21 },
  }
}

const mockUser: MyProfile = {
  userId: 1,
  email: 'devkim@example.com',
  displayName: 'Kim Developer',
  handle: 'devkim',
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

// ── Insight Home (ERR-33) in-memory mock state ──
// Toggles change subsequent responses within a session.
const watchlistSet = new Set<number>([1, 3]) // caseIds I'm watching
const followingSet = new Set<number>([3, 1]) // userIds I follow (seeded so the following feed shows)

const HOUR = 3600_000
const DAY = 24 * HOUR
function isoAgo(ms: number) {
  return new Date(Date.now() - ms).toISOString()
}

// Recent my activities (core-api /users/me/recent-activities) — timeline items + byType summary.
const recentActivities = [
  { type: 'SOLUTION_REGISTERED', caseId: 1, caseTitle: 'CORS policy blocking API requests in production', occurredAt: isoAgo(1 * HOUR) },
  { type: 'COMMENT_POSTED', caseId: 2, caseTitle: 'TypeScript strict mode breaks third-party library types', occurredAt: isoAgo(5 * HOUR) },
  { type: 'STEP_ADDED', caseId: 7, caseTitle: 'Kafka consumer rebalance storms during rolling deploy', occurredAt: isoAgo(1 * DAY) },
  { type: 'CASE_RESOLVED', caseId: 4, caseTitle: 'Vite HMR full reload loop on case-sensitive paths', occurredAt: isoAgo(2 * DAY) },
  { type: 'CASE_CREATED', caseId: 7, caseTitle: 'Kafka consumer rebalance storms during rolling deploy', occurredAt: isoAgo(3 * DAY) },
  { type: 'COMMENT_POSTED', caseId: 1, caseTitle: 'CORS policy blocking API requests in production', occurredAt: isoAgo(4 * DAY) },
  { type: 'STEP_ADDED', caseId: 1, caseTitle: 'CORS policy blocking API requests in production', occurredAt: isoAgo(6 * DAY) },
] as const

const activityByType: Record<string, number> = {
  CASE_CREATED: 1,
  CASE_RESOLVED: 1,
  COMMENT_POSTED: 2,
  STEP_ADDED: 2,
  SOLUTION_REGISTERED: 1,
}

// Watchlist feed cards (core-api /users/me/watchlist-feed). Filtered by watchlistSet.
const watchlistFeedAll = [
  { id: 3, title: 'Memory leak in WebSocket connection handler', status: 'IN_PROGRESS', visibility: 'PUBLIC', severity: 2, workspaceId: null, latestActivitySource: 'STEP_ADDED', latestActivityActorUserId: 4, actor: { userId: 4, handle: 'dohyun.han', displayName: '한도윤', avatarUrl: null }, lastActivityAt: isoAgo(3 * HOUR), unreadActivityCount: 4, detailUrl: '/error-cases/3#step-31' },
  { id: 1, title: 'CORS policy blocking API requests in production', status: 'RESOLVED', visibility: 'PUBLIC', severity: 2, workspaceId: null, latestActivitySource: 'SOLUTION_REGISTERED', latestActivityActorUserId: 1, actor: { userId: 1, handle: 'johndoe', displayName: 'John Doe', avatarUrl: null }, lastActivityAt: isoAgo(1 * DAY), unreadActivityCount: 2, detailUrl: '/error-cases/1#solution-11' },
  { id: 6, title: 'JPA N+1 query on order aggregation endpoint', status: 'RESOLVED', visibility: 'PUBLIC', severity: 3, workspaceId: null, latestActivitySource: 'CASE_RESOLVED', latestActivityActorUserId: 3, actor: { userId: 3, handle: 'jiyeon.park', displayName: '박지연', avatarUrl: null }, lastActivityAt: isoAgo(2 * DAY), unreadActivityCount: 1, detailUrl: '/error-cases/6' },
  { id: 5, title: 'Pinia store state reset on nested route change', status: 'OPEN', visibility: 'PUBLIC', severity: null, workspaceId: null, latestActivitySource: 'COMMENT_POSTED', latestActivityActorUserId: 5, actor: { userId: 5, handle: 'mira.k', displayName: 'Mira K.', avatarUrl: null }, lastActivityAt: isoAgo(4 * DAY), unreadActivityCount: 0, detailUrl: '/error-cases/5#comment-51' },
]

// My recent active cases (core-api /users/me/recent-active-cases) — my cases with recent activity, unread first.
const recentActiveCasesMock = [
  { id: 42, title: 'NullPointerException in KafkaProducer.send during broker restart', status: 'IN_PROGRESS', visibility: 'PUBLIC', workspaceId: null, stepCount: 3, commentCount: 12, solutionCount: 1, meTooCount: 8, createdAt: isoAgo(20 * DAY), lastActivityAt: isoAgo(2 * HOUR), unreadCount: 5, commentDelta24h: 3, commentDelta7d: 9, meTooDelta24h: 2, meTooDelta7d: 6 },
  { id: 47, title: 'Redis cluster 7.4 PubSub subscriber reconnects every 5s', status: 'OPEN', visibility: 'PUBLIC', workspaceId: null, stepCount: 1, commentCount: 5, solutionCount: 0, meTooCount: 3, createdAt: isoAgo(12 * DAY), lastActivityAt: isoAgo(1 * DAY), unreadCount: 2, commentDelta24h: 0, commentDelta7d: 1, meTooDelta24h: 0, meTooDelta7d: 3 },
  { id: 15, title: 'Hikari pool leak — connection 30/30 used, idle 0', status: 'RESOLVED', visibility: 'PUBLIC', workspaceId: null, stepCount: 5, commentCount: 9, solutionCount: 2, meTooCount: 11, createdAt: isoAgo(30 * DAY), lastActivityAt: isoAgo(2 * DAY), unreadCount: 1, commentDelta24h: 0, commentDelta7d: 2, meTooDelta24h: 0, meTooDelta7d: 5 },
  { id: 38, title: 'Spring Boot 3.2 -> 4.0: Jackson 2 -> 3 ObjectMapper conflict', status: 'RESOLVED', visibility: 'PUBLIC', workspaceId: null, stepCount: 4, commentCount: 7, solutionCount: 1, meTooCount: 6, createdAt: isoAgo(40 * DAY), lastActivityAt: isoAgo(3 * DAY), unreadCount: 0, commentDelta24h: 0, commentDelta7d: 1, meTooDelta24h: 0, meTooDelta7d: 4 },
  { id: 33, title: "React Server Components — missing 'use client' blocks hydration", status: 'RESOLVED', visibility: 'PUBLIC', workspaceId: null, stepCount: 2, commentCount: 3, solutionCount: 1, meTooCount: 2, createdAt: isoAgo(22 * DAY), lastActivityAt: isoAgo(5 * DAY), unreadCount: 0, commentDelta24h: 0, commentDelta7d: 0, meTooDelta24h: 0, meTooDelta7d: 2 },
]

// Following feed — recent cases from people I follow (core-api /users/me/following-feed).
const followingFeedMock = [
  { id: 312, ownerUserId: 3, title: 'Kotlin coroutine NPE not caught — throw in supervisorScope propagates to root scope', status: 'OPEN', createdAt: isoAgo(3 * HOUR), tags: ['kotlin', 'coroutine'], author: { userId: 3, handle: 'jiyeon.park', displayName: '박지연', avatarUrl: null, bio: 'Backend · Kotlin · Spring' } },
  { id: 256, ownerUserId: 1, title: 'Spring AOP proxy self-invocation skips @Transactional, causing NPE', status: 'RESOLVED', createdAt: isoAgo(6 * HOUR), tags: ['spring', 'aop', 'transaction'], author: { userId: 1, handle: 'johndoe', displayName: 'John Doe', avatarUrl: null, bio: 'DevOps · k8s' } },
  { id: 198, ownerUserId: 4, title: 'Postgres 16 logical replication large-txn delay — wal sender memory spike', status: 'IN_PROGRESS', createdAt: isoAgo(1 * DAY), tags: ['postgres', 'replication'], author: { userId: 4, handle: 'dohyun.han', displayName: '한도윤', avatarUrl: null, bio: 'DBA · Postgres' } },
  { id: 177, ownerUserId: 5, title: 'Next.js App Router — cookie set dropped on a streaming response', status: 'OPEN', createdAt: isoAgo(2 * DAY), tags: ['nextjs', 'ssr', 'cookie'], author: { userId: 5, handle: 'mira.k', displayName: 'Mira K.', avatarUrl: null, bio: 'Frontend · Next.js' } },
  { id: 154, ownerUserId: 3, title: 'Redis pipeline partial reply on network hiccup — lettuce vs jedis behavior', status: 'IN_PROGRESS', createdAt: isoAgo(3 * DAY), tags: ['redis', 'lettuce'], author: { userId: 3, handle: 'jiyeon.park', displayName: '박지연', avatarUrl: null, bio: 'Backend · Kotlin · Spring' } },
  { id: 98, ownerUserId: 1, title: 'Kafka consumer rebalance storm — cooperative-sticky transition hang', status: 'RESOLVED', createdAt: isoAgo(4 * DAY), tags: ['kafka', 'rebalance'], author: { userId: 1, handle: 'johndoe', displayName: 'John Doe', avatarUrl: null, bio: 'DevOps · k8s' } },
]

// Suggested people to follow (AuthorSummary; shown when following nobody).
const suggestedFolloweesMock = [
  { userId: 3, handle: 'jiyeon.park', displayName: '박지연', avatarUrl: null, bio: 'Backend · Kotlin · Spring · Kafka', isFollowing: false },
  { userId: 1, handle: 'johndoe', displayName: 'John Doe', avatarUrl: null, bio: 'DevOps · Kubernetes · observability', isFollowing: false },
  { userId: 4, handle: 'dohyun.han', displayName: '한도윤', avatarUrl: null, bio: 'DBA · Postgres · replication internals', isFollowing: false },
]

// Mutable so newly created workspaces show up in the switcher and resolve by slug.
const mockWorkspaces = [
  { workspaceId: 1, name: 'Frontend Team', role: 'ADMIN', createdByUserId: 1, slug: 'frontend-team' },
  { workspaceId: 2, name: 'Backend Team', role: 'WRITE', createdByUserId: 2, slug: 'backend-team' },
]
let nextWorkspaceId = 3

// publish-api 발행물 — Library > Published. 배지가 실제로 뜨는 조합을 섞어둔다
// (정상 / source changed / Unlisted / Archived / source deleted).
const mockPublishments = [
  {
    slug: 'jpa-n1-fetch-join', title: 'Killing an N+1 with fetch join, step by step',
    summary: 'From 214 queries per request down to 3 — where lazy loading bites, and when to reach for fetch join over @EntityGraph.',
    originalCaseId: 142, visibility: 'PUBLIC', sourceState: 'LIVE', status: 'LIVE',
    sourceStale: true, version: 2, viewCount: 1284, downloadCount: 37,
    stepCount: 7, solutionCount: 1, tags: ['spring', 'jpa', 'n+1'],
    publishedAt: '2026-08-14T10:20:00', updatedAt: '2026-08-30T09:10:00',
  },
  {
    slug: 'docker-m1-amd64-build', title: 'Why amd64 image builds die on an M1',
    summary: 'The exec format error you get building multi-arch without buildx, plus the QEMU emulation setup that fixes it.',
    originalCaseId: 98, visibility: 'UNLISTED', sourceState: 'LIVE', status: 'LIVE',
    sourceStale: false, version: 1, viewCount: 412, downloadCount: 8,
    stepCount: 4, solutionCount: 1, tags: ['docker', 'm1'],
    publishedAt: '2026-07-02T14:05:00', updatedAt: '2026-07-02T14:05:00',
  },
  {
    slug: 'coroutine-cancellation', title: 'Coroutine cancellation that never propagated',
    summary: null,
    originalCaseId: 77, visibility: 'PUBLIC', sourceState: 'SOURCE_DELETED', status: 'UNPUBLISHED',
    sourceStale: null, version: 1, viewCount: 96, downloadCount: 0,
    stepCount: 3, solutionCount: 0, tags: ['kotlin', 'coroutine'],
    publishedAt: '2026-06-19T08:40:00', updatedAt: '2026-06-25T11:00:00',
  },
  {
    slug: 'vite-hmr-stuck', title: 'Vite HMR going quiet with no error',
    summary: 'A symlinked local package sat outside the watcher. How to reproduce it and how to confirm the cause.',
    originalCaseId: 63, visibility: 'PUBLIC', sourceState: 'LIVE', status: 'LIVE',
    sourceStale: false, version: 1, viewCount: 2310, downloadCount: 64,
    stepCount: 5, solutionCount: 2, tags: ['vite', 'hmr'],
    publishedAt: '2026-05-11T19:30:00', updatedAt: '2026-05-11T19:30:00',
  },
  {
    slug: 'postgres-ddl-auto-check', title: 'ddl-auto=update never updates a CHECK constraint',
    summary: 'Added a new enum value and watched every event land in the DLQ instead.',
    originalCaseId: 51, visibility: 'PUBLIC', sourceState: 'LIVE', status: 'LIVE',
    sourceStale: false, version: 3, viewCount: 874, downloadCount: 21,
    stepCount: 6, solutionCount: 1, tags: ['postgres', 'hibernate'],
    publishedAt: '2026-04-28T09:15:00', updatedAt: '2026-06-01T09:15:00',
  },
  {
    slug: 'sse-behind-cloudflare', title: 'SSE dropping behind the Cloudflare proxy',
    summary: 'Long-lived connections do not ride the proxy well — routing them to a DNS-only host instead.',
    originalCaseId: 44, visibility: 'UNLISTED', sourceState: 'LIVE', status: 'LIVE',
    sourceStale: false, version: 1, viewCount: 158, downloadCount: 3,
    stepCount: 4, solutionCount: 1, tags: ['sse', 'cloudflare'],
    publishedAt: '2026-03-09T16:45:00', updatedAt: '2026-03-09T16:45:00',
  },
]


// In-app notifications — mutable so read / read-all reflect.
const mockNotifications: Array<{
  id: number; type: string; actorUserId: number | null
  payload: Record<string, unknown>; deepLink: string | null
  readAt: string | null; createdAt: string
}> = [
  { id: 3, type: 'MENTION_IN_COMMENT', actorUserId: 2, payload: { snippet: 'broker restart 시나리오로 검증이 필요할 것 같아요. 어떻게 생각하세요?', errorCaseId: 1, commentId: 101 }, deepLink: '/error-cases/1#comment-101', readAt: null, createdAt: isoAgo(18 * 60 * 1000) },
  { id: 2, type: 'NEW_FOLLOWER', actorUserId: 3, payload: { followerId: 3, followerName: 'Lee Dev' }, deepLink: '/users/3', readAt: null, createdAt: isoAgo(3 * HOUR) },
  { id: 1, type: 'COMMENT_ON_ERROR_CASE', actorUserId: 4, payload: { snippet: '저도 같은 이슈 겪고 있어요. 환경 정보 공유 가능할까요?', errorCaseId: 1, commentId: 90 }, deepLink: '/error-cases/1#comment-90', readAt: isoAgo(20 * HOUR), createdAt: isoAgo(1 * DAY) },
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

  http.put('/api/v1/users/:id/follow', ({ params }) => {
    const id = Number(params.id)
    const changed = !followingSet.has(id)
    followingSet.add(id)
    return HttpResponse.json({ followerId: 1, followeeId: id, following: true, changed })
  }),

  http.delete('/api/v1/users/:id/follow', ({ params }) => {
    const id = Number(params.id)
    const changed = followingSet.delete(id)
    return HttpResponse.json({ followerId: 1, followeeId: id, following: false, changed })
  }),

  // ── Insight Home (ERR-33) ──
  http.get('/api/v1/users/me/recent-activities', () => {
    return HttpResponse.json({ items: recentActivities, windowDays: 7, summary: { byType: activityByType } })
  }),

  http.get('/api/v1/users/me/kpis', () => {
    return HttpResponse.json({
      errorsRaised: { total: 47, weeklyDelta: 3 },
      resolved: { total: 32, weeklyDelta: 2 },
      stepsAdded: { total: 128, weeklyDelta: 9 },
      solutions: { total: 21, weeklyDelta: 1 },
      published: { total: 8, weeklyDelta: 1 },
      resolutionRate: 0.68,
      publishRate: 0.25,
    })
  }),

  http.get('/api/v1/users/me/watchlist', () => {
    return HttpResponse.json(mockErrors.filter((e) => watchlistSet.has(e.id)).map(withAuthor))
  }),

  http.get('/api/v1/users/me/watchlist-feed', () => {
    const items = watchlistFeedAll
      .filter((f) => watchlistSet.has(f.id))
      .slice()
      .sort((a, b) =>
        ((b.unreadActivityCount > 0 ? 1 : 0) - (a.unreadActivityCount > 0 ? 1 : 0))
        || (new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()))
    return HttpResponse.json({ items })
  }),

  http.get('/api/v1/users/me/recent-active-cases', () => {
    return HttpResponse.json({ items: recentActiveCasesMock })
  }),

  http.get('/api/v1/users/me/following-feed', () => {
    // No follows → empty feed; the FE then shows suggested followees.
    const items = followingSet.size > 0 ? followingFeedMock : []
    return HttpResponse.json({ items })
  }),

  http.get('/api/v1/users/me/suggested-followees', () => {
    const items = suggestedFolloweesMock.filter((s) => !followingSet.has(s.userId))
    return HttpResponse.json({ items })
  }),

  http.post('/api/v1/error-cases/:id/watchlist', ({ params }) => {
    watchlistSet.add(Number(params.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('/api/v1/error-cases/:id/watchlist', ({ params }) => {
    watchlistSet.delete(Number(params.id))
    return new HttpResponse(null, { status: 204 })
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
  // Library > Published. 커서 페이징을 실제로 돌려보려고 페이지 크기를 4로 잘라 둔다.
  http.get('/api/v1/publishments/me', ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const visibility = url.searchParams.get('visibility')
    const sort = url.searchParams.get('sort') ?? 'published'
    const cursor = Number(url.searchParams.get('cursor') ?? 0)

    let rows = mockPublishments.filter(p =>
      (!q || p.title.toLowerCase().includes(q)) &&
      (!visibility || p.visibility === visibility),
    )
    rows = [...rows].sort((a, b) => sort === 'views'
      ? b.viewCount - a.viewCount
      : b.publishedAt.localeCompare(a.publishedAt))

    const PAGE = 4
    const page = rows.slice(cursor, cursor + PAGE)
    const end = cursor + PAGE
    const base = 'http://localhost:5173'
    return HttpResponse.json({
      items: page.map(p => ({
        ...p,
        publicUrl: `${base}/p/${p.slug}`,
        markdownUrl: `${base}/api/v1/publishments/by-slug/${p.slug}/export.md`,
        pdfUrl: `${base}/api/v1/publishments/by-slug/${p.slug}/export.pdf`,
      })),
      nextCursor: end < rows.length ? String(end) : null,
      hasNext: end < rows.length,
      // BE 와 같게 — 첫 페이지에서만 채운다.
      totalCount: cursor === 0 ? rows.length : null,
    })
  }),

  // 게스트 사용 가이드 대상 — core-api GET /demo/guide
  http.get('/api/v1/demo/guide', () => {
    return HttpResponse.json({ caseId: 4, articleSlug: 'demo-hikaricp-503' })
  }),

  http.get('/api/v1/workspaces', () => {
    return HttpResponse.json(mockWorkspaces)
  }),

  http.post('/api/v1/workspaces', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const slug = String(body.slug || '')
    // iam-api returns 409 on duplicate slug (unique constraint).
    if (mockWorkspaces.some(w => w.slug === slug)) {
      return HttpResponse.json({ message: 'slug already exists' }, { status: 409 })
    }
    const workspaceId = nextWorkspaceId++
    // Persist so the new workspace appears in the switcher and is reachable by slug.
    mockWorkspaces.push({ workspaceId, name: String(body.name), role: 'ADMIN', createdByUserId: 1, slug })
    // Create takes only { name, slug }; timezone/notifications default and are set later via PATCH.
    return HttpResponse.json({
      workspaceId,
      name: body.name,
      slug,
      createdByUserId: 1,
      notificationEnabled: true,
      defaultTimezone: 'Asia/Seoul',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewerRole: 'ADMIN',
    }, { status: 201 })
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

  // Insights — activity grass (insight-api). `me` must precede the `:userId` variant.
  http.get('/api/v1/users/me/activity-grass', () => HttpResponse.json(buildGrass())),
  http.get('/api/v1/users/:userId/activity-grass', () => HttpResponse.json(buildGrass())),

  // Notifications (noti-api). SSE stream (/stream) isn't mockable via MSW — offline shows inbox only.
  http.get('/api/v1/users/me/notifications', ({ request }) => {
    const unreadOnly = new URL(request.url).searchParams.get('unreadOnly') === 'true'
    return HttpResponse.json(unreadOnly ? mockNotifications.filter(n => !n.readAt) : mockNotifications)
  }),

  http.get('/api/v1/users/me/notifications/unread-count', () => {
    return HttpResponse.json({ count: mockNotifications.filter(n => !n.readAt).length })
  }),

  http.post('/api/v1/users/me/notifications/:id/read', ({ params }) => {
    const n = mockNotifications.find(x => x.id === Number(params.id))
    if (n && !n.readAt) n.readAt = new Date().toISOString()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/users/me/notifications/read-all', () => {
    mockNotifications.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString() })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/v1/auth/sse-ticket', () => {
    return HttpResponse.json({ ticket: 'mock-sse-ticket', expiresAt: new Date(Date.now() + 30000).toISOString() })
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

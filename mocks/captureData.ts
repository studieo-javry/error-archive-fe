// 오프라인 데모(VITE_OFFLINE_MODE)용 Agent Capture 샘플 데이터 + 시나리오 상태.
// 실제 앱 소스가 아니라 mocks/ 전용 — 배포 번들에 포함되지 않는다. handlers.ts 가 읽는다.
import type {
  AgentConnection,
} from '@/types/agentConnection'
import type {
  CaptureArtifact,
  CaptureAttempt,
  CaptureDetail,
  CaptureSolution,
  Capture,
} from '@/types/capture'
import type { ProjectBinding } from '@/types/projectBinding'

// 네 디자인 목업의 시나리오 스위처와 동일한 체계. 플로팅 패널이 localStorage 에 쓰고 핸들러가 읽는다.
export type DemoScenario =
  | 'normal' | 'first' | 'empty' | 'error' | 'loading'
  | 'revision' | 'duplicate' | 'network' | 'notfound' | 'restoreOpen'

export function getScenario(): DemoScenario {
  try {
    return (localStorage.getItem('cap-demo-scenario') as DemoScenario) || 'normal'
  } catch {
    return 'normal'
  }
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function attempt(
  id: string, order: number, result: CaptureAttempt['result'], type: string,
  detail: CaptureAttempt['detail'],
): CaptureAttempt {
  return { clientAttemptId: id, orderIndex: order, result, attemptType: type, detail, createdAt: '2026-11-14T15:00:00Z', updatedAt: '2026-11-14T15:00:00Z' }
}
function artifact(id: string, fileName: string, contentType: string, sizeBytes: number, sha: string): CaptureArtifact {
  return { clientArtifactId: id, fileName, contentType, sizeBytes, sha256: sha, status: 'COMPLETED', createdAt: '2026-11-14T15:00:00Z' }
}

type Stored = CaptureDetail & { caseId?: number | null }

// ── 샘플 초안 ────────────────────────────────────────────────────────────────
function paymentCapture(): Stored {
  const artifacts = [
    artifact('test-log', 'callback-concurrency.log', 'text/plain', 18432, 'a71f043a0d97bd41182eb0fa58b14381ca1f043a0d97bd41182eb0fa58b14381c'),
    artifact('result-image', 'test-result.png', 'image/png', 184320, 'b29e481e6c9f45acb481e6c9f45acb481b29e481e6c9f45acb481e6c9f45acb481'),
  ]
  const attempts: CaptureAttempt[] = [
    attempt('attempt-1', 0, 'FAILED', 'INVESTIGATION', {
      title: '애플리케이션의 중복 조회 조건을 추가했다',
      hypothesis: '처리 전에 기존 승인 여부를 조회하면 중복을 막을 수 있다.',
      action: '동일 paymentKey 조회 조건을 추가하고 동시 요청 테스트를 실행했다.',
      insight: '조회와 저장 사이에 다른 요청이 진입해 중복 처리가 여전히 발생했다.',
      nextStep: 'DB 제약으로 중복 승인을 최종 차단한다.', evidenceRefs: ['test-log'],
    }),
    attempt('attempt-2', 1, 'SUCCEEDED', 'CODE_CHANGE', {
      title: '고유 제약과 조건부 갱신으로 중복 반영을 차단했다',
      hypothesis: 'DB에서 중복 요청을 한 번만 반영하도록 보장한다.',
      action: 'paymentKey 고유 제약과 상태 조건부 UPDATE를 적용했다.',
      insight: '최종 상태 변경 시점에 조건을 검사해 경합 구간을 줄였다.',
      nextStep: '중복 요청 회귀 테스트를 실행한다.', evidenceRefs: ['test-log', 'result-image'],
    }),
    attempt('attempt-3', 2, 'SUCCEEDED', 'OTHER', {
      title: '동시 콜백 20건으로 회귀 테스트를 실행했다',
      hypothesis: null,
      action: 'PaymentCallbackTest를 실행해 반영 1회, 중복 처리 19회를 확인했다.',
      insight: '테스트 범위에서는 중복 반영이 재발하지 않았다.',
      nextStep: '스테이징 환경에서 콜백 재전송을 확인한다.', evidenceRefs: ['result-image'],
    }),
  ]
  const solutions: CaptureSolution[] = [
    {
      clientSolutionId: 'solution-1', title: 'DB 제약과 멱등 상태 전이로 콜백 중복 처리 방지',
      createdAt: '2026-11-14T15:00:00Z',
      content: {
        description: '승인 결과를 한 번만 저장하고, 동일 요청이 다시 오면 기존 처리 결과를 반환한다. 애플리케이션 사전 조회는 보조 수단으로 유지한다.',
        clientAttemptIds: ['attempt-2', 'attempt-3'],
        verification: {
          result: 'PASSED', scope: 'LOCAL', command: './gradlew :core-api:test --tests PaymentCallbackTest',
          testId: 'PaymentCallbackTest.concurrentCallback', executed: true, ranAt: '2026-11-14T15:28:00Z',
          commitSha: '9a31c6e', evidence: '동시 요청 20건 중 승인 반영 1건 · 회귀 테스트 통과',
        },
      },
    },
  ]
  return {
    capture: {
      captureUuid: uuid(1), status: 'READY_FOR_REVIEW', revision: 7, title: '결제 승인 콜백이 중복 처리되는 문제',
      project: 'error-archive', projectBindingId: 1,
      content: {
        symptom: '동일 paymentKey로 동시에 도착한 콜백이 승인 결과를 두 번 반영했다.',
        observedFacts: ['동일 요청을 동시에 처리할 때 기대한 결과와 실제 데이터가 달랐다.', '로컬 재현 테스트에서 동일한 현상을 확인했다.'],
        hypotheses: ['조회 후 저장 사이의 경쟁 조건이 원인일 수 있다.'],
        reproduction: { steps: ['동일한 식별자로 요청 20개를 동시에 실행한다.', '처리 결과와 저장된 행 수를 비교한다.'], executed: true },
        environment: { service: 'core-api', branch: 'fix/callback-idempotency', commitSha: '9a31c6e', dirtyWorktree: true, diffRef: null },
        unknowns: ['스테이징에서 실제 외부 콜백 재전송 조건은 확인하지 못했다.'],
      },
      createdAt: '2026-11-14T15:30:00Z', updatedAt: '2026-11-14T15:30:00Z', completedAt: '2026-11-14T15:30:00Z',
    },
    attempts, solutions, artifacts,
  }
}

function redisCapture(): Stored {
  return {
    capture: {
      captureUuid: uuid(2), status: 'READY_FOR_REVIEW', revision: 4, title: 'Redis 연결 종료 후 알림 발행이 누락됨',
      project: 'notification-api', projectBindingId: 2,
      content: {
        symptom: 'Redis 재연결 구간에서 일부 알림 이벤트의 발행이 누락됐다.',
        observedFacts: ['재연결 로그 직후 특정 알림의 전송 결과가 남아 있지 않았다.'],
        hypotheses: ['재연결 중 발행 요청이 유실되었을 가능성이 있다.'],
        reproduction: { steps: ['테스트 환경에서 연결 단절을 재현한다.'], executed: false },
        environment: { service: 'notification-api', branch: 'investigate/redis-reconnect', commitSha: null, dirtyWorktree: false, diffRef: null },
        unknowns: ['유실이 발생하는 정확한 시점과 영향 범위'],
      },
      createdAt: '2026-11-14T10:10:00Z', updatedAt: '2026-11-14T10:10:00Z', completedAt: '2026-11-14T10:10:00Z',
    },
    attempts: [
      attempt('attempt-r1', 0, 'INCONCLUSIVE', 'INVESTIGATION', {
        title: '재연결 시점의 발행 로그를 비교했다',
        hypothesis: '연결 상태 확인과 실제 전송 사이에 연결이 끊길 수 있다.',
        action: '로그 타임스탬프와 재연결 이벤트를 비교했다.',
        insight: '원인을 확정하기 위한 추가 재현이 필요하다.',
        nextStep: '테스트 환경에서 연결 단절을 재현한다.', evidenceRefs: [],
      }),
    ],
    solutions: [], artifacts: [],
  }
}

function mobileCapture(): Stored {
  return {
    capture: {
      captureUuid: uuid(3), status: 'READY_FOR_REVIEW', revision: 3, title: '모바일에서 코드 블록이 화면 밖으로 넘침',
      project: 'error-archive', projectBindingId: 1,
      content: {
        symptom: '긴 에러 로그를 표시하면 상세 화면에 가로 스크롤이 발생했다.',
        observedFacts: ['375px 뷰포트에서 긴 코드 줄이 페이지 폭을 확장했다.'],
        hypotheses: ['flex 항목의 기본 min-width가 원인이다.'],
        reproduction: { steps: ['375px 너비에서 에러 상세 페이지를 연다.', '공백 없는 긴 코드 줄을 확인한다.'], executed: true },
        environment: { service: 'error-archive-fe', branch: 'fix/code-overflow', commitSha: '72ae81b', dirtyWorktree: false, diffRef: null },
        unknowns: ['Safari 실기기 확인'],
      },
      createdAt: '2026-11-13T07:00:00Z', updatedAt: '2026-11-13T07:00:00Z', completedAt: '2026-11-13T07:00:00Z',
    },
    attempts: [
      attempt('attempt-ui1', 0, 'SUCCEEDED', 'CODE_CHANGE', {
        title: '코드 영역의 최소 너비와 내부 스크롤을 조정했다',
        hypothesis: 'flex 자식의 min-width가 콘텐츠 너비를 유지한다.',
        action: 'min-width: 0과 코드 블록 overflow-x: auto를 적용했다.',
        insight: '페이지 너비를 유지하며 코드 블록 안에서만 스크롤된다.',
        nextStep: '실기기에서 추가 확인한다.', evidenceRefs: ['result-image'],
      }),
    ],
    solutions: [
      {
        clientSolutionId: 'solution-ui1', title: '코드 블록 내부에서만 가로 스크롤', createdAt: '2026-11-13T07:00:00Z',
        content: {
          description: '부모 flex 항목의 최소 너비를 줄여 긴 로그가 레이아웃을 밀어내지 않도록 수정했다.',
          clientAttemptIds: ['attempt-ui1'],
          verification: { result: 'PASSED', scope: 'MANUAL', command: null, testId: null, executed: true, ranAt: null, commitSha: null, evidence: '375px 뷰포트에서 페이지 가로 넘침이 없음을 확인했다.' },
        },
      },
    ],
    artifacts: [artifact('result-image', 'test-result.png', 'image/png', 184320, 'b29e481e6c9f45acb481e6c9f45acb481b29e481e6c9f45acb481e6c9f45acb481')],
  }
}

function outboxImported(): Stored {
  return {
    caseId: 842,
    capture: {
      captureUuid: uuid(4), status: 'IMPORTED', revision: 9, title: 'Outbox 이벤트 재발행 시 순서 불일치',
      project: 'error-archive', projectBindingId: 1,
      content: {
        symptom: '재처리 시 이벤트의 순서가 바뀌는 조건을 확인했다.',
        observedFacts: ['재시도 구간에서 후속 이벤트가 먼저 처리되는 상황을 재현했다.'],
        hypotheses: ['재발행 범위와 순서 기준이 일치하지 않았다.'],
        reproduction: { steps: ['특정 이벤트 발행을 실패시킨다.', '재발행 이후의 처리 순서를 확인한다.'], executed: true },
        environment: { service: 'core-api', branch: 'fix/outbox-retry', commitSha: null, dirtyWorktree: false, diffRef: null },
        unknowns: [],
      },
      createdAt: '2026-11-10T06:00:00Z', updatedAt: '2026-11-10T06:00:00Z', completedAt: '2026-11-10T06:00:00Z',
    },
    attempts: [
      attempt('attempt-o1', 0, 'SUCCEEDED', 'CODE_CHANGE', {
        title: '재발행 범위와 순서 기준을 고정했다',
        hypothesis: '실패 시 재시도 범위에 따라 이벤트 순서가 바뀔 수 있다.',
        action: '동일 집계 키의 발행 순서와 실패 재시도 범위를 확인하고 조정했다.',
        insight: '장애 복구에서도 같은 순서 기준을 유지해야 한다.',
        nextStep: '운영 지표로 지연을 확인한다.', evidenceRefs: [],
      }),
    ],
    solutions: [], artifacts: [],
  }
}

function depsDiscarded(): Stored {
  return {
    capture: {
      captureUuid: uuid(5), status: 'DISCARDED', revision: 2, title: '일시적인 네트워크 오류로 의존성 다운로드 실패',
      project: 'error-archive', projectBindingId: 1,
      content: {
        symptom: '재시도 후 정상 복구되어 별도 Case로 남기지 않았다.',
        observedFacts: ['재시도 후 정상 복구되어 별도 Case로 남기지 않았다.'],
        hypotheses: [], reproduction: { steps: [], executed: false },
        environment: { service: 'error-archive' }, unknowns: [],
      },
      createdAt: '2026-11-09T03:00:00Z', updatedAt: '2026-11-09T03:00:00Z', completedAt: '2026-11-09T03:00:00Z',
    },
    attempts: [], solutions: [], artifacts: [],
  }
}

// restoreOpen 시나리오용 — 봉인 전 폐기(복원 시 OPEN 으로).
function configDiscardedOpen(): Stored {
  return {
    capture: {
      captureUuid: uuid(6), status: 'DISCARDED', revision: 1, title: '테스트 환경 설정 확인 중 중단된 기록',
      project: 'notification-api', projectBindingId: 2,
      content: {
        symptom: '설정을 조사하던 중 작업을 중단했다.', observedFacts: ['설정을 조사하던 중 작업을 중단했다.'],
        hypotheses: [], reproduction: { steps: [], executed: false }, environment: { service: 'notification-api' }, unknowns: [],
      },
      createdAt: '2026-11-08T03:00:00Z', updatedAt: '2026-11-08T03:00:00Z', completedAt: null,
    },
    attempts: [], solutions: [], artifacts: [],
  }
}

// ── 가변 상태(요청 사이 유지) ──────────────────────────────────────────────
export const captureStore: Stored[] = [
  paymentCapture(), redisCapture(), mobileCapture(), outboxImported(), depsDiscarded(), configDiscardedOpen(),
]

export function resetCaptureStore() {
  captureStore.splice(0, captureStore.length, paymentCapture(), redisCapture(), mobileCapture(), outboxImported(), depsDiscarded(), configDiscardedOpen())
  nextCaseId.value = 845
}
export const nextCaseId = { value: 845 }

export function queueCaptures(): Capture[] {
  return captureStore.filter((c) => c.capture.status === 'READY_FOR_REVIEW').map((c) => c.capture)
}
export function historyCaptures() {
  return captureStore
    .filter((c) => c.capture.status === 'IMPORTED' || c.capture.status === 'DISCARDED')
    .map((c) => ({
      captureUuid: c.capture.captureUuid, status: c.capture.status, title: c.capture.title,
      project: c.capture.project, caseId: c.caseId ?? null, createdAt: c.capture.createdAt, updatedAt: c.capture.updatedAt,
    }))
}
export function findCapture(id: string): Stored | undefined {
  return captureStore.find((c) => c.capture.captureUuid === id)
}

export const connectionStore: AgentConnection[] = [
  {
    connectionId: '11111111-1111-4111-8111-111111111111', label: 'MacBook · 개발용', displayName: 'MacBook · 개발용',
    clientKind: 'claude-code', clientVersion: '1.11.0', installLabel: 'Jiin-MacBook',
    scopes: ['artifact:write', 'capture:read', 'capture:write', 'case:read'],
    createdAt: '2026-11-12T00:00:00Z', lastUsedAt: '2026-11-15T00:28:00Z', expiresAt: '2026-12-12T00:00:00Z', expired: false,
  },
  {
    connectionId: '22222222-2222-4222-8222-222222222222', label: '이전 테스트 환경', displayName: '이전 테스트 환경',
    clientKind: null, clientVersion: null, installLabel: null,
    scopes: ['artifact:write', 'capture:read', 'capture:write'],
    createdAt: '2026-10-12T00:00:00Z', lastUsedAt: null, expiresAt: '2026-11-11T00:00:00Z', expired: true,
  },
]

export const projectStore: ProjectBinding[] = [
  { id: 1, projectKey: 'error-archive', normalizedRepoId: 'github.com/studieo-javry/error-archive', storagePolicy: 'DEFAULT', createdAt: '2026-11-12T00:00:00Z' },
  { id: 2, projectKey: 'notification-api', normalizedRepoId: null, storagePolicy: 'DEFAULT', createdAt: '2026-11-13T00:00:00Z' },
]

// core-api agentcapture 검토 경로(/api/v1/captures) — AgentCaptureDtos.kt / 도메인 VO 와 1:1.
// 세션 사용자 전용(본인 소유 초안만). 에이전트 토큰 경로와 분리.

/** AgentCapture 상태. */
export type CaptureStatus = 'OPEN' | 'READY_FOR_REVIEW' | 'IMPORTED' | 'DISCARDED'

/** Attempt 원본 결과(상위 컬럼). */
export type AttemptResult = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'INCONCLUSIVE'

/** 검증 결과. PASSED 확정에는 실제 실행 근거가 필요(executed=false 인데 PASSED 면 422). */
export type VerificationResult = 'NOT_RUN' | 'PASSED' | 'FAILED' | 'INCONCLUSIVE'

/** 검증 범위. */
export type VerificationScope = 'LOCAL' | 'CI' | 'MANUAL'

/** 반영 시 Step 최종 상태(정정 가능). AttemptResult 에서 기본 파생. */
export type StepStatus = 'RESOLVED' | 'IN_PROGRESS' | 'FAILED'

/** 근거 첨부 상태. */
export type ArtifactStatus = 'RESERVED' | 'COMPLETED' | 'LINKED'

/** 제안한 재현 절차 + 실제 실행 여부. */
export interface Reproduction {
  steps: string[]
  /** 제안만 했는지(false) / 실제 재현을 실행했는지(true). */
  executed: boolean
}

/** 관측 가능한 실행 환경. */
export interface CaptureEnvironment {
  service?: string | null
  branch?: string | null
  commitSha?: string | null
  dirtyWorktree?: boolean | null
  /** 변경 diff 의 식별자(내용 자체가 아닌 참조). */
  diffRef?: string | null
}

/** 초안 서사(사실·가설·판단 분리). 하나의 jsonb 블롭. */
export interface CaptureContent {
  symptom?: string | null
  observedFacts: string[]
  hypotheses: string[]
  reproduction?: Reproduction | null
  environment?: CaptureEnvironment | null
  unknowns: string[]
}

/** Attempt 서사(결과·순서·clientId 는 상위). */
export interface AttemptDetail {
  title: string
  hypothesis?: string | null
  /** 실제 수행한 내용. */
  action?: string | null
  /** 이 시도에서 얻은 판단. */
  insight?: string | null
  nextStep?: string | null
  /** 근거(첨부) 참조(clientArtifactId). */
  evidenceRefs: string[]
}

/** 검증 근거. */
export interface Verification {
  result: VerificationResult
  scope?: VerificationScope | null
  command?: string | null
  testId?: string | null
  executed: boolean
  ranAt?: string | null
  commitSha?: string | null
  evidence?: string | null
}

/** Solution 후보 서사(clientSolutionId·title 은 상위). */
export interface SolutionContent {
  description?: string | null
  /** 해결에 기여한 Attempt(clientAttemptId). 최소 1개 존재 Attempt 를 가리켜야 함. */
  clientAttemptIds: string[]
  verification?: Verification | null
}

/** 초안 요약(revision 포함 — 편집/반영의 expectedRevision·reviewedRevision 에 사용). CaptureResponse. */
export interface Capture {
  captureUuid: string
  status: CaptureStatus
  revision: number
  title?: string | null
  project?: string | null
  /** 귀속된 ProjectBinding id(세션 상속/명시, 미귀속 null). 이름은 project-bindings 로 매핑. */
  projectBindingId?: number | null
  content: CaptureContent
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

/** Attempt. AttemptResponse. */
export interface CaptureAttempt {
  clientAttemptId: string
  orderIndex: number
  result: AttemptResult
  attemptType?: string | null
  detail: AttemptDetail
  createdAt: string
  updatedAt: string
}

/** Solution 후보. SolutionResponse. */
export interface CaptureSolution {
  clientSolutionId: string
  title: string
  content: SolutionContent
  createdAt: string
}

/** 근거 첨부 메타. ArtifactResponse. 현재 검토 API 는 메타만 제공(내용 미리보기/다운로드 없음). */
export interface CaptureArtifact {
  clientArtifactId: string
  sha256: string
  contentType: string
  sizeBytes: number
  fileName?: string | null
  status: ArtifactStatus
  createdAt: string
}

/** 초안 상세. CaptureDetailResponse. */
export interface CaptureDetail {
  capture: Capture
  attempts: CaptureAttempt[]
  solutions: CaptureSolution[]
  artifacts: CaptureArtifact[]
}

/** 검토 큐(cursor 페이지). ReviewQueueResponse. */
export interface ReviewQueuePage {
  items: Capture[]
  nextCursor?: string | null
  hasNext: boolean
}

/** 검토 이력 항목. CaptureHistoryItemResponse. IMPORTED 면 caseId 로 반영 Case 지시. */
export interface CaptureHistoryItem {
  captureUuid: string
  status: CaptureStatus
  title?: string | null
  project?: string | null
  /** 반영된 ErrorCase id. IMPORTED 만 값, DISCARDED 는 null. */
  caseId?: number | null
  createdAt: string
  updatedAt: string
}

/** 검토 이력(cursor 페이지). CaptureHistoryResponse. */
export interface CaptureHistoryPage {
  items: CaptureHistoryItem[]
  nextCursor?: string | null
  hasNext: boolean
}

/** 자동기록 계측(퍼널). CaptureMetricsResponse. reviewed=0 이면 두 비율 null. */
export interface CaptureMetrics {
  windowDays: number
  since: string
  created: number
  open: number
  readyForReview: number
  imported: number
  discarded: number
  reviewed: number
  /** 폐기/검토완료(오생성 지표). */
  discardRate?: number | null
  /** 반영/검토완료. */
  adoptionRate?: number | null
}

/** 검토 중 Step 수정. null 필드는 캡처 원본 유지, body 빈 문자열이면 본문 없음. StepEditRequest. */
export interface StepEditRequest {
  title?: string | null
  body?: string | null
  /** 최종 Step 상태 정정. null 이면 Attempt 결과서 파생된 기본값. */
  status?: StepStatus | null
}

/** 검토 중 Solution 수정. SolutionEditRequest. */
export interface SolutionEditRequest {
  title?: string | null
  description?: string | null
  /** 검증 정보 정정(통째 교체). executed=false 인데 PASSED 면 422. clearVerification=true 면 무시. */
  verification?: Verification | null
  /** AI 검증 정보를 신뢰할 수 없을 때 — 검증 정보 제외(null)하고 반영. verification 보다 우선. */
  clearVerification?: boolean
}

/** 검토 확정 반영 요청. 승인된 항목만 반영. ImportCaptureRequest. */
export interface ImportCaptureRequest {
  /** 검토한 초안 revision. 현재 revision 과 다르면 409 REVISION_CONFLICT. */
  reviewedRevision: number
  /** 반영할 Attempt — 지정 순서가 Step 순서. */
  selectedAttemptIds: string[]
  selectedSolutionIds: string[]
  /** 반영할 근거 — 명시 선택 집합(FE 는 선택 Attempt 의 evidenceRefs 기본 포함). */
  selectedArtifactIds: string[]
  /** 사용자가 명시적으로 해결 표시(기본 false). */
  markResolved: boolean
  editedTitle?: string | null
  /** 빈 문자열이면 본문 없음. */
  editedDescription?: string | null
  /** key=clientAttemptId(반드시 selectedAttemptIds 안, 아니면 422). */
  stepEdits?: Record<string, StepEditRequest>
  /** key=clientSolutionId(반드시 selectedSolutionIds 안, 아니면 422). */
  solutionEdits?: Record<string, SolutionEditRequest>
  note?: string | null
  /** 귀속시킬 ProjectBinding id. 미지정 시 capture 프로젝트 상속. */
  projectBindingId?: number | null
  /** 명시적 프로젝트 해제. projectBindingId 보다 우선. */
  clearProjectBinding?: boolean
}

/** 반영 결과. ImportCaptureResponse. alreadyImported 는 멱등 재요청. */
export interface ImportCaptureResult {
  captureUuid: string
  caseId: number
  alreadyImported: boolean
}

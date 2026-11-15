import { computed, reactive, ref, type Ref } from 'vue'
import type {
  CaptureAttempt,
  CaptureContent,
  CaptureDetail,
  CaptureSolution,
  ImportCaptureRequest,
  StepStatus,
  Verification,
} from '@/types/capture'

// 검토 드래프트 모델 — 수집 원본은 서버에 그대로 두고, 사용자의 "무엇을/어떻게 반영할지" 선택·정정을
// 클라이언트에서만 보관하다 Import 시점에 payload 로 직렬화한다(서버 draft 저장 계약은 아직 없음).

/** AttemptResult → 기본 Step 상태. */
export function statusOf(result: CaptureAttempt['result']): StepStatus {
  if (result === 'SUCCEEDED') return 'RESOLVED'
  if (result === 'FAILED') return 'FAILED'
  return 'IN_PROGRESS'
}

/** 초안 서사(content)를 Case 본문 마크다운으로 렌더. editedDescription 변경 감지의 기준값이기도 하다. */
export function defaultBody(content: CaptureContent): string {
  const parts: string[] = []
  if (content.symptom) parts.push(`## 증상\n${content.symptom}`)
  if (content.observedFacts.length) parts.push(`## 관측된 사실\n${content.observedFacts.map((v) => `- ${v}`).join('\n')}`)
  if (content.hypotheses.length) parts.push(`## 가설\n${content.hypotheses.map((v) => `- ${v}`).join('\n')}`)
  if (content.reproduction?.steps.length) {
    const tag = content.reproduction.executed ? '실행 확인됨' : '제안, 미실행'
    parts.push(`## 재현 절차 (${tag})\n${content.reproduction.steps.map((v) => `- ${v}`).join('\n')}`)
  }
  if (content.environment) {
    const lines = Object.entries(content.environment)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `- ${k}: ${v}`)
    if (lines.length) parts.push(`## 환경\n${lines.join('\n')}`)
  }
  if (content.unknowns.length) parts.push(`## 아직 확인되지 않음\n${content.unknowns.map((v) => `- ${v}`).join('\n')}`)
  return parts.join('\n\n')
}

/** Attempt 의 가설·수행·다음단계를 Step 본문 마크다운으로 렌더(Insight 는 별도 표기). */
export function stepBody(attempt: CaptureAttempt): string {
  return (
    [
      ['가설', attempt.detail.hypothesis],
      ['수행', attempt.detail.action],
      ['다음 단계', attempt.detail.nextStep],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([label, v]) => `**${label}**\n${v}`)
    .join('\n\n')
}

export interface StepEditDraft {
  title?: string
  body?: string
  status?: StepStatus
}

export interface SolutionEditDraft {
  title?: string
  description?: string
  verification?: Verification
  clearVerification?: boolean
}

/** 반영 프로젝트 선택: 제안 유지 / 지정 안 함 / 특정 바인딩 id(문자열). */
export type ProjectChoice = 'inherit' | 'none' | string

export interface ReviewDraft {
  title: string
  body: string
  /** 선택된 attempt id(포함 여부). */
  attempts: string[]
  /** 표시·반영 순서(전체 attempt, 선택과 별개). */
  order: string[]
  solutions: string[]
  artifacts: string[]
  /** 사용자가 직접 토글한 artifact(자동 포함 로직이 덮어쓰지 않게). */
  artifactTouched: string[]
  stepEdits: Record<string, StepEditDraft>
  solutionEdits: Record<string, SolutionEditDraft>
  markResolved: boolean
  project: ProjectChoice
  revision: number
  dirty: boolean
}

function initDraft(detail: CaptureDetail): ReviewDraft {
  const { capture, attempts } = detail
  return {
    title: capture.title ?? '',
    body: defaultBody(capture.content),
    attempts: attempts.map((a) => a.clientAttemptId),
    order: attempts.map((a) => a.clientAttemptId),
    solutions: detail.solutions.map((s) => s.clientSolutionId),
    artifacts: [...new Set(attempts.flatMap((a) => a.detail.evidenceRefs))],
    artifactTouched: [],
    stepEdits: {},
    solutionEdits: {},
    markResolved: false,
    project: 'inherit',
    revision: capture.revision,
    dirty: false,
  }
}

/**
 * 검토 드래프트 상태 + 파생값. `detail` 이 바뀌면(다른 초안 로드/재로딩) draft 를 초기화한다.
 * revision 충돌 회복 시 `rebaseRevision` 으로 편집은 유지한 채 기준 revision 만 올린다.
 */
export function useCaptureReview(detail: Ref<CaptureDetail | null>) {
  const draft = reactive(
    detail.value ? initDraft(detail.value) : ({} as ReviewDraft),
  ) as ReviewDraft
  const seededUuid = ref<string | null>(detail.value?.capture.captureUuid ?? null)

  function reset(next: CaptureDetail) {
    Object.assign(draft, initDraft(next))
    seededUuid.value = next.capture.captureUuid
  }

  /** detail 교체 감지 — 다른 초안이면 draft 재초기화. 컴포넌트에서 watch 로 호출. */
  function syncWith(next: CaptureDetail | null) {
    if (next && next.capture.captureUuid !== seededUuid.value) reset(next)
  }

  const attemptById = computed(() => {
    const map = new Map<string, CaptureAttempt>()
    for (const a of detail.value?.attempts ?? []) map.set(a.clientAttemptId, a)
    return map
  })
  const solutionById = computed(() => {
    const map = new Map<string, CaptureSolution>()
    for (const s of detail.value?.solutions ?? []) map.set(s.clientSolutionId, s)
    return map
  })

  /** 선택된 attempt 를 순서대로. */
  const chosenAttempts = computed<CaptureAttempt[]>(() =>
    draft.order
      .filter((id) => draft.attempts.includes(id))
      .map((id) => attemptById.value.get(id))
      .filter((a): a is CaptureAttempt => a != null),
  )

  /** artifact → 처음 참조한 선택 attempt(배치 기준). */
  const assignments = computed<Record<string, string>>(() => {
    const assigned: Record<string, string> = {}
    for (const a of chosenAttempts.value) {
      for (const fid of a.detail.evidenceRefs) {
        if (draft.artifacts.includes(fid) && !assigned[fid]) assigned[fid] = a.clientAttemptId
      }
    }
    return assigned
  })

  /** 선택된 solution 의 최종 표시값(편집 반영). */
  function solutionValue(s: CaptureSolution) {
    const e = draft.solutionEdits[s.clientSolutionId] ?? {}
    return {
      title: e.title ?? s.title,
      description: e.description ?? s.content.description ?? '',
      verification: e.clearVerification ? null : (e.verification ?? s.content.verification ?? null),
    }
  }

  /** 반영 전 검증 룰(선택된 solution 기준). 비어있으면 반영 가능. */
  const errors = computed<string[]>(() => {
    const es: string[] = []
    if (!draft.title.trim()) es.push('Case 제목을 입력해 주세요.')
    for (const s of detail.value?.solutions ?? []) {
      if (!draft.solutions.includes(s.clientSolutionId)) continue
      if (!s.content.clientAttemptIds.some((id) => draft.attempts.includes(id))) {
        es.push(`“${s.title}”에 연결된 시도를 최소 1개 포함해 주세요.`)
      }
      const v = solutionValue(s).verification
      if (v?.result === 'PASSED' && !v.executed) es.push('통과로 표시한 검증의 실제 실행 여부를 확인해 주세요.')
      if (v?.result === 'PASSED' && ![v.command, v.testId, v.evidence].some((x) => String(x ?? '').trim())) {
        es.push('통과한 검증에 명령, 테스트 ID 또는 결과 근거를 입력해 주세요.')
      }
    }
    return es
  })

  /** Import payload — 변경된 것만 담는다(editedTitle/Description 은 원본과 다를 때만). */
  function payload(includeProject: boolean): ImportCaptureRequest {
    const capture = detail.value!.capture
    const p: ImportCaptureRequest = {
      reviewedRevision: draft.revision,
      selectedAttemptIds: chosenAttempts.value.map((a) => a.clientAttemptId),
      selectedSolutionIds: [...draft.solutions],
      selectedArtifactIds: [...draft.artifacts],
      markResolved: draft.markResolved,
    }
    if (draft.title !== (capture.title ?? '')) p.editedTitle = draft.title
    if (draft.body !== defaultBody(capture.content)) p.editedDescription = draft.body

    const stepEdits = Object.fromEntries(
      Object.entries(draft.stepEdits).filter(([id]) => draft.attempts.includes(id)),
    )
    if (Object.keys(stepEdits).length) p.stepEdits = stepEdits

    const solutionEdits = Object.fromEntries(
      Object.entries(draft.solutionEdits)
        .filter(([id]) => draft.solutions.includes(id))
        .map(([id, e]) => [
          id,
          {
            title: e.title,
            description: e.description,
            verification: e.verification,
            clearVerification: e.clearVerification ?? false,
          },
        ]),
    )
    if (Object.keys(solutionEdits).length) p.solutionEdits = solutionEdits

    if (includeProject) {
      if (draft.project === 'none') p.clearProjectBinding = true
      else if (draft.project !== 'inherit') p.projectBindingId = Number(draft.project)
    }
    return p
  }

  function rebaseRevision(revision: number) {
    draft.revision = revision
  }

  return {
    draft,
    attemptById,
    solutionById,
    chosenAttempts,
    assignments,
    errors,
    solutionValue,
    payload,
    reset,
    syncWith,
    rebaseRevision,
  }
}

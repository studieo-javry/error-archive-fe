import { defineStore } from 'pinia'
import { ref } from 'vue'

// paused = 진행 중에 접음(이어보기 가능), done = 완료 후 닫음.
export type TourStatus = 'idle' | 'active' | 'paused' | 'done'

/** 단계 안의 세부 진행(목업 reduceGuide 의 contextOpened / evidenceRead / solutionSelected). */
export interface TourFlags {
  contextOpened: boolean
  evidenceRead: boolean
  solutionSelected: boolean
}

const NO_FLAGS: TourFlags = { contextOpened: false, evidenceRead: false, solutionSelected: false }

// 게스트 가이드 투어 진행 상태. 새로고침에도 이어지도록 localStorage 에 보존.
const NS = 'tour.'
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    /* storage 접근 불가(프라이빗 모드 등)는 무시 — 투어는 비영속으로 동작 */
  }
}

export const useTourStore = defineStore('tour', () => {
  const status = ref<TourStatus>(load<TourStatus>('status', 'idle'))
  const step = ref<number>(load<number>('step', 0))
  const caseId = ref<number | null>(load<number | null>('caseId', null))
  const flags = ref<TourFlags>({ ...NO_FLAGS, ...load<Partial<TourFlags>>('flags', {}) })

  // 상세 페이지가 알려 주는 샘플 케이스의 솔루션(3단계 문구용). 비영속 — 페이지가 다시 채운다.
  const solutionTitle = ref<string | null>(null)
  const solutionStepCount = ref(0)
  // "솔루션 선택하기" 요청 신호. 상세 페이지가 감지해 첫 솔루션을 선택한다.
  const solutionRequest = ref(0)

  // ── 발행하기(04) 단계: 게스트가 미리보기로 보는 PublishSheet 진행 상태 ──
  // null = 시트 닫힘, -1 = 슬림 바, 0 = Steps, 1 = Details, 2 = Files, 3 = Options, 4 = Preview.
  // 비영속 — 시트는 열려 있는 동안만 의미가 있다. 상세 페이지(시트)가 채우고, 가이드 카드가 읽어 내레이션한다.
  const publishStage = ref<number | null>(null)
  // 가이드 카드 ↔ 상세 페이지 사이의 열기/닫기 요청 신호(solutionRequest 와 같은 방식).
  const publishOpenRequest = ref(0)
  const publishCloseRequest = ref(0)

  function setStatus(value: TourStatus) {
    status.value = value
    persist('status', value)
  }
  function setStep(value: number) {
    step.value = value
    persist('step', value)
  }
  function setCase(value: number | null) {
    caseId.value = value
    persist('caseId', value)
  }
  function setFlag(key: keyof TourFlags, value: boolean) {
    if (flags.value[key] === value) return
    flags.value = { ...flags.value, [key]: value }
    persist('flags', flags.value)
  }
  function resetFlags() {
    flags.value = { ...NO_FLAGS }
    persist('flags', flags.value)
  }
  /** 처음 상태로(새 게스트 세션·로그아웃·가입 전환 — 목업 restartSession 의 defaultGuide). */
  function reset() {
    setStatus('idle')
    setStep(0)
    setCase(null)
    resetFlags()
    publishStage.value = null
  }
  function setSolutionInfo(title: string | null, stepCount: number) {
    solutionTitle.value = title
    solutionStepCount.value = stepCount
  }
  function requestSolution() {
    solutionRequest.value++
  }
  function setPublishStage(value: number | null) {
    publishStage.value = value
  }
  function requestPublishOpen() {
    publishOpenRequest.value++
  }
  function requestPublishClose() {
    publishCloseRequest.value++
  }

  return {
    status, step, caseId, flags, solutionTitle, solutionStepCount, solutionRequest,
    publishStage, publishOpenRequest, publishCloseRequest,
    setStatus, setStep, setCase, setFlag, resetFlags, reset, setSolutionInfo, requestSolution,
    setPublishStage, requestPublishOpen, requestPublishClose,
  }
})

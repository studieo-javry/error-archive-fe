import { defineStore } from 'pinia'
import { ref } from 'vue'

export type TourStatus = 'idle' | 'active' | 'done'

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

  return { status, step, caseId, setStatus, setStep, setCase }
})

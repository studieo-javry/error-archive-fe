import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTourStore } from '@/stores/tourStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import { useErrorStore } from '@/stores/errorStore'
import { useTeamStore } from '@/stores/teamStore'

export interface TourStep {
  key: string
  title: string
  body: string
  /** 현재 라우트에서 강조할 요소 셀렉터. null = 강조 없음(완료 카드 등). */
  anchor: string | null
  /** 다음 버튼 라벨. */
  cta: string
}

/**
 * 게스트 가이드 투어 스텝. 실제 FE 화면에 앵커한다:
 *  0) 케이스 목록에서 샘플 케이스(= tour.caseId 의 ErrorCard) 강조 → 열기
 *  1) 케이스 상세의 Context 영역
 *  2) 케이스 상세의 Resolution Timeline(시도·해결)
 *  3) 완료 카드 — 가입 전환
 */
export const TOUR_STEPS: TourStep[] = [
  {
    key: 'case',
    title: '샘플 케이스로 시작해요',
    body: '먼저 에러 하나를 따라가 볼게요. 강조된 케이스를 열면 기록이 쌓이는 흐름을 볼 수 있어요.',
    anchor: '[data-case-id]',
    cta: '케이스 열기',
  },
  {
    key: 'context',
    title: '상황부터 이해하기',
    body: '에러 메시지만으로는 부족해요. 발생 조건·환경·관찰한 현상을 한 케이스에 모아 둡니다.',
    anchor: '[data-tour="context"]',
    cta: '다음',
  },
  {
    key: 'timeline',
    title: '시도와 해결 따라가기',
    body: '실패한 시도도 지우지 않아요. 무엇을 해봤고 어떻게 확인했는지, 근거와 함께 타임라인에 쌓이고 솔루션으로 이어집니다.',
    anchor: '[data-tour="timeline"]',
    cta: '다음',
  },
  {
    key: 'done',
    title: '이제, 내 에러도 기록해 볼까요?',
    body: '케이스에서 시작한 기록이 솔루션이 되고, 공개 글로 이어져요. 가입하면 내 워크스페이스에서 그대로 남길 수 있어요.',
    anchor: null,
    cta: '가입하기',
  },
]

export function useTour() {
  const tour = useTourStore()
  const auth = useAuthStore()
  const router = useRouter()
  const errorStore = useErrorStore()
  const teamStore = useTeamStore()
  const { startSignup } = useAuth()

  // 투어는 게스트 전용. status 가 active 일 때만 컴패니언/하이라이트가 보인다.
  const active = computed(() => auth.isGuest && tour.status === 'active')
  const stepIndex = computed(() => tour.step)
  const current = computed<TourStep | null>(() => TOUR_STEPS[tour.step] ?? null)
  const isLast = computed(() => tour.step >= TOUR_STEPS.length - 1)
  // 한 번이라도 끝냈거나 자유 둘러보기로 닫은 뒤의 재시작용.
  const canResume = computed(() => auth.isGuest && tour.status !== 'active')

  /** 투어가 따라갈 샘플 케이스 — 해결된 케이스 우선, 없으면 첫 케이스. 하드코딩 ID 대신 동적 선택. */
  function pickCaseId(): number | null {
    const list = errorStore.errors
    const resolved = list.find((e) => e.status === 'RESOLVED')
    return (resolved ?? list[0])?.id ?? null
  }

  function goList() {
    if (router.currentRoute.value.name !== 'errorList') {
      router.push({ name: 'errorList', params: { slug: teamStore.currentSlug } })
    }
  }

  function start() {
    tour.setCase(pickCaseId())
    tour.setStep(0)
    tour.setStatus('active')
    goList()
  }

  function next() {
    const i = tour.step
    if (i === 0) {
      const id = tour.caseId ?? pickCaseId()
      tour.setCase(id)
      if (id != null) {
        router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id } })
      }
      tour.setStep(1)
      return
    }
    if (i < TOUR_STEPS.length - 1) tour.setStep(i + 1)
  }

  function prev() {
    const i = tour.step
    if (i <= 0) return
    if (i === 1) goList()
    tour.setStep(i - 1)
  }

  /** X / 자유 둘러보기 — 투어를 접지만 재시작할 수 있게 둔다. */
  function dismiss() {
    tour.setStatus('idle')
  }

  /** 완료 카드의 1차 CTA — 가입(= GitHub OAuth) 전환. */
  function convert() {
    tour.setStatus('done')
    startSignup()
  }

  return { TOUR_STEPS, active, canResume, stepIndex, current, isLast, start, next, prev, dismiss, convert }
}

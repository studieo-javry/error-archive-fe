import { computed, ref } from 'vue'
import { useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useTourStore } from '@/stores/tourStore'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import { useErrorStore } from '@/stores/errorStore'
import { useTeamStore } from '@/stores/teamStore'
import { demoApi } from '@/services/demoApi'

/**
 * 게스트 사용 가이드 — 목업 GUIDE_TITLES / reduceGuide / guidePrimary / guideCopy 를 실제 FE 화면에 옮긴 것.
 *
 *  01 상황 이해하기   Library 의 샘플 케이스 → 상세 Context
 *  02 시도 살펴보기   타임라인 아래 조사 근거(GuideEvidence) 펼치기
 *  03 솔루션 확인하기 솔루션 탭에서 해결안을 선택해 연결된 시도 강조
 *  04 발행하기        상세 상단 'Publish' → PublishSheet 를 미리보기(게스트는 실제 발행 비활성)로 단계별 둘러보기
 *  05 발행된 글 읽기  샘플 케이스의 공개 아티클(앱 안 리더 오버레이) — core `GET /demo/guide` 가 응답할 때만
 *  완료              가입 전환
 *
 * 각 단계는 버튼을 두 번 누르는 구조다: 먼저 그 단계의 행동(열기/펼치기/선택)을 하고, 다음 단계로 넘어간다.
 * 04·05 는 발행 아티클(demo/guide)이 있을 때만 — 없으면 03 솔루션 확인에서 가이드를 마친다.
 */
export const GUIDE_TITLES = ['상황 이해하기', '시도 살펴보기', '솔루션 확인하기', '발행하기', '발행된 글 읽기']

/** 발행하기(03) 단계에서 PublishSheet 가 올라온 뒤, 각 내부 단계에 맞춘 가이드 문구(목업 NAR 와 동일). */
const PUBLISH_STAGE_COPY: Record<number, { title: string; body: string }> = {
  [-1]: {
    title: '무엇을, 어떻게 담을지 골라요.',
    body: '<strong>‘고르기’</strong>로 담을 내용을 단계별로 고르거나, <strong>‘바로 발행’</strong>으로 가장 포괄적인 기본값을 확인해 보세요.',
  },
  0: {
    title: '어떤 시도를 담을까요?',
    body: '발행물에 넣을 <strong>step</strong>을 고르세요. 실패한 시도까지 넣으면 생생한 여정이, 빼면 깔끔한 회고가 됩니다.',
  },
  1: {
    title: '제목과 공개 범위를 다듬어요.',
    body: '디버깅용 원본 제목 대신, 읽는 사람을 위한 <strong>제목·한 줄 요약·공개 설정</strong>을 정리합니다.',
  },
  2: {
    title: '첨부는 본문에 넣은 것만 나가요.',
    body: '본문·step 에 <strong>삽입한 첨부</strong>만 발행물에 함께 담깁니다. 넣을 파일만 켜 두세요.',
  },
  3: {
    title: '표시 방식을 고릅니다.',
    body: '<strong>시간 표기</strong>와 step 사이 간격 표시 같은 옵션을 조정해요. 발행 후에도 바꿀 수 있어요.',
  },
  4: {
    title: '발행 전 미리보기예요.',
    body: '실제로 공개될 모습이에요. <strong>게스트는 여기까지</strong> — 가입하면 이대로 발행돼 누구나 링크로 볼 수 있어요.',
  },
}

/** 현재 단계 카드에 보여줄 내용. body 는 강조(<strong>)가 들어간 고정 문구라 v-html 로 렌더한다. */
export interface TourCard {
  title: string
  body: string
  hint: string
  cta: string
  /** 강조할 요소 셀렉터(없으면 강조 없음). */
  anchor: string | null
  /** 강조 영역 제목 옆 칩 문구. */
  chip: string
}

/**
 * 발행 아티클 리더 오버레이 열림 상태(04 단계). 여러 useTour() 인스턴스가 공유하도록 모듈 레벨 ref.
 * 오버레이는 실제 공개 페이지(`/p/{slug}`)를 iframe 으로 띄운다 — 재구현이 아니라 진짜 발행물.
 */
const articleOpen = ref(false)

export function useTour() {
  const tour = useTourStore()
  const auth = useAuthStore()
  const router = useRouter()
  const errorStore = useErrorStore()
  const teamStore = useTeamStore()
  const { startSignup } = useAuth()

  const article = computed(() => auth.guestDemoArticle)
  // 아티클을 모르면 04 단계를 건너뛴다(3단계 + 완료).
  const titles = computed(() => (article.value ? GUIDE_TITLES : GUIDE_TITLES.slice(0, 3)))
  const total = computed(() => titles.value.length)

  // 투어는 게스트 전용. status 가 active 일 때만 컴패니언/하이라이트가 보인다.
  const active = computed(() => auth.isGuest && tour.status === 'active')
  const stepIndex = computed(() => Math.min(tour.step, total.value))
  const isComplete = computed(() => stepIndex.value >= total.value)
  const canResume = computed(() => auth.isGuest && tour.status !== 'active')

  const card = computed<TourCard | null>(() => {
    const f = tour.flags
    switch (stepIndex.value) {
      case 0:
        return {
          title: '먼저, 에러가 발생한 맥락을 읽어보세요.',
          body: '에러 메시지만으로는 상황을 알기 어려워요. <strong>발생 조건, 환경, 관찰한 현상</strong>을 케이스 하나에 모아둡니다.',
          hint: f.contextOpened ? '이 기록이 이후 모든 시도의 출발점이 됩니다.' : '해결된 샘플을 열어 전체 흐름을 살펴볼게요.',
          cta: f.contextOpened ? '시도 살펴보기' : '샘플 케이스 열기',
          anchor: f.contextOpened
            ? '[data-tour="context"]'
            : tour.caseId != null ? `[data-case-id="${tour.caseId}"]` : '[data-case-id]',
          chip: f.contextOpened ? '01 · 상황 이해하기' : '이 케이스로 시작',
        }
      case 1:
        return {
          title: '실패한 시도도 다음의 단서가 됩니다.',
          body: f.evidenceRead
            ? '시도마다 <strong>변경한 내용과 관찰한 결과</strong>를 함께 남기면, 다음 시도의 이유가 분명해집니다.'
            : '첫 시도가 늘 답이 되지는 않아요. 타임라인 아래의 <strong>조사 근거</strong>를 펼쳐, 어떻게 원인을 좁혀 갔는지 확인해 보세요.',
          hint: '실패한 시도도 지우지 않아요. 같은 시행착오를 줄이는 기록입니다.',
          cta: f.evidenceRead ? '솔루션 확인하기' : '조사 근거 펼치기',
          // 근거가 붙은 스텝의 내용 영역을 강조(스텝 아래 여백은 제외 — 다음 스텝과 겹치지 않게). 칩은 그 스텝 제목 옆.
          anchor: '.step-item:has([data-tour="evidence"]) > .flex-1',
          chip: '02 · 조사 근거',
        }
      case 2: {
        const sol = tour.solutionTitle
        const n = tour.solutionStepCount
        return {
          title: f.solutionSelected ? '해결에 기여한 시도가 연결됐어요.' : '해결에 기여한 시도만 묶어보세요.',
          body: f.solutionSelected
            ? `${n > 0 ? `<strong>${n}개의 시도가 하나의 솔루션</strong>에` : '<strong>솔루션</strong>에'} 연결되어 강조됐어요. 관련 없는 시도도 타임라인에 그대로 남아 있습니다.`
            : `타임라인 위의 <strong>‘${escapeHtml(sol ?? '솔루션')}’</strong>을 선택해 보세요. 이 해결안에 연결된 시도를 함께 확인할 수 있어요.`,
          hint: '솔루션은 정답 한 줄이 아니라, 해결을 뒷받침하는 시도의 묶음입니다.',
          cta: f.solutionSelected ? (article.value ? '발행하기' : '가이드 마치기') : '솔루션 선택하기',
          anchor: '[data-tour="solutions"]',
          chip: '03 · 솔루션 확인',
        }
      }
      case 3: {
        // 시트가 닫혀 있으면(stage=null) 상단 Publish 로 안내, 열려 있으면 내부 단계에 맞춰 내레이션.
        const ps = tour.publishStage
        if (ps == null) {
          return {
            title: '이제, 공개 글로 발행해 볼까요?',
            body: '상세 상단 액션 바의 <strong>‘Publish’</strong>를 누르면 발행이 시작돼요. 정리한 케이스를 공개 글로 만들어 봅시다.',
            hint: '게스트는 발행이 비활성이지만, 흐름은 그대로 미리 볼 수 있어요.',
            cta: 'Publish 누르기',
            // 하이라이트/칩은 상세 페이지가 직접 그린다(타이트 박스) — 여기선 공용 하이라이트를 쓰지 않는다.
            anchor: null,
            chip: '',
          }
        }
        const copy = PUBLISH_STAGE_COPY[ps] ?? PUBLISH_STAGE_COPY[-1]
        // 카드 CTA 가 시트를 직접 진행: 슬림 → 고르기, 위저드 → 다음, 미리보기 → 발행된 글 읽기.
        const cta = ps === -1 ? '고르기' : ps >= 4 ? '발행된 글 읽기' : '다음'
        return {
          title: copy.title,
          body: copy.body,
          hint: '게스트는 미리보기까지 볼 수 있어요. 실제 발행과 공개는 가입 후에.',
          cta,
          anchor: null,
          chip: '',
        }
      }
      case 4:
        return {
          title: '작업 기록이 공유할 글이 됩니다.',
          body: '방금 본 케이스를 읽기 좋은 이야기로 정리한 아티클이에요. <strong>원본 케이스와 연결</strong>되어, 다른 사람도 시도와 근거를 따라갈 수 있습니다.',
          hint: '정리된 기록을 발행하면 공개 글이 되어, 다른 사람에게 단서가 됩니다.',
          cta: '가이드 마치기',
          anchor: null,
          chip: '',
        }
      default:
        return null
    }
  })

  /** 투어가 따라갈 샘플 케이스 — 아티클이 있는 시드 케이스 우선, 다음은 해결된 케이스, 없으면 첫 케이스. */
  function pickCaseId(): number | null {
    if (article.value) return article.value.caseId
    const list = errorStore.errors
    const resolved = list.find((e) => e.status === 'RESOLVED')
    return (resolved ?? list[0])?.id ?? null
  }

  function goList() {
    if (router.currentRoute.value.name !== 'errorList') {
      router.push({ name: 'errorList', params: { slug: teamStore.currentSlug } })
    }
  }

  function goCase() {
    const id = tour.caseId ?? pickCaseId()
    tour.setCase(id)
    const r = router.currentRoute.value
    if (id != null && !(r.name === 'errorDetail' && Number(r.params.id) === id)) {
      router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id } })
    }
  }

  /** 04 단계 — 발행물을 새 탭이 아니라 앱 안 리더 오버레이로 띄운다(목업과 동일한 "화면 내" 방식). */
  function openArticle() {
    if (article.value) articleOpen.value = true
  }
  function closeArticle() {
    articleOpen.value = false
  }
  /**
   * 발행하기(04)에서 발행된 글 읽기(05)로. 시트의 '바로 발행'·최종 '발행'을 눌렀을 때도 이리 온다
   * (게스트는 실제 발행 대신 미리 준비된 데모 발행물을 읽는다 — 로그인으로 튕기지 않는다).
   */
  function finishPublishToArticle() {
    if (!article.value) { articleOpen.value = false; tour.setStep(total.value); return }
    tour.setStep(4)
    openArticle()
  }

  /**
   * 가이드 대상(샘플 케이스·아티클)을 새로 받는다. 데모 케이스는 야간 리셋마다 id 가 바뀌어 시작할 때마다 조회.
   * 실패(404 = 데모 비활성/시드 없음, 네트워크)면 아티클 단계 없이 목록에서 샘플을 고른다.
   */
  async function refreshGuideTarget() {
    try {
      const { data } = await demoApi.guide()
      auth.setGuestDemoArticle({
        caseId: data.caseId,
        slug: data.articleSlug,
        publicUrl: `${window.location.origin}/p/${encodeURIComponent(data.articleSlug)}`,
      })
    } catch {
      auth.setGuestDemoArticle(null)
    }
  }

  async function start() {
    await refreshGuideTarget()
    tour.setCase(pickCaseId())
    tour.resetFlags()
    tour.setStep(0)
    tour.setStatus('active')
    goList()
  }

  /**
   * 현재 화면이 가이드 단계와 맞는지(목업 guideCompatible). 1단계(케이스 열기 전)는 Library 또는 샘플 케이스,
   * 그 뒤로는 샘플 케이스 상세에서만 가이드를 띄운다 — 홈 등 다른 화면에선 접는다.
   */
  function isCompatible(route: RouteLocationNormalizedLoaded): boolean {
    const onCase = route.name === 'errorDetail' && Number(route.params.id) === tour.caseId
    if (stepIndex.value === 0 && !tour.flags.contextOpened) return route.name === 'errorList' || onCase
    return onCase
  }

  /** 맞지 않는 화면으로 오면 접는다(이어보기 가능). */
  function pause() {
    if (tour.status === 'active') tour.setStatus('paused')
  }

  /** 배너·사이드바 진입점 — 접어 둔 가이드는 그 자리에서 이어보고, 처음이거나 끝냈으면 새로 시작(목업 resumeGuide). */
  function resume() {
    if (tour.status !== 'paused') { start(); return }
    tour.setStatus('active')
    const i = stepIndex.value
    if (i === 0 && !tour.flags.contextOpened) goList()
    else if (i <= 4) goCase()
  }

  /** 카드의 1차 버튼 — 그 단계의 행동을 먼저 하고, 한 번 더 누르면 다음 단계로. */
  function next() {
    const f = tour.flags
    switch (stepIndex.value) {
      case 0:
        if (!f.contextOpened) { tour.setFlag('contextOpened', true); goCase(); return }
        tour.setStep(1); goCase(); return
      case 1:
        if (!f.evidenceRead) { tour.setFlag('evidenceRead', true); goCase(); return }
        tour.setStep(2); goCase(); return
      case 2:
        if (!f.solutionSelected) { tour.setFlag('solutionSelected', true); tour.requestSolution(); goCase(); return }
        // 아티클이 있으면 04 발행하기로, 없으면 여기서 완료(setStep(total) → 완료 카드).
        tour.setStep(3)
        return
      case 3:
        // 04 발행하기: ① 시트가 닫혀 있으면 상단 Publish 로 열고 ② 미리보기 전이면 시트 단계를 한 칸 진행
        // ③ 미리보기(4)까지 오면 발행된 글 읽기(05)로. 시트의 '고르기'·'다음'을 사용자가 누르지 않아도 카드가 끌고 간다.
        if (tour.publishStage == null) { tour.requestPublishOpen(); return }
        if (tour.publishStage < 4) { tour.requestPublishAdvance(); return }
        finishPublishToArticle()
        return
      default:
        // 가이드 마치기 → 완료 카드로. 리더가 열려 있으면 닫는다.
        articleOpen.value = false
        tour.setStep(total.value)
    }
  }

  function prev() {
    const i = stepIndex.value
    // 05(아티클) 단계에서 뒤로 가면 리더를 닫고 발행하기 단계로.
    if (articleOpen.value) articleOpen.value = false
    if (i === 0) {
      tour.setFlag('contextOpened', false)
      goList()
      return
    }
    // 04 발행하기에서 시트가 열려 있으면, 먼저 시트만 닫고 그 단계에 머문다.
    if (i === 3 && tour.publishStage != null) { tour.requestPublishClose(); return }
    tour.setStep(i - 1)
    if (i - 1 <= 3) goCase()
  }

  /** 접기 / X — 투어를 접지만 재시작할 수 있게 둔다. */
  function dismiss() {
    articleOpen.value = false
    tour.setStatus(isComplete.value ? 'done' : 'paused')
  }

  /** 완료 카드의 1차 CTA — 가입(= GitHub OAuth) 전환. */
  function convert() {
    articleOpen.value = false
    tour.setStatus('done')
    startSignup()
  }

  return {
    titles, total, active, canResume, stepIndex, isComplete, card, article,
    articleOpen, start, resume, next, prev, dismiss, convert, openArticle, closeArticle, finishPublishToArticle, isCompatible, pause,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

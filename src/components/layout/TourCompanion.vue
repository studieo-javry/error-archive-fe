<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTour } from '@/composables/useTour'
import { useTourStore } from '@/stores/tourStore'
import { useDemoStore } from '@/stores/demoStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

const route = useRoute()
const router = useRouter()
const tourStore = useTourStore()
const { titles, total, active, card, stepIndex, isComplete, article, next, prev, dismiss, convert, openArticle, isCompatible, pause } = useTour()
const demo = useDemoStore()

// 목업 규칙: 가이드는 단계에 맞는 화면에서만 뜬다.
//  - 처음 열었을 때 맞지 않는 화면이면 조용히 접는다(예: 진행 중 상태로 홈 새로고침).
//  - 진행 중에 맞지 않는 화면으로 이동하면 접고 안내한다. (가이드 자신의 이동은 항상 맞는 화면으로 간다.)
// 첫 내비게이션이 끝나기 전엔 route 가 비어 있어(앱이 먼저 마운트됨) 잘못 접히지 않도록 isReady 이후에 판정.
let routerReady = false
onMounted(async () => {
  await router.isReady()
  if (active.value && !isCompatible(route)) pause()
  routerReady = true
})
watch(() => route.fullPath, () => {
  // 첫 내비게이션(새로고침·직접 진입)은 위 onMounted 가 조용히 처리 — 여기선 사용자의 이동만.
  if (!routerReady) return
  if (active.value && !isCompatible(route)) {
    pause()
    demo.toast('가이드를 접었어요. 상단의 사용 가이드에서 이어볼 수 있어요.')
  }
})

// 1단계에서 게스트가 직접 샘플 케이스를 열어도 "케이스 열기"를 한 것으로 친다(목업 navigate → OPEN_CASE).
watch(
  () => route.fullPath,
  () => {
    if (active.value && stepIndex.value === 1 && route.name === 'errorDetail' && Number(route.params.id) === tourStore.caseId) {
      tourStore.setFlag('contextOpened', true)
    }
  },
  { immediate: true },
)

// ── 현재 단계 대상 요소 강조 ───────────────────────────────────────────────
// 목업 applyGuideHighlight: 대상 영역에 초록 박스(.tour-highlight) + 제목 옆 스텝 칩(.tour-chip).
let highlighted: Element | null = null
let chip: HTMLElement | null = null
let pollTimer: number | null = null
function clearHighlight() {
  if (pollTimer != null) { clearInterval(pollTimer); pollTimer = null }
  if (highlighted) { highlighted.classList.remove('tour-highlight'); highlighted = null }
  if (chip) { chip.remove(); chip = null }
}
function mark(el: Element, label: string) {
  el.classList.add('tour-highlight')
  highlighted = el
  // 칩은 영역의 제목(h2/h3) 옆에, 제목이 없는 영역은 [data-tour-chip] 지점에 붙인다.
  const host = el.matches('[data-tour-chip]') ? el : el.querySelector('h2, h3, [data-tour-chip]')
  if (host && label) {
    chip = document.createElement('span')
    chip.className = 'tour-chip'
    chip.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/></svg>'
    chip.append(label)
    host.appendChild(chip)
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
async function applyHighlight() {
  clearHighlight()
  if (!active.value || !card.value?.anchor) return
  const { anchor, chip: label } = card.value
  await nextTick()
  // 단계 전환 직후엔 상세 페이지가 아직 로딩 중(스피너)일 수 있어, 대상이 렌더될 때까지 잠깐 기다린다.
  const deadline = Date.now() + 5000
  pollTimer = window.setInterval(() => {
    if (!active.value || Date.now() > deadline) { clearHighlight(); return }
    const el = document.querySelector(anchor)
    if (!el) return
    clearInterval(pollTimer!)
    pollTimer = null
    mark(el, label)
  }, 100)
}
watch([() => card.value?.anchor, () => card.value?.chip, () => route.fullPath, active], applyHighlight, { flush: 'post' })
onMounted(applyHighlight)
onBeforeUnmount(clearHighlight)
</script>

<template>
  <div
    v-if="active && (card || isComplete)"
    class="demo-ui fe-guide-companion"
  >
    <!-- 완료 카드 -->
    <aside v-if="isComplete" class="guide-aside" aria-label="사용 가이드 완료">
      <div class="guide-card guide-complete">
        <div class="guide-top">
          <span class="guide-label"><DemoIcon name="compass" />사용 가이드<span class="mobile-guide-step">완료</span></span>
          <div class="guide-tools">
            <button type="button" class="icon-btn" aria-label="가이드 접기" title="접고 자유롭게 둘러보기" @click="dismiss"><DemoIcon name="minus" /></button>
            <button type="button" class="icon-btn" aria-label="가이드 닫기" @click="dismiss"><DemoIcon name="close" /></button>
          </div>
        </div>
        <div class="guide-body">
          <div class="guide-complete-icon"><DemoIcon name="check" /></div>
          <h2>이제, 내 에러도<br>기록해 볼까요?</h2>
          <p>케이스에서 시작한 시도가 솔루션이 되고, 하나의 글로 이어졌어요. 내 워크스페이스에서 나만의 해결 기록을 쌓아보세요.</p>
          <div class="complete-chips"><span>케이스</span><span>시도</span><span>솔루션</span><span v-if="article">발행</span><span v-if="article">아티클</span><span>비슷한 사례</span></div>
          <div class="guide-actions">
            <button type="button" class="btn btn-primary" @click="convert"><DemoIcon name="arrow" />내 기록 시작하기</button>
            <button type="button" class="btn btn-quiet" @click="dismiss">계속 둘러보기</button>
          </div>
        </div>
      </div>
      <p class="guide-passive-note">가이드는 언제든 상단에서 다시 열 수 있어요.</p>
    </aside>

    <!-- 진행 카드 -->
    <aside v-else-if="card" class="guide-aside" :aria-label="`사용 가이드 ${stepIndex + 1}단계`">
      <div class="guide-card">
        <div class="guide-top">
          <span class="guide-label"><DemoIcon name="compass" />사용 가이드<span class="mobile-guide-step">{{ stepIndex + 1 }} / {{ total }}</span></span>
          <div class="guide-tools">
            <button type="button" class="icon-btn" aria-label="가이드 접기" title="접고 자유롭게 둘러보기" @click="dismiss"><DemoIcon name="minus" /></button>
            <button type="button" class="icon-btn" aria-label="가이드 닫기" title="가이드 닫기" @click="dismiss"><DemoIcon name="close" /></button>
          </div>
        </div>
        <ol class="guide-outline">
          <li v-for="(t, i) in titles" :key="i" :class="i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''">
            <span class="num mono"><DemoIcon v-if="i < stepIndex" name="check" /><template v-else>{{ '0' + (i + 1) }}</template></span>
            {{ t }}
            <span v-if="i === stepIndex" class="current-label">지금 보고 있어요</span>
          </li>
        </ol>
        <div class="guide-body">
          <div class="guide-count mono">{{ '0' + (stepIndex + 1) }} <span>/ {{ '0' + total }}</span></div>
          <h2>{{ card.title }}</h2>
          <!-- eslint-disable-next-line vue/no-v-html -- useTour 의 고정 문구(동적 값은 escape) -->
          <p v-html="card.body" />
          <div class="guide-hint"><DemoIcon name="bulb" /><span>{{ card.hint }}</span></div>
          <div class="guide-actions">
            <!-- 인트로(비슷한 사례 찾기): 직접 체험용 2버튼 + 탐색으로 넘어가기 -->
            <template v-if="stepIndex === 0">
              <button type="button" class="btn btn-primary btn-full" @click="tourStore.requestSimilarDemo()"><DemoIcon name="arrow" />비슷한 사례 띄워보기</button>
              <button type="button" class="btn btn-quiet btn-full" @click="tourStore.requestSimilarManual()">직접 입력해볼게요</button>
              <button type="button" class="text-btn guide-reopen" @click="next"><DemoIcon name="arrow" />둘러보기 시작</button>
            </template>
            <template v-else>
              <button type="button" class="btn btn-primary btn-full" @click="next"><DemoIcon name="arrow" />{{ card.cta }}</button>
              <button v-if="stepIndex === 5 && article" type="button" class="text-btn guide-reopen" @click="openArticle"><DemoIcon name="arrow" />아티클 다시 열기</button>
            </template>
          </div>
          <div class="guide-bottom">
            <button type="button" class="guide-back" @click="prev"><DemoIcon name="back" />{{ stepIndex === 0 ? '처음으로' : '이전 단계' }}</button>
            <span class="guide-dots" aria-hidden="true">
              <span v-for="i in total" :key="i" :class="i - 1 === stepIndex ? 'active' : i - 1 < stepIndex ? 'done' : ''" />
            </span>
          </div>
        </div>
      </div>
      <p class="guide-passive-note">안내를 접어도 자유롭게 이동할 수 있어요.<br>상단의 ‘사용 가이드’에서 다시 이어보세요.</p>
    </aside>
  </div>
</template>

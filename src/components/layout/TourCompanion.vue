<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useTour, TOUR_OUTLINE, TOUR_STEPS } from '@/composables/useTour'
import { useTourStore } from '@/stores/tourStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

const route = useRoute()
const tourStore = useTourStore()
const { active, current, stepIndex, isLast, next, prev, dismiss, convert } = useTour()

// ── 현재 스텝 대상 요소 강조 ───────────────────────────────────────────────
// 목업 applyGuideHighlight: 대상 영역에 초록 박스(.tour-highlight) + 제목 옆 스텝 칩(.tour-chip).
let highlighted: Element | null = null
let chip: HTMLElement | null = null
let pollTimer: number | null = null
function clearHighlight() {
  if (pollTimer != null) { clearInterval(pollTimer); pollTimer = null }
  if (highlighted) { highlighted.classList.remove('tour-highlight'); highlighted = null }
  if (chip) { chip.remove(); chip = null }
}
function selector(): string | null {
  const step = current.value
  if (!step || !step.anchor) return null
  if (step.key === 'case' && tourStore.caseId != null) return `[data-case-id="${tourStore.caseId}"]`
  return step.anchor
}
function chipLabel(): string {
  const step = current.value
  if (!step) return ''
  if (step.key === 'case') return '이 케이스로 시작'
  return `${String(stepIndex.value + 1).padStart(2, '0')} · ${TOUR_OUTLINE[stepIndex.value]}`
}
function mark(el: Element) {
  el.classList.add('tour-highlight')
  highlighted = el
  const heading = el.querySelector('h2, h3')
  if (heading) {
    chip = document.createElement('span')
    chip.className = 'tour-chip'
    chip.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/></svg>'
    chip.append(chipLabel())
    heading.appendChild(chip)
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
async function applyHighlight() {
  clearHighlight()
  if (!active.value) return
  const sel = selector()
  if (!sel) return
  await nextTick()
  // 스텝 전환 직후엔 상세 페이지가 아직 로딩 중(스피너)일 수 있어, 대상이 렌더될 때까지 잠깐 기다린다.
  const deadline = Date.now() + 5000
  pollTimer = window.setInterval(() => {
    if (!active.value || Date.now() > deadline) { clearHighlight(); return }
    const el = document.querySelector(sel)
    if (!el) return
    clearInterval(pollTimer!)
    pollTimer = null
    mark(el)
  }, 100)
}
watch([() => tourStore.step, () => route.fullPath, active], applyHighlight, { flush: 'post' })
onMounted(applyHighlight)
onBeforeUnmount(clearHighlight)

function back() {
  if (stepIndex.value === 0) dismiss()
  else prev()
}
</script>

<template>
  <div
    v-if="active && current"
    class="demo-ui fe-guide-companion"
  >
    <!-- 완료 카드 -->
    <aside v-if="isLast" class="guide-aside" aria-label="사용 가이드 완료">
      <div class="guide-card guide-complete">
        <div class="guide-top">
          <span class="guide-label"><DemoIcon name="compass" />사용 가이드<span class="mobile-guide-step">완료</span></span>
          <div class="guide-tools">
            <button type="button" class="icon-btn" aria-label="가이드 닫기" @click="dismiss"><DemoIcon name="close" /></button>
          </div>
        </div>
        <div class="guide-body">
          <div class="guide-complete-icon"><DemoIcon name="check" /></div>
          <h2>이제, 내 에러도<br>기록해 볼까요?</h2>
          <p>{{ current.body }}</p>
          <div class="complete-chips"><span>케이스</span><span>시도</span><span>솔루션</span><span>아티클</span></div>
          <div class="guide-actions">
            <button type="button" class="btn btn-primary" @click="convert"><DemoIcon name="arrow" />{{ current.cta }}</button>
            <button type="button" class="btn btn-quiet" @click="dismiss">계속 둘러보기</button>
          </div>
        </div>
      </div>
      <p class="guide-passive-note">가이드는 언제든 상단에서 다시 열 수 있어요.</p>
    </aside>

    <!-- 진행 카드 -->
    <aside v-else class="guide-aside" :aria-label="`사용 가이드 ${stepIndex + 1}단계`">
      <div class="guide-card">
        <div class="guide-top">
          <span class="guide-label"><DemoIcon name="compass" />사용 가이드<span class="mobile-guide-step">{{ stepIndex + 1 }} / 4</span></span>
          <div class="guide-tools">
            <button type="button" class="icon-btn" aria-label="가이드 접기" title="접고 자유롭게 둘러보기" @click="dismiss"><DemoIcon name="minus" /></button>
            <button type="button" class="icon-btn" aria-label="가이드 닫기" @click="dismiss"><DemoIcon name="close" /></button>
          </div>
        </div>
        <ol class="guide-outline">
          <li v-for="(t, i) in TOUR_OUTLINE" :key="i" :class="i === stepIndex ? 'active' : i < stepIndex ? 'done' : ''">
            <span class="num mono"><DemoIcon v-if="i < stepIndex" name="check" /><template v-else>{{ '0' + (i + 1) }}</template></span>
            {{ t }}
            <span v-if="i === stepIndex" class="current-label">지금 보고 있어요</span>
          </li>
        </ol>
        <div class="guide-body">
          <div class="guide-count mono">{{ '0' + (stepIndex + 1) }} <span>/ 04</span></div>
          <h2>{{ current.title }}</h2>
          <p>{{ current.body }}</p>
          <div v-if="current.hint" class="guide-hint"><DemoIcon name="bulb" /><span>{{ current.hint }}</span></div>
          <div class="guide-actions">
            <button type="button" class="btn btn-primary btn-full" @click="next"><DemoIcon name="arrow" />{{ current.cta }}</button>
          </div>
          <div class="guide-bottom">
            <button type="button" class="guide-back" @click="back"><DemoIcon name="back" />{{ stepIndex === 0 ? '처음으로' : '이전 단계' }}</button>
            <span class="guide-dots" aria-hidden="true">
              <span v-for="i in TOUR_STEPS.length" :key="i" :class="i - 1 === stepIndex ? 'active' : i - 1 < stepIndex ? 'done' : ''" />
            </span>
          </div>
        </div>
      </div>
      <p class="guide-passive-note">안내를 접어도 자유롭게 이동할 수 있어요.<br>상단의 '사용 가이드'에서 다시 이어보세요.</p>
    </aside>
  </div>
</template>

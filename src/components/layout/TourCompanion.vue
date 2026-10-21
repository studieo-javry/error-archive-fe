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
let highlighted: Element | null = null
function clearHighlight() {
  if (highlighted) { highlighted.classList.remove('tour-highlight'); highlighted = null }
}
function selector(): string | null {
  const step = current.value
  if (!step || !step.anchor) return null
  if (step.key === 'case' && tourStore.caseId != null) return `[data-case-id="${tourStore.caseId}"]`
  return step.anchor
}
async function applyHighlight() {
  clearHighlight()
  if (!active.value) return
  const sel = selector()
  if (!sel) return
  await nextTick()
  window.setTimeout(() => {
    if (!active.value) return
    const el = document.querySelector(sel)
    if (!el) return
    el.classList.add('tour-highlight')
    highlighted = el
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 120)
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

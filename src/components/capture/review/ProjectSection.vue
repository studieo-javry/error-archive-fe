<script setup lang="ts">
// 05 프로젝트 확인(Phase 2) — 수집 시 제안된 프로젝트를 확인·정정. import payload 의 projectBindingId/clearProjectBinding 로 반영.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CapIcon from '@/components/capture/CapIcon.vue'
import type { CaptureReview, ProjectChoice } from '@/composables/useCaptureReview'
import type { ProjectBinding } from '@/types/projectBinding'

const props = defineProps<{ review: CaptureReview; projects: ProjectBinding[]; suggestedId: number | null }>()

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

const suggested = computed(() => props.review.draft.project === 'inherit')
const rec = computed(() => props.projects.find((p) => p.id === props.suggestedId) ?? null)
const current = computed<ProjectBinding | null>(() => {
  const v = props.review.draft.project
  if (v === 'inherit') return rec.value
  if (v === 'none') return null
  return props.projects.find((p) => String(p.id) === v) ?? null
})
const title = computed(() => current.value?.projectKey ?? '프로젝트 지정 안 함')
const desc = computed(() => {
  const v = props.review.draft.project
  if (v === 'inherit') return 'AI가 제안한 프로젝트를 유지합니다.'
  if (v === 'none') return '별도 프로젝트에 소속되지 않습니다.'
  return '반영할 프로젝트를 직접 선택했습니다.'
})
// 제안 유지 외 선택지: 제안 프로젝트는 inherit 로 이미 대표되므로 목록에서 제외.
const others = computed(() => props.projects.filter((p) => p.id !== props.suggestedId))

function choose(value: ProjectChoice) {
  props.review.draft.project = value
  props.review.draft.dirty = true
  menuOpen.value = false
}
function isActive(value: ProjectChoice) {
  return props.review.draft.project === value
}

function onDocPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) menuOpen.value = false
}
watch(menuOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onDocPointer)
  else document.removeEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<template>
  <section class="section" id="project">
    <div class="section-head">
      <h3><span class="num">05</span>프로젝트 확인</h3>
      <span class="tiny muted">Draft PR 기능</span>
    </div>
    <div ref="root" class="project-inline">
      <span class="project-inline-icon"><CapIcon name="folder" /></span>
      <div class="grow">
        <div class="project-inline-kicker">이 Case가 소속될 프로젝트</div>
        <div class="project-inline-name">{{ title }}</div>
        <div class="project-inline-desc">{{ desc }}</div>
      </div>
      <div class="project-inline-actions">
        <span v-if="suggested" class="badge green">제안 유지</span>
        <button type="button" class="project-change" :aria-expanded="menuOpen" aria-label="프로젝트 선택 변경" @click="menuOpen = !menuOpen">
          변경 <CapIcon name="down" />
        </button>
      </div>
      <div v-if="menuOpen" class="project-popover" role="group" aria-label="반영 프로젝트 선택">
        <div class="project-popover-header">반영할 프로젝트 선택</div>
        <button type="button" class="project-option" :class="{ active: isActive('inherit') }" :aria-pressed="isActive('inherit')" @click="choose('inherit')">
          <span class="project-option-icon"><CapIcon name="folder" /></span>
          <span class="grow">{{ rec?.projectKey ?? '미지정' }}<small>AI가 제안한 프로젝트 유지</small></span>
          <CapIcon v-if="isActive('inherit')" name="check" class="chosen-check" />
        </button>
        <button v-for="p in others" :key="p.id" type="button" class="project-option" :class="{ active: isActive(String(p.id)) }" :aria-pressed="isActive(String(p.id))" @click="choose(String(p.id))">
          <span class="project-option-icon"><CapIcon name="folder" /></span>
          <span class="grow">{{ p.projectKey }}<small>등록된 프로젝트</small></span>
          <CapIcon v-if="isActive(String(p.id))" name="check" class="chosen-check" />
        </button>
        <button type="button" class="project-option" :class="{ active: isActive('none') }" :aria-pressed="isActive('none')" @click="choose('none')">
          <span class="project-option-icon"><CapIcon name="close" /></span>
          <span class="grow">프로젝트 지정 안 함<small>어떤 프로젝트에도 연결하지 않음</small></span>
          <CapIcon v-if="isActive('none')" name="check" class="chosen-check" />
        </button>
      </div>
    </div>
    <p class="project-no-box-hint">프로젝트는 기록을 분류하는 기준이며, 기존 Case를 읽는 연결 권한의 범위를 바꾸지 않습니다.</p>
  </section>
</template>

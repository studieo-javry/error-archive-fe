<script setup lang="ts">
/**
 * 개인 Case 의 프로젝트 귀속 표시·정정(사후 재분류) — 본인 소유·개인(비워크스페이스) Case 에서만.
 * GET 으로 현재 값을 보여주고(design §11 notes ③ 해소) PUT/DELETE 로 지정/해제한다.
 * ErrorDetailPage(Tailwind) 안에 들어가므로 .cap 스타일에 의존하지 않고 자체 스타일.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { FolderIcon, ChevronDownIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { projectBindingApi } from '@/services/projectBindingApi'
import type { ProjectBinding } from '@/types/projectBinding'
import { useCaptureToast } from '@/composables/useCaptureToast'

const props = defineProps<{ caseId: number }>()
const { toast } = useCaptureToast()

const projects = ref<ProjectBinding[]>([])
const current = ref<ProjectBinding | null>(null)
const loading = ref(true)
const saving = ref(false)
const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)

async function load() {
  loading.value = true
  try {
    const [list, binding] = await Promise.all([
      projectBindingApi.list(),
      projectBindingApi.getCaseBinding(props.caseId),
    ])
    projects.value = list.data.items
    current.value = binding.data.projectBinding
  } catch {
    /* 조용히 — 표시만 생략 */
  } finally {
    loading.value = false
  }
}
load()

async function choose(p: ProjectBinding) {
  if (saving.value || current.value?.id === p.id) {
    menuOpen.value = false
    return
  }
  saving.value = true
  try {
    await projectBindingApi.bindCase(props.caseId, { projectBindingId: p.id })
    current.value = p
    menuOpen.value = false
    toast(`${p.projectKey} 프로젝트로 지정했어요.`)
  } catch {
    toast('프로젝트 지정에 실패했어요. 다시 시도해 주세요.')
  } finally {
    saving.value = false
  }
}
async function clear() {
  if (saving.value) return
  saving.value = true
  try {
    await projectBindingApi.unbindCase(props.caseId)
    current.value = null
    menuOpen.value = false
    toast('프로젝트 귀속을 해제했어요.')
  } catch {
    toast('해제에 실패했어요. 다시 시도해 주세요.')
  } finally {
    saving.value = false
  }
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
  <div v-if="!loading" ref="root" class="cpb">
    <FolderIcon class="w-3.5 h-3.5 text-zinc-400" />
    <span class="text-zinc-500">프로젝트</span>
    <span class="font-medium text-zinc-700 dark:text-zinc-300">{{ current?.projectKey ?? '미지정' }}</span>
    <button type="button" class="cpb-change" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
      변경 <ChevronDownIcon class="w-3 h-3" />
    </button>

    <div v-if="menuOpen" class="cpb-pop" role="group" aria-label="프로젝트 선택">
      <div class="cpb-pop-head">프로젝트 선택</div>
      <button
        v-for="p in projects"
        :key="p.id"
        type="button"
        class="cpb-opt"
        :class="{ active: current?.id === p.id }"
        :disabled="saving"
        @click="choose(p)"
      >
        <FolderIcon class="w-4 h-4 text-zinc-400 shrink-0" />
        <span class="grow truncate">{{ p.projectKey }}</span>
        <CheckIcon v-if="current?.id === p.id" class="w-4 h-4 text-emerald-600 shrink-0" />
      </button>
      <div class="cpb-sep" />
      <button type="button" class="cpb-opt" :class="{ active: !current }" :disabled="saving" @click="clear">
        <XMarkIcon class="w-4 h-4 text-zinc-400 shrink-0" />
        <span class="grow">프로젝트 지정 안 함</span>
        <CheckIcon v-if="!current" class="w-4 h-4 text-emerald-600 shrink-0" />
      </button>
      <p v-if="!projects.length" class="cpb-empty">등록된 프로젝트가 없어요. Capture Inbox의 프로젝트 탭에서 먼저 등록하세요.</p>
    </div>
  </div>
</template>

<style scoped>
.cpb { position: relative; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.cpb-change { display: inline-flex; align-items: center; gap: 3px; border: 0; background: transparent; color: #059669; font-weight: 500; cursor: pointer; padding: 2px; }
.dark .cpb-change { color: #34d399; }
.cpb-change:hover { text-decoration: underline; }
.cpb-pop { position: absolute; z-index: 20; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); min-width: 240px; max-width: 90vw; text-align: left;
  background: #fff; border: 1px solid #e4e4e7; border-radius: 11px; padding: 6px; box-shadow: 0 18px 50px #18181b22; }
.dark .cpb-pop { background: #202023; border-color: #333338; box-shadow: 0 18px 50px #0006; }
.cpb-pop-head { font-size: 10px; color: #71717a; font-weight: 600; padding: 7px 9px 5px; }
.cpb-opt { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: 0; background: transparent; border-radius: 7px; padding: 8px 9px; font-size: 12px; color: #18181b; cursor: pointer; }
.dark .cpb-opt { color: #e4e4e7; }
.cpb-opt:hover:not(:disabled), .cpb-opt.active { background: #f1f1f0; }
.dark .cpb-opt:hover:not(:disabled), .dark .cpb-opt.active { background: #27272a; }
.cpb-opt:disabled { opacity: .5; cursor: not-allowed; }
.cpb-opt .grow { flex: 1; min-width: 0; }
.cpb-sep { height: 1px; background: #e4e4e7; margin: 4px 0; }
.dark .cpb-sep { background: #333338; }
.cpb-empty { font-size: 11px; color: #a1a1aa; padding: 6px 9px; line-height: 1.6; }
</style>

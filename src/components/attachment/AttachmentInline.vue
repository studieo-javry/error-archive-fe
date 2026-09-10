<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import type { ErrorCaseAttachment } from '@/types/error'

const props = defineProps<{
  attachment: ErrorCaseAttachment | null
  width?: number
  editable?: boolean
}>()
const emit = defineEmits<{ resize: [markerId: string, width: number] }>()

// BE kind is an enum name (uppercase): IMAGE / JSON / TEXT / DOCUMENT / OTHER.
const isImage = computed(() => props.attachment?.kind === 'IMAGE')

// Object storage replaced the old authenticated download API. The detail response now carries
// presigned URLs directly:
//   - `url`         : Content-Disposition: inline  → usable as <img src> and new-tab preview
//   - `downloadUrl` : Content-Disposition: attachment → clicking it downloads the file
// The signature lives in the query string, so no Authorization header is needed (and <img> works).
const imgUrl = computed(() => props.attachment?.url ?? null)
const imgFailed = ref(false)
const figureEl = ref<HTMLElement | null>(null)

// Live width while dragging the resize handle (editable mode); null = use the marker's width.
const dragWidth = ref<number | null>(null)
const maxWidthCss = computed(() => `min(100%, ${dragWidth.value ?? props.width ?? 560}px)`)

onUnmounted(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
})

// Once the rewritten marker flows back as a new width prop, drop the transient drag width.
watch(() => props.width, () => { dragWidth.value = null })

function onImageClick() {
  if (!props.editable && props.attachment?.url) window.open(props.attachment.url, '_blank', 'noopener')
}

// Non-image (or image that failed to render): download via the presigned attachment URL.
// downloadUrl is absent only for freshly-uploaded (unsaved) attachments in the editor preview.
function downloadFile() {
  const href = props.attachment?.downloadUrl
  if (!href) return
  const a = document.createElement('a')
  a.href = href
  a.rel = 'noopener'
  a.click()
}

// ── drag resize (editable image only) ──
let startX = 0
let startW = 0
let maxW = 1200
function onMove(e: PointerEvent) {
  dragWidth.value = Math.round(Math.min(maxW, Math.max(80, startW + (e.clientX - startX))))
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (props.attachment && dragWidth.value != null) {
    emit('resize', props.attachment.markerId, dragWidth.value)
  }
}
function startResize(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  startX = e.clientX
  startW = figureEl.value?.querySelector('img')?.clientWidth ?? props.width ?? 400
  maxW = figureEl.value?.parentElement?.clientWidth ?? 1200
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div v-if="attachment" class="my-3">
    <!-- image: rendered inline via presigned inline URL, no frame -->
    <figure v-if="isImage && imgUrl && !imgFailed" ref="figureEl" class="group relative w-fit max-w-full">
      <img
        :src="imgUrl"
        :alt="attachment.title || attachment.fileName"
        class="h-auto block max-w-full"
        :class="editable ? 'select-none' : 'cursor-zoom-in'"
        :style="{ maxWidth: maxWidthCss }"
        :title="editable ? '' : 'Click to view full size'"
        draggable="false"
        @click="onImageClick"
        @error="imgFailed = true"
      />

      <figcaption v-if="attachment.caption" class="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{{ attachment.caption }}</figcaption>

      <!-- resize handle (editable only) -->
      <div
        v-if="editable"
        class="absolute right-1 top-4 w-1 h-9 bg-emerald-500/70 hover:bg-emerald-500 cursor-ew-resize touch-none"
        title="Drag to resize"
        @pointerdown="startResize"
      />
    </figure>

    <!-- non-image file (or image that failed to load): file card with a matching download button -->
    <div v-else class="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 max-w-md">
      <DocumentTextIcon class="w-8 h-8 text-zinc-400 dark:text-zinc-500 shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{{ attachment.title || attachment.fileName }}</div>
        <div class="text-[11px] text-zinc-400 dark:text-zinc-500">{{ (attachment.size / 1024).toFixed(1) }}KB · {{ attachment.kind }}</div>
      </div>
      <button
        v-if="attachment.downloadUrl"
        type="button"
        title="다운로드"
        class="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors shrink-0"
        @click="downloadFile"
      >
        <ArrowDownTrayIcon class="w-4 h-4" />
      </button>
    </div>
  </div>

  <div v-else class="my-3 text-xs text-zinc-400 dark:text-zinc-500 italic">삭제된 첨부입니다</div>
</template>

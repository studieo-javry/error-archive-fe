<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
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
function downloadFile() {
  if (!props.attachment) return
  const a = document.createElement('a')
  a.href = props.attachment.downloadUrl
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
    <figure v-if="isImage && imgUrl && !imgFailed" ref="figureEl" class="relative w-fit max-w-full">
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

    <!-- non-image file (or image that failed to load): click to download -->
    <div v-else class="flex items-center gap-2 text-sm">
      <span class="text-zinc-400">📎</span>
      <button type="button" class="text-emerald-600 dark:text-emerald-400 hover:underline truncate" title="Download" @click="downloadFile">{{ attachment.title || attachment.fileName }}</button>
      <span class="text-[11px] text-zinc-400">{{ (attachment.size / 1024).toFixed(1) }}KB</span>
    </div>
  </div>

  <div v-else class="my-3 text-xs text-zinc-400 dark:text-zinc-500 italic">삭제된 첨부입니다</div>
</template>

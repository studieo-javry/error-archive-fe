<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/authStore'

// 게스트(데모)는 첨부 업로드 불가 — 서버도 403 으로 막지만, UI 에서 먼저 비활성화해 혼란을 줄인다.
const isGuest = computed(() => useAuthStore().isGuest)

const emit = defineEmits<{
  save: [data: { title?: string; caption?: string; file: File }]
  close: []
}>()

const title = ref('')
const caption = ref('')
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const isImage = computed(() => file.value?.type.startsWith('image/') ?? false)

function setFile(selected: File | undefined | null) {
  if (!selected) return
  if (selected.size > 10 * 1024 * 1024) {
    alert('File size must be under 10MB')
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = selected
  previewUrl.value = selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null
}

function onFileChange(e: Event) {
  setFile((e.target as HTMLInputElement).files?.[0])
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  setFile(e.dataTransfer?.files?.[0])
}

function onSubmit() {
  if (!file.value) return
  emit('save', {
    title: title.value.trim() || undefined,
    caption: caption.value.trim() || undefined,
    file: file.value,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-4">Add Attachment</h2>

        <div v-if="isGuest" class="mb-4 px-3 py-2.5 rounded-xl text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
          데모 모드에서는 파일 업로드를 사용할 수 없어요.
        </div>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <input v-model="title" type="text" placeholder="Title (optional)" class="raw-input w-full text-sm" />

          <div>
            <label class="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">File <span class="text-rose-400">*</span></label>
            <input ref="fileInput" type="file" class="sr-only" @change="onFileChange" />
            <button
              type="button"
              :disabled="isGuest"
              class="w-full flex flex-col items-center justify-center gap-1.5 px-4 py-7 rounded-xl border border-dashed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :class="dragOver
                ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-900/10'
                : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10'"
              @click="fileInput?.click()"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
            >
              <ArrowUpTrayIcon class="w-6 h-6 text-emerald-500" />
              <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Choose a file</span>
              <span class="text-[11px] text-zinc-400 dark:text-zinc-500">or drag &amp; drop here · max 10MB</span>
            </button>
          </div>

          <div v-if="previewUrl && isImage" class="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <img :src="previewUrl" alt="Preview" class="max-h-48 w-full object-contain bg-zinc-50 dark:bg-zinc-800" />
          </div>
          <div v-else-if="file" class="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
            <span class="truncate">{{ file.name }}</span>
            <span class="shrink-0 text-zinc-400">{{ (file.size / 1024).toFixed(1) }}KB</span>
          </div>

          <input v-model="caption" type="text" placeholder="Caption (optional)" class="raw-input w-full text-sm" />

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="px-4 py-2 text-sm rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 transition-colors" @click="emit('close')">Cancel</button>
            <button type="submit" :disabled="!file || isGuest" class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">Upload</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

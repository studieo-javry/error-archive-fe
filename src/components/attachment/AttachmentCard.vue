<script setup lang="ts">
import type { AttachmentUploadResponse } from '@/types/error'
import { attachmentApi } from '@/services/attachmentApi'
import { ClipboardDocumentIcon, TrashIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{ attachment: AttachmentUploadResponse }>()
const emit = defineEmits<{
  insert: [marker: string]
  delete: [markerId: string]
}>()

const marker = `@attach(${props.attachment.markerId})`

function copyMarker() {
  navigator.clipboard.writeText(marker)
}

async function download() {
  const blob = await attachmentApi.download(props.attachment.markerId, true)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.attachment.fileName
  a.click()
  URL.revokeObjectURL(url)
}

async function preview() {
  const blob = await attachmentApi.download(props.attachment.markerId, false)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
</script>

<template>
  <div class="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 flex items-start gap-3">
    <div v-if="attachment.kind === 'image'" class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800">
      <img :src="attachment.storageUrl" :alt="attachment.fileName" class="w-full h-full object-cover" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <button class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" @click="preview">{{ attachment.fileName }}</button>
        <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ (attachment.size / 1024).toFixed(1) }}KB</span>
      </div>
      <code class="text-[11px] text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{{ marker }}</code>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button class="p-1 text-zinc-400 hover:text-emerald-600 transition-colors" title="Insert marker" @click="emit('insert', marker)">
        <DocumentTextIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Copy marker" @click="copyMarker">
        <ClipboardDocumentIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-emerald-600 transition-colors" title="Download" @click="download">
        <ArrowDownTrayIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-rose-500 transition-colors" title="Delete" @click="emit('delete', attachment.markerId)">
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

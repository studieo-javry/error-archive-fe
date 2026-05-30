<script setup lang="ts">
import type { Attachment } from '@/types/error'
import { ClipboardDocumentIcon, PencilSquareIcon, TrashIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{ attachment: Attachment }>()
const emit = defineEmits<{
  insert: [marker: string]
  edit: [attachment: Attachment]
  delete: [id: string]
}>()

const marker = `@attach(${props.attachment.id})`

function copyMarker() {
  navigator.clipboard.writeText(marker)
}
</script>

<template>
  <div class="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 flex items-start gap-3">
    <div v-if="attachment.kind === 'image'" class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800">
      <img :src="attachment.url" :alt="attachment.fileName" class="w-full h-full object-cover" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{{ attachment.title || attachment.fileName }}</span>
        <span class="text-[10px] text-zinc-400 dark:text-zinc-500">{{ (attachment.fileSize / 1024).toFixed(1) }}KB</span>
      </div>
      <code class="text-[11px] text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{{ marker }}</code>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <button class="p-1 text-zinc-400 hover:text-indigo-600 transition-colors" title="Insert marker" @click="emit('insert', marker)">
        <DocumentTextIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Copy marker" @click="copyMarker">
        <ClipboardDocumentIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Edit" @click="emit('edit', attachment)">
        <PencilSquareIcon class="w-4 h-4" />
      </button>
      <button class="p-1 text-zinc-400 hover:text-rose-500 transition-colors" title="Delete" @click="emit('delete', attachment.id)">
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

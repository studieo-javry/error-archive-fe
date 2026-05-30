<script setup lang="ts">
import type { Attachment } from '@/types/error'

defineProps<{ attachment: Attachment | null }>()
</script>

<template>
  <div v-if="attachment" class="my-3">
    <div v-if="attachment.kind === 'image'" class="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <img :src="attachment.url" :alt="attachment.title || attachment.fileName" class="max-w-full h-auto" />
      <p v-if="attachment.caption" class="px-3 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700">{{ attachment.caption }}</p>
    </div>
    <div v-else class="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">📎</div>
      <div class="flex-1 min-w-0">
        <a :href="attachment.url" target="_blank" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{{ attachment.title || attachment.fileName }}</a>
        <span class="text-[11px] text-zinc-400">{{ (attachment.fileSize / 1024).toFixed(1) }}KB</span>
      </div>
    </div>
  </div>
  <div v-else class="my-3 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 italic">
    삭제된 첨부입니다
  </div>
</template>

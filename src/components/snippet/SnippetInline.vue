<script setup lang="ts">
import { computed } from 'vue'
import type { ErrorCaseSnippet } from '@/types/error'
import hljs from 'highlight.js'

const props = defineProps<{ snippet: ErrorCaseSnippet | null }>()

const highlightedCode = computed(() => {
  if (!props.snippet) return ''
  const lang = props.snippet.language
  if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
    return hljs.highlight(props.snippet.code, { language: lang }).value
  }
  return hljs.highlightAuto(props.snippet.code).value
})

// Only show a title when the user actually entered one — ignore blanks and
// "untitled" style defaults so no placeholder title leaks into the body.
const displayTitle = computed(() => {
  const t = props.snippet?.title?.trim() ?? ''
  return t && t.toLowerCase() !== 'untitled' ? t : ''
})
</script>

<template>
  <div v-if="snippet" class="my-3 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
    <div
      v-if="displayTitle || snippet.filePathOrClass"
      class="flex items-center justify-between px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700"
    >
      <span v-if="displayTitle" class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{ displayTitle }}</span>
      <span v-if="snippet.filePathOrClass" class="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-48">
        {{ snippet.filePathOrClass }}<template v-if="snippet.lineRange">:{{ snippet.lineRange }}</template>
      </span>
    </div>
    <pre class="p-3 text-xs font-mono overflow-x-auto bg-white dark:bg-zinc-900"><code v-html="highlightedCode" /></pre>
    <p v-if="snippet.caption" class="px-3 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700">{{ snippet.caption }}</p>
  </div>
  <div v-else class="my-3 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 italic">
    삭제된 스니펫입니다
  </div>
</template>

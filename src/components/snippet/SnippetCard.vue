<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SnippetCreateResponse } from '@/types/error'
import { ClipboardDocumentIcon, TrashIcon, DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import hljs from 'highlight.js'

const props = defineProps<{ snippet: SnippetCreateResponse }>()
const emit = defineEmits<{
  insert: [marker: string]
  delete: [markerId: string]
}>()

const marker = `@snippet(${props.snippet.markerId})`
const expanded = ref(false)

const highlightedCode = computed(() => {
  const code = props.snippet.code
  if (!code) return ''
  const lang = props.snippet.language
  if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value
  }
  return hljs.highlightAuto(code).value
})

function copyMarker() {
  navigator.clipboard.writeText(marker)
}
</script>

<template>
  <div class="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
    <div class="p-3 flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span v-if="snippet.title" class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{{ snippet.title }}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase">{{ snippet.language }}</span>
        </div>
        <code class="text-[11px] text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{{ marker }}</code>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="snippet.code"
          class="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          :title="expanded ? 'Hide code' : 'Preview code'"
          @click="expanded = !expanded"
        >
          <component :is="expanded ? ChevronUpIcon : ChevronDownIcon" class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-emerald-600 transition-colors" title="Insert marker" @click="emit('insert', marker)">
          <DocumentTextIcon class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Copy marker" @click="copyMarker">
          <ClipboardDocumentIcon class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-rose-500 transition-colors" title="Delete" @click="emit('delete', snippet.markerId)">
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div v-if="expanded && snippet.code" class="border-t border-zinc-200 dark:border-zinc-700">
      <pre class="p-3 text-xs font-mono overflow-x-auto bg-zinc-50 dark:bg-zinc-900"><code v-html="highlightedCode" /></pre>
    </div>
  </div>
</template>

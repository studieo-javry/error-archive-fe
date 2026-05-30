<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Snippet } from '@/types/error'
import { ClipboardDocumentIcon, PencilSquareIcon, TrashIcon, DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'
import hljs from 'highlight.js'

const props = defineProps<{ snippet: Snippet }>()
const emit = defineEmits<{
  insert: [marker: string]
  edit: [snippet: Snippet]
  delete: [id: string]
}>()

const marker = `@snippet(${props.snippet.id})`
const expanded = ref(false)

const highlightedCode = computed(() => {
  const lang = props.snippet.language
  if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
    return hljs.highlight(props.snippet.code, { language: lang }).value
  }
  return hljs.highlightAuto(props.snippet.code).value
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
          <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{{ snippet.title || 'Untitled snippet' }}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase">{{ snippet.language }}</span>
        </div>
        <code class="text-[11px] text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">{{ marker }}</code>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Toggle preview" @click="expanded = !expanded">
          <component :is="expanded ? ChevronUpIcon : ChevronDownIcon" class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-indigo-600 transition-colors" title="Insert marker" @click="emit('insert', marker)">
          <DocumentTextIcon class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Copy marker" @click="copyMarker">
          <ClipboardDocumentIcon class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-zinc-600 transition-colors" title="Edit" @click="emit('edit', snippet)">
          <PencilSquareIcon class="w-4 h-4" />
        </button>
        <button class="p-1 text-zinc-400 hover:text-rose-500 transition-colors" title="Delete" @click="emit('delete', snippet.id)">
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div v-if="expanded" class="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
      <pre class="p-3 text-xs font-mono overflow-x-auto"><code v-html="highlightedCode" /></pre>
      <p v-if="snippet.caption" class="px-3 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">{{ snippet.caption }}</p>
    </div>
  </div>
</template>

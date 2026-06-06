<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SnippetCreateRequest } from '@/types/error'
import hljs from 'highlight.js'

const emit = defineEmits<{
  save: [data: SnippetCreateRequest]
  close: []
}>()

const title = ref('')
const language = ref('text')
const filePathOrClass = ref('')
const lineRange = ref('')
const caption = ref('')
const code = ref('')

const languages = [
  { value: 'java', label: 'Java' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'text', label: 'Text' },
]

const highlightedCode = computed(() => {
  if (!code.value) return ''
  if (language.value && language.value !== 'text' && hljs.getLanguage(language.value)) {
    return hljs.highlight(code.value, { language: language.value }).value
  }
  return hljs.highlightAuto(code.value).value
})

function onSubmit() {
  if (!code.value.trim()) return
  emit('save', {
    title: title.value.trim() || undefined,
    language: language.value,
    filePathOrClass: filePathOrClass.value.trim() || undefined,
    lineRange: lineRange.value.trim() || undefined,
    caption: caption.value.trim() || undefined,
    code: code.value,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-4">Add Code Snippet</h2>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <input v-model="title" type="text" placeholder="Title (optional)" class="raw-input w-full text-sm" />
          <div class="grid grid-cols-2 gap-3">
            <input v-model="filePathOrClass" type="text" placeholder="File path (optional)" class="raw-input text-sm" />
            <input v-model="lineRange" type="text" placeholder="Line range (e.g. 42-58)" class="raw-input text-sm" />
          </div>
          <input v-model="caption" type="text" placeholder="Caption (optional)" class="raw-input w-full text-sm" />
          <select v-model="language" class="raw-input text-sm w-full">
            <option v-for="lang in languages" :key="lang.value" :value="lang.value">{{ lang.label }}</option>
          </select>
          <textarea v-model="code" placeholder="Paste code here *" rows="8" class="raw-textarea w-full font-mono text-xs" required />

          <div v-if="code.trim()" class="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div class="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
              <span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Preview</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase">{{ language }}</span>
            </div>
            <pre class="p-3 text-xs font-mono overflow-x-auto bg-white dark:bg-zinc-900"><code v-html="highlightedCode" /></pre>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="px-4 py-2 text-sm rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 transition-colors" @click="emit('close')">Cancel</button>
            <button type="submit" class="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Save Snippet</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const rendered = computed(() => {
  let html = escapeHtml(props.content)

  // fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-[#ececee] dark:bg-zinc-800/80 border-l-2 border-emerald-500/70 pl-3 pr-3 py-2.5 overflow-x-auto my-2"><code class="text-xs font-mono text-zinc-700 dark:text-zinc-200">${code.trim()}</code></pre>`
  })

  // inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#ececee] text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 text-xs font-mono">$1</code>')

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // line breaks → paragraphs
  html = html
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p)
    .map(p => {
      if (p.startsWith('<pre')) return p
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`
    })
    .join('')

  return html
})
</script>

<template>
  <div class="markdown-body text-xs text-zinc-600 dark:text-[#c7c7cd] leading-relaxed [&_p]:mb-1.5 [&_strong]:text-zinc-700 dark:[&_strong]:text-zinc-200 [&_em]:italic" v-html="rendered" />
</template>

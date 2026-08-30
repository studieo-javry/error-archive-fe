<script setup lang="ts">
import { computed } from 'vue'
import hljs from 'highlight.js'

const props = defineProps<{ content: string }>()

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Fenced blocks are lifted out *before* the rest is escaped: highlight.js needs the raw
// source (it escapes its own output), and feeding it pre-escaped text would render the
// entities literally. Each block is parked behind a sentinel and restored at the end.
const SENTINEL = /@@CODEBLOCK(\d+)@@/g

const rendered = computed(() => {
  const blocks: string[] = []

  const src = props.content.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const body = code.replace(/\s+$/, '')
    const known = Boolean(lang) && lang !== 'text' && Boolean(hljs.getLanguage(lang))
    const inner = known ? hljs.highlight(body, { language: lang }).value : escapeHtml(body)
    blocks.push(
      '<pre class="relative bg-[#ececee] dark:bg-zinc-800/80 border-l-2 border-emerald-500/70 pl-3 pr-3 py-2.5 overflow-x-auto themed-scroll my-2">'
      + (known
        ? `<span class="absolute right-2 top-1.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 select-none">${escapeHtml(lang)}</span>`
        : '')
      + `<code class="hljs text-xs font-mono">${inner}</code></pre>`,
    )
    return `@@CODEBLOCK${blocks.length - 1}@@`
  })

  let html = escapeHtml(src)

  // inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#ececee] text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 text-xs font-mono">$1</code>')

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // line breaks → paragraphs (a block on its own line must not be wrapped in a <p>)
  html = html
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p)
    .map((p) => {
      if (!/@@CODEBLOCK\d+@@/.test(p)) return `<p>${p.replace(/\n/g, '<br/>')}</p>`
      // a fence glued to surrounding text would otherwise land inside the <p>
      return p
        .split(/(@@CODEBLOCK\d+@@)/)
        .map((part) => {
          if (/^@@CODEBLOCK\d+@@$/.test(part)) return part
          const t = part.trim()
          return t ? `<p>${t.replace(/\n/g, '<br/>')}</p>` : ''
        })
        .join('')
    })
    .join('')

  return html.replace(SENTINEL, (_m, i: string) => blocks[Number(i)] ?? '')
})
</script>

<template>
  <div class="markdown-body text-xs text-zinc-600 dark:text-[#c7c7cd] leading-relaxed [&_p]:mb-1.5 [&_strong]:text-zinc-700 dark:[&_strong]:text-zinc-200 [&_em]:italic" v-html="rendered" />
</template>

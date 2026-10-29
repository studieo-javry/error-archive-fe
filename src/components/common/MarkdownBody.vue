<script setup lang="ts">
import { computed, ref } from 'vue'
import hljs from 'highlight.js'
import { TASK_LINE } from '@/utils/markdownTasks'
import '@/styles/markdown-task-list.css'

const props = defineProps<{
  content: string
  /**
   * 주면 작업 목록 체크박스를 누를 수 있다 — index 번째 항목을 checked 로 저장하는 함수.
   * 없으면 체크박스는 보기 전용(disabled).
   */
  onToggleTask?: (index: number, checked: boolean) => Promise<unknown>
}>()

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

  // bold — 문단 내 소프트 줄바꿈은 넘되(CommonMark), 빈 줄(\n\n=문단 경계)은 넘지 않는다.
  // (`.` 는 \n 미매칭이라 과거엔 줄바꿈에 걸친 **볼드** 가 깨졌다.)
  html = html.replace(/\*\*((?:(?!\n\n)[\s\S])+?)\*\*/g, '<strong>$1</strong>')

  // italic — 볼드와 동일 정책.
  html = html.replace(/\*((?:(?!\n\n)[\s\S])+?)\*/g, '<em>$1</em>')

  // 블록 레벨: 제목(#/##/###) · 목록(-, 1.) · 작업 목록(- [ ]) · 문단 · 코드블록 센티넬. 라인 단위로 그룹핑한다.
  const out: string[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol' | 'task'; items: string[] } | null = null
  let taskIndex = 0
  const flushPara = () => { if (para.length) { out.push(`<p>${para.join('<br/>')}</p>`); para = [] } }
  const flushList = () => {
    if (list?.type === 'task') out.push(`<div class="md-tasks"><div class="gh-task-section-step"><div class="gh-task-lines">${list.items.join('')}</div></div></div>`)
    else if (list) out.push(`<${list.type}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.type}>`)
    list = null
  }
  const flush = () => { flushPara(); flushList() }

  for (const rawLine of html.split('\n')) {
    const line = rawLine.trim()
    if (!line) { flush(); continue }
    // 코드블록은 자체 라인으로 — <p> 안에 넣지 않는다.
    if (/^@@CODEBLOCK\d+@@$/.test(line)) { flush(); out.push(line); continue }
    // 제목
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) { flush(); const lvl = h[1].length; out.push(`<h${lvl}>${h[2]}</h${lvl}>`); continue }
    // 작업 목록 (- [ ] / - [x]) — 마크업은 목업 체크리스트(gh-task-*) 그대로
    const task = line.match(TASK_LINE)
    if (task) {
      flushPara()
      if (list?.type !== 'task') { flushList(); list = { type: 'task', items: [] } }
      const checked = task[1] !== ' '
      list.items.push(`<div class="gh-task-line"><input class="gh-task-box" type="checkbox" data-task="${taskIndex++}" aria-label="작업 완료 여부"${checked ? ' checked' : ''}${props.onToggleTask ? '' : ' disabled'}><div class="gh-task-words"><span>${task[2]}</span></div></div>`)
      continue
    }
    // 순서 없는 목록 (- )
    const ul = line.match(/^-\s+(.+)$/)
    if (ul) { flushPara(); if (list?.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } } list.items.push(ul[1]); continue }
    // 순서 있는 목록 (1. )
    const ol = line.match(/^\d+\.\s+(.+)$/)
    if (ol) { flushPara(); if (list?.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } } list.items.push(ol[1]); continue }
    // 일반 텍스트 → 문단
    flushList(); para.push(line)
  }
  flush()
  html = out.join('')

  return html.replace(SENTINEL, (_m, i: string) => blocks[Number(i)] ?? '')
})

// 체크박스 클릭 → 저장. 저장 중엔 다른 클릭을 받지 않고(앞 저장 결과를 덮어쓰지 않게), 실패하면 되돌린다.
const saving = ref(false)
async function onChange(e: Event) {
  const box = e.target as HTMLInputElement
  if (!box.matches('input[data-task]') || !props.onToggleTask) return
  if (saving.value) { box.checked = !box.checked; return }
  saving.value = true
  try {
    await props.onToggleTask(Number(box.dataset.task), box.checked)
  } catch {
    box.checked = !box.checked
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="markdown-body text-xs text-zinc-600 dark:text-[#c7c7cd] leading-relaxed [&_p]:mb-2 [&_strong]:text-zinc-700 dark:[&_strong]:text-zinc-200 [&_em]:italic [&_h1]:text-[15px] [&_h1]:font-bold [&_h1]:text-zinc-800 dark:[&_h1]:text-zinc-100 [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-zinc-800 dark:[&_h2]:text-zinc-100 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-zinc-700 dark:[&_h3]:text-zinc-200 [&_h3]:mt-5 [&_h3]:mb-2 [&>h1:first-child]:mt-0 [&>h2:first-child]:mt-0 [&>h3:first-child]:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-0.5" @change="onChange" v-html="rendered" />
</template>

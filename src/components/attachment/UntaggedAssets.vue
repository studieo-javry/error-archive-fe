<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ErrorCaseAttachment, ErrorCaseSnippet } from '@/types/error'
import { PhotoIcon, DocumentIcon, CodeBracketIcon } from '@heroicons/vue/24/outline'
import SnippetInline from '@/components/snippet/SnippetInline.vue'

const props = defineProps<{
  attachments: ErrorCaseAttachment[]
  snippets: ErrorCaseSnippet[]
  /** 케이스 본문(description). 여기 마커로 참조된 자료는 제외. */
  body: string | null
}>()

// 본문에서 참조된 markerId 집합 — BodyRenderer 와 동일한 마커 문법.
const referenced = computed(() => {
  const ids = new Set<string>()
  const re = /@(?:snippet|attach)\(([a-zA-Z0-9_-]+)(?:\|\d{2,4})?\)/g
  let m: RegExpExecArray | null
  const src = props.body ?? ''
  while ((m = re.exec(src)) !== null) ids.add(m[1])
  return ids
})

// "붙었지만 본문에 삽입 안 한" 자료.
const untaggedAttachments = computed(() => props.attachments.filter(a => !referenced.value.has(a.markerId)))
const untaggedSnippets = computed(() => props.snippets.filter(s => !referenced.value.has(s.markerId)))
const hasAny = computed(() => untaggedAttachments.value.length > 0 || untaggedSnippets.value.length > 0)

// 기본 탭: 첨부가 있으면 첨부, 없으면 스니펫.
const tab = ref<'att' | 'snip'>('att')
if (untaggedAttachments.value.length === 0 && untaggedSnippets.value.length > 0) tab.value = 'snip'

const expanded = ref<Set<string>>(new Set())
function toggleExpand(id: string) {
  const s = new Set(expanded.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expanded.value = s
}

const copiedId = ref<string | null>(null)
async function copyCode(snip: ErrorCaseSnippet) {
  try {
    await navigator.clipboard.writeText(snip.code)
    copiedId.value = snip.markerId
    setTimeout(() => { if (copiedId.value === snip.markerId) copiedId.value = null }, 1500)
  } catch { /* clipboard 미지원 — 무시 */ }
}

function isImage(a: ErrorCaseAttachment) {
  return a.contentType?.startsWith('image/') ?? false
}
function typeLabel(a: ErrorCaseAttachment) {
  return isImage(a) ? '이미지' : '파일'
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <section v-if="hasAny" class="mt-2">
    <h3 class="font-bold text-zinc-800 dark:text-zinc-200 mb-1">함께 올린 자료</h3>
    <p class="text-xs text-zinc-400 dark:text-zinc-500 mb-4">본문에 삽입하진 않았지만 이 케이스에 함께 올린 파일·코드예요.</p>

    <!-- 탭 -->
    <div class="flex items-center gap-5 text-xs border-b border-zinc-200 dark:border-zinc-800 mb-3">
      <button
        v-if="untaggedAttachments.length"
        class="relative pb-2 transition-colors"
        :class="tab === 'att' ? 'text-zinc-800 dark:text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
        @click="tab = 'att'"
      >
        첨부 파일<span class="ml-1 text-[10px] text-zinc-400 dark:text-zinc-500">{{ untaggedAttachments.length }}</span>
        <span v-if="tab === 'att'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500" />
      </button>
      <button
        v-if="untaggedSnippets.length"
        class="relative pb-2 transition-colors"
        :class="tab === 'snip' ? 'text-zinc-800 dark:text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
        @click="tab = 'snip'"
      >
        코드 스니펫<span class="ml-1 text-[10px] text-zinc-400 dark:text-zinc-500">{{ untaggedSnippets.length }}</span>
        <span v-if="tab === 'snip'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500" />
      </button>
    </div>

    <!-- 첨부 탭 -->
    <div v-if="tab === 'att'" class="space-y-1.5">
      <div
        v-for="a in untaggedAttachments"
        :key="a.markerId"
        class="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40"
      >
        <span
          class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          :class="isImage(a) ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'"
        >
          <PhotoIcon v-if="isImage(a)" class="w-5 h-5" />
          <DocumentIcon v-else class="w-5 h-5" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{{ a.fileName }}</div>
          <div class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            {{ typeLabel(a) }} · {{ fmtSize(a.size) }}
            <template v-if="isImage(a) && a.url">
              <span class="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              <a :href="a.url" target="_blank" rel="noopener" class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">미리보기</a>
            </template>
            <span class="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
            <a :href="a.downloadUrl ?? a.url" class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">다운로드</a>
          </div>
        </div>
      </div>
    </div>

    <!-- 스니펫 탭 -->
    <div v-else class="space-y-1.5">
      <div
        v-for="s in untaggedSnippets"
        :key="s.markerId"
        class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 overflow-hidden"
      >
        <div class="flex items-center gap-3 p-2.5">
          <span class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400">
            <CodeBracketIcon class="w-5 h-5" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
              {{ s.title || s.filePathOrClass || '코드 스니펫' }}
              <span v-if="s.lineRange" class="text-zinc-400 dark:text-zinc-500 font-normal">· {{ s.lineRange }}</span>
            </div>
            <div class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
              {{ s.language }}
              <span class="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              <button class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium" @click="toggleExpand(s.markerId)">
                {{ expanded.has(s.markerId) ? '접기' : '펼치기' }}
              </button>
              <span class="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              <button class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium" @click="copyCode(s)">
                {{ copiedId === s.markerId ? '복사됨' : '복사' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="expanded.has(s.markerId)" class="px-2.5 pb-2.5">
          <SnippetInline :snippet="s" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 본문 `#` 자동완성 — 목업 refSuggest · refChooseItem (B · Issue / PR 검색).
// `#`·`#번호`·`#제목` 입력 → 공간에 연결된 레포의 Issue·PR 검색 결과 → Enter·Tab·클릭으로 골라야 `owner/repo#N` 으로 확정.
// 고르지 않으면 입력한 `#95` 그대로(일반 텍스트). 연결된 레포가 0개면 띄우지 않는다.
import { onBeforeUnmount, ref, watch } from 'vue'
import GhEvIcon from '@/components/github-evidence/GhEvIcon.vue'
import { statusName } from '@/composables/useCaseGithub'
import type { GithubRefs } from '@/composables/useGithubRefs'
import { githubReferenceApi } from '@/services/githubReferenceApi'
import type { GithubReferenceSearchItem } from '@/types/githubReference'
import { refToken } from '@/utils/githubRefs'
import '@/styles/github-reference.css'

const props = defineProps<{
  target: HTMLTextAreaElement | null
  /** 공간(workspaceId)·고른 결과 기억을 함께 쓴다 */
  refs: GithubRefs
}>()
const workspaceId = () => props.refs.workspaceId.value

type Token = { start: number; end: number; num: string }
const open = ref(false)
const above = ref(false)
const token = ref<Token | null>(null)
const results = ref<GithubReferenceSearchItem[]>([])
const index = ref(0)
const repoCount = ref(0)

// 공간별 레포 수와 검색 결과는 잠깐 재사용(타이핑마다 같은 질의가 반복된다).
const repoCache = new Map<string, Promise<number>>()
const searchCache = new Map<string, { at: number; items: GithubReferenceSearchItem[] }>()
const SEARCH_TTL = 30_000

watch(workspaceId, ws => {
  const key = String(ws)
  let p = repoCache.get(key)
  if (!p) {
    p = githubReferenceApi.repositories(ws).then(r => r.data.repositories.length).catch(() => 0)
    repoCache.set(key, p)
  }
  p.then(n => { if (workspaceId() === ws) repoCount.value = n })
  close()
}, { immediate: true })

function close() {
  open.value = false
  token.value = null
}

let seq = 0
async function search(q: string): Promise<GithubReferenceSearchItem[] | null> {
  const key = `${workspaceId()}|${q.toLowerCase()}`
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.items
  const mine = ++seq
  try {
    const { data } = await githubReferenceApi.search(workspaceId(), q)
    searchCache.set(key, { at: Date.now(), items: data.items })
    return mine === seq ? data.items : null
  } catch {
    return mine === seq ? [] : null
  }
}

async function suggest() {
  const ta = props.target
  if (!ta) return
  const t = refToken(ta)
  if (!t || !repoCount.value) return close()
  const items = await search(t.num)
  if (items == null) return
  // 응답을 기다리는 사이 커서가 옮겨졌으면 지금 위치 기준으로 다시 판단.
  const now = refToken(ta)
  if (!now || now.start !== t.start || now.num !== t.num) return
  const previous = token.value
  index.value = previous && previous.start === t.start ? Math.min(index.value, Math.max(0, items.length - 1)) : 0
  token.value = t
  results.value = items
  open.value = true
  above.value = window.innerHeight - 90 - ta.getBoundingClientRect().bottom < 210
}

function choose(item: GithubReferenceSearchItem) {
  const ta = props.target
  const info = token.value
  if (!ta || !info) return
  const t = refToken(ta) || info
  if (t.start < 0 || t.end > ta.value.length || ta.value.slice(t.start, t.start + 1) !== '#') return
  const replacement = `${item.repo}#${item.number}`
  ta.value = ta.value.slice(0, t.start) + replacement + ta.value.slice(t.end)
  const pos = t.start + replacement.length
  ta.focus()
  ta.setSelectionRange(pos, pos)
  props.refs.remember(item)
  close()
  // v-model 에 반영
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || e.isComposing) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  const n = results.value.length
  if (n > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
    index.value = (index.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    return
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (!n) return
    e.preventDefault()
    choose(results.value[index.value])
  }
}

function onDocClick(e: MouseEvent) {
  const shell = props.target?.parentElement
  if (open.value && shell && !shell.contains(e.target as Node)) close()
}

watch(() => props.target, (el, prev) => {
  prev?.removeEventListener('input', suggest)
  prev?.removeEventListener('keydown', onKeydown)
  el?.addEventListener('input', suggest)
  el?.addEventListener('keydown', onKeydown)
}, { immediate: true })
document.addEventListener('click', onDocClick)
onBeforeUnmount(() => {
  props.target?.removeEventListener('input', suggest)
  props.target?.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="gh-ref">
    <div class="ref-suggest search-results" :class="{ above }" role="listbox" aria-label="저장소 자동완성" :hidden="!open">
      <template v-if="open && token">
        <div class="ref-suggest-head"><GhEvIcon name="github" size="xs" />{{ token.num ? `“${token.num}” Issue·PR 검색` : '연결된 저장소의 Issue·PR' }}<span class="ref-count">{{ results.length }}개 결과</span></div>
        <template v-if="results.length">
          <button
            v-for="(it, i) in results"
            :key="`${it.repo}#${it.number}`"
            type="button"
            class="ref-suggest-result"
            role="option"
            :aria-selected="index === i"
            @click="choose(it)"
          ><span class="ref-result-kind" :class="it.kind === 'ISSUE' ? 'issue' : 'pr'"><GhEvIcon :name="it.kind === 'ISSUE' ? 'issue' : 'pr'" size="sm" /></span><span class="result-body"><span class="result-name">{{ it.title }}</span><span class="result-meta">{{ it.repo }} #{{ it.number }} · {{ it.kind === 'ISSUE' ? 'Issue' : 'Pull request' }} <span class="result-badge">{{ statusName(it.status) }}</span></span></span><span v-if="index === i" class="result-select"><svg class="svg xs" aria-hidden="true" viewBox="0 0 24 24" /></span></button>
        </template>
        <div v-else class="ref-suggest-empty">찾은 Issue·PR이 없어요. 다른 번호나 제목을 입력해 보세요.</div>
        <div class="ref-suggest-foot">↑ ↓ 선택 · Enter/Tab 확정 · Esc 취소 · 선택하지 않고 저장하면 일반 텍스트</div>
      </template>
    </div>
  </div>
</template>

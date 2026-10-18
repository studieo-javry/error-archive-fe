<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublicPublishmentItem } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import {
  GlobeAltIcon,
  LinkIcon,
  EyeIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline'

// Explore = 공개(PUBLIC+LIVE) 발행물 갤러리(전역). 소유자 무관 — 누구나 발견하는 완성 글.
// 카드 디자인은 Library 의 발행물 리스트(PublishedList)와 동일 언어(좌측 초록 액센트 + 1열).
const items = ref<PublicPublishmentItem[]>([])
const loading = ref(false)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await publishmentApi.listPublic({ limit: 60 })
    items.value = data
  } catch (e) {
    items.value = []
    loadError.value = axios.isAxiosError(e)
      ? ((e.response?.data as { detail?: string })?.detail ?? "Couldn't load published posts.")
      : "Couldn't load published posts."
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 공개 링크 복사 — 눌렀을 때 잠깐 Copied 로 바뀐다. (PublishedList 와 동일 UX)
const copiedSlug = ref<string | null>(null)
async function copyLink(p: PublicPublishmentItem) {
  try {
    await navigator.clipboard.writeText(p.publicUrl)
    copiedSlug.value = p.slug
    setTimeout(() => { if (copiedSlug.value === p.slug) copiedSlug.value = null }, 1500)
  } catch { /* clipboard 미지원 — 무시 */ }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <!-- 헤더 -->
    <div class="mb-6">
      <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1.5">
        <GlobeAltIcon class="w-5 h-5" />
        <h1 class="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Explore</h1>
      </div>
      <p class="text-[12.5px] text-zinc-400 dark:text-zinc-600">
        Published write-ups shared by the community — every solved case, from its first symptom to the fix.
      </p>
    </div>

    <p v-if="loadError" class="text-sm text-rose-600 dark:text-rose-400 py-6">{{ loadError }}</p>

    <LoadingSpinner v-else-if="loading && !items.length" size="lg" />

    <template v-else>
      <div v-if="items.length" class="grid gap-3">
        <article
          v-for="p in items"
          :key="p.slug"
          class="pub-card rounded-xl border border-zinc-200 bg-white px-5 py-[18px] transition-colors hover:border-zinc-300"
        >
          <!-- 헤더: 제목 + slug / 오른쪽 PUBLIC 배지 -->
          <div class="flex items-start justify-between gap-3 mb-1.5">
            <div class="min-w-0 flex-1">
              <a
                :href="p.publicUrl"
                target="_blank"
                rel="noopener"
                class="block text-[15px] font-semibold leading-snug text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-1 line-clamp-2"
              >{{ p.title }}</a>
              <a
                :href="p.publicUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:hover:text-emerald-400"
              >
                <LinkIcon class="w-3 h-3 shrink-0" />
                <span class="truncate">/p/{{ p.slug }}</span>
              </a>
            </div>
            <span class="shrink-0 rounded bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">Public</span>
          </div>

          <p v-if="p.summary || p.descriptionPreview" class="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2 my-2">{{ p.summary || p.descriptionPreview }}</p>

          <!-- 지표 + 태그 -->
          <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pb-2.5 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
            <span class="inline-flex items-center gap-1.5"><EyeIcon class="w-3 h-3 text-zinc-400 dark:text-zinc-600" /><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.viewCount }}</b> views</span>
            <span><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.stepCount }}</b> steps</span>
            <span><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.solutionCount }}</b> solution{{ p.solutionCount === 1 ? '' : 's' }}</span>
            <div v-if="p.tags.length" class="ml-auto inline-flex flex-wrap items-center gap-1.5">
              <span
                v-for="t in p.tags.slice(0, 3)"
                :key="t"
                class="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-px font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60"
              >#{{ t }}</span>
            </div>
          </div>

          <!-- 액션 + 저자/타이밍 -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-800">
            <div class="flex items-center gap-1.5">
              <a :href="p.publicUrl" target="_blank" rel="noopener" class="pub-btn pub-btn-primary"><LinkIcon class="w-3 h-3" />Open</a>
              <button type="button" class="pub-btn" @click="copyLink(p)">
                <component :is="copiedSlug === p.slug ? CheckIcon : ClipboardDocumentIcon" class="w-3 h-3" />
                {{ copiedSlug === p.slug ? 'Copied' : 'Copy link' }}
              </button>
            </div>
            <div class="flex items-center gap-3 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
              <span v-if="p.author" class="border-r border-zinc-200 pr-3 dark:border-zinc-700">{{ p.author }}</span>
              <span><b class="font-medium text-zinc-500 dark:text-zinc-400">published</b> {{ formatAbsolute(p.publishedAt) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <h3 class="serif-title text-3xl text-zinc-800 dark:text-zinc-200 mb-6">Nothing to Explore Yet</h3>
        <p class="text-zinc-500 font-light text-sm max-w-md mx-auto leading-relaxed">
          Public write-ups appear here as people publish the cases they've solved.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 카드 액션 버튼 — Library 발행물 리스트와 동일(outline chip) */
.pub-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  border: 1px solid #e4e4e7;
  background: transparent;
  color: #71717a;
  font: 500 10.5px "JetBrains Mono", ui-monospace, Menlo, monospace;
  cursor: pointer;
  transition: color .12s, border-color .12s, background-color .12s;
  text-decoration: none;
}
.pub-btn:hover { border-color: #71717a; color: #18181b; background: #f4f4f5; }
.pub-btn-primary:hover { border-color: #059669; color: #059669; background: rgba(16, 185, 129, .06); }
</style>

<!--
  카드 호버 = Library 발행물 리스트(PublishedList)와 동일: 테두리를 지우고 hover 시 좌측 초록
  액센트 바가 위→아래로 자라며 배경이 살짝 뜨고 padding-left 가 벌어진다. LightningCSS 가
  scoped :global(.dark) 를 드랍하므로 비-scoped 블록에서 처리(유틸보다 우선하도록 unlayered).
-->
<style>
.pub-card {
  position: relative;
  border-color: transparent;
  background: transparent;
  padding-left: 20px;
  transition: background-color .18s, padding-left .22s cubic-bezier(.4, 0, .2, 1);
}
.pub-card::before {
  content: "";
  position: absolute;
  left: 0; top: 12px; bottom: 12px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(#34d399, #059669);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform .24s cubic-bezier(.4, 0, .2, 1);
}
.pub-card:hover { border-color: transparent; background: rgba(0, 0, 0, .025); padding-left: 24px; }
.pub-card:hover::before { transform: scaleY(1); }
html.dark .pub-card:hover { background: rgba(255, 255, 255, .025); }
html.dark .pub-btn { border-color: #27272a; color: #a1a1aa; }
html.dark .pub-btn:hover { border-color: #a1a1aa; color: #e4e4e7; background: #232327; }
html.dark .pub-btn-primary:hover { border-color: #10b981; color: #34d399; background: rgba(16, 185, 129, .1); }
</style>

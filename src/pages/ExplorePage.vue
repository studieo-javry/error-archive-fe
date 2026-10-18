<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublicPublishmentItem } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { GlobeAltIcon, EyeIcon, LinkIcon } from '@heroicons/vue/24/outline'

// Explore = 공개(PUBLIC+LIVE) 발행물 갤러리. 소유자 무관 — 누구나 발견할 수 있는 글.
// 커서 페이징은 아직(공개 목록은 상위 N건). 카드 → 공개 페이지(publicUrl, 새 탭).
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
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
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
      <div v-if="items.length" class="grid gap-3 sm:grid-cols-2">
        <a
          v-for="p in items"
          :key="p.slug"
          :href="p.publicUrl"
          target="_blank"
          rel="noopener"
          class="exp-card group rounded-xl border border-zinc-200 bg-white px-5 py-[18px] transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 class="text-[15px] font-semibold leading-snug text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 mb-1.5">
            {{ p.title }}
          </h2>

          <p v-if="p.summary || p.descriptionPreview" class="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
            {{ p.summary || p.descriptionPreview }}
          </p>

          <!-- 지표 + 태그 -->
          <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mb-2.5">
            <span class="inline-flex items-center gap-1.5"><EyeIcon class="w-3 h-3 text-zinc-400 dark:text-zinc-600" /><b class="font-semibold text-zinc-700 dark:text-zinc-300">{{ p.viewCount }}</b></span>
            <span><b class="font-semibold text-zinc-700 dark:text-zinc-300">{{ p.stepCount }}</b> steps</span>
            <span><b class="font-semibold text-zinc-700 dark:text-zinc-300">{{ p.solutionCount }}</b> solution{{ p.solutionCount === 1 ? '' : 's' }}</span>
            <div v-if="p.tags.length" class="ml-auto inline-flex flex-wrap items-center gap-1.5">
              <span
                v-for="t in p.tags.slice(0, 3)"
                :key="t"
                class="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-px text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60"
              >#{{ t }}</span>
            </div>
          </div>

          <!-- 푸터: 저자 · slug · 날짜 -->
          <div class="flex items-center justify-between gap-2 border-t border-dashed border-zinc-200 pt-2.5 dark:border-zinc-800 text-[10.5px] font-mono text-zinc-400 dark:text-zinc-600">
            <span class="inline-flex items-center gap-1.5 min-w-0">
              <span v-if="p.author" class="truncate text-zinc-500 dark:text-zinc-400">{{ p.author }}</span>
              <span class="inline-flex items-center gap-1 text-zinc-400 dark:text-zinc-600"><LinkIcon class="w-3 h-3 shrink-0" />/p/{{ p.slug }}</span>
            </span>
            <span class="shrink-0">{{ formatAbsolute(p.publishedAt) }}</span>
          </div>
        </a>
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
/* 카드 좌측 초록 액센트 — hover 시 위→아래로 자란다(라이트/다크 공통, PublishedList 와 동일 감성). */
.exp-card { position: relative; overflow: hidden; }
.exp-card::before {
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
.exp-card:hover::before { transform: scaleY(1); }
</style>

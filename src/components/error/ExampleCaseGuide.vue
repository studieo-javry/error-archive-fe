<script setup lang="ts">
// 작성 예시 케이스(응답 demo=true) 상세 안내 — 접힌 한 줄 → 단계 3칸 → 전체 가이드 문서(우측 드로어).
import { onUnmounted, ref, watch } from 'vue'
import { BookOpenIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useTeamStore } from '@/stores/teamStore'

const teamStore = useTeamStore()
const expanded = ref(false)
const drawerOpen = ref(false)

const steps = [
  { no: '01', section: 'Context', text: '증상, 환경, 재현 방법을 적어요.' },
  { no: '02', section: 'Resolution Timeline', text: '가설과 시도 결과를 시간순으로 기록해요.' },
  { no: '03', section: 'Solution', text: '검증된 해결 과정을 모아 정리해요.' },
]

const docItems = [
  {
    no: '01', title: 'Context · 어떤 문제가 발생했나요?',
    body: '어떤 서비스와 환경에서 나타났는지, 어떤 조건에서 재현되는지, 사용자에게 어떤 영향이 있었는지를 남겨요.',
    example: 'production 배포 직후 API 요청에서 CORS 오류 발생. 브라우저 preflight 요청이 실패함.',
  },
  {
    no: '02', title: 'Snapshot · 무엇을 확인했나요?',
    body: '에러 메시지, 스택 트레이스, 로그, 관련 코드 조각을 추가해 문제 상황을 재현할 단서를 남겨요. 민감정보는 반드시 제거해 주세요.',
    example: null,
  },
  {
    no: '03', title: 'Resolution Timeline · 어떻게 해결했나요?',
    body: '가설 → 시도한 방법 → 관찰한 결과를 스텝으로 기록해요. 성공한 방법뿐 아니라 실패한 시도도 유용한 근거가 돼요.',
    example: 'nginx 헤더 중복 가능성 조사 → OPTIONS 응답 확인 → 설정 수정 및 재검증.',
  },
  {
    no: '04', title: 'Solution · 다음에는 어떻게 해결하나요?',
    body: '실제로 효과 있었던 스텝을 묶고, 핵심 원인과 해결 조건을 요약해요. 나중에 같은 오류를 만나도 바로 참고할 수 있어요.',
    example: null,
  },
]

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') drawerOpen.value = false
}
watch(drawerOpen, (open) => {
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="-mt-3.5 mb-14 break-keep border-t border-b border-zinc-200 dark:border-zinc-800">
    <button
      type="button"
      class="flex w-full items-center gap-2.5 py-3.5 text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <BookOpenIcon class="w-4 h-4 shrink-0 text-zinc-400" />
      <span class="flex-1 text-sm text-zinc-500 dark:text-zinc-400">
        <strong class="font-semibold text-zinc-800 dark:text-zinc-200">이 케이스를 따라 작성하는 법</strong>
        · Context / Timeline / Solution
      </span>
      <ChevronDownIcon class="w-4 h-4 shrink-0 text-zinc-400 transition-transform" :class="{ 'rotate-180': expanded }" />
    </button>
    <div v-if="expanded" class="grid gap-3 pb-4 pl-6 sm:grid-cols-3">
      <div
        v-for="s in steps"
        :key="s.no"
        class="rounded-lg bg-zinc-100 dark:bg-zinc-800/70 p-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
      >
        <strong class="mb-1 block font-semibold text-zinc-800 dark:text-zinc-200">{{ s.no }} {{ s.section }}</strong>
        {{ s.text }}
      </div>
      <button
        type="button"
        class="justify-self-start pt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline sm:col-span-3"
        @click="drawerOpen = true"
      >전체 가이드 문서 보기 →</button>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="drawerOpen"
      class="fixed inset-0 z-50 flex justify-end bg-black/60"
      @click.self="drawerOpen = false"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="케이스 작성 가이드"
        class="h-full w-full max-w-[520px] overflow-auto border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl"
      >
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-7 py-5">
          <b class="text-[15px] text-zinc-900 dark:text-zinc-100">케이스 작성 가이드</b>
          <button type="button" aria-label="닫기" class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" @click="drawerOpen = false">
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
        <div class="px-8 pt-8 pb-14 break-keep">
          <span class="mb-3.5 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
            <BookOpenIcon class="w-4 h-4" /> ERROR ARCHIVE · GETTING STARTED
          </span>
          <h2 class="mb-4 text-[28px] font-bold leading-snug tracking-tight text-balance text-zinc-900 dark:text-zinc-100">에러 케이스를 다시 참고할 수 있는 기록으로</h2>
          <p class="mb-7 text-sm leading-loose text-zinc-500 dark:text-zinc-400">
            에러의 증상만 남기지 말고, 어떤 원인을 의심했고 무엇을 검증했는지 기록해 보세요.
            아래 네 가지를 채우면 다른 개발자도 과정을 따라갈 수 있는 케이스가 완성돼요.
          </p>
          <div v-for="item in docItems" :key="item.no" class="mb-6 grid grid-cols-[24px_1fr] gap-3">
            <div class="grid h-6 w-6 place-items-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-400">{{ item.no }}</div>
            <div class="min-w-0">
              <h3 class="mt-0.5 mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">{{ item.title }}</h3>
              <p class="text-xs leading-loose text-zinc-500 dark:text-zinc-400">{{ item.body }}</p>
              <div v-if="item.example" class="mt-3 rounded-md bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                <strong class="text-zinc-800 dark:text-zinc-200">예시</strong> {{ item.example }}
              </div>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <router-link
              :to="{ name: 'errorCreate', params: { slug: teamStore.currentSlug } }"
              class="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >내 케이스 작성하기 →</router-link>
            <button
              type="button"
              class="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              @click="drawerOpen = false"
            >예시 케이스 보기</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

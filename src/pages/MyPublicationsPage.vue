<script setup lang="ts">
import PublishedList from '@/components/publish/PublishedList.vue'
import { DocumentTextIcon } from '@heroicons/vue/24/outline'

// 내 발행물 전체 페이지 — Profile 의 Publications 미리보기에서 "View all" 로 진입.
// 전역 라우트(/me/publications). 발행물은 워크스페이스 무관(개인 자산)이라 slug 없음.
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <div class="mb-6">
      <div class="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 mb-1.5">
        <DocumentTextIcon class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <h1 class="text-xl font-semibold">My Publications</h1>
      </div>
      <p class="text-[12.5px] text-zinc-400 dark:text-zinc-600">
        Everything you've published — shareable write-ups of the cases you've solved.
      </p>
    </div>
    <PublishedList />
  </div>
</template>

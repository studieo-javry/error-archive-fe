<script setup lang="ts">
import { InformationCircleIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div
    class="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium
           bg-amber-50 text-amber-800 border-b border-amber-200
           dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
    role="status"
  >
    <InformationCircleIcon class="w-4 h-4 shrink-0" />
    <span>
      데모 모드 — 둘러보기 전용 세션입니다. <span class="hidden sm:inline">파일 업로드·발행 등 일부 기능은 비활성화돼 있고, </span>변경사항은 매일 초기화됩니다.
    </span>
  </div>
</template>

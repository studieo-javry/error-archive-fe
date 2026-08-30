<script setup lang="ts">
import ActiveCasesSection from '@/components/home/ActiveCasesSection.vue'
import FollowingFeedSection from '@/components/home/FollowingFeedSection.vue'
import WatchlistSection from '@/components/home/WatchlistSection.vue'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { StarIcon } from '@heroicons/vue/24/solid'

const authStore = useAuthStore()
const teamStore = useTeamStore()

// The case-based sections only show what belongs to the workspace you're currently in.
const scopeLabel = computed(() => teamStore.currentWorkspace?.name ?? 'Personal')
const hour = new Date().getHours()
const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
</script>

<template>
  <div class="relative">
    <div class="ambient-glow" />

    <!-- sits above .ambient-glow (z-0) without competing with the app chrome -->
    <div class="relative">
      <!-- Header -->
      <header class="mb-20">
        <div class="text-emerald-600 dark:text-emerald-500 font-mono text-[10px] font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
          <span class="w-2 h-px bg-emerald-500" /> Overview
        </div>
        <h1 class="serif-title text-4xl md:text-5xl text-zinc-900 dark:text-zinc-100 font-light mb-5 tracking-tight">
          Good {{ greeting }}<span v-if="authStore.user">, {{ authStore.user.displayName }}</span>
        </h1>
        <p class="text-zinc-500 dark:text-zinc-400 font-light text-sm">Here's what's happening across your errors.</p>
      </header>

      <!-- My Active Cases -->
      <section class="mb-20">
        <div class="flex justify-between items-end mb-8">
          <h2 class="text-xl font-medium text-zinc-800 dark:text-zinc-100 tracking-tight">My Active Cases</h2>
          <span class="text-xs font-mono text-zinc-500">{{ scopeLabel }} · 7 days</span>
        </div>
        <div class="gradient-divider mb-6" />
        <ActiveCasesSection />
      </section>

      <!-- Team Network (following feed) -->
      <section class="mb-20">
        <div class="flex justify-between items-end mb-8">
          <h2 class="text-xl font-medium text-zinc-800 dark:text-zinc-100 tracking-tight">People You Follow</h2>
          <span class="text-xs font-mono text-zinc-500">Across all workspaces</span>
        </div>
        <div class="gradient-divider mb-8" />
        <FollowingFeedSection />
      </section>

      <!-- Watchlist Updates -->
      <section>
        <div class="flex justify-between items-end mb-8">
          <h2 class="text-xl font-medium text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            Watchlist Updates <StarIcon class="w-4 h-4 text-amber-500" />
          </h2>
          <span class="text-xs font-mono text-zinc-500">{{ scopeLabel }}</span>
        </div>
        <div class="gradient-divider mb-6" />
        <WatchlistSection />
      </section>
    </div>
  </div>
</template>

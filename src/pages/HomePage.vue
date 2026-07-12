<script setup lang="ts">
import WatchlistSection from '@/components/home/WatchlistSection.vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-1">
      Good {{ new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening' }}<span v-if="authStore.user">, {{ authStore.user.displayName }}</span>
    </h1>
    <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Here's what's happening with your errors</p>

    <div class="space-y-12">
      <!-- Watchlist -->
      <section class="pt-10 border-t border-zinc-100 dark:border-zinc-800/60">
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Watchlist</h2>
        <WatchlistSection />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()

const typedText = ref('')
const showButton = ref(false)
const transitioning = ref(false)

const fullText = '> errorarchive --trace-the-unknown'
let typeTimer: ReturnType<typeof setTimeout> | null = null
let charIndex = 0

let targetX = 0
let targetY = 0
let smoothX = 0
let smoothY = 0
let rafId = 0

function onMouseMove(e: MouseEvent) {
  targetX = e.clientX
  targetY = e.clientY
}

function renderLoop() {
  smoothX += (targetX - smoothX) * 0.08
  smoothY += (targetY - smoothY) * 0.08
  document.documentElement.style.setProperty('--smx', smoothX + 'px')
  document.documentElement.style.setProperty('--smy', smoothY + 'px')
  rafId = requestAnimationFrame(renderLoop)
}

function typeNextChar() {
  if (charIndex < fullText.length) {
    typedText.value += fullText.charAt(charIndex)
    charIndex++
    typeTimer = setTimeout(typeNextChar, 30)
  } else {
    setTimeout(() => { showButton.value = true }, 300)
  }
}

function launchWorkspace() {
  transitioning.value = true
  setTimeout(() => { router.push('/home') }, 500)
}

onMounted(() => {
  targetX = window.innerWidth / 2
  targetY = window.innerHeight / 2
  smoothX = targetX
  smoothY = targetY

  window.addEventListener('mousemove', onMouseMove)
  rafId = requestAnimationFrame(renderLoop)

  setTimeout(() => { typeTimer = setTimeout(typeNextChar, 0) }, 150)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  cancelAnimationFrame(rafId)
  if (typeTimer) clearTimeout(typeTimer)
  document.documentElement.style.removeProperty('--smx')
  document.documentElement.style.removeProperty('--smy')
})
</script>

<template>
  <div class="relative h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#18181b] dark:text-[#e4e4e7]">
    <!-- Ambient spotlight -->
    <div class="ambient-spotlight" />

    <!-- Nav -->
    <nav class="absolute top-0 left-0 right-0 h-24 px-10 flex items-center justify-between z-20">
      <div class="flex items-center gap-3">
        <div class="text-emerald-600 dark:text-emerald-500 text-xl transition-colors duration-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
        </div>
        <span class="font-bold text-lg tracking-tighter text-zinc-800 dark:text-zinc-200">ErrorArchive</span>
      </div>
      <button
        class="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/50 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition"
        @click="toggleTheme"
      >
        <svg v-if="!isDark" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
      </button>
    </nav>

    <!-- Main content -->
    <section class="absolute inset-0 flex flex-col justify-center items-center z-10">
      <div class="text-left w-full max-w-2xl px-8 relative z-10">
        <div class="font-mono text-zinc-500 dark:text-zinc-400 text-sm mb-4 opacity-80 transition-colors duration-300">
          errorarchive ~ where errors become lessons
        </div>

        <div class="prompt-text text-zinc-800 dark:text-zinc-100">
          <span>{{ typedText }}</span><span class="cursor-blink bg-emerald-600 dark:bg-emerald-500" />
        </div>

        <div
          class="mt-12 transition-all duration-700 ease-out"
          :class="showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'"
        >
          <button class="btn-hybrid group" @click="launchWorkspace">
            Begin Investigation
            <svg class="w-2.5 h-2.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </button>
        </div>
      </div>
    </section>

    <!-- Transition overlay -->
    <div
      class="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-[#18181b] pointer-events-none transition-opacity duration-500"
      :class="transitioning ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>

<style scoped>
.ambient-spotlight {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(circle 600px at var(--smx, 50vw) var(--smy, 50vh), rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.08) 40%, transparent 100%);
  transition: background 0.4s ease;
}
:global(.dark) .ambient-spotlight {
  background: radial-gradient(circle 600px at var(--smx, 50vw) var(--smy, 50vh), rgba(16, 185, 129, 0.20) 0%, rgba(16, 185, 129, 0.04) 40%, transparent 100%);
}

.prompt-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;
  font-weight: 400;
  transition: color 0.4s ease;
}
@media (min-width: 768px) {
  .prompt-text { font-size: 1.5rem; }
}

.cursor-blink {
  display: inline-block;
  width: 12px;
  height: 1.2em;
  vertical-align: bottom;
  margin-left: 4px;
  animation: blink 1s step-end infinite;
  transition: background-color 0.4s ease;
}
@keyframes blink { 50% { opacity: 0; } }

.btn-hybrid {
  background-color: transparent;
  border: 1px solid #d4d4d8;
  color: #52525b;
  padding: 0.85rem 2.25rem;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: none;
}
.btn-hybrid:hover {
  background-color: #10b981;
  border-color: #10b981;
  color: #ffffff;
  box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
  transform: translateY(-2px);
}
:global(.dark) .btn-hybrid {
  border-color: #3f3f46;
  color: #a1a1aa;
}
:global(.dark) .btn-hybrid:hover {
  background-color: #10b981;
  border-color: #10b981;
  color: #09090b;
  box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
}
</style>

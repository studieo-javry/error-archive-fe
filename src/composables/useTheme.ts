import { ref, watchEffect, computed } from 'vue'

type ThemeMode = 'light' | 'dark' | 'system'

const themeMode = ref<ThemeMode>((localStorage.getItem('themeMode') as ThemeMode) || 'system')

const isDark = computed(() => {
  if (themeMode.value === 'dark') return true
  if (themeMode.value === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('themeMode', themeMode.value)
})

export function useTheme() {
  function toggle() {
    themeMode.value = isDark.value ? 'light' : 'dark'
  }

  function setMode(mode: ThemeMode) {
    themeMode.value = mode
  }

  return { isDark, themeMode, toggle, setMode }
}

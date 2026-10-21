import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 게스트(데모) 전용 크롬의 일시적 UI 상태 — 토스트와 안내 다이얼로그. 목업의 toast()/openDialog() 대응. */
export type DemoDialog = 'workspace' | 'signup' | 'account' | 'settings' | null

export const useDemoStore = defineStore('demo', () => {
  const toastMessage = ref('')
  // 메시지와 별개로 둬서 페이드아웃 동안 문구가 먼저 사라지지 않게 한다.
  const toastVisible = ref(false)
  const dialog = ref<DemoDialog>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function toast(message: string) {
    if (toastTimer) clearTimeout(toastTimer)
    toastMessage.value = message
    toastVisible.value = true
    toastTimer = setTimeout(() => { toastVisible.value = false; toastTimer = null }, 3200)
  }

  function openDialog(d: Exclude<DemoDialog, null>) {
    dialog.value = d
  }

  function closeDialog() {
    dialog.value = null
  }

  return { toastMessage, toastVisible, dialog, toast, openDialog, closeDialog }
})

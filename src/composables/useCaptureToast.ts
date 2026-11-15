import { ref } from 'vue'

// 캡처 화면용 경량 토스트(문자열). 서버 알림(notificationStore.toasts, dto 기반)과 별개의 임시 안내.
const message = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

export function useCaptureToast() {
  function toast(text: string) {
    message.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      message.value = null
    }, 3600)
  }
  return { message, toast }
}

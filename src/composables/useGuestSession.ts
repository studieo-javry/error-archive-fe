import { ref, computed, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'

/**
 * 게스트(데모) 세션의 남은 시간 / 만료 여부를 제공한다.
 * 만료 시각은 `/auth/guest` 가 내려준 `accessTokenExpiresAt`(authStore.guestExpiresAt)를 그대로 쓴다 —
 * 임의의 클라이언트 카운트다운이 아니라 실제 세션 수명을 따른다.
 *
 * 1초 틱은 모듈 레벨 싱글턴(여러 소비자가 하나의 interval 공유)이며, 참조 카운트로 정리한다.
 */
const now = ref(Date.now())
let timer: number | null = null
let consumers = 0

function startClock() {
  if (timer == null) timer = window.setInterval(() => { now.value = Date.now() }, 1000)
}
function stopClock() {
  if (timer != null) { clearInterval(timer); timer = null }
}

export function useGuestSession() {
  const auth = useAuthStore()

  consumers++
  startClock()
  onUnmounted(() => {
    consumers--
    if (consumers <= 0) stopClock()
  })

  const expiresAt = computed(() =>
    auth.guestExpiresAt ? new Date(auth.guestExpiresAt).getTime() : null,
  )

  const remainingMs = computed(() =>
    expiresAt.value == null ? null : Math.max(0, expiresAt.value - now.value),
  )

  const remainingLabel = computed(() => {
    if (remainingMs.value == null) return null
    const total = Math.floor(remainingMs.value / 1000)
    const mm = String(Math.floor(total / 60)).padStart(2, '0')
    const ss = String(total % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })

  const isExpired = computed(() =>
    auth.isGuest && expiresAt.value != null && now.value >= expiresAt.value,
  )

  return { remainingMs, remainingLabel, isExpired }
}

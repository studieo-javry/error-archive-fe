<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGuestSession } from '@/composables/useGuestSession'
import { useAuth } from '@/composables/useAuth'
import DemoIcon from '@/components/demo/DemoIcon.vue'

const { isExpired } = useGuestSession()
const { loginAsGuest, startSignup } = useAuth()
const dismissed = ref(false)
const restarting = ref(false)

// 새로 만료되면 다시 노출.
watch(isExpired, (v) => { if (v) dismissed.value = false })

function restart() {
  if (restarting.value) return
  restarting.value = true
  loginAsGuest().finally(() => { restarting.value = false })
}
</script>

<template>
  <div
    v-if="isExpired && !dismissed"
    class="demo-ui"
    style="position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(24,24,27,.3);backdrop-filter:blur(3px)"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
  >
    <div class="demo-dialog" style="position:relative">
      <button type="button" class="icon-btn dialog-close" aria-label="창 닫기" @click="dismissed = true"><DemoIcon name="close" /></button>
      <p class="dialog-eyebrow mono">DEMO ENDED</p>
      <h2 id="dialog-title" class="dialog-title">데모 시간이 끝났어요.</h2>
      <p class="dialog-copy">가입하면 지금까지 둘러본 흐름 그대로, 내 워크스페이스에서 에러를 기록하고 해결 과정을 이어갈 수 있어요.</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-primary" @click="startSignup"><DemoIcon name="arrow" />가입하기</button>
        <button type="button" class="btn btn-quiet" @click="restart"><DemoIcon name="reset" />{{ restarting ? '다시 시작하는 중…' : '데모 다시 시작하기' }}</button>
      </div>
    </div>
  </div>
</template>

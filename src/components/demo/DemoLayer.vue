<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useDemoStore } from '@/stores/demoStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuth } from '@/composables/useAuth'
import { useTour } from '@/composables/useTour'
import DemoIcon from '@/components/demo/DemoIcon.vue'

// 게스트 전용 오버레이 레이어: 토스트 + 워크스페이스/가입 안내 다이얼로그(목업 openWorkspace / openSignup).
const demo = useDemoStore()
const teamStore = useTeamStore()
const { startSignup } = useAuth()
const { resume: startTour } = useTour()

function openGuide() {
  demo.closeDialog()
  startTour()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') demo.closeDialog()
}
watch(() => demo.dialog, (d) => {
  if (d) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function signup() {
  demo.closeDialog()
  startSignup()
}
</script>

<template>
  <div class="demo-ui">
    <div
      v-if="demo.dialog"
      class="demo-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-dialog-title"
      @mousedown.self="demo.closeDialog()"
    >
      <div class="demo-dialog" style="position:relative">
        <button type="button" class="icon-btn dialog-close" aria-label="창 닫기" @click="demo.closeDialog()"><DemoIcon name="close" /></button>

        <template v-if="demo.dialog === 'workspace'">
          <p class="dialog-eyebrow mono">WORKSPACE</p>
          <h2 id="demo-dialog-title" class="dialog-title">{{ teamStore.currentWorkspace?.name ?? 'Demo workspace' }}</h2>
          <p class="dialog-copy">샘플 케이스로 기록의 흐름을 살펴보는 공간이에요. Home과 Library에서 같은 케이스를 다른 맥락으로 확인할 수 있어요.</p>
          <div class="public-locked">
            <DemoIcon name="meridian" />
            <div>
              <div class="public-locked-title">가입하면 열리는 공개 공간</div>
              <div class="public-locked-copy">다른 사람들의 케이스를 검색(Search)하고,<br>발행된 해결 글을 둘러볼(Explore) 수 있어요.</div>
            </div>
          </div>
          <div class="dialog-menu">
            <button type="button" @click="demo.closeDialog()">
              <span>{{ teamStore.currentWorkspace?.name ?? 'Demo workspace' }} <span class="pill pill-green" style="margin-left:8px">현재 공간</span></span>
              <DemoIcon name="check" />
            </button>
            <button type="button" @click="demo.openDialog('signup')">
              <span>내 워크스페이스 시작하기</span>
              <DemoIcon name="arrow" />
            </button>
          </div>
        </template>

        <!-- 사이드바 계정 메뉴 → Profile (목업 openAccount) -->
        <template v-else-if="demo.dialog === 'account'">
          <p class="dialog-eyebrow mono">ACCOUNT</p>
          <h2 id="demo-dialog-title" class="dialog-title">Guest session</h2>
          <p class="dialog-copy">1시간 동안 샘플 데이터로 서비스를 둘러볼 수 있어요. 파일 업로드와 발행은 가입 후 내 워크스페이스에서 이용할 수 있습니다.</p>
          <div class="dialog-menu">
            <button type="button" @click="openGuide"><span>사용 가이드 열기</span><DemoIcon name="compass" /></button>
            <button type="button" @click="demo.openDialog('signup')"><span>내 기록 시작하기</span><DemoIcon name="arrow" /></button>
          </div>
        </template>

        <!-- 사이드바 계정 메뉴 → Settings (목업 mockAction('Settings')) -->
        <template v-else-if="demo.dialog === 'settings'">
          <p class="dialog-eyebrow mono">SETTINGS</p>
          <h2 id="demo-dialog-title" class="dialog-title">Settings</h2>
          <p class="dialog-copy">환경 설정과 프로필은 실제 서비스에서 관리할 수 있어요.</p>
          <p class="dialog-note">데모 세션에서는 설정을 바꾸거나 저장하지 않아요. 가입하면 내 계정에서 관리할 수 있어요.</p>
          <div class="dialog-actions">
            <button type="button" class="btn btn-primary" @click="demo.closeDialog()">확인</button>
          </div>
        </template>

        <template v-else-if="demo.dialog === 'signup'">
          <p class="dialog-eyebrow mono">YOUR NEXT CASE</p>
          <h2 id="demo-dialog-title" class="dialog-title">이번에는 내 에러를<br>해결 기록으로 남겨보세요.</h2>
          <p class="dialog-copy">샘플에서 살펴본 흐름 그대로, 내 워크스페이스에서 기록을 쌓을 수 있어요.</p>
          <div class="dialog-features">
            <div class="dialog-feature"><DemoIcon name="library" />에러의 맥락과 시도를 한 케이스에 모으기</div>
            <div class="dialog-feature"><DemoIcon name="link" />해결에 기여한 시도를 솔루션으로 연결하기</div>
            <div class="dialog-feature"><DemoIcon name="globe" />정리한 아티클을 공개하고 공유하기</div>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-primary" @click="signup"><DemoIcon name="arrow" />가입하기</button>
            <button type="button" class="btn btn-quiet" @click="demo.closeDialog()">계속 둘러볼게요</button>
          </div>
        </template>
      </div>
    </div>

    <div class="demo-toast" :class="{ show: demo.toastVisible }" role="status" aria-live="polite">{{ demo.toastMessage }}</div>
  </div>
</template>

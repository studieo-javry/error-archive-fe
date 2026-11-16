<script setup lang="ts">
// 프로젝트 — 수집 기록·기존 Case 를 프로젝트별로 묶는 분류. GET/POST /me/project-bindings.
// 웹 등록과 로컬 수집 승인은 별개(최초 승인은 CLI).
import { onMounted, ref } from 'vue'
import CapIcon from '@/components/capture/CapIcon.vue'
import CapModal from '@/components/capture/CapModal.vue'
import { projectBindingApi } from '@/services/projectBindingApi'
import type { ProjectBinding } from '@/types/projectBinding'
import { useCaptureToast } from '@/composables/useCaptureToast'

const { toast } = useCaptureToast()

const projects = ref<ProjectBinding[]>([])
const loading = ref(false)
const loadError = ref(false)

const showNew = ref(false)
const form = ref({ projectKey: '', repo: '' })
const creating = ref(false)

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const { data } = await projectBindingApi.list()
    projects.value = data.items
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openNew() {
  form.value = { projectKey: '', repo: '' }
  showNew.value = true
}
async function create() {
  const key = form.value.projectKey.trim()
  if (!key) {
    toast('프로젝트 식별자를 입력해 주세요.')
    return
  }
  if (creating.value) return
  creating.value = true
  try {
    const existing = projects.value.find((p) => p.projectKey === key)
    await projectBindingApi.create({ projectKey: key, normalizedRepoId: form.value.repo.trim() || null })
    await load()
    showNew.value = false
    toast(existing ? '같은 식별자의 기존 프로젝트를 사용합니다.' : '프로젝트를 등록했어요. 로컬 승인은 별도로 진행해 주세요.')
  } catch {
    toast('프로젝트 등록에 실패했어요. 다시 시도해 주세요.')
  } finally {
    creating.value = false
  }
}

function koDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div>
    <div class="row between wrap" style="margin-bottom: 8px">
      <span class="small muted">수집한 기록과 기존 Case를 프로젝트별로 묶어 관리합니다.</span>
      <button type="button" class="btn primary" @click="openNew"><CapIcon name="plus" />프로젝트 등록</button>
    </div>

    <div class="notice neutral" style="margin: 16px 0">
      웹에서 등록한 프로젝트와 로컬 수집 승인은 별개예요. 작업 폴더의 최초 승인은 Claude Code 또는 터미널에서 진행해 주세요.
    </div>

    <div v-if="loading && !projects.length" class="card">
      <div class="loading" style="width: 50%" />
      <div class="loading" style="width: 75%" />
      <p class="small muted">프로젝트를 불러오고 있어요…</p>
    </div>

    <div v-else-if="loadError" class="notice rose" role="alert">
      프로젝트를 불러오지 못했어요.<br />
      <button type="button" class="btn small" @click="load">다시 불러오기</button>
    </div>

    <template v-else>
      <div v-if="projects.length">
        <div v-for="p in projects" :key="p.id" class="project-row">
          <div class="connection-icon"><CapIcon name="folder" /></div>
          <div class="grow">
            <h3>{{ p.projectKey }}</h3>
            <p class="tiny muted">{{ p.normalizedRepoId || '저장소 정보 없음' }}</p>
            <span class="tiny muted">등록 {{ koDate(p.createdAt) }} · 기본 보관</span>
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <div class="empty-icon"><CapIcon name="folder" /></div>
        <h2 class="serif">아직 프로젝트가 없어요</h2>
        <p>프로젝트 식별자를 등록해 수집 기록을 묶어보세요. 로컬 작업 폴더 승인은 CLI에서 진행합니다.</p>
        <button type="button" class="btn primary" @click="openNew">프로젝트 등록</button>
      </div>

      <div class="callout">
        <p class="small muted">프로젝트 귀속은 Case의 분류 정보입니다. 연결 토큰의 기존 Case 읽기 권한을 제한하지 않습니다.</p>
      </div>
    </template>

    <CapModal :show="showNew" title="프로젝트 등록" @close="showNew = false">
      <label class="form-field"><span>프로젝트 식별자</span><input v-model="form.projectKey" class="cap-input" placeholder="error-archive" /></label>
      <label class="form-field"><span>저장소 식별자 (선택)</span><input v-model="form.repo" class="cap-input" placeholder="github.com/org/repo" /></label>
      <p class="tiny muted">같은 식별자로 등록하면 기존 프로젝트를 사용합니다. 저장소 정보를 변경하는 요청은 아닙니다.</p>
      <template #footer>
        <button type="button" class="btn" @click="showNew = false">취소</button>
        <button type="button" class="btn primary" :disabled="creating" @click="create">
          <span v-if="creating" class="spinner" />프로젝트 등록
        </button>
      </template>
    </CapModal>
  </div>
</template>

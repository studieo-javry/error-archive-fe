<script setup lang="ts">
/**
 * Settings → Integrations — Agent connections.
 * 로컬 커넥터(Claude Code MCP)가 내 계정에 초안을 남길 수 있도록 연결 토큰을 발급·조회·폐기한다.
 * 마크업·문구는 error_archive_agent_capture_final.html 의 connectionPage/모달, 스타일은 styles/agent-capture.css(.cap).
 *  - 목록: GET /me/agent-connections   - 발급: POST (token 1회 노출)   - 폐기: DELETE /{id}
 */
import { onMounted, ref } from 'vue'
import { isAxiosError } from 'axios'
import CapIcon from '@/components/capture/CapIcon.vue'
import CapModal from '@/components/capture/CapModal.vue'
import { agentConnectionApi } from '@/services/agentConnectionApi'
import { DEFAULT_AGENT_SCOPES, type AgentConnection } from '@/types/agentConnection'
import { useCaptureToast } from '@/composables/useCaptureToast'
import { timeAgo } from '@/utils/timeAgo'

const { toast } = useCaptureToast()

const connections = ref<AgentConnection[]>([])
const loading = ref(false)
const loadError = ref(false)

// 드래프트 커넥터 버전(설치 안내). package.json version 한 곳만 바꾸면 되는 커넥터와 맞춤.
const CONNECTOR_VERSION = '1.11.0'

type ModalKind = 'new' | 'token' | 'guide' | 'revoke' | null
const modal = ref<ModalKind>(null)

// 새 연결 폼
const newLabel = ref('MacBook · 개발용')
const newCaseRead = ref(true)
const creating = ref(false)

// 토큰 1회 노출
const issuedToken = ref('')
const issuedLabel = ref('')
const tokenHidden = ref(false)

// 폐기 대상
const revokeTarget = ref<AgentConnection | null>(null)
const revoking = ref(false)

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const { data } = await agentConnectionApi.list()
    connections.value = data
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function refresh() {
  await load()
  if (!loadError.value) toast('연결 목록을 새로고침했어요.')
}

function koDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function statusBadge(c: AgentConnection): { label: string; tone: string } {
  if (c.expired) return { label: '만료됨', tone: 'amber' }
  if (c.lastUsedAt) return { label: '유효', tone: 'green' }
  return { label: '사용 확인 전', tone: '' }
}

function openNew() {
  newLabel.value = ''
  newCaseRead.value = true
  modal.value = 'new'
}

async function createConnection() {
  if (creating.value) return
  creating.value = true
  try {
    const scopes = [...DEFAULT_AGENT_SCOPES].filter((s) => s !== 'case:read' || newCaseRead.value)
    const { data } = await agentConnectionApi.create({ label: newLabel.value.trim() || null, scopes })
    issuedToken.value = data.token
    issuedLabel.value = data.label || '이름 없는 연결'
    tokenHidden.value = false
    await load()
    modal.value = 'token'
  } catch {
    toast('연결을 발급하지 못했어요. 잠시 후 다시 시도해 주세요.')
  } finally {
    creating.value = false
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('복사했어요.')
  } catch {
    toast('클립보드 사용이 제한되어 있어요. 텍스트를 직접 선택해 복사해 주세요.')
  }
}

function askRevoke(c: AgentConnection) {
  revokeTarget.value = c
  modal.value = 'revoke'
}
async function confirmRevoke() {
  const target = revokeTarget.value
  if (!target || revoking.value) return
  revoking.value = true
  try {
    await agentConnectionApi.revoke(target.connectionId)
    connections.value = connections.value.filter((c) => c.connectionId !== target.connectionId)
    modal.value = null
    toast('연결을 폐기했어요. 기존 기록은 유지됩니다.')
  } catch (e) {
    // 404 = 이미 폐기/없음 → 목록에서 제거하고 조용히 닫는다(멱등).
    if (isAxiosError(e) && e.response?.status === 404) {
      connections.value = connections.value.filter((c) => c.connectionId !== target.connectionId)
      modal.value = null
    } else {
      toast('연결 폐기에 실패했어요. 다시 시도해 주세요.')
    }
  } finally {
    revoking.value = false
  }
}

const guideCommands = {
  register: `npm login --scope=@error-archive
claude mcp add --scope user --transport stdio error-archive -- npx -y @error-archive/agent@${CONNECTOR_VERSION}`,
  config: `{
  "baseUrl": "<사용 중인 Error Archive API 주소>",
  "token": "<발급한 연결 토큰>"
}`,
  chmod: 'chmod 600 ~/.config/error-archive-agent/config.json',
  doctor: `npx -y @error-archive/agent@${CONNECTOR_VERSION} doctor`,
  hooks: `npm install -g @error-archive/agent@${CONNECTOR_VERSION}
error-archive-agent install-hooks
error-archive-agent connect-project /path/to/project`,
}
</script>

<template>
  <div class="cap">
    <div class="row between wrap">
      <div>
        <p class="eyebrow" style="margin-bottom: 8px">INTEGRATIONS</p>
        <h1 class="setting-title">Agent connections</h1>
      </div>
      <button type="button" class="btn primary" @click="openNew"><CapIcon name="plus" />새 연결</button>
    </div>
    <p class="subtitle">AI 코딩 도구가 내 계정에 초안을 남길 수 있도록 연결합니다.</p>

    <div class="intro" style="margin-top: 25px">
      <div class="intro-icon"><CapIcon name="terminal" /></div>
      <div class="grow">
        <h3>Claude Code</h3>
        <p class="small muted">MCP 커넥터 · 초안 수집 · 근거 파일</p>
      </div>
      <button type="button" class="btn small" @click="modal = 'guide'">설치 안내</button>
    </div>

    <div class="row between">
      <h3>내 연결 <span class="muted">{{ connections.length }}</span></h3>
      <button type="button" class="btn ghost small" @click="refresh"><CapIcon name="refresh" />목록 새로고침</button>
    </div>

    <template v-if="loading">
      <div class="card" style="margin-top: 12px">
        <div class="loading" style="width: 55%" />
        <div class="loading" style="width: 85%" />
        <p class="small muted">연결 목록을 불러오고 있어요…</p>
      </div>
    </template>

    <div v-else-if="loadError" class="notice rose" role="alert" style="margin-top: 12px">
      연결 목록을 불러오지 못했어요.<br />
      <button type="button" class="btn small" @click="load"><CapIcon name="refresh" />다시 불러오기</button>
    </div>

    <template v-else>
      <div v-if="connections.length">
        <div v-for="c in connections" :key="c.connectionId" class="connection">
          <div class="connection-icon"><CapIcon name="device" /></div>
          <div class="grow">
            <h3>{{ c.displayName }}</h3>
            <div class="small muted">
              <template v-if="c.clientKind">
                {{ c.clientKind }}<template v-if="c.clientVersion"> · v{{ c.clientVersion }}</template>
                <template v-if="c.installLabel"> · {{ c.installLabel }}</template>
              </template>
              <template v-else>설치 환경 확인 전</template>
            </div>
            <div class="meta">
              <span>최근 사용 {{ c.lastUsedAt ? timeAgo(c.lastUsedAt) : '없음' }}</span>
              <span>·</span>
              <span>{{ koDate(c.expiresAt) }} 만료</span>
            </div>
            <div class="scope-list"><span v-for="s in c.scopes" :key="s">{{ s }}</span></div>
          </div>
          <div class="actions">
            <span class="badge" :class="statusBadge(c).tone">{{ statusBadge(c).label }}</span>
            <button type="button" class="text-btn" @click="askRevoke(c)">연결 폐기</button>
          </div>
        </div>
      </div>

      <div v-else class="empty">
        <div class="empty-icon"><CapIcon name="device" /></div>
        <h2 class="serif">Your first connection</h2>
        <p>기기나 작업 환경별로 이름을 붙여 연결을 구분해 보세요.</p>
        <button type="button" class="btn primary" @click="openNew">새 연결 만들기</button>
      </div>

      <div class="callout">
        <p class="small muted">연결은 세션이 아닌 토큰 단위입니다. 마지막 사용 시각은 실시간 접속 상태를 의미하지 않아요.</p>
      </div>
      <div class="accordion">
        <details>
          <summary>연결을 폐기하면 기록도 사라지나요?</summary>
          <p>폐기는 이후 요청만 차단합니다. 이미 수집된 초안과 반영된 Case는 그대로 유지됩니다.</p>
        </details>
      </div>
      <div class="accordion">
        <details>
          <summary>기존 Case 읽기 권한은 어떤 범위인가요?</summary>
          <p>case:read는 내 소유 Case를 AI가 참고할 수 있는 권한입니다. 프로젝트 연결은 검색 필터이며, 특정 프로젝트만 읽도록 제한하는 권한은 아닙니다.</p>
        </details>
      </div>
    </template>

    <!-- 새 연결 -->
    <CapModal :show="modal === 'new'" title="새 Agent 연결" @close="modal = null">
      <p class="subtitle">어느 기기나 작업 환경에서 사용하는지 알아볼 이름을 붙여주세요.</p>
      <label class="form-field">
        <span>연결 이름</span>
        <input v-model="newLabel" class="cap-input" maxlength="120" placeholder="MacBook · 개발용" />
      </label>
      <div class="notice neutral">기본 권한: 초안 조회·기록, 근거 파일 업로드</div>
      <label class="choice" style="margin-top: 18px">
        <input v-model="newCaseRead" class="check" type="checkbox" />
        <span>내 기존 Case를 AI가 참고하도록 허용<small class="muted" style="display: block">내 소유 Case를 읽을 수 있습니다. 특정 프로젝트에만 제한되지 않습니다.</small></span>
      </label>
      <p class="tiny muted" style="margin-top: 17px">토큰은 발급 직후 한 번만 확인할 수 있으며 기본 30일 후 만료됩니다.</p>
      <template #footer>
        <button type="button" class="btn" @click="modal = null">취소</button>
        <button type="button" class="btn primary" :disabled="creating" @click="createConnection">
          <span v-if="creating" class="spinner" />{{ creating ? '발급 중…' : '연결 토큰 발급' }}
        </button>
      </template>
    </CapModal>

    <!-- 토큰 1회 노출 -->
    <CapModal :show="modal === 'token'" title="토큰을 한 번만 보여드려요" @close="modal = null">
      <p class="subtitle">{{ issuedLabel }} 연결을 만들었습니다. 아래 토큰은 지금만 확인할 수 있어요.</p>
      <div class="token mono">{{ tokenHidden ? '••••••••••••••••••••••••••' : issuedToken }}</div>
      <div class="row">
        <button type="button" class="btn" @click="copyText(issuedToken)"><CapIcon name="copy" />토큰 복사</button>
        <button type="button" class="btn ghost" @click="tokenHidden = !tokenHidden">{{ tokenHidden ? '표시하기' : '가리기' }}</button>
      </div>
      <div class="notice amber" style="margin-top: 18px">창을 닫으면 토큰을 다시 볼 수 없습니다. 분실하면 연결을 폐기하고 새로 발급해 주세요.</div>
      <template #footer>
        <button type="button" class="btn primary" @click="modal = 'guide'">보관했어요 · 설치 안내</button>
      </template>
    </CapModal>

    <!-- 설치 안내 -->
    <CapModal :show="modal === 'guide'" title="Claude Code 연결하기" large @close="modal = null">
      <p class="subtitle">Node.js 20 이상과 패키지 읽기 권한이 필요합니다. 아래 버전은 코드 기준이며, npm 게시·접근 가능 여부를 먼저 확인해 주세요.</p>
      <div class="guide-step">
        <span class="guide-n">1</span>
        <div class="grow">
          <h3>패키지에 접근하고 MCP를 등록해요</h3>
          <div class="code-box">
            <pre>{{ guideCommands.register }}</pre>
            <button type="button" class="iconbtn" aria-label="명령 복사" @click="copyText(guideCommands.register)"><CapIcon name="copy" /></button>
          </div>
        </div>
      </div>
      <div class="guide-step">
        <span class="guide-n">2</span>
        <div class="grow">
          <h3>서버 주소와 발급한 토큰을 설정해요</h3>
          <p class="small muted">~/.config/error-archive-agent/config.json</p>
          <div class="code-box">
            <pre>{{ guideCommands.config }}</pre>
            <button type="button" class="iconbtn" aria-label="명령 복사" @click="copyText(guideCommands.config)"><CapIcon name="copy" /></button>
          </div>
          <div class="code-box">
            <pre>{{ guideCommands.chmod }}</pre>
            <button type="button" class="iconbtn" aria-label="명령 복사" @click="copyText(guideCommands.chmod)"><CapIcon name="copy" /></button>
          </div>
          <p class="tiny muted">토큰이 포함된 명령을 셸 히스토리나 공유 저장소에 남기지 마세요.</p>
        </div>
      </div>
      <div class="guide-step">
        <span class="guide-n">3</span>
        <div class="grow">
          <h3>터미널에서 연결을 확인해요</h3>
          <div class="code-box">
            <pre>{{ guideCommands.doctor }}</pre>
            <button type="button" class="iconbtn" aria-label="명령 복사" @click="copyText(guideCommands.doctor)"><CapIcon name="copy" /></button>
          </div>
          <p class="small muted">진단을 마친 후 이 목록을 새로고침하면 최근 사용 시각을 확인할 수 있어요.</p>
        </div>
      </div>
      <div class="guide-step">
        <span class="guide-n">4</span>
        <div class="grow">
          <h3>Hook을 설치하고 프로젝트를 승인해요</h3>
          <p class="small muted">Hook 명령이 실행되도록 error-archive-agent가 PATH에 있어야 합니다.</p>
          <div class="code-box">
            <pre>{{ guideCommands.hooks }}</pre>
            <button type="button" class="iconbtn" aria-label="명령 복사" @click="copyText(guideCommands.hooks)"><CapIcon name="copy" /></button>
          </div>
          <p class="tiny muted">상세 기록 절차를 함께 설치하려면 install-hooks --with-skill을 사용합니다.</p>
        </div>
      </div>
      <div class="notice neutral">프로젝트 승인에는 도구 입력·출력 수집이 포함됩니다. 프롬프트 원문은 저장하지 않으며, 민감 경로 제외·시크릿 마스킹·크기 제한이 적용됩니다. 로컬 수집 중지는 ERROR_ARCHIVE_COLLECT=off로 설정하세요.</div>
      <template #footer>
        <button type="button" class="btn primary" @click="modal = null">안내 확인</button>
      </template>
    </CapModal>

    <!-- 폐기 확인 -->
    <CapModal :show="modal === 'revoke'" title="연결을 폐기할까요?" @close="modal = null">
      <h3>{{ revokeTarget?.displayName }}</h3>
      <p class="subtitle" style="margin-top: 12px">이 연결의 다음 요청부터 차단됩니다. 이미 수집된 초안과 Case는 유지됩니다.</p>
      <template #footer>
        <button type="button" class="btn" @click="modal = null">취소</button>
        <button type="button" class="btn danger" :disabled="revoking" @click="confirmRevoke">연결 폐기</button>
      </template>
    </CapModal>
  </div>
</template>

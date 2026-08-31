<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import { teamApi } from '@/services/teamApi'
import type { WorkspaceMember, InvitationItem } from '@/types/team'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Modal from '@/components/common/Modal.vue'
import {
  EllipsisHorizontalIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
  UserPlusIcon,
  EnvelopeIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline'

const teamStore = useTeamStore()
const router = useRouter()

// iam-api requires ADMIN for both role changes and invitations
// (ChangeMemberRoleUseCase / InviteMemberUseCase call WorkspaceAccess.requireAdmin),
// so don't offer either to anyone else.
const isAdmin = computed(() => teamStore.currentWorkspace?.role === 'ADMIN')

function openProfile(userId: number) {
  router.push({ name: 'profile', params: { id: String(userId) } })
}

const members = ref<WorkspaceMember[]>([])
const loading = ref(false)
const showInviteModal = ref(false)
// EMAIL = one-off invite mailed to an address, LINK = reusable URL. Both are supported by
// iam-api; only LINK was wired up before.
const inviteType = ref<'EMAIL' | 'LINK'>('EMAIL')
const inviteRole = ref('WRITE')
const inviteEmail = ref('')
const inviteLink = ref('')
const inviteSentTo = ref('')
const inviteError = ref('')
const inviteBusy = ref(false)

// axios 에러 → 사용자에게 보여줄 메시지(BE ProblemDetail 의 detail 우선).
function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { detail?: string; message?: string } | undefined
    return data?.detail ?? data?.message ?? fallback
  }
  return fallback
}

async function loadMembers(wsId: number) {
  loading.value = true
  try {
    const { data } = await teamApi.getMembers(wsId)
    members.value = data
  } finally {
    loading.value = false
  }
}

function resetInviteResult() {
  inviteLink.value = ''
  inviteSentTo.value = ''
  inviteError.value = ''
}

async function createInvite() {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null || inviteBusy.value) return
  const email = inviteEmail.value.trim()
  if (inviteType.value === 'EMAIL' && !email) {
    inviteError.value = '초대할 이메일 주소를 입력해주세요.'
    return
  }
  inviteBusy.value = true
  resetInviteResult()
  try {
    const { data } = await teamApi.createInvitation(wsId, {
      type: inviteType.value,
      role: inviteRole.value,
      email: inviteType.value === 'EMAIL' ? email : null,
      expiresInHours: 168,
    })
    if (inviteType.value === 'EMAIL') {
      inviteSentTo.value = email
      inviteEmail.value = ''
    } else if (data.inviteUrl) {
      inviteLink.value = data.inviteUrl
    } else if (data.inviteToken) {
      // 메일의 accept URL(IAM_INVITATION_BASE_URL=/invitations)과 경로를 일치시킨다.
      inviteLink.value = `${window.location.origin}/invitations/${data.inviteToken}`
    }
    // 방금 보낸 초대가 아래 "대기 중 초대" 목록에 바로 뜨도록 재조회.
    loadInvitations()
  } catch (e) {
    // 예: ADMIN 은 초대로 부여 불가(가입 후 승격) → BE 400. 조용히 실패하지 않도록 표시.
    inviteError.value = errorMessage(
      e,
      inviteType.value === 'EMAIL'
        ? '초대 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'
        : '초대 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    )
  } finally {
    inviteBusy.value = false
  }
}

// ── 대기 중 초대 목록 + 취소 (초대 모달 안) ──
const pendingInvites = ref<InvitationItem[]>([])
const invitesLoading = ref(false)
const confirmRevokeId = ref<number | null>(null) // 인라인 "취소할까요?" 확인 대상
const revokingId = ref<number | null>(null)

const roleLabel: Record<string, string> = { ADMIN: 'Admin', WRITE: 'Write', READ: 'Read' }

// expiresAt → "N일 후 만료" / "N시간 후 만료" / "곧 만료" / "만료됨".
function expiryLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '만료됨'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}일 후 만료`
  if (hours >= 1) return `${hours}시간 후 만료`
  return '곧 만료'
}
// 24시간 이내면 rose 로 강조.
function isExpiringSoon(expiresAt: string): boolean {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return ms > 0 && ms < 86_400_000
}

async function loadInvitations() {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null) return
  invitesLoading.value = true
  try {
    const { data } = await teamApi.listInvitations(wsId)
    pendingInvites.value = data
  } catch {
    // 목록 조회 실패는 조용히 무시(초대 보내기 자체는 계속 가능).
    pendingInvites.value = []
  } finally {
    invitesLoading.value = false
  }
}

async function revokeInvite(invitationId: number) {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null || revokingId.value != null) return
  revokingId.value = invitationId
  try {
    await teamApi.revokeInvitation(wsId, invitationId)
    // 성공: 목록에서 제거(= 더는 대기 중 아님).
    pendingInvites.value = pendingInvites.value.filter((i) => i.invitationId !== invitationId)
    confirmRevokeId.value = null
  } catch (e) {
    inviteError.value = errorMessage(e, '초대 취소에 실패했습니다. 잠시 후 다시 시도해주세요.')
  } finally {
    revokingId.value = null
  }
}

// 모달을 열 때마다 대기 목록을 새로 불러온다.
watch(showInviteModal, (open) => {
  if (open) {
    confirmRevokeId.value = null
    loadInvitations()
  }
})

const roleError = ref('')
let roleErrorTimer: ReturnType<typeof setTimeout> | null = null

// 역할 변경 에러 배너. 메시지가 있으면 5초 뒤 자동으로 사라진다.
function setRoleError(message: string) {
  if (roleErrorTimer) { clearTimeout(roleErrorTimer); roleErrorTimer = null }
  roleError.value = message
  if (message) {
    roleErrorTimer = setTimeout(() => { roleError.value = ''; roleErrorTimer = null }, 5000)
  }
}

async function changeRole(member: WorkspaceMember, event: Event) {
  const el = event.target as HTMLSelectElement
  const newRole = el.value
  const prevRole = member.role
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null || newRole === prevRole) return
  setRoleError('')
  try {
    await teamApi.changeMemberRole(wsId, member.userId, newRole)
    member.role = newRole // 성공: 로컬 반영(전체 리로드/스피너 없음 → 깜빡임 방지).
  } catch (e) {
    // 예: 마지막 Admin 강등 → BE 409(WORKSPACE_LAST_ADMIN). 조용히 실패하지 않도록 표시.
    setRoleError(errorMessage(e, '역할 변경에 실패했습니다. 잠시 후 다시 시도해주세요.'))
    // 실패: 드롭다운 UI 를 원래 역할로 되돌린다(재렌더/재조회 없이 DOM 값만).
    member.role = prevRole
    el.value = prevRole
  }
}

// Members of the workspace selected in the header selector.
watch(
  () => teamStore.currentWorkspaceId,
  (id) => {
    setRoleError('') // 이전 워크스페이스의 에러 배너가 남지 않도록 클리어.
    if (id != null) loadMembers(id)
    else members.value = []
  },
  { immediate: true },
)

// ── Leave / Delete workspace ──
// 자주 쓰지 않는 파괴적 동작이라 헤더에 노출하지 않고 ⋯ 메뉴 안으로 넣는다.
const showWsMenu = ref(false)
const showLeaveConfirm = ref(false)
const showDeleteConfirm = ref(false)
const wsActionBusy = ref(false)

// 나가기/삭제 성공 후: 목록 재조회 + Public 워크스페이스로 이동.
async function afterWorkspaceGone() {
  showLeaveConfirm.value = false
  showDeleteConfirm.value = false
  await teamStore.fetchWorkspaces()
  teamStore.setCurrentWorkspace(null)
  router.push({ name: 'home', params: { slug: 'public' } })
}

async function leaveWorkspace() {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null || wsActionBusy.value) return
  wsActionBusy.value = true
  try {
    await teamApi.leaveWorkspace(wsId)
    await afterWorkspaceGone()
  } catch (e) {
    showLeaveConfirm.value = false
    setRoleError(errorMessage(e, '워크스페이스 나가기에 실패했습니다.'))
  } finally {
    wsActionBusy.value = false
  }
}

async function deleteWorkspace() {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null || wsActionBusy.value) return
  wsActionBusy.value = true
  try {
    await teamApi.deleteWorkspace(wsId)
    await afterWorkspaceGone()
  } catch (e) {
    showDeleteConfirm.value = false
    setRoleError(errorMessage(e, '워크스페이스 삭제에 실패했습니다.'))
  } finally {
    wsActionBusy.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">
        {{ teamStore.currentWorkspace?.name ?? 'Members' }}
      </h1>
      <div v-if="teamStore.currentWorkspaceId != null" class="flex items-center gap-2">
        <button
          v-if="isAdmin"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          @click="showInviteModal = true"
        >
          <UserPlusIcon class="w-4 h-4" />
          Invite Member
        </button>
        <div class="relative">
          <button
            class="flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            aria-label="더보기"
            aria-haspopup="menu"
            :aria-expanded="showWsMenu"
            @click.stop="showWsMenu = !showWsMenu"
          >
            <EllipsisHorizontalIcon class="w-5 h-5" />
          </button>
          <!-- click-outside backdrop -->
          <div v-if="showWsMenu" class="fixed inset-0 z-10" @click="showWsMenu = false" />
          <div
            v-if="showWsMenu"
            role="menu"
            class="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[196px] p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg shadow-black/10"
          >
            <button
              role="menuitem"
              class="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors"
              @click="showWsMenu = false; showLeaveConfirm = true"
            >
              <ArrowRightOnRectangleIcon class="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              워크스페이스 나가기
            </button>
            <template v-if="isAdmin">
              <div class="h-px bg-zinc-200 dark:bg-zinc-700 mx-1 my-1" />
              <button
                role="menuitem"
                class="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                @click="showWsMenu = false; showDeleteConfirm = true"
              >
                <TrashIcon class="w-4 h-4" />
                워크스페이스 삭제
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <p
      v-if="teamStore.currentWorkspaceId == null"
      class="text-sm text-zinc-400 dark:text-zinc-500 py-16 text-center"
    >
      Select a team workspace from the header to view its members.
    </p>

    <LoadingSpinner v-else-if="loading" size="lg" />

    <div v-else class="space-y-3">
      <div v-if="roleError" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
        <p class="text-sm text-rose-600 dark:text-rose-400">{{ roleError }}</p>
      </div>
      <div
        v-for="member in members"
        :key="member.userId"
        class="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40"
      >
        <button
          type="button"
          class="group flex items-center gap-3 min-w-0 text-left"
          :title="`View ${member.displayName}'s profile`"
          @click="openProfile(member.userId)"
        >
          <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" class="w-8 h-8 rounded-full shrink-0" />
          <span v-else class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center text-xs font-medium text-zinc-500 dark:text-zinc-300">
            {{ member.displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{{ member.displayName }}</span>
            <span class="block text-xs text-zinc-400 dark:text-zinc-500">{{ member.role }}</span>
          </span>
        </button>

        <select
          v-if="isAdmin"
          :value="member.role"
          class="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1 dark:text-zinc-300"
          @change="changeRole(member, $event)"
        >
          <option value="ADMIN">Admin</option>
          <option value="WRITE">Write</option>
          <option value="READ">Read</option>
        </select>
      </div>
    </div>

    <Modal :show="showInviteModal" title="Invite Member" @close="showInviteModal = false">
      <div class="space-y-5">
        <!-- how to deliver the invite -->
        <div class="flex items-center gap-5 text-xs">
          <button
            v-for="t in (['EMAIL', 'LINK'] as const)"
            :key="t"
            type="button"
            class="relative pb-1.5 transition-colors"
            :class="inviteType === t
              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
            @click="inviteType = t; resetInviteResult()"
          >
            {{ t === 'EMAIL' ? 'Send email' : 'Create link' }}
            <span v-if="inviteType === t" class="absolute left-0 right-0 -bottom-px h-px bg-emerald-500" />
          </button>
        </div>

        <div v-if="inviteType === 'EMAIL'">
          <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Email address</label>
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="teammate@example.com"
            class="raw-input w-full text-sm"
            @keyup.enter="createInvite"
          />
        </div>

        <div>
          <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5">Role</label>
          <select v-model="inviteRole" class="raw-input w-full text-sm" @change="inviteError = ''">
            <option value="WRITE">Write</option>
            <option value="READ">Read</option>
          </select>
          <p class="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
            관리자(Admin) 권한은 초대로 부여할 수 없어요. 멤버가 참여한 뒤 역할을 Admin 으로 변경하세요.
          </p>
        </div>

        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
          :disabled="inviteBusy"
          @click="createInvite"
        >
          {{ inviteType === 'EMAIL' ? 'Send invitation' : 'Generate link' }}
        </button>
        <div v-if="inviteError" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
          <p class="text-sm text-rose-600 dark:text-rose-400">{{ inviteError }}</p>
        </div>

        <p v-if="inviteSentTo" class="text-xs text-emerald-600 dark:text-emerald-400">
          {{ inviteSentTo }} 님에게 초대 메일을 보냈어요.
        </p>

        <div v-if="inviteLink" class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-700">
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Share this link:</p>
          <p class="text-sm font-mono text-zinc-800 dark:text-zinc-200 break-all">{{ inviteLink }}</p>
        </div>

        <!-- 대기 중 초대 목록 + 취소 -->
        <div class="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div class="flex items-center gap-2 mb-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">대기 중 초대</p>
            <span
              v-if="!invitesLoading"
              class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-[11px] font-semibold text-zinc-500 dark:text-zinc-300"
            >{{ pendingInvites.length }}</span>
          </div>

          <div v-if="invitesLoading" class="py-4"><LoadingSpinner /></div>

          <p
            v-else-if="pendingInvites.length === 0"
            class="text-center text-xs text-zinc-400 dark:text-zinc-500 py-5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700"
          >
            아직 대기 중인 초대가 없어요.
          </p>

          <div v-else class="space-y-2">
            <div
              v-for="inv in pendingInvites"
              :key="inv.invitationId"
              class="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40"
            >
              <div
                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                :class="inv.type === 'LINK'
                  ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
                  : 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400'"
              >
                <LinkIcon v-if="inv.type === 'LINK'" class="w-4 h-4" />
                <EnvelopeIcon v-else class="w-4 h-4" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                    {{ inv.type === 'LINK' ? '초대 링크' : inv.email }}
                  </span>
                  <span class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400">
                    {{ roleLabel[inv.role] ?? inv.role }}
                  </span>
                </div>
                <p class="text-xs mt-0.5" :class="isExpiringSoon(inv.expiresAt) ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500'">
                  {{ expiryLabel(inv.expiresAt) }}
                </p>
              </div>

              <!-- 취소: 기본은 휴지통, 누르면 인라인 확인 -->
              <div class="shrink-0 flex items-center gap-1">
                <template v-if="confirmRevokeId === inv.invitationId">
                  <button
                    class="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
                    :disabled="revokingId === inv.invitationId"
                    @click="revokeInvite(inv.invitationId)"
                  >
                    {{ revokingId === inv.invitationId ? '취소 중…' : '취소하기' }}
                  </button>
                  <button
                    class="text-xs px-2 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    @click="confirmRevokeId = null"
                  >
                    유지
                  </button>
                </template>
                <button
                  v-else
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  aria-label="초대 취소"
                  @click="confirmRevokeId = inv.invitationId"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Leave workspace confirm -->
    <Modal :show="showLeaveConfirm" title="워크스페이스 나가기" @close="showLeaveConfirm = false">
      <p class="text-sm text-zinc-600 dark:text-zinc-300 mb-5">
        <strong>{{ teamStore.currentWorkspace?.name }}</strong> 에서 나갈까요? 다시 참여하려면 새 초대가 필요해요.
      </p>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 text-sm rounded-xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors" @click="showLeaveConfirm = false">취소</button>
        <button
          class="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-800 text-white hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white transition-colors disabled:opacity-60"
          :disabled="wsActionBusy"
          @click="leaveWorkspace"
        >나가기</button>
      </div>
    </Modal>

    <!-- Delete workspace confirm (admin) -->
    <Modal :show="showDeleteConfirm" title="워크스페이스 삭제" @close="showDeleteConfirm = false">
      <p class="text-sm text-zinc-600 dark:text-zinc-300 mb-5">
        <strong>{{ teamStore.currentWorkspace?.name }}</strong> 를 삭제할까요? 이 워크스페이스와 모든 멤버 구성이 사라지며 되돌릴 수 없어요.
      </p>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 text-sm rounded-xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors" @click="showDeleteConfirm = false">취소</button>
        <button
          class="px-4 py-2 text-sm font-medium rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
          :disabled="wsActionBusy"
          @click="deleteWorkspace"
        >삭제</button>
      </div>
    </Modal>
  </div>
</template>

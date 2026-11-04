<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/services/authApi'
import { notificationApi } from '@/services/notificationApi'
import { teamApi } from '@/services/teamApi'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { formatAbsolute } from '@/utils/timeAgo'
import GithubIntegrationSection from '@/components/integration/GithubIntegrationSection.vue'
import GhIcon from '@/components/integration/GhIcon.vue'
import '@/styles/github-integration.css'
import type { NotificationSettings } from '@/types/notification'
import type { WorkspaceListItem } from '@/types/team'
import type { Connection, Session } from '@/types/user'

const authStore = useAuthStore()
const { logout } = useAuth()
const { themeMode, setMode } = useTheme()

const route = useRoute()
const router = useRouter()

// /settings/integrations(및 GitHub 설치 콜백)로 들어오면 Integrations 탭으로 연다.
const INTEGRATION_ROUTES = ['settingsIntegrations', 'githubCallback']
const activeTab = ref(INTEGRATION_ROUTES.includes(String(route.name)) ? 'integrations' : 'profile')
watch(() => route.name, (name) => {
  if (INTEGRATION_ROUTES.includes(String(name))) activeTab.value = 'integrations'
})
// 탭과 주소를 맞춘다 — Integrations 는 /settings/integrations 로 공유·새로고침 가능.
watch(activeTab, (tab) => {
  if (tab === 'integrations' && route.name === 'settings') router.replace({ name: 'settingsIntegrations' })
  if (tab !== 'integrations' && INTEGRATION_ROUTES.includes(String(route.name))) router.replace({ name: 'settings' })
})
const toast = ref({ show: false, msg: '' })

function showToast(msg: string) {
  toast.value = { show: true, msg }
  setTimeout(() => { toast.value.show = false }, 3000)
}

// ── Profile ──
const displayName = ref('')
const bio = ref('')
const originalProfile = ref({ displayName: '', bio: '' })
const saving = ref(false)
const avatarFile = ref<HTMLInputElement | null>(null)

function applyUserData() {
  if (!authStore.user) return
  displayName.value = authStore.user.displayName
  bio.value = authStore.user.bio ?? ''
  originalProfile.value = { displayName: displayName.value, bio: bio.value }
  if (authStore.user.theme) setMode(authStore.user.theme.toLowerCase() as 'light' | 'dark' | 'system')
  defaultWorkspaceId.value = authStore.user.defaultWorkspaceId
}

onMounted(async () => {
  try {
    const { data } = await authApi.getMe()
    authStore.setUser(data)
  } catch { /* use existing store data */ }
  applyUserData()
  loadNotifSettings()
  loadWorkspaces()
  loadConnections()
  loadSessions()
})

async function saveProfile() {
  saving.value = true
  try {
    const { data } = await authApi.updateProfile({
      displayName: displayName.value,
      bio: bio.value || undefined,
      clearBio: !bio.value,
    })
    authStore.setUser(data)
    originalProfile.value = { displayName: displayName.value, bio: bio.value }
    showToast('Profile saved successfully')
  } finally { saving.value = false }
}

function discardProfile() {
  displayName.value = originalProfile.value.displayName
  bio.value = originalProfile.value.bio
  showToast('Changes discarded')
}

async function uploadAvatar() {
  const file = avatarFile.value?.files?.[0]
  if (!file) return
  const { data } = await authApi.uploadAvatar(file)
  authStore.setUser(data)
  showToast('Avatar updated')
}

async function removeAvatar() {
  const { data } = await authApi.removeAvatar()
  authStore.setUser(data)
  showToast('Avatar removed')
}

const avatarInitials = computed(() => (displayName.value || 'U').slice(0, 2).toUpperCase())

// ── Preferences ──
async function savePreferences() {
  await authApi.updateProfile({ theme: themeMode.value.toUpperCase() as 'LIGHT' | 'DARK' | 'SYSTEM' })
  showToast('Preferences saved')
}

// ── Notifications ──
const dnd = ref(false)
const notifSettings = ref<NotificationSettings>({ comment: true, reaction: true, invitation: true, follow: true, watchUpdate: true })
const originalNotif = ref<NotificationSettings>({ comment: true, reaction: true, invitation: true, follow: true, watchUpdate: true })

async function loadNotifSettings() {
  try {
    const { data } = await notificationApi.getSettings()
    notifSettings.value = data
    originalNotif.value = { ...data }
  } catch { /* defaults */ }
}

async function saveNotifSettings() {
  await notificationApi.updateSettings(notifSettings.value)
  originalNotif.value = { ...notifSettings.value }
  showToast('Notification settings saved')
}

function discardNotifSettings() {
  notifSettings.value = { ...originalNotif.value }
  dnd.value = false
  showToast('Changes discarded')
}

// ── Workspace ──
const workspaces = ref<WorkspaceListItem[]>([])
const defaultWorkspaceId = ref<number | null>(null)
const originalWsId = ref<number | null>(null)

async function loadWorkspaces() {
  try {
    const { data } = await teamApi.listWorkspaces()
    workspaces.value = data
    originalWsId.value = authStore.user?.defaultWorkspaceId ?? null
  } catch { /* empty */ }
}

async function saveWorkspace() {
  await authApi.updateProfile({
    defaultWorkspaceId: defaultWorkspaceId.value ?? undefined,
    clearDefaultWorkspace: !defaultWorkspaceId.value,
  })
  originalWsId.value = defaultWorkspaceId.value
  showToast('Workspace settings saved')
}

function discardWorkspace() {
  defaultWorkspaceId.value = originalWsId.value
  showToast('Changes discarded')
}

// ── Sessions ──
const sessions = ref<Session[]>([])

async function loadSessions() {
  try {
    const { data } = await authApi.getSessions()
    sessions.value = data
  } catch { /* empty */ }
}

// 기기 아이콘(폰/노트북) 고르기 — 서버는 기기 종류를 따로 주지 않아 deviceLabel·userAgent 로 추정
const isMobileDevice = (s: Session) => /iphone|ipad|android|mobile/i.test(`${s.deviceLabel} ${s.userAgent}`)

async function revokeSession(sessionId: string) {
  await authApi.revokeSession(sessionId)
  sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
  showToast('Session revoked')
}

async function revokeAllSessions() {
  if (!confirm('This will sign you out from all devices, including this one. Continue?')) return
  await authApi.revokeAllSessions()
  showToast('All sessions revoked')
  logout()
}

// ── Connections ──
const connections = ref<Connection[]>([])

// 로그인 제공자 목록(iam SocialProvider). available=false 는 아직 연결 경로가 없어 'Coming soon' 으로만 보인다.
const PROVIDERS = [
  { id: 'GITHUB', label: 'GitHub', available: true, blurb: 'Sign in with GitHub' },
  { id: 'GOOGLE', label: 'Google', available: false, blurb: 'Sign in with your Google account · 출시 예정' },
  { id: 'APPLE', label: 'Apple', available: false, blurb: 'Sign in with Apple · iOS 도입과 함께 제공 예정' },
]
const providerLabel = (id: string) => PROVIDERS.find(p => p.id === id.toUpperCase())?.label ?? id
const providerSwatch = (id: string) => ({
  GITHUB: 'bg-zinc-900 text-white dark:bg-[#0d1117]',
  GOOGLE: 'bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700',
  APPLE: 'bg-black text-white',
} as Record<string, string>)[id.toUpperCase()] ?? 'bg-zinc-100 dark:bg-zinc-800'
const connectedProviders = computed(() => connections.value.map(c => ({ ...c, provider: c.provider.toUpperCase() })))
const upcomingProviders = computed(() => PROVIDERS.filter(p => !p.available && !connectedProviders.value.some(c => c.provider === p.id)))

async function loadConnections() {
  try {
    const { data } = await authApi.getConnections()
    connections.value = data
  } catch { /* empty */ }
}

async function disconnectProvider(provider: string) {
  if (connections.value.length <= 1) {
    alert('Cannot disconnect the only sign-in method. Please add another provider first.')
    return
  }
  await authApi.disconnectProvider(provider)
  connections.value = connections.value.filter(c => c.provider !== provider)
  showToast(`${provider} disconnected`)
}

// ── Account / Danger ──
const pendingDeletion = computed(() => authStore.user?.status === 'PENDING_DELETION')
// 유예 30일 — iam 탈퇴 finalize 기준과 같음. pendingDeletionAt 은 요청 시각이라 마감은 +30일
const DELETION_GRACE_DAYS = 30
const deletionDeadline = computed(() => {
  const at = authStore.user?.pendingDeletionAt
  return at ? new Date(new Date(at).getTime() + DELETION_GRACE_DAYS * 86_400_000).toISOString() : null
})
const deletionDaysLeft = computed(() => deletionDeadline.value
  ? Math.max(0, Math.ceil((new Date(deletionDeadline.value).getTime() - Date.now()) / 86_400_000))
  : null)
const statusBadge = computed(() => {
  const st = authStore.user?.status ?? 'ACTIVE'
  if (st === 'ACTIVE') return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' }
  if (st === 'PENDING_DELETION') return { label: 'Pending deletion', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' }
  return { label: st.charAt(0) + st.slice(1).toLowerCase(), cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' }
})

async function requestDeletion() {
  if (!confirm('Are you sure you want to request account deletion? You will have 30 days to restore it.')) return
  await authApi.deleteAccount()
  const { data } = await authApi.getMe()
  authStore.setUser(data)
  showToast('Account deletion requested')
}

async function restoreAccount() {
  await authApi.restoreAccount()
  const { data } = await authApi.getMe()
  authStore.setUser(data)
  showToast('Account restored successfully')
}
</script>

<template>
  <div class="flex h-full -m-6 max-w-6xl mx-auto w-full">
    <!-- Toast -->
    <Teleport to="body">
      <div
        class="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white px-6 py-3 rounded-full font-medium text-sm shadow-2xl transition-all duration-300 z-50 flex items-center gap-3"
        :class="toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'"
      >
        <span class="text-emerald-500">&#10003;</span>
        <span>{{ toast.msg }}</span>
      </div>
    </Teleport>

    <!-- Sub Navigation -->
    <aside class="w-60 border-r border-zinc-200 dark:border-zinc-800 p-6 overflow-y-auto shrink-0">
      <div class="mb-8">
        <h3 class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 px-2">My Account</h3>
        <button class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="activeTab === 'profile' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'" @click="activeTab = 'profile'">Profile</button>
      </div>
      <div class="mb-8">
        <h3 class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 px-2">App</h3>
        <div class="space-y-1">
          <button v-for="tab in [{id:'preferences',l:'Preferences'},{id:'notifications',l:'Notifications'},{id:'workspace',l:'Workspace'}]" :key="tab.id" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="activeTab === tab.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'" @click="activeTab = tab.id">{{ tab.l }}</button>
          <button class="w-full text-left flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="activeTab === 'integrations' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'" :aria-current="activeTab === 'integrations' ? 'page' : undefined" @click="activeTab = 'integrations'">Integrations<GhIcon name="link" class="w-3.5 h-3.5 shrink-0 fill-none stroke-current [stroke-width:1.6] [stroke-linecap:round] [stroke-linejoin:round]" /></button>
        </div>
      </div>
      <div class="mb-8">
        <h3 class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 px-2">Security</h3>
        <div class="space-y-1">
          <button v-for="tab in [{id:'sessions',l:'Sessions'},{id:'connections',l:'Connections'}]" :key="tab.id" class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="activeTab === tab.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'" @click="activeTab = tab.id">{{ tab.l }}</button>
        </div>
      </div>
      <div>
        <h3 class="text-[10px] font-bold text-rose-400/80 uppercase tracking-widest mb-3 px-2">Danger</h3>
        <button class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" :class="activeTab === 'account' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10'" @click="activeTab = 'account'">Account Status</button>
      </div>
      <div class="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <button class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" @click="logout">Sign Out</button>
      </div>
    </aside>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-10 pb-32">
      <!-- 모든 탭 공통 폭: 섹션마다 max-w 를 따로 주면 탭 전환 시 박스 오른쪽 끝이 들쭉날쭉해짐 -->
      <div class="max-w-3xl">

        <!-- ═══ PROFILE ═══ -->
        <section v-if="activeTab === 'profile'">
          <h2 class="text-2xl font-bold mb-2">Public Profile</h2>
          <p class="text-sm text-zinc-500 mb-8">This information will be displayed publicly across your workspaces.</p>

          <div class="flex flex-col lg:flex-row gap-10">
            <div class="flex-1 min-w-0 space-y-6">
              <div>
                <label class="block text-sm font-medium mb-2">Avatar</label>
                <div class="flex items-center gap-6">
                  <div class="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border-2 border-dashed border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-2xl overflow-hidden">
                    <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" class="w-full h-full object-cover" />
                    <span v-else>{{ avatarInitials }}</span>
                  </div>
                  <div>
                    <div class="flex gap-3 mb-2">
                      <label class="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors cursor-pointer">
                        Upload Image
                        <input ref="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="uploadAvatar" />
                      </label>
                      <button class="px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md text-sm font-medium transition-colors" @click="removeAvatar">Remove</button>
                    </div>
                    <p class="text-xs text-zinc-500">JPG, GIF or PNG. Max size of 5MB.</p>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Nickname</label>
                <input v-model="displayName" type="text" maxlength="100" class="setting-input" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Bio</label>
                <textarea v-model="bio" maxlength="280" rows="3" class="setting-input resize-none" />
                <p class="text-xs text-zinc-500 mt-2 text-right">Max 280 characters</p>
              </div>
              <div class="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
                <button class="set-btn-text" @click="discardProfile">Discard</button>
                <button class="set-btn-primary" :disabled="saving" @click="saveProfile">{{ saving ? 'Saving...' : 'Save Changes' }}</button>
              </div>
            </div>

            <!-- Live Preview -->
            <div class="w-full lg:w-80 shrink-0">
              <label class="block text-sm font-medium mb-4 text-zinc-400">Live Preview</label>
              <div class="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mb-6">
                <div class="flex items-center gap-4 mb-4">
                  <div class="w-12 h-12 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center overflow-hidden">
                    <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" class="w-full h-full object-cover" />
                    <span v-else>{{ avatarInitials }}</span>
                  </div>
                  <div>
                    <h4 class="font-bold text-zinc-900 dark:text-zinc-100">{{ displayName || 'Anonymous' }}</h4>
                    <div class="text-xs text-zinc-500">@{{ displayName.toLowerCase().replace(/\s+/g, '') || 'user' }}</div>
                  </div>
                </div>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">{{ bio || 'No bio yet.' }}</p>
              </div>
              <div class="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <div class="text-xs text-zinc-500 mb-2">Mention Chip</div>
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-500/20">
                  @{{ displayName.replace(/\s+/g, '') || 'user' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ PREFERENCES ═══ -->
        <section v-if="activeTab === 'preferences'">
          <h2 class="text-2xl font-bold mb-2">Preferences</h2>
          <p class="text-sm text-zinc-500 mb-8">Manage your workspace experience and UI settings.</p>
          <div class="space-y-8">
            <div>
              <h3 class="text-sm font-medium mb-4">Theme</h3>
              <div class="grid grid-cols-3 gap-4">
                <label v-for="opt in [{v:'light',icon:'&#9728;',l:'Light'},{v:'dark',icon:'&#9790;',l:'Dark'},{v:'system',icon:'&#9000;',l:'System'}]" :key="opt.v" class="cursor-pointer">
                  <input :checked="themeMode === opt.v" @change="setMode(opt.v as 'light' | 'dark' | 'system')" type="radio" name="theme" :value="opt.v" class="peer sr-only" />
                  <div class="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50 dark:peer-checked:bg-emerald-900/20 transition-colors">
                    <div class="text-2xl mb-2 text-zinc-400" v-html="opt.icon" />
                    <div class="text-sm font-medium">{{ opt.l }}</div>
                  </div>
                </label>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium mb-2">Language</label>
                <select class="setting-input">
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en" disabled>English (Coming Soon)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Timezone</label>
                <select class="setting-input">
                  <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                  <option value="America/New_York">America/New_York (ET)</option>
                </select>
              </div>
            </div>
            <div class="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
              <button class="set-btn-text">Discard</button>
              <button class="set-btn-primary" @click="savePreferences">Save</button>
            </div>
          </div>
        </section>

        <!-- ═══ NOTIFICATIONS ═══ -->
        <section v-if="activeTab === 'notifications'">
          <div class="flex items-center justify-between p-6 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-8 shadow-sm">
            <div>
              <h3 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span class="text-rose-500">&#9790;</span> Do Not Disturb
              </h3>
              <p class="text-sm text-zinc-500">Mute all notifications temporarily. Individual preferences below will be paused.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input v-model="dnd" type="checkbox" class="sr-only peer" />
              <div class="w-9 h-5 bg-zinc-300 dark:bg-zinc-600 peer-checked:bg-rose-500 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <h2 class="text-xl font-bold mb-4">Notification Channels</h2>
          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                <tr>
                  <th class="px-6 py-4 font-medium">Category</th>
                  <th class="px-6 py-4 font-medium text-center w-24">In-App</th>
                  <th class="px-6 py-4 font-medium text-center w-24">Email</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                <tr :class="{ 'opacity-40 grayscale': dnd }">
                  <td class="px-6 py-4">
                    <div class="font-medium">Mentions & Replies</div>
                    <div class="text-xs text-zinc-500 mt-1">When someone tags you or replies to your log trace.</div>
                  </td>
                  <td class="px-6 py-4 text-center"><input v-model="notifSettings.comment" type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                  <td class="px-6 py-4 text-center"><input v-model="notifSettings.reaction" type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                </tr>
                <tr :class="{ 'opacity-40 grayscale': dnd }">
                  <td class="px-6 py-4">
                    <div class="font-medium">New Followers</div>
                    <div class="text-xs text-zinc-500 mt-1">When someone starts following your activity.</div>
                  </td>
                  <td class="px-6 py-4 text-center"><input v-model="notifSettings.follow" type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                  <td class="px-6 py-4 text-center"><input type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                </tr>
                <tr :class="{ 'opacity-40 grayscale': dnd }">
                  <td class="px-6 py-4">
                    <div class="font-medium">Workspace Invitations</div>
                    <div class="text-xs text-zinc-500 mt-1">When you are invited to a new workspace. (Recommended)</div>
                  </td>
                  <td class="px-6 py-4 text-center"><input v-model="notifSettings.invitation" type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                  <td class="px-6 py-4 text-center"><input type="checkbox" checked :disabled="dnd" class="custom-checkbox" /></td>
                </tr>
                <tr :class="{ 'opacity-40 grayscale': dnd }">
                  <td class="px-6 py-4">
                    <div class="font-medium">Weekly Digest</div>
                    <div class="text-xs text-zinc-500 mt-1">A summary of your weekly activity and impact.</div>
                  </td>
                  <td class="px-6 py-4 text-center text-zinc-400 text-xs italic">N/A</td>
                  <td class="px-6 py-4 text-center"><input v-model="notifSettings.watchUpdate" type="checkbox" :disabled="dnd" class="custom-checkbox" /></td>
                </tr>
                <tr class="bg-zinc-50/50 dark:bg-zinc-800/20 border-t-2 border-zinc-200 dark:border-zinc-700">
                  <td class="px-6 py-4">
                    <div class="font-medium flex items-center gap-2">Security Alerts <span class="text-zinc-400 text-xs">&#128274;</span></div>
                    <div class="text-xs text-zinc-500 mt-1">Critical account changes. Cannot be disabled.</div>
                  </td>
                  <td class="px-6 py-4 text-center"><input type="checkbox" checked disabled class="custom-checkbox opacity-50 cursor-not-allowed" /></td>
                  <td class="px-6 py-4 text-center"><input type="checkbox" checked disabled class="custom-checkbox opacity-50 cursor-not-allowed" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pt-6 mt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
            <button class="set-btn-text" @click="discardNotifSettings">Discard</button>
            <button class="set-btn-primary" @click="saveNotifSettings">Save Settings</button>
          </div>
        </section>

        <!-- ═══ WORKSPACE ═══ -->
        <section v-if="activeTab === 'workspace'">
          <h2 class="text-2xl font-bold mb-2">Default Workspace</h2>
          <p class="text-sm text-zinc-500 mb-8">Manage which workspace opens automatically when you sign in.</p>
          <div>
            <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mb-8">
              <label class="block text-sm font-medium mb-2">Select Workspace</label>
              <select v-model="defaultWorkspaceId" class="setting-input">
                <option :value="null">Personal Home (Default)</option>
                <option v-for="ws in workspaces" :key="ws.workspaceId" :value="ws.workspaceId">{{ ws.name }}</option>
              </select>
              <p class="text-xs text-zinc-500 mt-3">This workspace will load automatically when you sign in.</p>
            </div>
            <div class="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
              <button class="set-btn-text" @click="discardWorkspace">Discard</button>
              <button class="set-btn-primary" @click="saveWorkspace">Save Changes</button>
            </div>
          </div>
        </section>

        <!-- ═══ INTEGRATIONS ═══ -->
        <section v-if="activeTab === 'integrations'">
          <GithubIntegrationSection @open-connections="activeTab = 'connections'" />
        </section>

        <!-- ═══ SESSIONS ═══ -->
        <section v-if="activeTab === 'sessions'">
          <div class="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Active Sessions</h2>
              <p class="text-sm text-zinc-500">Devices currently signed in to your account.</p>
            </div>
            <span class="shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Security</span>
          </div>

          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6">
            <!-- 최근 활동 -->
            <div class="flex items-center gap-3 px-4 py-3.5 mb-5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 text-xs">
              <svg class="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 7v5l3 2" /></svg>
              <div v-if="sessions.length" class="min-w-0">
                Most recent activity: <span class="font-semibold">{{ formatAbsolute(sessions[0].lastUsedAt || sessions[0].createdAt) }}</span> &middot; {{ sessions[0].deviceLabel }} &middot; {{ sessions[0].ipAddress }}
              </div>
              <div v-else>활성 세션이 없어요.</div>
            </div>

            <!-- 세션 목록 -->
            <h3 class="text-[13px] font-medium mb-1 flex items-baseline gap-2">Active sessions <span class="text-[11px] font-normal text-zinc-400">{{ sessions.length }} active</span></h3>
            <div v-for="(session, idx) in sessions" :key="session.sessionId" class="flex items-center gap-3.5 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
              <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" :class="idx === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'">
                <svg v-if="isMobileDevice(session)" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="2" width="10" height="20" rx="2" /><path stroke-linecap="round" d="M11 19h2" /></svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="12" rx="2" /><path stroke-linecap="round" d="M8 21h8M12 17v4" /></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium flex items-center gap-2">
                  {{ session.deviceLabel || 'Unknown device' }}
                  <span v-if="idx === 0" class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">This device</span>
                </div>
                <div class="text-[11px] text-zinc-500 mt-0.5 truncate">
                  {{ session.ipAddress }} &middot; last active {{ idx === 0 ? 'now' : formatAbsolute(session.lastUsedAt || session.createdAt) }} &middot; expires {{ formatAbsolute(session.expiresAt) }}
                </div>
              </div>
              <button v-if="idx > 0" class="conn-btn" @click="revokeSession(session.sessionId)">Sign out</button>
            </div>
            <p v-if="!sessions.length" class="text-xs italic text-zinc-400 py-3">활성 세션이 없어요.</p>

            <!-- 전체 로그아웃 -->
            <div class="flex items-center justify-between gap-6 pt-4">
              <div>
                <div class="text-[13px] font-medium">Sign out everywhere</div>
                <div class="text-xs text-zinc-500 mt-1 leading-relaxed max-w-[540px]">지금 이 기기를 <b class="font-medium">포함한</b> 모든 기기에서 로그아웃해요. 로그인이 도용된 것 같을 때 쓰는 기능이에요. 모든 기기에서 다시 로그인해야 해요.</div>
              </div>
              <button class="shrink-0 px-3.5 py-2 border border-transparent bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-medium rounded-xl transition-colors" @click="revokeAllSessions">Revoke all sessions</button>
            </div>
          </div>

          <!-- 2단계 인증 안내 -->
          <div class="mt-3.5 flex gap-3 px-3.5 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500 leading-relaxed">
            <svg class="w-[18px] h-[18px] shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20z" /></svg>
            <div><b class="font-semibold text-zinc-700 dark:text-zinc-300">2단계 인증(2FA)</b>은 로그인 제공자(GitHub)에서 관리해요. 그 계정에 2FA 가 켜져 있으면 Error Archive 로그인도 자동으로 보호돼요. 따로 설정할 건 없어요.</div>
          </div>
        </section>

        <!-- ═══ CONNECTIONS ═══ -->
        <section v-if="activeTab === 'connections'">
          <div class="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Connected Accounts</h2>
              <p class="text-sm text-zinc-500">External accounts you use to sign in.</p>
            </div>
            <span class="shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Security</span>
          </div>

          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm px-6 py-2">
            <!-- 연결됨 -->
            <div class="py-4 border-b border-dashed border-zinc-200 dark:border-zinc-800">
              <h3 class="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-1">Available now</h3>
              <div v-for="conn in connectedProviders" :key="conn.provider" class="flex items-center gap-3.5 py-3.5 border-b last:border-b-0 border-zinc-200 dark:border-zinc-800">
                <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" :class="providerSwatch(conn.provider)">
                  <svg v-if="conn.provider === 'GITHUB'" viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor"><path d="M12 .5A11.5 11.5 0 00.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.27-1.7-1.27-1.7-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.07.78 2.15v3.18c0 .31.21.67.8.56A11.5 11.5 0 0023.5 12 11.5 11.5 0 0012 .5z" /></svg>
                  <span v-else class="font-bold text-sm">{{ providerLabel(conn.provider).slice(0, 1) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium flex items-center gap-2">
                    {{ providerLabel(conn.provider) }}
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Connected</span>
                  </div>
                  <div class="text-xs text-zinc-500 mt-0.5 truncate">
                    <template v-if="conn.providerEmail">{{ conn.providerEmail }} &middot; </template>linked {{ formatAbsolute(conn.linkedAt) }}
                  </div>
                </div>
                <a v-if="conn.profileUrl" :href="conn.profileUrl" target="_blank" rel="noopener" class="conn-btn">View &#8599;</a>
                <button class="conn-btn" :disabled="connections.length <= 1" :title="connections.length <= 1 ? '마지막 로그인 수단은 해제할 수 없어요' : undefined" @click="disconnectProvider(conn.provider)">Disconnect</button>
              </div>
              <p v-if="!connections.length" class="text-xs italic text-zinc-400 py-3">연결된 외부 계정이 없어요.</p>
            </div>

            <!-- 준비 중 -->
            <div v-if="upcomingProviders.length" class="py-4">
              <h3 class="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-1 flex flex-wrap items-baseline gap-x-2">
                Coming soon
                <span class="normal-case tracking-normal font-normal text-zinc-400">추후 지원 예정이에요. 출시되면 여기서 바로 연결할 수 있어요.</span>
              </h3>
              <div v-for="p in upcomingProviders" :key="p.id" class="flex items-center gap-3.5 py-3.5 border-b last:border-b-0 border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-80 transition-opacity">
                <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0 grayscale-[.7]" :class="providerSwatch(p.id)">
                  <svg v-if="p.id === 'GOOGLE'" viewBox="0 0 24 24" class="w-[18px] h-[18px]"><path fill="#4285F4" d="M22.5 12.27c0-.78-.07-1.53-.2-2.27H12v4.3h5.92a5.07 5.07 0 01-2.2 3.33v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.13z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0012 23z" /><path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 010-4.18V7.07H2.18a11 11 0 000 9.86l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1a11 11 0 00-9.82 6.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" /></svg>
                  <svg v-else-if="p.id === 'APPLE'" viewBox="0 0 24 24" class="w-[18px] h-[18px]" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium flex items-center gap-2">
                    {{ p.label }}
                    <span class="text-[10px] italic px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Coming soon</span>
                  </div>
                  <div class="text-xs text-zinc-500 mt-0.5">{{ p.blurb }}</div>
                </div>
                <button class="conn-btn" disabled>Connect</button>
              </div>
            </div>
          </div>

          <div class="mt-3.5 flex items-center gap-2.5 p-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-500">
            <svg class="w-4 h-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20z" /></svg>
            <div>마지막 로그인 수단은 해제할 수 없어요. 다른 로그인 수단을 연결한 뒤에 기존 연결을 해제할 수 있어요.</div>
          </div>

          <div class="gh-int mt-6">
            <div class="notice"><GhIcon name="info" /><div>이 연결은 Error Archive 로그인에 사용됩니다.<br>GitHub 저장소의 접근 권한은 Integrations에서 설정하세요.</div></div>
            <button class="text-button" @click="activeTab = 'integrations'">GitHub 저장소 연동으로 이동 <GhIcon name="arrow" class="sm" /></button>
          </div>
        </section>

        <!-- ═══ ACCOUNT / DANGER ═══ -->
        <section v-if="activeTab === 'account'">
          <!-- 탈퇴 진행 중 배너 -->
          <div v-if="pendingDeletion" class="mb-8 flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <svg class="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold">탈퇴 진행 중 <span v-if="deletionDaysLeft !== null">&middot; D-{{ deletionDaysLeft }}</span></h3>
              <p class="text-xs mt-1 opacity-90"><template v-if="deletionDeadline">{{ formatAbsolute(deletionDeadline) }} 이후 </template>데이터가 영구 익명화돼요. 그 전까지는 아래에서 복구할 수 있어요.</p>
            </div>
          </div>

          <div class="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 class="text-2xl font-bold mb-2">Account Information</h2>
              <p class="text-sm text-zinc-500">Read-only details about your account.</p>
            </div>
            <span class="shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Private</span>
          </div>

          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 mb-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <div class="text-xs font-medium text-zinc-500 mb-1.5">Email <span class="font-normal text-zinc-400">(non-editable)</span></div>
                <div class="acc-ro">{{ authStore.user?.email || '—' }}</div>
              </div>
              <div>
                <div class="text-xs font-medium text-zinc-500 mb-1.5">Status</div>
                <div class="acc-ro">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-sans text-[11px] font-semibold" :class="statusBadge.cls">
                    <span class="w-1.5 h-1.5 rounded-full" :class="statusBadge.dot" />{{ statusBadge.label }}
                  </span>
                </div>
              </div>
              <div>
                <div class="text-xs font-medium text-zinc-500 mb-1.5">Member since</div>
                <div class="acc-ro">{{ authStore.user?.createdAt ? formatAbsolute(authStore.user.createdAt) : '—' }}</div>
              </div>
              <div>
                <div class="text-xs font-medium text-zinc-500 mb-1.5">Pending deletion at</div>
                <div class="acc-ro">{{ authStore.user?.pendingDeletionAt ? formatAbsolute(authStore.user.pendingDeletionAt) : '— (not pending)' }}</div>
              </div>
            </div>
          </div>

          <!-- 되돌리기 어려운 동작은 별도 카드로 격리 -->
          <div class="bg-white dark:bg-zinc-900/50 border border-rose-200 dark:border-rose-500/30 rounded-xl shadow-sm p-6">
            <div class="flex items-start justify-between gap-4 mb-1">
              <h3 class="text-base font-semibold text-rose-600 dark:text-rose-400">Danger Zone</h3>
              <span class="shrink-0 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Danger</span>
            </div>
            <div class="flex items-center justify-between gap-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <div class="text-[13px] font-medium">Delete account</div>
                <div class="text-xs text-zinc-500 mt-1 leading-relaxed max-w-[540px]">요청하면 30일 유예 기간이 시작되고, 끝나면 개인정보가 익명화돼요. 유예 기간 안에는 복구할 수 있어요.</div>
              </div>
              <button class="shrink-0 px-3.5 py-2 border border-transparent bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-500" :disabled="pendingDeletion" @click="requestDeletion">{{ pendingDeletion ? 'Already requested' : 'Request deletion' }}</button>
            </div>
            <div class="flex items-center justify-between gap-6 pt-4">
              <div>
                <div class="text-[13px] font-medium">Restore account</div>
                <div class="text-xs text-zinc-500 mt-1 leading-relaxed max-w-[540px]">탈퇴를 요청한 상태에서만 쓸 수 있어요.</div>
              </div>
              <button class="set-btn" :disabled="!pendingDeletion" @click="restoreAccount">{{ pendingDeletion ? 'Restore account' : 'Not pending' }}</button>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<style>
.setting-input {
  width: 100%;
  background: transparent;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #18181b;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s;
}
.dark .setting-input {
  border-color: #3f3f46;
  color: #f4f4f5;
}
.setting-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
}
/* 저장 줄·카드 안 동작 버튼 공통 크기 — 보조(테두리)·주(초록)·취소(글자만). 위험 동작은 같은 크기에 rose */
.set-btn,
.set-btn-primary,
.set-btn-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  transition: all 0.15s;
}
.set-btn {
  color: #52525b;
  border-color: #e4e4e7;
}
.set-btn:hover:not(:disabled) {
  color: #18181b;
  background: #f4f4f5;
}
.dark .set-btn {
  color: #a1a1aa;
  border-color: #3f3f46;
}
.dark .set-btn:hover:not(:disabled) {
  color: #f4f4f5;
  background: #27272a;
}
.set-btn-primary {
  color: #fff;
  background: #059669;
}
.set-btn-primary:hover:not(:disabled) {
  background: #10b981;
}
.set-btn-text {
  color: #71717a;
}
.set-btn-text:hover {
  color: #18181b;
}
.dark .set-btn-text {
  color: #a1a1aa;
}
.dark .set-btn-text:hover {
  color: #f4f4f5;
}
.set-btn:disabled,
.set-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.conn-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.3125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #71717a;
  border: 1px solid #e4e4e7;
  border-radius: 0.75rem;
  transition: all 0.15s;
}
.conn-btn:hover:not(:disabled) {
  color: #18181b;
  background: #f4f4f5;
}
.dark .conn-btn {
  color: #a1a1aa;
  border-color: #3f3f46;
}
.dark .conn-btn:hover:not(:disabled) {
  color: #f4f4f5;
  background: #27272a;
}
.conn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.acc-ro {
  padding: 0.5rem 0;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.75rem;
  color: #52525b;
  border-bottom: 1px dashed #e4e4e7;
}
.dark .acc-ro {
  color: #a1a1aa;
  border-bottom-color: #3f3f46;
}
select.setting-input {
  appearance: none;
  padding-right: 2.5rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  cursor: pointer;
}
</style>

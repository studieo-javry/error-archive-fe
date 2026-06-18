<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { authApi } from '@/services/authApi'
import { notificationApi } from '@/services/notificationApi'
import { teamApi } from '@/services/teamApi'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { formatAbsolute } from '@/utils/timeAgo'
import type { NotificationSettings } from '@/types/notification'
import type { WorkspaceListItem } from '@/types/team'
import type { Connection, Session } from '@/types/user'

const authStore = useAuthStore()
const { logout } = useAuth()
const { themeMode, setMode } = useTheme()

const activeTab = ref('profile')
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
      <div>

        <!-- ═══ PROFILE ═══ -->
        <section v-if="activeTab === 'profile'">
          <h2 class="text-2xl font-bold mb-2">Public Profile</h2>
          <p class="text-sm text-zinc-500 mb-8">This information will be displayed publicly across your workspaces.</p>

          <div class="flex flex-col lg:flex-row gap-16">
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
                <button class="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" @click="discardProfile">Discard</button>
                <button class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors" :disabled="saving" @click="saveProfile">{{ saving ? 'Saving...' : 'Save Changes' }}</button>
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
          <div class="space-y-8 max-w-2xl">
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
              <button class="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Discard</button>
              <button class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors" @click="savePreferences">Save</button>
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
          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-w-3xl shadow-sm">
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
          <div class="pt-6 mt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4 max-w-3xl">
            <button class="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" @click="discardNotifSettings">Discard</button>
            <button class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors" @click="saveNotifSettings">Save Settings</button>
          </div>
        </section>

        <!-- ═══ WORKSPACE ═══ -->
        <section v-if="activeTab === 'workspace'">
          <h2 class="text-2xl font-bold mb-2">Default Workspace</h2>
          <p class="text-sm text-zinc-500 mb-8">Manage which workspace opens automatically when you sign in.</p>
          <div class="max-w-2xl">
            <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm mb-8">
              <label class="block text-sm font-medium mb-2">Select Workspace</label>
              <select v-model="defaultWorkspaceId" class="setting-input">
                <option :value="null">Personal Home (Default)</option>
                <option v-for="ws in workspaces" :key="ws.workspaceId" :value="ws.workspaceId">{{ ws.name }}</option>
              </select>
              <p class="text-xs text-zinc-500 mt-3">This workspace will load automatically when you sign in.</p>
            </div>
            <div class="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
              <button class="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" @click="discardWorkspace">Discard</button>
              <button class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors" @click="saveWorkspace">Save Changes</button>
            </div>
          </div>
        </section>

        <!-- ═══ SESSIONS ═══ -->
        <section v-if="activeTab === 'sessions'">
          <div class="flex justify-between items-end mb-6">
            <div>
              <h2 class="text-2xl font-bold mb-2">Active Sessions</h2>
              <p class="text-sm text-zinc-500">Review devices currently logged into your account.</p>
            </div>
            <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 text-white text-sm font-medium rounded-md transition-colors shadow-sm" @click="revokeAllSessions">
              Sign out everywhere
            </button>
          </div>

          <div v-if="sessions.length" class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 mb-8 flex items-center gap-4 max-w-3xl">
            <div class="text-emerald-500 text-xl ml-2">&#9200;</div>
            <div>
              <div class="text-sm font-bold text-emerald-900 dark:text-emerald-400">Last Login: {{ formatAbsolute(sessions[0]?.lastUsedAt || sessions[0]?.createdAt) }}</div>
              <div class="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">{{ sessions[0]?.deviceLabel }} &middot; {{ sessions[0]?.ipAddress }}</div>
            </div>
          </div>

          <div class="space-y-4 max-w-3xl">
            <div v-for="(session, idx) in sessions" :key="session.sessionId" class="flex items-center justify-between p-5 rounded-xl" :class="idx === 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30' : 'bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800'">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" :class="idx === 0 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'">&#128187;</div>
                <div>
                  <div class="font-medium flex items-center gap-2">
                    {{ session.deviceLabel }}
                    <span v-if="idx === 0" class="text-[10px] uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded">Current</span>
                  </div>
                  <div class="text-xs text-zinc-500 mt-1">{{ session.ipAddress }} &middot; {{ idx === 0 ? 'Active now' : formatAbsolute(session.lastUsedAt) }}</div>
                </div>
              </div>
              <button v-if="idx > 0" class="text-sm font-medium text-rose-600 hover:text-rose-700 dark:text-rose-500 dark:hover:text-rose-400 px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors" @click="revokeSession(session.sessionId)">Revoke</button>
            </div>
            <p v-if="!sessions.length" class="text-sm text-zinc-400 py-4">No active sessions found.</p>
          </div>
        </section>

        <!-- ═══ CONNECTIONS ═══ -->
        <section v-if="activeTab === 'connections'">
          <h2 class="text-2xl font-bold mb-2">Connected Accounts</h2>
          <p class="text-sm text-zinc-500 mb-8">Manage OAuth providers used to sign in.</p>
          <div class="space-y-4 max-w-2xl">
            <div v-for="conn in connections" :key="conn.provider" class="flex items-center justify-between p-5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-sm">{{ conn.provider.slice(0, 2).toUpperCase() }}</div>
                <div>
                  <div class="font-medium">{{ conn.provider }}</div>
                  <div class="text-xs text-zinc-500 mt-1">{{ conn.providerEmail || 'Connected' }} &middot; {{ formatAbsolute(conn.linkedAt) }}</div>
                </div>
              </div>
              <button class="text-sm font-medium transition-colors" :class="connections.length <= 1 ? 'text-zinc-400 cursor-not-allowed' : 'text-rose-600 hover:text-rose-700 dark:text-rose-500'" :disabled="connections.length <= 1" @click="disconnectProvider(conn.provider)">Disconnect</button>
            </div>

            <div class="flex items-center justify-between p-5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl opacity-60 grayscale">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-white border border-zinc-200 dark:border-zinc-700 text-blue-500 flex items-center justify-center font-bold">G</div>
                <div>
                  <div class="font-medium flex items-center gap-2">Google <span class="text-[10px] uppercase border border-zinc-300 dark:border-zinc-600 px-1.5 rounded">Coming soon</span></div>
                  <div class="text-xs text-zinc-500 mt-1">Not connected</div>
                </div>
              </div>
              <button class="text-sm font-medium text-zinc-400" disabled>Connect</button>
            </div>
          </div>
        </section>

        <!-- ═══ ACCOUNT / DANGER ═══ -->
        <section v-if="activeTab === 'account'">
          <div v-if="pendingDeletion" class="mb-8 bg-rose-50 dark:bg-rose-500/10 border-l-4 border-rose-500 p-4 rounded-r-lg">
            <h3 class="text-sm font-medium text-rose-800 dark:text-rose-400">Account Pending Deletion</h3>
            <p class="text-sm text-rose-700 dark:text-rose-300 mt-1">Your account is scheduled to be permanently deleted in 30 days. You can restore it before the grace period ends.</p>
          </div>

          <h2 class="text-2xl font-bold mb-2">Account Information</h2>
          <p class="text-sm text-zinc-500 mb-8">Basic information about your ErrorLog account.</p>

          <div class="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-2xl mb-12 space-y-6 shadow-sm">
            <div>
              <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Primary Email</label>
              <div class="font-medium">{{ authStore.user?.email || '—' }}</div>
            </div>
            <div>
              <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Account Status</label>
              <div v-if="!pendingDeletion" class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
              </div>
              <div v-else class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500" /> Pending Deletion
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Member Since</label>
              <div class="text-sm">{{ authStore.user?.createdAt ? formatAbsolute(authStore.user.createdAt) : '—' }}</div>
            </div>
          </div>

          <div class="border border-rose-200 dark:border-rose-900/50 rounded-xl p-6 max-w-2xl bg-rose-50/30 dark:bg-rose-900/10 shadow-sm">
            <h3 class="text-lg font-bold text-rose-600 dark:text-rose-500 mb-2">Danger Zone</h3>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Once you delete your account, you will lose all data and workspace access. A 30-day grace period is provided before hard deletion.</p>
            <div v-if="!pendingDeletion">
              <button class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm" @click="requestDeletion">Request Account Deletion</button>
            </div>
            <div v-else class="flex items-center gap-3">
              <button class="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-sm font-medium rounded-md transition-colors shadow-sm" @click="restoreAccount">Restore Account</button>
              <span class="text-xs text-zinc-500">Deletes permanently in 30 days</span>
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

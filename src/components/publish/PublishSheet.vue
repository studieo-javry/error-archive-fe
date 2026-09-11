<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentDetail, PublishmentVisibility, PublishRequest, PublishTimeStyle } from '@/types/publish'
import type { Step, Solution, ErrorCaseAttachment } from '@/types/error'
import { ChevronRightIcon, ChevronLeftIcon, CheckIcon } from '@heroicons/vue/24/outline'

/**
 * 케이스 상세에서 올라오는 발행물 생성 시트(하단 슬라이드업).
 * 흐름: 슬림 바 → Steps → Details → Files(첨부 포함/제외) → Options → Preview → 발행 → 완료.
 * 발행 성공 시 published(detail) 를 올려 부모가 상태 바로 전환한다.
 */
const props = defineProps<{
  caseId: number
  caseTitle: string
  caseSummary: string | null
  caseDescription: string | null
  steps: Step[]
  solutions: Solution[]
  attachments: ErrorCaseAttachment[]
  authorDefault: string
}>()
const emit = defineEmits<{ close: []; published: [detail: PublishmentDetail] }>()

// -1 = 슬림 바, 0 = Steps, 1 = Details, 2 = Files, 3 = Options, 4 = Preview, DONE = 완료
const DONE = 5
const stage = ref(-1)
const STAGES = ['Steps', 'Details', 'Files', 'Options', 'Preview']

const selSteps = ref(new Set<number>(props.steps.map(s => s.id)))
const selSols = ref(new Set<number>(props.solutions.map(s => s.id)))
const excludedAtt = ref(new Set<string>())          // 제외한 첨부 markerId (기본 전부 포함)
const options = ref<{ timeStyle: PublishTimeStyle; showStepDuration: boolean }>({ timeStyle: 'RELATIVE', showStepDuration: true })
const title = ref(props.caseTitle)
const summary = ref(props.caseSummary ?? '')
const author = ref(props.authorDefault)
const visibility = ref<PublishmentVisibility>('PUBLIC')

const busy = ref(false)
const errorMsg = ref('')
const published = ref<PublishmentDetail | null>(null)
const copied = ref(false)

// 멱등 키 — 첫 발행 시 생성해 재시도 때 재사용(중복 발행 방지).
let idemKey = ''

const orderedSteps = computed(() => [...props.steps].sort((a, b) => a.orderIndex - b.orderIndex))
const canNextInclude = computed(() => selSteps.value.size > 0)
const canNextDetails = computed(() => title.value.trim().length > 0)

function pill(status: string) {
  if (status === 'RESOLVED') return { cls: 'resolved', label: 'RESOLVED' }
  if (status === 'IN_PROGRESS') return { cls: 'wip', label: 'WIP' }
  return { cls: 'failed', label: 'FAILED' }
}
function toggleStep(id: number) { selSteps.value.has(id) ? selSteps.value.delete(id) : selSteps.value.add(id); selSteps.value = new Set(selSteps.value) }
function toggleSol(id: number) { selSols.value.has(id) ? selSols.value.delete(id) : selSols.value.add(id); selSols.value = new Set(selSols.value) }
function quick(kind: 'all' | 'nofail' | 'resolved') {
  const src = props.steps
  if (kind === 'all') selSteps.value = new Set(src.map(s => s.id))
  else if (kind === 'nofail') selSteps.value = new Set(src.filter(s => s.status !== 'FAILED').map(s => s.id))
  else selSteps.value = new Set(src.filter(s => s.status === 'RESOLVED').map(s => s.id))
}

const selectedStepList = computed(() => orderedSteps.value.filter(s => selSteps.value.has(s.id)))
const selectedSolList = computed(() => props.solutions.filter(s => selSols.value.has(s.id)))

// 발행에 실제로 들어갈 첨부 = 케이스 본문(description) + 선택된 step 본문에 @attach 로 태그된 것.
// BE ContentSnapshotBuilder 와 동일: descriptionAttachments + stepAttachments (미태그는 제외).
const ATTACH_MARKER = /@attach\(([a-zA-Z0-9_-]+)(?:\|\d{2,4})?\)/g
function attachMarkersIn(text: string | null): string[] {
  if (!text) return []
  return [...text.matchAll(ATTACH_MARKER)].map(m => m[1])
}
const includedAttachments = computed<{ att: ErrorCaseAttachment; src: 'body' | 'step' }[]>(() => {
  const byMarker = new Map(props.attachments.map(a => [a.markerId, a]))
  const seen = new Set<string>()
  const out: { att: ErrorCaseAttachment; src: 'body' | 'step' }[] = []
  const add = (ids: string[], src: 'body' | 'step') => {
    for (const id of ids) {
      if (seen.has(id)) continue
      const att = byMarker.get(id)
      if (att) { seen.add(id); out.push({ att, src }) }
    }
  }
  add(attachMarkersIn(props.caseDescription), 'body') // 본문(Context) 태그 첨부 먼저
  for (const s of selectedStepList.value) add(attachMarkersIn(s.body), 'step')
  return out
})
const includedAttCount = computed(() => includedAttachments.value.filter(x => !excludedAtt.value.has(x.att.markerId)).length)

// 미태그(본문·스텝 어디에도 @attach 로 넣지 않은) 첨부 — 발행 미포함 안내용
const untaggedCount = computed(() => {
  const referenced = new Set<string>()
  attachMarkersIn(props.caseDescription).forEach(id => referenced.add(id))
  for (const s of props.steps) attachMarkersIn(s.body).forEach(id => referenced.add(id))
  return props.attachments.filter(a => !referenced.has(a.markerId)).length
})

function toggleAtt(mid: string) { excludedAtt.value.has(mid) ? excludedAtt.value.delete(mid) : excludedAtt.value.add(mid); excludedAtt.value = new Set(excludedAtt.value) }
function attHint(kind: string): { ico: string; how: string } {
  if (kind === 'IMAGE') return { ico: '🖼', how: '이미지로 표시' }
  if (kind === 'TEXT') return { ico: '📄', how: '새 탭에서 보기' }
  if (kind === 'JSON') return { ico: '🔧', how: '새 탭에서 보기' }
  if (kind === 'DOCUMENT') return { ico: '📕', how: '새 탭에서 보기' }
  return { ico: '📦', how: '다운로드' }
}
function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${Math.round(b / 1024)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function bodyPreview(b: string | null): string {
  if (!b) return ''
  // 마커/마크다운 잡음을 대충 걷어내고 한 줄로.
  return b.replace(/\[\[[^\]]*\]\]/g, '').replace(/[#>*`_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
}

async function doPublish() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  if (!idemKey) idemKey = (crypto.randomUUID?.() ?? `${props.caseId}-${Date.now()}-${Math.random()}`)
  const req: PublishRequest = {
    caseId: props.caseId,
    title: title.value.trim(),
    summary: summary.value.trim() || undefined,
    visibility: visibility.value,
    includeStepIds: [...selSteps.value],
    includeSolutionIds: [...selSols.value],
    excludedAttachmentMarkerIds: [...excludedAtt.value],
    options: {
      authorDisplayName: author.value.trim() || null,
      timeStyle: options.value.timeStyle,
      showStepDuration: options.value.showStepDuration,
    },
  }
  try {
    const { data } = await publishmentApi.create(req, idemKey)
    published.value = data
    stage.value = DONE
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      // 이미 발행된 케이스 — 기존 발행물을 끌어와 완료 화면으로 자연스럽게 넘어간다.
      try {
        const { data } = await publishmentApi.getByCase(props.caseId)
        published.value = data
        stage.value = DONE
      } catch { errorMsg.value = '이미 발행된 케이스예요. 페이지를 새로고침 해주세요.' }
    } else if (axios.isAxiosError(e) && e.response?.status === 422) {
      errorMsg.value = '최소 1개의 step 을 포함해야 해요.'
    } else {
      errorMsg.value = '발행에 실패했어요. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    busy.value = false
  }
}

async function copyLink() {
  if (!published.value) return
  try { await navigator.clipboard.writeText(published.value.publicUrl); copied.value = true; setTimeout(() => copied.value = false, 1500) } catch { /* noop */ }
}

// ── 슬라이드 인/아웃 ──
const shown = ref(false)
onMounted(() => requestAnimationFrame(() => { shown.value = true }))
let closeTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(closeTimer))
function close() {
  if (published.value) emit('published', published.value)
  shown.value = false
  closeTimer = setTimeout(() => emit('close'), 320)
}
</script>

<template>
  <div class="psh-root">
    <div class="psh-backdrop" :class="{ show: shown }" @click="close" />

    <div class="psh-wrap" :class="{ show: shown }">
      <div class="psh-panel">
        <div class="psh-grip" />

        <!-- 슬림 진입 바 -->
        <div v-if="stage === -1" class="psh-slim">
          <span class="psh-live" />
          <div class="psh-slim-txt">
            <div class="t">이 케이스를 발행물로 만들기</div>
            <div class="s">기본값: step {{ selSteps.size }}개 · solution {{ selSols.size }}개 선택됨 · 공개</div>
          </div>
          <button class="psh-btn" @click="stage = 0">고르기</button>
          <button class="psh-btn primary" :disabled="busy" @click="doPublish">
            바로 발행<ChevronRightIcon class="ic" />
          </button>
          <button class="psh-x" aria-label="닫기" @click="close">×</button>
        </div>

        <!-- 완료 -->
        <template v-else-if="stage === DONE && published">
          <div class="psh-head">
            <h3>발행 완료</h3>
            <button class="psh-x" aria-label="닫기" @click="close">×</button>
          </div>
          <div class="psh-done">
            <div class="ok-ic"><CheckIcon class="w-7 h-7" /></div>
            <h4>발행되었습니다 🎉</h4>
            <p>이제 누구나 이 링크로 당신의 디버깅 기록을 볼 수 있어요.</p>
            <div class="slug-box">
              <span class="u">{{ published.publicUrl }}</span>
              <button @click="copyLink">{{ copied ? 'Copied' : 'Copy' }}</button>
            </div>
            <div class="share">
              <a :href="published.publicUrl" target="_blank" rel="noopener">↗ 열기</a>
              <a :href="published.pdfUrl" target="_blank" rel="noopener">📄 PDF</a>
            </div>
            <p class="tip">이 상세 페이지 하단에 이제 <b>발행 상태 바</b>가 떠요 — 조회수 확인, 발행 내리기, 다시 공개를 거기서 할 수 있어요.</p>
          </div>
          <div class="psh-foot"><span class="sp" /><button class="psh-cta" @click="close">완료</button></div>
        </template>

        <!-- 위저드 (Include / Details / Preview) -->
        <template v-else>
          <div class="psh-head">
            <h3>발행물 만들기</h3>
            <div class="psh-stepper">
              <template v-for="(label, i) in STAGES" :key="label">
                <div class="stp" :class="{ active: i === stage, done: i < stage }">
                  <span class="n"><CheckIcon v-if="i < stage" class="w-3 h-3" /><template v-else>{{ i + 1 }}</template></span>{{ label }}
                </div>
                <span v-if="i < STAGES.length - 1" class="bar" />
              </template>
            </div>
            <button class="psh-x" aria-label="닫기" @click="close">×</button>
          </div>

          <div class="psh-body">
            <!-- Include -->
            <template v-if="stage === 0">
              <h4>무엇을 넣을까요?</h4>
              <p class="hint">발행물에 담을 step 을 고르세요. 실패한 시도까지 넣으면 생생한 여정이 되고, 빼면 깔끔한 회고가 됩니다.</p>
              <div class="quick"><span>빠른 선택:</span>
                <button @click="quick('all')">전체</button>
                <button @click="quick('nofail')">실패 빼기</button>
                <button @click="quick('resolved')">해결만</button>
              </div>
              <div class="pick-list">
                <div v-for="s in orderedSteps" :key="s.id" class="pick" :class="selSteps.has(s.id) ? 'on' : 'off'" @click="toggleStep(s.id)">
                  <span class="chk"><CheckIcon class="w-3 h-3" /></span>
                  <span class="ord">#{{ s.orderIndex }}</span>
                  <span class="ptitle">{{ s.title }}</span>
                  <span class="p-pill" :class="pill(s.status).cls">{{ pill(s.status).label }}</span>
                </div>
              </div>
              <template v-if="solutions.length">
                <div class="sub-label">Solutions</div>
                <div class="pick-list">
                  <div v-for="s in solutions" :key="s.id" class="pick" :class="selSols.has(s.id) ? 'on' : 'off'" @click="toggleSol(s.id)">
                    <span class="chk"><CheckIcon class="w-3 h-3" /></span>
                    <span class="ptitle">{{ s.title }}</span>
                    <span class="when">step {{ s.stepIds.join(', ') }}</span>
                  </div>
                </div>
              </template>
            </template>

            <!-- Details -->
            <template v-else-if="stage === 1">
              <h4>제목과 공개 설정</h4>
              <p class="hint">원본 case 제목은 디버깅용 raw 일 수 있어요. 발행용 제목과 한 줄 요약을 다듬으세요.</p>
              <div class="field"><label>Title <span class="count">{{ title.length }}/200</span></label>
                <input v-model="title" maxlength="200"></div>
              <div class="field"><label>Summary (TL;DR) <span class="count">{{ summary.length }}/500</span></label>
                <textarea v-model="summary" rows="3" maxlength="500" placeholder="한 줄 요약(선택)" /></div>
              <div class="field"><label>Author display name</label>
                <input v-model="author" placeholder="비우면 익명"></div>
              <div class="field"><label>Visibility</label>
                <div class="vis-row">
                  <div class="vis" :class="{ on: visibility === 'PUBLIC' }" @click="visibility = 'PUBLIC'">
                    <div class="vn">🌐 Public</div><div class="vd">검색에 노출 · 누구나 발견</div>
                  </div>
                  <div class="vis" :class="{ on: visibility === 'UNLISTED' }" @click="visibility = 'UNLISTED'">
                    <div class="vn">🔗 Unlisted</div><div class="vd">검색 X · 링크 아는 사람만</div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Files (첨부 포함/제외) -->
            <template v-else-if="stage === 2">
              <h4>첨부 파일</h4>
              <p class="hint">발행물에 넣을 첨부만 켜세요. 본문(Context)과 선택한 step 에 삽입된 첨부가 대상이에요. <b>표시 방식은 파일 종류로 자동</b> — 이미지는 인라인, 로그·JSON·PDF 는 새 탭, zip 등은 다운로드.</p>
              <p v-if="includedAttachments.length === 0" class="hint" style="font-style:italic">본문·선택한 step 에 삽입된 첨부가 없습니다.</p>
              <div v-else class="pick-list">
                <div v-for="{ att, src } in includedAttachments" :key="att.markerId" class="pick att" :class="excludedAtt.has(att.markerId) ? 'off' : 'on'" @click="toggleAtt(att.markerId)">
                  <span class="chk"><CheckIcon class="w-3 h-3" /></span>
                  <span class="att-ico">{{ attHint(att.kind).ico }}</span>
                  <span class="ptitle">{{ att.fileName }}</span>
                  <span class="att-src">{{ src === 'body' ? '본문' : 'step' }}</span>
                  <span class="att-how">{{ attHint(att.kind).how }}</span>
                  <span class="when">{{ fmtSize(att.size) }}</span>
                </div>
              </div>
              <p v-if="untaggedCount > 0" class="hint" style="margin-top:12px">본문·step 에 삽입하지 않은 첨부 {{ untaggedCount }}개는 발행에 포함되지 않아요. 넣으려면 케이스 본문/step 에 삽입하세요.</p>
            </template>

            <!-- Options -->
            <template v-else-if="stage === 3">
              <h4>표시 옵션</h4>
              <p class="hint">step 시간 표기와 간격 표시를 조정하세요. 발행 후에도 바꿀 수 있어요.</p>
              <div class="field"><label>Time style (시간 표기)</label>
                <select v-model="options.timeStyle" class="opt-select">
                  <option value="EXACT">정확한 타임스탬프</option>
                  <option value="RELATIVE">상대 시간 (Day N)</option>
                  <option value="NONE">표시 안 함</option>
                </select>
              </div>
              <div class="opt-toggle" :class="{ on: options.showStepDuration }" @click="options.showStepDuration = !options.showStepDuration">
                <span class="tg" />
                <div class="ot-txt">
                  <div class="ot-t">step 사이 간격 표시</div>
                  <div class="ot-s">"3시간 뒤 다음 step" 처럼 소요 시간을 함께 보여줍니다</div>
                </div>
              </div>
            </template>

            <!-- Preview -->
            <template v-else-if="stage === 4">
              <div class="rv-banner">👁 <div><b>발행 전 미리보기</b> — 아직 저장되지 않았습니다. 웹 발행물이 원본이고 PDF 는 사본입니다.</div></div>
              <div class="rv-meta">
                <span class="rv-chip"><b>{{ selSteps.size }}</b> steps</span>
                <span class="rv-chip"><b>{{ selSols.size }}</b> solutions</span>
                <span class="rv-chip"><b>{{ includedAttCount }}</b> attachments</span>
                <span class="rv-chip">visibility <b>{{ visibility }}</b></span>
              </div>
              <div class="pv">
                <span class="pv-vis">{{ visibility }}</span>
                <h2>{{ title }}</h2>
                <div v-if="summary" class="pv-sum">{{ summary }}</div>
                <div class="pv-sec">Timeline · {{ selSteps.size }} steps</div>
                <div v-for="s in selectedStepList" :key="s.id" class="pv-step" :class="{ ok: s.status === 'RESOLVED' }">
                  <div class="st-h">{{ s.title }}</div>
                  <div v-if="bodyPreview(s.body)" class="st-b">{{ bodyPreview(s.body) }}</div>
                </div>
                <template v-if="selectedSolList.length">
                  <div class="pv-sec">Solutions</div>
                  <div v-for="s in selectedSolList" :key="s.id" class="pv-sol">
                    <div class="sl-h">✓ {{ s.title }}</div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <div class="psh-foot">
            <button v-if="stage === 0" class="psh-btn" @click="close">취소</button>
            <button v-else class="psh-btn" @click="stage--"><ChevronLeftIcon class="ic" />뒤로</button>
            <span v-if="stage === 0" class="selinfo">{{ selSteps.size }} steps · {{ selSols.size }} solutions</span>
            <span v-else-if="stage === 2 && includedAttachments.length" class="selinfo">{{ includedAttCount }} / {{ includedAttachments.length }} 첨부 포함</span>
            <span v-if="errorMsg" class="err">{{ errorMsg }}</span>
            <span class="sp" />
            <button v-if="stage === 0" class="psh-btn primary" :disabled="!canNextInclude" @click="stage = 1">다음: 제목<ChevronRightIcon class="ic" /></button>
            <button v-else-if="stage === 1" class="psh-btn primary" :disabled="!canNextDetails" @click="stage = 2">다음: 첨부<ChevronRightIcon class="ic" /></button>
            <button v-else-if="stage === 2" class="psh-btn primary" @click="stage = 3">다음: 옵션<ChevronRightIcon class="ic" /></button>
            <button v-else-if="stage === 3" class="psh-btn primary" @click="stage = 4">다음: 미리보기<ChevronRightIcon class="ic" /></button>
            <button v-else class="psh-btn primary" :disabled="busy" @click="doPublish">{{ busy ? '발행 중…' : '발행하기' }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.psh-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.32); opacity: 0; transition: opacity .3s; z-index: 44; }
.psh-backdrop.show { opacity: 1; }

.psh-wrap { position: fixed; left: 80px; right: 0; bottom: 0; z-index: 45; transform: translateY(100%); transition: transform .34s cubic-bezier(.32,.72,0,1); }
.psh-wrap.show { transform: translateY(0); }
.psh-panel { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e4e4e7; border-bottom: 0; border-radius: 20px 20px 0 0;
  box-shadow: 0 20px 60px rgba(0,0,0,.16); display: flex; flex-direction: column; max-height: 86vh; overflow: hidden; }
:global(.dark) .psh-panel { background: #232327; border-color: #34343a; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.psh-grip { width: 38px; height: 4px; border-radius: 2px; background: #e4e4e7; margin: 9px auto 0; flex-shrink: 0; }
:global(.dark) .psh-grip { background: #3f3f46; }

/* 슬림 바 */
.psh-slim { display: flex; align-items: center; gap: 14px; padding: 16px 22px; }
.psh-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0; }
.psh-slim-txt { flex: 1; min-width: 0; }
.psh-slim-txt .t { font-size: 13.5px; font-weight: 500; color: #18181b; }
:global(.dark) .psh-slim-txt .t { color: #e4e4e7; }
.psh-slim-txt .s { font-size: 11.5px; color: #a1a1aa; margin-top: 2px; }

/* head + stepper */
.psh-head { display: flex; align-items: center; gap: 12px; padding: 14px 22px 0; flex-shrink: 0; }
.psh-head h3 { font-size: 15px; font-weight: 600; color: #18181b; }
:global(.dark) .psh-head h3 { color: #e4e4e7; }
.psh-stepper { display: flex; align-items: center; gap: 8px; margin-left: 6px; }
.stp { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa; }
.stp .n { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #e4e4e7; display: grid; place-items: center; font-size: 11px; font-weight: 600; }
.stp.active { color: #18181b; font-weight: 500; }
:global(.dark) .stp.active { color: #e4e4e7; }
.stp.active .n { border-color: #059669; color: #059669; }
.stp.done .n { background: #059669; border-color: #059669; color: #fff; }
.stp .bar { width: 18px; height: 1.5px; background: #e4e4e7; border-radius: 2px; }
:global(.dark) .stp .n, :global(.dark) .stp .bar { border-color: #3f3f46; }

.psh-x { margin-left: auto; width: 30px; height: 30px; border-radius: 9px; border: 0; background: none; color: #a1a1aa; font-size: 20px; line-height: 1; cursor: pointer; }
.psh-x:hover { background: #f4f4f5; color: #18181b; }
:global(.dark) .psh-x:hover { background: #27272a; color: #e4e4e7; }

.psh-body { padding: 14px 22px 20px; overflow-y: auto; flex: 1; min-height: 0; }
/* 단계별 마지막 요소의 margin 차이를 지워 footer 와의 간격을 항상 20px 로 통일 */
.psh-body > :last-child { margin-bottom: 0; }
.psh-body h4 { font-size: 16px; font-weight: 600; color: #18181b; margin-bottom: 5px; }
:global(.dark) .psh-body h4 { color: #e4e4e7; }
.hint { font-size: 12.5px; color: #71717a; line-height: 1.55; margin-bottom: 16px; }

.quick { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #a1a1aa; margin: 2px 0 12px; }
.quick button { font-size: 11.5px; padding: 4px 10px; border-radius: 7px; border: 1px solid #e4e4e7; background: none; color: #71717a; cursor: pointer; }
.quick button:hover { border-color: #059669; color: #059669; }
:global(.dark) .quick button { border-color: #3f3f46; color: #a1a1aa; }

.pick-list { display: flex; flex-direction: column; gap: 7px; }
.pick { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1px solid #e4e4e7; border-radius: 11px; cursor: pointer; transition: .13s; background: #fff; }
:global(.dark) .pick { background: #232327; border-color: #34343a; }
.pick:hover { border-color: #a1a1aa; }
.pick.on { border-color: #059669; background: #ecfdf5; }
:global(.dark) .pick.on { background: rgba(16,185,129,.10); border-color: #059669; }
.pick .chk { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid #a1a1aa; flex-shrink: 0; display: grid; place-items: center; color: #fff; }
.pick .chk :deep(svg) { opacity: 0; }
.pick.on .chk { background: #059669; border-color: #059669; }
.pick.on .chk :deep(svg) { opacity: 1; }
.pick .ord { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #a1a1aa; flex-shrink: 0; }
.pick .ptitle { font-size: 13.5px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #18181b; }
:global(.dark) .pick .ptitle { color: #e4e4e7; }
.pick.off .ptitle { color: #a1a1aa; }
.p-pill { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 5px; flex-shrink: 0; }
.p-pill.failed { background: rgba(225,29,72,.12); color: #e11d48; }
.p-pill.wip { background: rgba(59,130,246,.12); color: #3b82f6; }
.p-pill.resolved { background: #ecfdf5; color: #059669; }
:global(.dark) .p-pill.resolved { background: rgba(16,185,129,.12); color: #34d399; }
.pick .when { font-size: 11px; color: #a1a1aa; flex-shrink: 0; }
.sub-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #a1a1aa; margin: 22px 0 10px; }

.field { margin-bottom: 16px; }
.field label { display: block; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #a1a1aa; margin-bottom: 6px; }
.field .count { float: right; font-size: 10.5px; text-transform: none; letter-spacing: 0; }
.field input, .field textarea { width: 100%; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px; padding: 10px 12px; font: 400 14px "Inter", sans-serif; color: #18181b; resize: vertical; }
:global(.dark) .field input, :global(.dark) .field textarea { background: #1d1d20; border-color: #34343a; color: #e4e4e7; }
.field input:focus, .field textarea:focus { outline: none; border-color: #059669; }
.vis-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.vis { border: 1px solid #e4e4e7; border-radius: 11px; padding: 13px; cursor: pointer; transition: .13s; background: #fff; }
:global(.dark) .vis { background: #232327; border-color: #34343a; }
.vis:hover { border-color: #a1a1aa; }
.vis.on { border-color: #059669; background: #ecfdf5; }
:global(.dark) .vis.on { background: rgba(16,185,129,.10); border-color: #059669; }
.vis .vn { font-size: 13px; font-weight: 600; color: #18181b; }
:global(.dark) .vis .vn { color: #e4e4e7; }
.vis .vd { font-size: 11.5px; color: #71717a; margin-top: 4px; line-height: 1.4; }

/* attachments */
.pick .att-ico { font-size: 15px; flex-shrink: 0; }
.pick .att-src { font-size: 9.5px; font-weight: 600; color: #71717a; background: #f4f4f5; padding: 1px 6px; border-radius: 999px; flex-shrink: 0; }
:global(.dark) .pick .att-src { color: #a1a1aa; background: #27272a; }
.pick .att-how { font-size: 11px; color: #a1a1aa; flex-shrink: 0; }
.pick.att.on .att-how { color: #059669; }
:global(.dark) .pick.att.on .att-how { color: #34d399; }

/* options */
.opt-select { width: 100%; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px; padding: 10px 12px; font: 400 14px "Inter", sans-serif; color: #18181b; cursor: pointer; }
:global(.dark) .opt-select { background: #1d1d20; border-color: #34343a; color: #e4e4e7; }
.opt-select:focus { outline: none; border-color: #059669; }
.opt-toggle { display: flex; align-items: center; gap: 13px; padding: 14px; border: 1px solid #e4e4e7; border-radius: 11px; cursor: pointer; background: #fff; transition: .13s; }
:global(.dark) .opt-toggle { background: #232327; border-color: #34343a; }
.opt-toggle:hover { border-color: #a1a1aa; }
.opt-toggle .tg { width: 38px; height: 22px; border-radius: 999px; background: #e4e4e7; position: relative; flex-shrink: 0; transition: .18s; }
:global(.dark) .opt-toggle .tg { background: #3f3f46; }
.opt-toggle .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: .18s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.opt-toggle.on .tg { background: #059669; }
.opt-toggle.on .tg::after { transform: translateX(16px); }
.opt-toggle .ot-t { font-size: 13.5px; font-weight: 500; color: #18181b; }
:global(.dark) .opt-toggle .ot-t { color: #e4e4e7; }
.opt-toggle .ot-s { font-size: 11.5px; color: #71717a; margin-top: 2px; line-height: 1.4; }

.rv-banner { display: flex; align-items: center; gap: 10px; background: #fffbeb; border: 1px solid rgba(180,83,9,.3); border-radius: 11px; padding: 11px 14px; font-size: 12.5px; color: #b45309; margin-bottom: 14px; line-height: 1.45; }
:global(.dark) .rv-banner { background: rgba(245,158,11,.10); color: #fbbf24; }
.rv-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.rv-chip { font-size: 11.5px; color: #71717a; background: #f4f4f5; padding: 4px 10px; border-radius: 7px; }
:global(.dark) .rv-chip { background: #27272a; color: #a1a1aa; }
.rv-chip b { color: #18181b; font-weight: 600; }
:global(.dark) .rv-chip b { color: #e4e4e7; }
.pv { border: 1px solid #e4e4e7; border-radius: 14px; padding: 24px 24px 28px; background: #fff; }
:global(.dark) .pv { background: #232327; border-color: #34343a; }
.pv-vis { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 5px; display: inline-block; }
:global(.dark) .pv-vis { background: rgba(16,185,129,.12); color: #34d399; }
.pv h2 { font-family: "Fraunces", Georgia, serif; font-size: 24px; font-weight: 500; line-height: 1.25; margin: 12px 0 10px; color: #18181b; }
:global(.dark) .pv h2 { color: #e4e4e7; }
.pv-sum { font-size: 14px; color: #71717a; line-height: 1.6; padding-bottom: 16px; border-bottom: 1px solid #f4f4f5; }
:global(.dark) .pv-sum { border-color: #27272a; }
.pv-sec { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #a1a1aa; margin: 22px 0 12px; }
.pv-step { padding-left: 18px; border-left: 2px solid #e4e4e7; margin-bottom: 16px; position: relative; }
:global(.dark) .pv-step { border-color: #34343a; }
.pv-step::before { content: ""; position: absolute; left: -6px; top: 4px; width: 9px; height: 9px; border-radius: 50%; background: #a1a1aa; }
.pv-step.ok::before { background: #059669; }
.pv-step .st-h { font-size: 13.5px; font-weight: 600; color: #18181b; margin-bottom: 3px; }
:global(.dark) .pv-step .st-h { color: #e4e4e7; }
.pv-step .st-b { font-size: 12.5px; color: #71717a; line-height: 1.55; }
.pv-sol { background: #ecfdf5; border-radius: 11px; padding: 12px 15px; margin-bottom: 10px; }
:global(.dark) .pv-sol { background: rgba(16,185,129,.10); }
.pv-sol .sl-h { font-size: 13.5px; font-weight: 600; color: #059669; }
:global(.dark) .pv-sol .sl-h { color: #34d399; }

/* done */
.psh-done { text-align: center; padding: 22px 22px 8px; overflow-y: auto; }
.psh-done .ok-ic { width: 56px; height: 56px; border-radius: 50%; background: #ecfdf5; color: #059669; display: grid; place-items: center; margin: 6px auto 16px; }
:global(.dark) .psh-done .ok-ic { background: rgba(16,185,129,.12); color: #34d399; }
.psh-done h4 { font-size: 19px; font-weight: 600; color: #18181b; margin-bottom: 6px; }
:global(.dark) .psh-done h4 { color: #e4e4e7; }
.psh-done p { font-size: 13px; color: #71717a; margin-bottom: 20px; }
.slug-box { display: flex; align-items: center; gap: 10px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 11px; padding: 11px 14px; max-width: 420px; margin: 0 auto 14px; }
:global(.dark) .slug-box { background: #1d1d20; border-color: #34343a; }
.slug-box .u { font-family: "JetBrains Mono", monospace; font-size: 12.5px; color: #3f3f46; flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:global(.dark) .slug-box .u { color: #d4d4d8; }
.slug-box button { font-size: 12px; color: #059669; background: none; border: 0; cursor: pointer; font-weight: 600; white-space: nowrap; }
.share { display: flex; gap: 9px; justify-content: center; margin-bottom: 18px; }
.share a { font-size: 12.5px; color: #71717a; border: 1px solid #e4e4e7; padding: 7px 14px; border-radius: 9px; text-decoration: none; transition: .13s; }
.share a:hover { border-color: #059669; color: #059669; }
:global(.dark) .share a { border-color: #34343a; color: #a1a1aa; }
.psh-done .tip { font-size: 11.5px; color: #a1a1aa; line-height: 1.5; max-width: 380px; margin: 0 auto; }

/* footer */
.psh-foot { display: flex; align-items: center; gap: 10px; padding: 16px 22px; border-top: 1px solid #e4e4e7; background: #fff; flex-shrink: 0; }
:global(.dark) .psh-foot { background: #232327; border-color: #34343a; }
.psh-foot .sp { flex: 1; }
.psh-foot .selinfo { font-size: 11.5px; color: #a1a1aa; }
.psh-foot .err { font-size: 11.5px; color: #e11d48; }

.psh-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; padding: 9px 16px; border-radius: 10px; cursor: pointer; border: 1px solid #e4e4e7; background: none; color: #71717a; transition: .13s; }
.psh-btn:hover { border-color: #a1a1aa; color: #18181b; }
:global(.dark) .psh-btn { border-color: #3f3f46; color: #a1a1aa; }
:global(.dark) .psh-btn:hover { color: #e4e4e7; }
.psh-btn.primary { background: #047857; color: #fff; border-color: #047857; }
.psh-btn.primary:hover { background: #065f46; border-color: #065f46; color: #fff; }
.psh-btn.primary:disabled { opacity: .45; cursor: default; background: #047857; }
.psh-btn .ic { width: 14px; height: 14px; }
.psh-cta { font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 10px; border: 0; background: #047857; color: #fff; cursor: pointer; }
.psh-cta:hover { background: #065f46; }

@media (max-width: 640px) {
  .psh-wrap { left: 0; }
  .psh-stepper { display: none; }
}
</style>

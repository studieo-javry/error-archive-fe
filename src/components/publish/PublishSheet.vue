<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentDetail, PublishmentVisibility, PublishRequest, PublishTimeStyle } from '@/types/publish'
import type { Step, Solution, ErrorCaseAttachment } from '@/types/error'
import { ChevronRightIcon, ChevronLeftIcon, CheckIcon, PaperClipIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'

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
  /** 게스트 가이드 미리보기 — 실제 발행(POST)은 막고(서버도 403), 단계는 밖으로 알리고 가이드 카드가 진행시킨다. */
  guided?: boolean
  /** 가이드 카드의 '고르기'·'다음' 신호(증가 카운터) — 바뀌면 시트를 한 단계 진행시킨다. */
  advanceSignal?: number
}>()
const emit = defineEmits<{ close: []; published: [detail: PublishmentDetail]; stageChange: [stage: number]; guidedFinish: [] }>()

// -1 = 슬림 바, 0 = Steps, 1 = Details, 2 = Files, 3 = Options, 4 = Preview, DONE = 완료
const DONE = 5
const stage = ref(-1)
const STAGES = ['Steps', 'Details', 'Files', 'Options', 'Preview']
// 가이드 모드에서는 내부 단계가 바뀔 때마다 밖(가이드 카드)에 알려 내레이션을 맞춘다.
watch(stage, (v) => { if (props.guided) emit('stageChange', v) })
// 가이드 카드가 진행 신호를 보내면 시트를 한 단계 진행(슬림 → 고르기, 위저드 → 다음).
watch(() => props.advanceSignal, () => {
  if (!props.guided) return
  if (stage.value === -1) stage.value = 0
  else if (stage.value < 4) goNext()
})

const selSteps = ref(new Set<number>(props.steps.map(s => s.id)))
const selSols = ref(new Set<number>(props.solutions.map(s => s.id)))
const excludedAtt = ref(new Set<string>())          // 제외한 첨부 markerId (기본 전부 포함)
const options = ref<{ timeStyle: PublishTimeStyle; showStepDuration: boolean }>({ timeStyle: 'RELATIVE', showStepDuration: true })
const title = ref(props.caseTitle)
const summary = ref(props.caseSummary ?? '')
const author = ref(props.authorDefault)
const visibility = ref<PublishmentVisibility>('PUBLIC')

const busy = ref(false)
const launching = ref(false) // 최종 발행 버튼: 발사 중
const launched = ref(false)  // 최종 발행 버튼: 발사 후 '✓ 발행됨' 표시
const errorMsg = ref('')
const published = ref<PublishmentDetail | null>(null)
const copied = ref(false)

// 멱등 키 — 첫 발행 시 생성해 재시도 때 재사용(중복 발행 방지).
let idemKey = ''

const orderedSteps = computed(() => [...props.steps].sort((a, b) => a.orderIndex - b.orderIndex))
const canNextInclude = computed(() => selSteps.value.size > 0)
const canNextDetails = computed(() => title.value.trim().length > 0)
// footer '다음' 버튼 비활성 조건 — 단계별 게이트.
const nextDisabled = computed(
  () => (stage.value === 0 && !canNextInclude.value) || (stage.value === 1 && !canNextDetails.value),
)
function goNext() {
  if (nextDisabled.value) return
  if (stage.value < 4) stage.value++
}

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

// 미리보기 렌더용: 특정 텍스트(본문/step)에 @attach 로 태그되고 제외되지 않은 첨부를 그 위치에 그린다.
// BE HtmlRenderer 와 동일 — 본문 첨부는 Context 에, step 첨부는 해당 step 아래에(위치별, 교차 dedup 없음).
const attByMarker = computed(() => new Map(props.attachments.map(a => [a.markerId, a])))
function attsIn(text: string | null): ErrorCaseAttachment[] {
  const seen = new Set<string>()
  const out: ErrorCaseAttachment[] = []
  for (const id of attachMarkersIn(text)) {
    if (seen.has(id) || excludedAtt.value.has(id)) continue
    const att = attByMarker.value.get(id)
    if (att) { seen.add(id); out.push(att) }
  }
  return out
}
const bodyAtts = computed(() => attsIn(props.caseDescription))

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
  // 마커/마크다운 잡음을 대충 걷어내고 한 줄로. @attach(..)/@snippet(..) 는 아래에서 실제 자산으로 렌더하므로 텍스트에선 제거.
  return b
    .replace(/@(?:attach|snippet)\([^)]*\)/g, '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/[#>*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

async function doPublish() {
  // 게스트 미리보기: 실제 발행(POST) 대신 발행된 글 읽기(05)로 넘긴다 — 로그인으로 튕기지 않는다.
  // (게스트는 미리 준비된 데모 발행물을 읽고, 가입은 마지막 완료 카드에서.)
  if (props.guided) { emit('guidedFinish'); return }
  if (busy.value) return
  busy.value = true
  launching.value = true
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
  // 발사(0.55s) → '✓ 발행됨'(0.75s) → 완료 화면. 발사와 발행 요청은 동시에.
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const finishOnButton = async () => { launched.value = true; await delay(750) } // 버튼에 발행됨 잠깐 표시
  const resetLaunch = () => { launching.value = false; launched.value = false }
  try {
    const [res] = await Promise.all([publishmentApi.create(req, idemKey), delay(550)])
    published.value = res.data
    await finishOnButton()
    stage.value = DONE
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      // 이미 발행된 케이스 — 기존 발행물을 끌어와 완료 화면으로 자연스럽게 넘어간다.
      try {
        const { data } = await publishmentApi.getByCase(props.caseId)
        published.value = data
        await finishOnButton()
        stage.value = DONE
      } catch { errorMsg.value = '이미 발행된 케이스예요. 페이지를 새로고침 해주세요.'; resetLaunch() }
    } else if (axios.isAxiosError(e) && e.response?.status === 422) {
      errorMsg.value = '최소 1개의 step 을 포함해야 해요.'
      resetLaunch()
    } else {
      errorMsg.value = '발행에 실패했어요. 잠시 후 다시 시도해 주세요.'
      resetLaunch()
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

        <!-- 게스트 가이드 미리보기 안내 -->
        <div v-if="guided" class="psh-guided"><span class="psh-guided-dot" />게스트 미리보기 · 실제 발행과 공개는 가입 후에</div>

        <!-- 슬림 진입 바 -->
        <div v-if="stage === -1" class="psh-slim">
          <span class="psh-live" />
          <div class="psh-slim-txt">
            <div class="t">이 케이스를 발행물로 만들기</div>
            <div class="s">기본값: step {{ selSteps.size }}개 · solution {{ selSols.size }}개 선택됨 · 공개
              <span class="psh-qp" tabindex="0" aria-label="바로 발행 기본값 안내">
                <span class="psh-qp-i">i</span>
                <span class="psh-qp-tip" role="tooltip">
                  <span class="h"><span class="zap">⚡</span> 바로 발행하면 이렇게 나가요</span>
                  <span class="lead">따로 고르지 않고 <b>가장 포괄적인 기본값</b>으로 즉시 발행합니다.</span>
                  <span class="row warn"><span class="ico">🌐</span><span class="rt"><span class="k">공개 (Public)</span><span class="v">누구나 링크로 열람 · 검색 노출. <b>즉시 외부 공개</b>돼요.</span></span></span>
                  <span class="row"><span class="ico">🧩</span><span class="rt"><span class="k">모든 step · solution 포함</span><span class="v"><b>실패한 step 까지</b> 전부 담겨요.</span></span></span>
                  <span class="row"><span class="ico">📎</span><span class="rt"><span class="k">태그된 첨부 전부</span><span class="v">본문·step 에 넣은 파일만 포함(안 넣은 첨부는 제외).</span></span></span>
                  <span class="row"><span class="ico">⏱</span><span class="rt"><span class="k">상대 시간 · 소요시간 · 줄번호</span><span class="v">Day N 표기 · step 소요시간 · 코드 줄번호 표시.</span></span></span>
                  <span class="row"><span class="ico">✍️</span><span class="rt"><span class="k">제목·요약·작성자는 케이스 그대로</span><span class="v">요약이 없으면 본문에서 미리보기를 자동 생성.</span></span></span>
                  <span class="foot">세부 조정이 필요하면 <b>고르기</b>로 단계별 선택하세요.</span>
                </span>
              </span>
            </div>
          </div>
          <button class="psh-btn" :class="{ 'psh-nudge': guided }" @click="stage = 0">고르기</button>
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
              <!-- Markdown 내보내기 — 도입 예정(비활성). -->
              <span class="soon" title="Markdown 내보내기 · 도입 예정">📝 Markdown<em>도입 예정</em></span>
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
              <p v-if="includedAttachments.length === 0" class="subline">본문과 선택한 step 에 삽입한 첨부가 발행물에 함께 들어가요.</p>
              <p v-else class="subline">넣을 첨부만 켜세요. <b>표시 방식은 파일 종류에 따라 자동</b>이에요.</p>

              <div v-if="includedAttachments.length === 0" class="att-empty">
                <div class="eico"><PaperClipIcon class="w-[22px] h-[22px]" /></div>
                <div class="et">삽입한 첨부가 없어요</div>
                <div class="ed">본문이나 step 에 파일을 삽입하면 여기서 발행 포함 여부를 고를 수 있어요.</div>
              </div>
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
              <div v-if="untaggedCount > 0" class="att-excluded">
                <InformationCircleIcon class="ic" />
                <span>본문·step 에 삽입하지 않은 첨부 <b>{{ untaggedCount }}개</b>는 제외돼요. 넣으려면 본문이나 step 에 삽입하세요.</span>
              </div>
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
                <!-- Context 본문에 삽입한 첨부(실제 발행 페이지와 동일 위치) -->
                <template v-if="bodyAtts.length">
                  <div class="pv-sec">Context</div>
                  <div v-for="a in bodyAtts" :key="a.markerId" class="pv-att">
                    <img v-if="a.kind === 'IMAGE' && a.url" :src="a.url" :alt="a.title || a.fileName" loading="lazy" />
                    <a v-else class="pv-att-file" :href="a.url || a.downloadUrl" target="_blank" rel="noopener"><PaperClipIcon class="ic" />{{ a.fileName }}<span class="how">{{ attHint(a.kind).how }}</span></a>
                  </div>
                </template>
                <div class="pv-sec">Timeline · {{ selSteps.size }} steps</div>
                <div v-for="s in selectedStepList" :key="s.id" class="pv-step" :class="{ ok: s.status === 'RESOLVED' }">
                  <div class="st-h">{{ s.title }}</div>
                  <div v-if="bodyPreview(s.body)" class="st-b">{{ bodyPreview(s.body) }}</div>
                  <!-- 이 step 본문에 삽입한 첨부 -->
                  <div v-for="a in attsIn(s.body)" :key="a.markerId" class="pv-att">
                    <img v-if="a.kind === 'IMAGE' && a.url" :src="a.url" :alt="a.title || a.fileName" loading="lazy" />
                    <a v-else class="pv-att-file" :href="a.url || a.downloadUrl" target="_blank" rel="noopener"><PaperClipIcon class="ic" />{{ a.fileName }}<span class="how">{{ attHint(a.kind).how }}</span></a>
                  </div>
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
            <button v-if="stage === 0" class="psh-back" @click="close">취소</button>
            <button v-else class="psh-back" @click="stage--"><ChevronLeftIcon class="ic" />뒤로</button>
            <span v-if="stage === 0" class="selinfo">{{ selSteps.size }} steps · {{ selSols.size }} solutions</span>
            <span v-else-if="stage === 2 && includedAttachments.length" class="selinfo">{{ includedAttCount }} / {{ includedAttachments.length }} 첨부 포함</span>
            <span v-if="errorMsg" class="err">{{ errorMsg }}</span>
            <span class="sp" />
            <!-- 다음(0~3): 라벨 없이 단계 인디케이터(완료=● 현재=◉ 예정=○) -->
            <button v-if="stage < 4" class="psh-prog" :class="{ 'psh-nudge': guided && !nextDisabled }" :disabled="nextDisabled" @click="goNext" aria-label="다음 단계">
              <span class="psh-dots"><i v-for="n in 5" :key="n" :class="n - 1 < stage ? 'done' : (n - 1 === stage ? 'cur' : 'up')" /></span>
            </button>
            <!-- 최종 발행(4): Launch -->
            <button v-else class="psh-launch" :class="{ launching, launched, 'psh-nudge': guided && !launching && !launched }" :disabled="busy" @click="doPublish" aria-label="발행">
              <span class="lbl"><span class="psh-dots"><i v-for="n in 5" :key="n" :class="n === 5 ? 'cur' : 'done'" /></span></span>
              <span class="plane" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 11.5 21 3l-6 18-4.5-6.5L2.5 11.5Z" /></svg>
              </span>
              <span class="okmsg"><CheckIcon class="w-3.5 h-3.5" />발행됨</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<!-- 테마 토큰은 비-scoped(전역) — 이 프로젝트는 scoped <style> 의 :global(.dark) 가
     빌드에서 누락돼 다크가 안 먹는다. 전역 :root/.dark 는 정상 동작(PublishStatusBar 동일 방식). -->
<style>
:root {
  --psh-surface: #ffffff;
  --psh-surface-2: #fafafa;
  --psh-line: #e4e4e7;
  --psh-line-2: #e4e4e7;
  --psh-soft: #f4f4f5;
  --psh-ink: #18181b;
  --psh-ink-2: #3f3f46;
  --psh-sub: #71717a;
  --psh-faint: #a1a1aa;
  --psh-accent: #059669;
  --psh-accent-fill: #059669;
  --psh-accent-soft: #ecfdf5;
  --psh-rose: #e11d48;
  --psh-rose-soft: rgba(225, 29, 72, .12);
  --psh-blue: #3b82f6;
  --psh-blue-soft: rgba(59, 130, 246, .12);
  --psh-amber: #b45309;
  --psh-amber-soft: #fffbeb;
  --psh-amber-ring: rgba(180, 83, 9, .3);
  --psh-shadow: 0 20px 60px rgba(0, 0, 0, .16);
}
.dark {
  --psh-surface: #232327;
  --psh-surface-2: #1d1d20;
  --psh-line: #34343a;
  --psh-line-2: #3f3f46;
  --psh-soft: #27272a;
  --psh-ink: #e4e4e7;
  --psh-ink-2: #d4d4d8;
  --psh-sub: #a1a1aa;
  --psh-faint: #71717a;
  --psh-accent: #34d399;
  --psh-accent-fill: #059669;
  --psh-accent-soft: rgba(16, 185, 129, .12);
  --psh-rose: #fb7185;
  --psh-rose-soft: rgba(225, 29, 72, .16);
  --psh-blue: #60a5fa;
  --psh-blue-soft: rgba(59, 130, 246, .16);
  --psh-amber: #fbbf24;
  --psh-amber-soft: rgba(245, 158, 11, .10);
  --psh-amber-ring: rgba(245, 158, 11, .3);
  --psh-shadow: 0 20px 60px rgba(0, 0, 0, .6);
}
</style>

<style scoped>
.psh-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.32); opacity: 0; transition: opacity .3s; z-index: 44; }
.psh-backdrop.show { opacity: 1; }

.psh-wrap { position: fixed; left: 80px; right: 0; bottom: 0; z-index: 45; transform: translateY(100%); transition: transform .34s cubic-bezier(.32,.72,0,1); }
.psh-wrap.show { transform: translateY(0); }
.psh-panel { max-width: 760px; margin: 0 auto; background: var(--psh-surface); border: 1px solid var(--psh-line); border-bottom: 0; border-radius: 20px 20px 0 0;
  box-shadow: var(--psh-shadow); display: flex; flex-direction: column; max-height: 86vh; overflow: hidden; }
.psh-grip { width: 38px; height: 4px; border-radius: 2px; background: var(--psh-line-2); margin: 9px auto 0; flex-shrink: 0; }
/* 게스트 가이드 미리보기 안내 바 */
.psh-guided { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 8px 22px 0; padding: 7px 12px; border-radius: 9px;
  background: var(--psh-accent-soft); color: var(--psh-accent); font-size: 11.5px; font-weight: 500; flex-shrink: 0; }
.psh-guided-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

/* 슬림 바 */
.psh-slim { display: flex; align-items: center; gap: 14px; padding: 16px 22px; }
.psh-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0; }
.psh-slim-txt { flex: 1; min-width: 0; }
.psh-slim-txt .t { font-size: 13.5px; font-weight: 500; color: var(--psh-ink); }
.psh-slim-txt .s { font-size: 11.5px; color: var(--psh-faint); margin-top: 2px; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }

/* 슬림 바(진입 화면)일 때만 툴팁이 시트 밖으로 나올 수 있게 clip 해제 (위저드 단계는 그대로 hidden) */
.psh-panel:has(.psh-slim) { overflow: visible; }

/* '바로 발행' 기본값 안내 툴팁 */
.psh-qp { position: relative; display: inline-flex; }
.psh-qp-i { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; border: 1px solid var(--psh-line-2); color: var(--psh-sub); font-size: 9.5px; font-weight: 700; line-height: 1; cursor: help; transition: border-color .14s, color .14s, background-color .14s; }
.psh-qp:hover .psh-qp-i, .psh-qp:focus-within .psh-qp-i { border-color: var(--psh-accent); color: var(--psh-accent); background: var(--psh-accent-soft); }
.psh-qp-tip { position: absolute; bottom: calc(100% + 12px); left: 0; z-index: 60; width: 290px;
  background: var(--psh-surface); border: 1px solid var(--psh-line); border-radius: 14px; box-shadow: var(--psh-shadow);
  padding: 14px 15px; opacity: 0; transform: translateY(6px) scale(.98); transform-origin: bottom left;
  pointer-events: none; transition: opacity .16s, transform .16s; }
.psh-qp:hover .psh-qp-tip, .psh-qp:focus-within .psh-qp-tip { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.psh-qp-tip::after { content: ""; position: absolute; top: 100%; left: 18px; width: 12px; height: 12px;
  background: var(--psh-surface); border-right: 1px solid var(--psh-line); border-bottom: 1px solid var(--psh-line);
  transform: translateY(-6px) rotate(45deg); }
.psh-qp-tip .h { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--psh-ink); margin-bottom: 3px; }
.psh-qp-tip .h .zap { color: var(--psh-accent); }
.psh-qp-tip .lead { display: block; font-size: 11px; color: var(--psh-sub); line-height: 1.5; margin-bottom: 11px; }
.psh-qp-tip .row { display: flex; gap: 9px; padding: 6px 0; border-top: 1px solid var(--psh-line); align-items: flex-start; }
.psh-qp-tip .row:first-of-type { border-top: 0; }
.psh-qp-tip .row .ico { width: 16px; flex-shrink: 0; text-align: center; font-size: 12px; line-height: 1.5; }
.psh-qp-tip .row .rt { flex: 1; min-width: 0; display: block; }
.psh-qp-tip .row .k { display: block; font-size: 11.5px; font-weight: 600; color: var(--psh-ink); line-height: 1.4; }
.psh-qp-tip .row .v { display: block; font-size: 11px; color: var(--psh-sub); line-height: 1.45; margin-top: 1px; }
.psh-qp-tip .row .v b { color: var(--psh-ink-2); font-weight: 600; }
.psh-qp-tip .row.warn .k { color: var(--psh-amber); }
.psh-qp-tip .foot { display: block; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--psh-line); font-size: 10.5px; color: var(--psh-faint); line-height: 1.5; }
.psh-qp-tip .foot b { color: var(--psh-sub); }

/* head + stepper */
.psh-head { display: flex; align-items: center; gap: 12px; padding: 14px 22px 0; flex-shrink: 0; }
.psh-head h3 { font-size: 15px; font-weight: 600; color: var(--psh-ink); }
.psh-stepper { display: flex; align-items: center; gap: 8px; margin-left: 6px; }
.stp { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--psh-faint); }
.stp .n { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--psh-line-2); display: grid; place-items: center; font-size: 11px; font-weight: 600; }
.stp.active { color: var(--psh-ink); font-weight: 500; }
.stp.active .n { border-color: var(--psh-accent); color: var(--psh-accent); }
.stp.done .n { background: var(--psh-accent-fill); border-color: var(--psh-accent-fill); color: #fff; }
.stp .bar { width: 18px; height: 1.5px; background: var(--psh-line-2); border-radius: 2px; }

.psh-x { margin-left: auto; width: 30px; height: 30px; border-radius: 9px; border: 0; background: none; color: var(--psh-faint); font-size: 20px; line-height: 1; cursor: pointer; }
.psh-x:hover { background: var(--psh-soft); color: var(--psh-ink); }

.psh-body { padding: 14px 22px 20px; overflow-y: auto; flex: 1; min-height: 0; }
/* 단계별 마지막 요소의 margin 차이를 지워 footer 와의 간격을 항상 20px 로 통일 */
.psh-body > :last-child { margin-bottom: 0; }
.psh-body h4 { font-size: 16px; font-weight: 600; color: var(--psh-ink); margin-bottom: 5px; }
.hint { font-size: 12.5px; color: var(--psh-sub); line-height: 1.55; margin-bottom: 16px; }
/* Files 단계 한 줄 안내 */
.subline { font-size: 12.5px; color: var(--psh-sub); line-height: 1.5; margin-bottom: 16px; }
.subline b { color: var(--psh-ink-2); font-weight: 600; }
/* 첨부 없음 — 필기체 대신 아이콘 블록 */
.att-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 30px 22px; border: 1px dashed var(--psh-line); border-radius: 14px; background: var(--psh-surface-2); }
.att-empty .eico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--psh-soft); color: var(--psh-faint); margin-bottom: 8px; }
.att-empty .et { font-size: 14px; font-weight: 600; color: var(--psh-ink-2); }
.att-empty .ed { font-size: 12px; color: var(--psh-sub); line-height: 1.5; max-width: 280px; }
/* 제외 안내 — info 배지 */
.att-excluded { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 9px 12px; border-radius: 10px; background: var(--psh-amber-soft); font-size: 11.5px; color: var(--psh-amber); line-height: 1.45; }
.att-excluded .ic { width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px; }
.att-excluded b { font-weight: 600; }

.quick { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--psh-faint); margin: 2px 0 12px; }
.quick button { font-size: 11.5px; padding: 4px 10px; border-radius: 7px; border: 1px solid var(--psh-line-2); background: none; color: var(--psh-sub); cursor: pointer; }
.quick button:hover { border-color: var(--psh-accent); color: var(--psh-accent); }

.pick-list { display: flex; flex-direction: column; gap: 7px; }
.pick { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1px solid var(--psh-line); border-radius: 11px; cursor: pointer; transition: .13s; background: var(--psh-surface); }
.pick:hover { border-color: var(--psh-faint); }
.pick.on { border-color: var(--psh-accent); background: var(--psh-accent-soft); }
.pick .chk { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid var(--psh-faint); flex-shrink: 0; display: grid; place-items: center; color: #fff; }
.pick .chk :deep(svg) { opacity: 0; }
.pick.on .chk { background: var(--psh-accent-fill); border-color: var(--psh-accent-fill); }
.pick.on .chk :deep(svg) { opacity: 1; }
.pick .ord { font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--psh-faint); flex-shrink: 0; }
.pick .ptitle { font-size: 13.5px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--psh-ink); }
.pick.off .ptitle { color: var(--psh-faint); }
.p-pill { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 5px; flex-shrink: 0; }
.p-pill.failed { background: var(--psh-rose-soft); color: var(--psh-rose); }
.p-pill.wip { background: var(--psh-blue-soft); color: var(--psh-blue); }
.p-pill.resolved { background: var(--psh-accent-soft); color: var(--psh-accent); }
.pick .when { font-size: 11px; color: var(--psh-faint); flex-shrink: 0; }
.sub-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--psh-faint); margin: 22px 0 10px; }

.field { margin-bottom: 16px; }
.field label { display: block; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--psh-faint); margin-bottom: 6px; }
.field .count { float: right; font-size: 10.5px; text-transform: none; letter-spacing: 0; }
.field input, .field textarea { width: 100%; background: var(--psh-surface-2); border: 1px solid var(--psh-line); border-radius: 10px; padding: 10px 12px; font: 400 14px "Inter", sans-serif; color: var(--psh-ink); resize: vertical; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--psh-accent); }
.vis-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.vis { border: 1px solid var(--psh-line); border-radius: 11px; padding: 13px; cursor: pointer; transition: .13s; background: var(--psh-surface); }
.vis:hover { border-color: var(--psh-faint); }
.vis.on { border-color: var(--psh-accent); background: var(--psh-accent-soft); }
.vis .vn { font-size: 13px; font-weight: 600; color: var(--psh-ink); }
.vis .vd { font-size: 11.5px; color: var(--psh-sub); margin-top: 4px; line-height: 1.4; }

/* attachments */
.pick .att-ico { font-size: 15px; flex-shrink: 0; }
.pick .att-src { font-size: 9.5px; font-weight: 600; color: var(--psh-sub); background: var(--psh-soft); padding: 1px 6px; border-radius: 999px; flex-shrink: 0; }
.pick .att-how { font-size: 11px; color: var(--psh-faint); flex-shrink: 0; }
.pick.att.on .att-how { color: var(--psh-accent); }

/* options */
.opt-select { width: 100%; background: var(--psh-surface-2); border: 1px solid var(--psh-line); border-radius: 10px; padding: 10px 12px; font: 400 14px "Inter", sans-serif; color: var(--psh-ink); cursor: pointer; }
.opt-select:focus { outline: none; border-color: var(--psh-accent); }
.opt-toggle { display: flex; align-items: center; gap: 13px; padding: 14px; border: 1px solid var(--psh-line); border-radius: 11px; cursor: pointer; background: var(--psh-surface); transition: .13s; }
.opt-toggle:hover { border-color: var(--psh-faint); }
.opt-toggle .tg { width: 38px; height: 22px; border-radius: 999px; background: var(--psh-line-2); position: relative; flex-shrink: 0; transition: .18s; }
.opt-toggle .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: .18s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.opt-toggle.on .tg { background: var(--psh-accent-fill); }
.opt-toggle.on .tg::after { transform: translateX(16px); }
.opt-toggle .ot-t { font-size: 13.5px; font-weight: 500; color: var(--psh-ink); }
.opt-toggle .ot-s { font-size: 11.5px; color: var(--psh-sub); margin-top: 2px; line-height: 1.4; }

.rv-banner { display: flex; align-items: center; gap: 10px; background: var(--psh-amber-soft); border: 1px solid var(--psh-amber-ring); border-radius: 11px; padding: 11px 14px; font-size: 12.5px; color: var(--psh-amber); margin-bottom: 14px; line-height: 1.45; }
.rv-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.rv-chip { font-size: 11.5px; color: var(--psh-sub); background: var(--psh-soft); padding: 4px 10px; border-radius: 7px; }
.rv-chip b { color: var(--psh-ink); font-weight: 600; }
.pv { border: 1px solid var(--psh-line); border-radius: 14px; padding: 24px 24px 28px; background: var(--psh-surface); }
.pv-vis { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--psh-accent); background: var(--psh-accent-soft); padding: 2px 8px; border-radius: 5px; display: inline-block; }
.pv h2 { font-family: "Fraunces", Georgia, serif; font-size: 24px; font-weight: 500; line-height: 1.25; margin: 12px 0 10px; color: var(--psh-ink); }
.pv-sum { font-size: 14px; color: var(--psh-sub); line-height: 1.6; padding-bottom: 16px; border-bottom: 1px solid var(--psh-soft); }
.pv-sec { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--psh-faint); margin: 22px 0 12px; }
.pv-step { padding-left: 18px; border-left: 2px solid var(--psh-line); margin-bottom: 16px; position: relative; }
.pv-step::before { content: ""; position: absolute; left: -6px; top: 4px; width: 9px; height: 9px; border-radius: 50%; background: var(--psh-faint); }
.pv-step.ok::before { background: var(--psh-accent); }
.pv-step .st-h { font-size: 13.5px; font-weight: 600; color: var(--psh-ink); margin-bottom: 3px; }
.pv-step .st-b { font-size: 12.5px; color: var(--psh-sub); line-height: 1.55; }
.pv-sol { background: var(--psh-accent-soft); border-radius: 11px; padding: 12px 15px; margin-bottom: 10px; }
.pv-sol .sl-h { font-size: 13.5px; font-weight: 600; color: var(--psh-accent); }
/* 미리보기 첨부 — 이미지는 인라인, 그 외는 📎 파일명 링크(실제 발행 페이지와 동일) */
.pv-att { margin: 10px 0; }
.pv-step .pv-att { margin: 8px 0 0; }
.pv-att img { display: block; max-width: 100%; max-height: 240px; width: auto; border: 1px solid var(--psh-line); border-radius: 8px; }
.pv-att-file { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--psh-ink-2); border: 1px solid var(--psh-line); border-radius: 9px; padding: 7px 12px; text-decoration: none; max-width: 100%; }
.pv-att-file:hover { border-color: var(--psh-accent); color: var(--psh-accent); }
.pv-att-file .ic { width: 14px; height: 14px; flex-shrink: 0; }
.pv-att-file .how { font-size: 11px; color: var(--psh-faint); flex-shrink: 0; }

/* done */
.psh-done { text-align: center; padding: 22px 22px 8px; overflow-y: auto; }
.psh-done .ok-ic { width: 56px; height: 56px; border-radius: 50%; background: var(--psh-accent-soft); color: var(--psh-accent); display: grid; place-items: center; margin: 6px auto 16px; }
.psh-done h4 { font-size: 19px; font-weight: 600; color: var(--psh-ink); margin-bottom: 6px; }
.psh-done p { font-size: 13px; color: var(--psh-sub); margin-bottom: 20px; }
.slug-box { display: flex; align-items: center; gap: 10px; background: var(--psh-surface-2); border: 1px solid var(--psh-line); border-radius: 11px; padding: 11px 14px; max-width: 420px; margin: 0 auto 14px; }
.slug-box .u { font-family: "JetBrains Mono", monospace; font-size: 12.5px; color: var(--psh-ink-2); flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slug-box button { font-size: 12px; color: var(--psh-accent); background: none; border: 0; cursor: pointer; font-weight: 600; white-space: nowrap; }
.share { display: flex; gap: 9px; justify-content: center; margin-bottom: 18px; }
.share a { font-size: 12.5px; color: var(--psh-sub); border: 1px solid var(--psh-line); padding: 7px 14px; border-radius: 9px; text-decoration: none; transition: .13s; }
.share a:hover { border-color: var(--psh-accent); color: var(--psh-accent); }
/* Markdown 도입 예정 — 비활성(점선 테두리 + 앰버 태그). 클릭 불가. */
.share .soon { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--psh-sub); border: 1px dashed var(--psh-amber-ring); padding: 7px 14px; border-radius: 9px; cursor: default; opacity: .78; }
.share .soon em { font-style: normal; font-size: 9px; font-weight: 700; letter-spacing: .02em; color: var(--psh-amber); background: var(--psh-amber-soft); padding: 1px 6px; border-radius: 999px; }
.psh-done .tip { font-size: 11.5px; color: var(--psh-faint); line-height: 1.5; max-width: 380px; margin: 0 auto; }

/* footer */
.psh-foot { display: flex; align-items: center; gap: 10px; padding: 16px 22px; border-top: 1px solid var(--psh-line); background: var(--psh-surface); flex-shrink: 0; }
.psh-foot .sp { flex: 1; }
.psh-foot .selinfo { font-size: 11.5px; color: var(--psh-faint); }
.psh-foot .err { font-size: 11.5px; color: var(--psh-rose); }

/* 슬림바 고르기·바로발행 — footer 버튼과 높이/폰트 통일(min-height 36 + 13px) */
.psh-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 36px; font-size: 13px; font-weight: 500; padding: 0 15px; border-radius: 10px; cursor: pointer; border: 1px solid var(--psh-line-2); background: none; color: var(--psh-sub); transition: .13s; }
.psh-btn:hover { border-color: var(--psh-faint); color: var(--psh-ink); }
/* CTA(다음/발행/완료): emerald-700 고정 — 라이트/다크 모두 흰 글자 대비 확보 */
.psh-btn.primary { background: #047857; color: #fff; border-color: #047857; }
.psh-btn.primary:hover { background: #065f46; border-color: #065f46; color: #fff; }
.psh-btn.primary:disabled { opacity: .45; cursor: default; background: #047857; }
.psh-btn .ic { width: 14px; height: 14px; }

/* 취소·뒤로: 테두리 없는 텍스트 */
.psh-back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; padding: 9px 8px; border: 0; background: none; color: var(--psh-sub); cursor: pointer; transition: color .13s; }
.psh-back:hover { color: var(--psh-ink); }
.psh-back .ic { width: 14px; height: 14px; }
/* 다음: 단계 인디케이터 dots 내장 */
/* 배경 박스를 .psh-btn.primary(바로 발행)와 동일하게: 대칭 padding + 1px 테두리 + 가운데 정렬 */
.psh-prog, .psh-launch { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 36px; font-size: 13px; font-weight: 600; padding: 0 15px; border-radius: 10px; border: 1px solid #047857; background: #047857; color: #fff; cursor: pointer; transition: transform .14s cubic-bezier(.34, 1.5, .5, 1), background .13s, border-color .13s; }
.psh-prog:hover, .psh-launch:hover { background: #065f46; border-color: #065f46; }
.psh-prog:active, .psh-launch:active { transform: scale(.97); }
.psh-prog:disabled { opacity: .45; cursor: default; background: #047857; border-color: #047857; transform: none; }
/* 단계 인디케이터(링 믹스): 완료=흰 점 / 현재=흰 점 + 링 / 예정=빈 원 */
.psh-dots { display: inline-flex; gap: 7px; align-items: center; }
.psh-dots i { width: 7px; height: 7px; border-radius: 50%; box-sizing: border-box; transition: background .25s, box-shadow .25s, border-color .25s; }
.psh-dots i.done { background: #fff; border: 0; }
.psh-dots i.cur { background: #fff; box-shadow: 0 0 0 3px rgba(255, 255, 255, .3); }
.psh-dots i.up { background: transparent; border: 1.5px solid rgba(255, 255, 255, .5); }
/* 최종 발행: Launch(발사) → '✓ 발행됨' */
.psh-launch { position: relative; overflow: hidden; justify-content: center; min-width: 100px; }
.psh-launch .lbl { display: inline-flex; align-items: center; gap: 9px; transition: opacity .3s, transform .3s; }
.psh-launch .okmsg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5px; font-weight: 600; opacity: 0; transform: translateY(8px); transition: opacity .3s, transform .3s; }
.psh-launch.launched .lbl { opacity: 0; }
.psh-launch.launched .okmsg { opacity: 1; transform: none; transition-delay: .1s; }
.psh-launch .plane { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 0; pointer-events: none; }
.psh-launch .plane svg { width: 15px; height: 15px; }
.psh-launch.launching .lbl { opacity: 0; transform: translateX(-6px); }
.psh-launch.launching .plane { animation: psh-launch .55s cubic-bezier(.4, 0, .6, 1) forwards; }
@keyframes psh-launch { 0% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg); } 100% { opacity: 0; transform: translate(120%, -260%) rotate(18deg); } }

/* 가이드 모드: 지금 눌러야 할 버튼(슬림 '고르기' → 위저드 '다음' → 미리보기 '발행')에
   클릭 유도 펄스 — 우측 가이드 카드만으로 시트 안 다음 동작이 안 보이던 문제 보완. */
.psh-nudge { animation: psh-nudge 1.7s ease-in-out infinite; }
@keyframes psh-nudge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); }
  45% { box-shadow: 0 0 0 5px rgba(5, 150, 105, .22); }
}
@media (prefers-reduced-motion: reduce) {
  .psh-nudge { animation: none; box-shadow: 0 0 0 3px rgba(5, 150, 105, .22); }
}

.psh-cta { font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 10px; border: 0; background: #047857; color: #fff; cursor: pointer; }
.psh-cta:hover { background: #065f46; }

@media (max-width: 640px) {
  .psh-wrap { left: 0; }
  .psh-stepper { display: none; }
}
</style>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useDemoStore } from '@/stores/demoStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

/**
 * 게스트용 "해결 과정 추가" 박스(목업 injectStepForm / stepFormInlineHTML).
 * 게스트는 데모 워크스페이스에 쓰기 권한이 없어 실제 StepForm 이 숨겨지므로, 입력 흐름만 체험하게 한다 —
 * 서버에 아무것도 저장하지 않는다. Evidence(측정값 근거 블록)는 발행 시 보일 모습을 미리보기로 렌더한다.
 */
const demo = useDemoStore()
const open = ref(false)

const title = ref('')
const status = ref('FAILED')
const attemptType = ref('')
const body = ref('')
const insight = ref('')

// 목업과 같은 샘플 값으로 채워 둬 미리보기가 처음부터 의미 있게 보이게 한다.
const evidence = reactive({
  title: '트랜잭션 실행 시간',
  rows: [
    { label: '외부 결제 API 응답 대기', value: '4,820 ms' },
    { label: 'DB 갱신 쿼리', value: '18 ms' },
    { label: '커넥션 점유 시간', value: '4,851 ms' },
  ],
  note: '@Transactional 메서드 안의 외부 호출이 긴 점유 시간의 대부분을 차지했습니다.',
})

const filledRows = computed(() => evidence.rows.filter(r => r.label || r.value))

function addRow() {
  evidence.rows.push({ label: '', value: '' })
}

function removeRow(i: number) {
  evidence.rows.splice(i, 1)
}

function submit() {
  demo.toast('데모 미리보기 — 저장되지 않아요. 입력한 Evidence가 이 기록에 함께 첨부됩니다.')
}
</script>

<template>
  <div class="cd-stepform">
    <button v-if="!open" type="button" class="cd-addstep" @click="open = true">
      <DemoIcon name="plus" />해결 과정 추가 <span>— 무엇을 해봤고, 무엇을 확인했는지 근거까지 남겨요</span>
    </button>

    <template v-else>
      <div class="sf-head">
        <span class="sf-title">해결 과정 추가</span>
        <span class="sf-demo">데모 — 저장되지 않아요</span>
        <button type="button" class="sf-collapse" @click="open = false">접기</button>
      </div>

      <form class="sf-inline" @submit.prevent="submit">
        <input v-model="title" class="raw-input w-full text-sm" placeholder="What did you try?" />
        <div class="sf-controls">
          <select v-model="status" class="raw-input text-xs sf-sel">
            <option value="FAILED">Failed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <select v-model="attemptType" class="raw-input text-xs sf-sel">
            <option value="">Type (optional)</option>
            <option value="CONFIG">Config</option>
            <option value="INVESTIGATION">Investigation</option>
            <option value="CODE_CHANGE">Code change</option>
          </select>
          <button type="submit" class="sf-addbtn">Add Step</button>
        </div>
        <textarea
          v-model="body"
          class="raw-textarea w-full text-sm"
          rows="4"
          placeholder="Details — what happened, what you observed (markdown supported)"
          style="resize:vertical"
        />
        <textarea
          v-model="insight"
          class="raw-textarea w-full text-sm"
          rows="2"
          maxlength="500"
          placeholder="Insight — key takeaway or summary (optional, max 500 chars)"
          style="resize:vertical"
        />

        <div class="sf-evidence">
          <div class="sf-ev-label">Evidence <span>(optional)</span></div>
          <p class="sf-ev-hint">측정값·지표로 근거를 남겨요</p>

          <div class="ev-editor">
            <input v-model="evidence.title" class="ev-in ev-title-in" placeholder="근거 제목 (예: 트랜잭션 실행 시간)" />
            <div class="ev-rows">
              <div v-for="(row, i) in evidence.rows" :key="i" class="ev-row">
                <input v-model="row.label" class="ev-in" placeholder="항목 (예: 외부 결제 API 응답 대기)" />
                <input v-model="row.value" class="ev-in ev-in-val" placeholder="값 (예: 4,820 ms)" />
                <button type="button" class="ev-del" aria-label="행 삭제" @click="removeRow(i)">&times;</button>
              </div>
            </div>
            <button type="button" class="ev-add" @click="addRow">+ 측정값 추가</button>
            <textarea v-model="evidence.note" class="ev-note-in" rows="2" placeholder="보충 설명 (선택)" />
          </div>

          <div class="ev-pv-label">미리보기 — 발행 시 이렇게 보여요</div>
          <details class="ev-block" open>
            <summary class="ev-sum">
              <span class="ev-sum-l">
                <DemoIcon name="code" class="ev-ic" />조사 근거<template v-if="evidence.title"> · {{ evidence.title }}</template>
              </span>
              <DemoIcon name="down" class="ev-chev" />
            </summary>
            <div class="ev-body">
              <template v-if="filledRows.length">
                <div v-for="(row, i) in filledRows" :key="i" class="ev-line">
                  <span>{{ row.label || '—' }}</span><strong class="ev-val">{{ row.value || '—' }}</strong>
                </div>
              </template>
              <p v-else class="ev-empty-line">측정값을 추가하면 여기에 표로 나타납니다.</p>
              <p v-if="evidence.note" class="ev-note">{{ evidence.note }}</p>
            </div>
          </details>
        </div>
      </form>
    </template>
  </div>
</template>

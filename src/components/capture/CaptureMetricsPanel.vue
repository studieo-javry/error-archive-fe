<script setup lang="ts">
// 기록 현황 — 자동기록이 검토를 거쳐 Case 로 남는 퍼널. GET /captures/metrics(windowDays).
import { ref, watch } from 'vue'
import { captureApi } from '@/services/captureApi'
import type { CaptureMetrics } from '@/types/capture'

const windowDays = ref(30)
const metrics = ref<CaptureMetrics | null>(null)
const loading = ref(false)
const loadError = ref(false)

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const { data } = await captureApi.metrics(windowDays.value)
    metrics.value = data
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
watch(windowDays, load, { immediate: true })

function pct(rate: number | null | undefined): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}
</script>

<template>
  <div>
    <div class="cap-tools">
      <span class="small muted">기간 내 생성된 기록의 현재 상태</span>
      <select v-model.number="windowDays" class="window-select" aria-label="집계 기간">
        <option :value="7">최근 7일</option>
        <option :value="30">최근 30일</option>
        <option :value="90">최근 90일</option>
      </select>
    </div>

    <div v-if="loading && !metrics" class="card">
      <div class="loading" style="width: 50%" />
      <div class="loading" style="width: 80%" />
      <p class="small muted">현황을 불러오고 있어요…</p>
    </div>

    <div v-else-if="loadError" class="notice rose" role="alert">
      현황을 불러오지 못했어요.<br />
      <button type="button" class="btn small" @click="load">다시 불러오기</button>
    </div>

    <template v-else-if="metrics">
      <div class="metric-grid">
        <div class="metric"><small>생성된 기록</small><div class="value">{{ metrics.created }}</div></div>
        <div class="metric"><small>검토 대기</small><div class="value">{{ metrics.readyForReview }}</div></div>
        <div class="metric"><small>Case 반영</small><div class="value">{{ metrics.imported }}</div></div>
        <div class="metric"><small>검토 후 채택률</small><div class="value">{{ pct(metrics.adoptionRate) }}</div></div>
      </div>

      <div class="card">
        <h3>기록 상태</h3>
        <div class="stat-row"><span class="small muted">기록 진행 중</span><strong>{{ metrics.open }}건</strong></div>
        <div class="stat-row"><span class="small muted">검토 대기</span><strong>{{ metrics.readyForReview }}건</strong></div>
        <div class="stat-row"><span class="small muted">반영 완료</span><strong>{{ metrics.imported }}건</strong></div>
        <div class="stat-row"><span class="small muted">폐기됨</span><strong>{{ metrics.discarded }}건</strong></div>
        <div class="stat-row"><span class="small muted">검토 완료</span><strong>{{ metrics.reviewed }}건</strong></div>
      </div>

      <div class="notice neutral" style="margin-top: 22px">
        채택률은 반영 건수 ÷ 검토 완료 건수입니다. AI의 정확도나 자동 기록 성공률을 뜻하지 않아요.<br />
        기간 내 생성된 기록을 기준으로 하므로 검토 대기함의 전체 건수와 다를 수 있습니다.
      </div>
    </template>
  </div>
</template>

<style scoped>
.cap-tools { display: flex; align-items: center; gap: 16px; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; }
</style>

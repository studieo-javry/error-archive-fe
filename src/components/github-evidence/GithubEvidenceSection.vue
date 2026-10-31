<script setup lang="ts">
// 목업 evidenceSection() + evidenceTree(items) — Context 아래 "01 · Case 근거 목록"(관계별).
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GhEvIcon from './GhEvIcon.vue'
import GhNotice from './GhNotice.vue'
import GhEvidenceRow from './GhEvidenceRow.vue'
import GhNestedPr from './GhNestedPr.vue'
import GhStandalonePr from './GhStandalonePr.vue'
import { useCaseGithub, type GhViewItem } from '@/composables/useCaseGithub'

const g = useCaseGithub()
const router = useRouter()
const items = computed(() => g.items.value)
const scenario = computed(() => g.scenario.value)

// Group only where the read DTO actually provides via Issue linkage. Masked items have no reference.
const tree = computed(() => {
  const issues = items.value.filter(x => x.kind === 'ISSUE')
  const prs = items.value.filter(x => x.kind === 'PULL_REQUEST')
  const seen = new Set<number>()
  const groups = issues.map(issue => {
    // repo + issue number prevents an unrelated repository with the same issue number being grouped.
    const linked: GhViewItem[] = issue.masked ? [] : prs.filter(pr => !pr.masked && pr.via === issue.number && (pr.viaRepo || pr.repo) === issue.repo)
    linked.forEach(pr => seen.add(pr.id))
    const key = `${issue.repo || 'masked'}#${issue.number || 'private'}`
    const expanded = g.ui.groupExpanded.has(key)
    return { issue, linked, key, expanded, visible: expanded ? linked : linked.slice(0, 2) }
  })
  return { groups, standalone: prs.filter(x => !seen.has(x.id)) }
})

function toggleGroup(k: string) {
  if (g.ui.groupExpanded.has(k)) g.ui.groupExpanded.delete(k)
  else g.ui.groupExpanded.add(k)
}
const goIntegrations = () => router.push({ name: 'settingsIntegrations' })
const maskedShown = computed(() => items.value.filter(x => x.masked).length)
</script>

<template>
  <div class="gh-ev">
    <section id="github-evidence" class="evidence-section" :class="{ 'is-collapsed': g.ui.collapsed }">
      <div class="evidence-heading">
        <h3 class="section-title"><GhEvIcon name="github" size="sm" />GitHub Evidence <span class="count">{{ scenario === 'failure' ? '—' : items.length }}</span></h3>
        <div class="evidence-header-actions"><button v-if="g.writes.value && scenario === 'normal'" class="text-action accent" @click="g.startAdd()"><GhEvIcon name="plus" size="xs" />근거 연결</button><button type="button" class="text-action evidence-collapse-button" :aria-expanded="!g.ui.collapsed" aria-controls="github-evidence-details" @click="g.ui.collapsed = !g.ui.collapsed">{{ g.ui.collapsed ? '펼치기' : '접기' }} <GhEvIcon name="chevron" size="xs" /></button></div>
      </div>
      <div id="github-evidence-details" :hidden="g.ui.collapsed">
      <div class="evidence-intro"></div>

      <GhNotice v-if="g.syncStopped.value" cls="warn" icon="alert">GitHub 연결이 중단됐어요. 저장해 둔 근거는 계속 볼 수 있지만, 연결 상태를 확인해야 합니다.</GhNotice>
      <GhNotice v-if="g.anyStale.value" cls="warn" icon="clock">새 커밋의 CI 결과를 기다리고 있어요. 이전 결과를 현재 커밋의 통과로 표시하지 않습니다.</GhNotice>
      <GhNotice v-if="!g.canSeePrivate.value && !g.exMember.value && maskedShown" icon="lock">비공개 저장소의 근거 {{ maskedShown }}건은 종류·상태만 표시됩니다.</GhNotice>
      <GhNotice v-if="g.exMember.value" cls="warn" icon="lock">현재 워크스페이스 멤버가 아니므로 비공개 근거의 상세와 근거 편집 기능이 제한됩니다.</GhNotice>
      <GhNotice v-if="g.readOnly.value" icon="eye">읽기 전용 멤버입니다. 비공개 근거를 포함해 열람할 수 있으며, 연결을 변경할 수는 없어요.</GhNotice>

      <div v-if="scenario === 'failure'" class="empty-evidence"><GhEvIcon name="alert" size="" /><h4>GitHub 근거를 불러오지 못했어요</h4><p>Case의 다른 기록은 계속 확인할 수 있어요.</p><button class="btn outline" @click="g.retry()">다시 시도</button></div>
      <div v-else-if="scenario === 'noapp'" class="empty-evidence"><GhEvIcon name="github" size="" /><h4>먼저 GitHub을 연결해 주세요</h4><p>이 Case가 속한 공간에 GitHub 저장소를 연결하면<br>Issue와 PR을 근거로 남길 수 있어요.</p><button class="btn outline" @click="goIntegrations">Settings → Integrations</button></div>
      <div v-else-if="!items.length" class="empty-evidence"><GhEvIcon name="link" size="" /><h4>아직 연결된 근거가 없어요</h4><p>문제를 추적한 Issue나 수정 PR의 주소를 붙여 보세요.</p><button v-if="g.writes.value" class="btn primary" @click="g.startAdd()">GitHub 근거 연결</button></div>
      <div v-else class="evidence-tree child-pr-no-icon">
        <div v-for="grp in tree.groups" :key="grp.key + grp.issue.id" class="evidence-tree-group">
          <GhEvidenceRow :item="grp.issue" />
          <div v-if="grp.linked.length" class="evidence-tree-branch">
            <div class="branch-heading ux-refine ux-a"><span class="branch-main"><span class="branch-gh-label"><GhEvIcon name="github" size="xs" /></span><span class="branch-join">자동 연결된 PR {{ grp.linked.length }}건</span></span><details class="link-why"><summary :aria-label="`Issue #${grp.issue.number}와 PR 자동 연결 기준 보기`"><GhEvIcon name="info" size="xs" />연결 기준</summary><div class="link-why-panel"><div class="link-why-title">왜 이 PR{{ grp.linked.length > 1 ? '들이' : '' }} 연결됐나요?</div><p>GitHub의 Issue를 닫는 참조가 있는 PR을 찾아 <strong>Case의 근거로 자동 연결</strong>했어요. GitHub에 PR을 새로 만든 것은 아니에요.</p><p class="why-example">예: Fixes #{{ grp.issue.number }} · Closes #{{ grp.issue.number }}</p><p class="why-muted">이미 닫힌 Issue의 PR은 소급 연결하고, 이후 PR은 웹훅으로 연결할 수 있어요.</p></div></details></div>
            <GhNestedPr v-for="pr in grp.visible" :key="pr.id" :item="pr" />
            <button v-if="grp.linked.length > 2" class="gh-group-more" :aria-expanded="grp.expanded" @click="toggleGroup(grp.key)">{{ grp.expanded ? '접기' : `나머지 PR ${grp.linked.length - 2}개 보기` }} <GhEvIcon name="chevron" size="xs" /></button>
          </div>
        </div>
        <template v-if="tree.standalone.length">
          <div class="evidence-orphan-heading"><span class="orphan-label">별도로 연결된 PR <span class="group-subtitle">{{ tree.standalone.length }}건 · Issue 연결 여부와 무관</span></span></div>
          <div class="evidence-ungrouped">
            <template v-for="x in tree.standalone" :key="x.id">
              <GhEvidenceRow v-if="x.masked" :item="x" />
              <GhStandalonePr v-else :item="x" />
            </template>
          </div>
        </template>
      </div>
      </div>
      <template v-if="g.ui.collapsed">
        <div v-if="scenario === 'failure' || scenario === 'noapp'" class="evidence-folded-summary"><GhEvIcon :name="scenario === 'failure' ? 'alert' : 'github'" size="xs" /><span>{{ scenario === 'failure' ? 'GitHub 근거를 불러오지 못했어요.' : 'GitHub 연결이 필요해요.' }}</span><button v-if="scenario === 'failure'" class="text-action accent" @click="g.retry()"><GhEvIcon name="refresh" size="xs" />다시 시도</button><button v-else class="text-action accent" @click="goIntegrations"><GhEvIcon name="link" size="xs" />GitHub 연결하기</button></div>
        <div v-else-if="!items.length" class="gh-notice"><GhEvIcon name="github" size="sm" /><span>Issue 0 · Pull requests 0 <span style="margin-left:8px;color:var(--soft)">Issue나 PR을 연결하면 이곳에서 확인할 수 있어요.</span></span></div>
        <div v-else class="gh-notice"><GhEvIcon name="github" size="sm" /><span>Issue {{ items.filter(x => x.kind === 'ISSUE').length }} · Pull requests {{ items.filter(x => x.kind === 'PULL_REQUEST').length }} <span style="margin-left:8px;color:var(--soft)">Step에 연결한 근거는 타임라인에서도 볼 수 있어요.</span></span></div>
      </template>
    </section>
  </div>
</template>

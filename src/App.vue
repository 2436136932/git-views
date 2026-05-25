<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGitStore } from './stores/gitStore'
import ChangeList from './components/ChangeList.vue'
import CommitBox from './components/CommitBox.vue'
import DiffViewer from './components/DiffViewer.vue'
import HistoryList from './components/HistoryList.vue'
import RemoteHistoryList from './components/RemoteHistoryList.vue'
import GitBadge from './components/GitBadge.vue'
import GitGuide from './components/GitGuide.vue'
import RepoHome from './components/RepoHome.vue'
import { useRecentStore } from './stores/recentStore.js'

const git = useGitStore()
const recent = useRecentStore()
const activeTab = ref('changes')
const newBranchName = ref('')
const mergeTarget = ref('')
const rebaseTarget = ref('')
const branchSearch = ref('')
const remoteBranchSearch = ref('')
const deleteBranchSearch = ref('')

const mergeOptions = computed(() => git.mergeCandidates)
const mergeActionDisabled = computed(() => git.loading || git.hasBlockingGitOperation)



watch(mergeOptions, (branches) => {
  if (!branches.includes(mergeTarget.value)) mergeTarget.value = ''
  if (!branches.includes(rebaseTarget.value)) rebaseTarget.value = ''
}, { immediate: true })

async function createBranch() {
  const ok = await git.createBranch(newBranchName.value)
  if (ok) newBranchName.value = ''
}

async function mergeBranch() {
  const target = mergeTarget.value
  const ok = await git.mergeBranch(target)
  if (ok || !mergeOptions.value.includes(target)) mergeTarget.value = ''
}

async function rebaseBranch() {
  const target = rebaseTarget.value
  const ok = await git.rebaseBranch(target)
  if (ok || !mergeOptions.value.includes(target)) rebaseTarget.value = ''
}

function showConflict(filePath) {
  git.showConflictFile(filePath)
  activeTab.value = 'changes'
}

const filteredBranchOptions = computed(() => {
  const q = branchSearch.value.toLowerCase().trim()
  if (!q) return git.branchOptions
  return git.branchOptions.filter(b => b.name.toLowerCase().includes(q))
})

const filteredRemoteBranches = computed(() => {
  const q = remoteBranchSearch.value.toLowerCase().trim()
  if (!q) return git.remoteBranches
  return git.remoteBranches.filter(b => b.toLowerCase().includes(q))
})

const filteredDeletableBranches = computed(() => {
  const q = deleteBranchSearch.value.toLowerCase().trim()
  const candidates = git.branches.filter(b => b !== git.currentBranch)
  if (!q) return candidates
  return candidates.filter(b => b.toLowerCase().includes(q))
})

const showRemoteForm = ref(false)
const remoteName = ref('origin')
const remoteUrl = ref('')

async function openRepoFromHome(path) {
  if (path) {
    await git.openRepo(path)
  } else {
    await git.selectRepo()
  }
  if (git.hasRepo) activeTab.value = 'changes'
}

async function connectRemote() {
  const ok = await git.addRemote(remoteName.value, remoteUrl.value)
  if (ok) {
    showRemoteForm.value = false
    remoteUrl.value = ''
    remoteName.value = 'origin'
  }
}

const updatePhase = ref('idle')
const updateVersion = ref('')
const updateProgress = ref(0)
const updateError = ref('')
const updateApi = window.desktopApi?.update
const updateCleanups = []

onMounted(() => {
  if (!updateApi) return

  updateCleanups.push(
    updateApi.onChecking(() => {
      updateError.value = ''
      updateProgress.value = 0
      updatePhase.value = 'checking'
    }),
    updateApi.onAvailable((info) => {
      updateVersion.value = info.version
      updateProgress.value = 0
      updateError.value = ''
      updatePhase.value = 'available'
    }),
    updateApi.onNotAvailable(() => {
      updateError.value = ''
      updateProgress.value = 0
      updatePhase.value = 'idle'
    }),
    updateApi.onProgress((progress) => {
      updatePhase.value = 'downloading'
      updateProgress.value = progress.percent
    }),
    updateApi.onDownloaded(() => {
      updatePhase.value = 'downloaded'
    }),
    updateApi.onError((message) => {
      updateError.value = message
      updatePhase.value = 'error'
    })
  )
})

onBeforeUnmount(() => {
  while (updateCleanups.length > 0) {
    const dispose = updateCleanups.pop()
    dispose?.()
  }
})

function startUpdateDownload() {
  updateApi?.startDownload()
}

function installUpdate() {
  updateApi?.install()
}
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">G</span>
        <div>
          <h1>Git 操作台</h1>
          <p>基础 Git 可视化原型</p>
        </div>
        <button v-if="git.hasRepo" class="close-repo-btn" type="button" @click="git.closeRepo(); activeTab = 'changes'" title="关闭仓库返回首页">⌂</button>
      </div>

      <div class="action-row">
        <button class="primary-action" type="button" :disabled="git.loading" @click="git.selectRepo">打开仓库</button>
        <button class="secondary-action repo-init" type="button" :disabled="git.loading" @click="git.initRepo">{{ git.loading ? '初始化中…' : '新建仓库' }}</button>
      </div>

      <section class="repo-panel" v-if="git.hasRepo">
        <span class="label">当前仓库</span>
        <strong>{{ git.repoPath }}</strong>
      </section>

      <section class="github-panel" v-if="git.hasRepo">
        <div class="panel-title compact">
          <h3>GitHub</h3>
        </div>

        <div class="github-loading" v-if="git.githubLoading">
          <span class="update-spinner"></span>
          <span>加载中…</span>
        </div>

        <template v-else-if="git.githubInfo">
          <div class="github-header">
            <GitBadge :name="git.githubInfo?.fullName || 'github'" />
            <strong>{{ git.githubInfo.fullName }}</strong>
          </div>
          <p class="github-desc" v-if="git.githubInfo.description">{{ git.githubInfo.description }}</p>
          <div class="github-stats">
            <span>Stars {{ git.githubInfo.stars }}</span>
            <span>Forks {{ git.githubInfo.forks }}</span>
            <span v-if="git.githubInfo.language" class="github-lang">{{ git.githubInfo.language }}</span>
          </div>
          <p class="github-issues" v-if="git.githubInfo.openIssues > 0">{{ git.githubInfo.openIssues }} 个未关闭 Issue</p>
        </template>

        <div class="github-empty" v-else>
          <p class="muted">{{ git.githubError || '未连接到 GitHub 远程仓库' }}</p>
          <button class="secondary-action" type="button" :disabled="git.loading" @click="showRemoteForm = !showRemoteForm">
            {{ showRemoteForm ? '取消' : '配置远程仓库' }}
          </button>
          <div class="remote-form" v-if="showRemoteForm">
            <input v-model="remoteName" type="text" placeholder="Remote 名称" :disabled="git.loading" />
            <input v-model="remoteUrl" type="text" placeholder="例如 https://github.com/owner/repo.git" :disabled="git.loading" />
            <button type="button" :disabled="git.loading || !remoteName.trim() || !remoteUrl.trim()" @click="connectRemote">
              确认连接
            </button>
          </div>
        </div>
      </section>

      <section class="status-panel" v-if="git.status">
        <div>
          <span class="label">当前分支</span>
          <strong>{{ git.status.current || '未命名分支' }}</strong>
        </div>
        <div class="sync-grid">
          <span>领先 {{ git.status.ahead }}</span>
          <span>落后 {{ git.status.behind }}</span>
        </div>
        <span class="tracking" v-if="git.status.tracking">跟踪 {{ git.status.tracking }}</span>
      </section>

      <section class="progress-panel" v-if="git.hasRepo && git.hasGitStateIssue">
        <div class="panel-title compact">
          <h3>Git 进行中状态</h3>
          <span>{{ git.gitStateSummary }}</span>
        </div>

        <div class="progress-tags">
          <span v-if="git.gitState?.mergeInProgress">当前操作：merge</span>
          <span v-if="git.gitState?.rebaseInProgress">当前操作：rebase</span>
          <span v-if="git.gitState?.cherryPickInProgress">当前操作：cherry-pick</span>
          <span v-if="git.gitState?.conflicts?.length > 0">冲突数量：{{ git.gitState.conflicts.length }}</span>
        </div>

        <p class="progress-summary" v-if="git.gitStateDetail">{{ git.gitStateDetail }}</p>
        <p class="progress-next">下一步：{{ git.gitStateNextStep }}</p>
        <div v-if="git.gitState?.conflicts?.length > 0">
          <p class="muted">冲突文件（点击查看差异）：</p>
          <ul class="conflict-list">
            <li v-for="file in git.gitState.conflicts" :key="file" class="clickable" @click="showConflict(file)">{{ file }}</li>
          </ul>
        </div>
        <p class="muted">进行中的 Git 操作会限制部分按钮，先处理完成再继续其他分支操作。</p>

        <div class="progress-actions">
          <button type="button" :disabled="git.loading || !git.gitState?.rebaseInProgress" @click="git.continueRebase">继续 rebase</button>
          <button type="button" :disabled="git.loading || !git.gitState?.rebaseInProgress" @click="git.abortRebase">中止 rebase</button>
          <button type="button" :disabled="git.loading || !git.gitState?.mergeInProgress" @click="git.abortMerge">中止 merge</button>
          <button type="button" :disabled="git.loading || !git.gitState?.cherryPickInProgress" @click="git.continueCherryPick">继续 cherry-pick</button>
          <button type="button" :disabled="git.loading || !git.gitState?.cherryPickInProgress" @click="git.abortCherryPick">中止 cherry-pick</button>
        </div>
      </section>

      <section class="branch-panel" v-if="git.hasRepo">
        <div class="panel-title compact">
          <h3>分支</h3>
          <span>{{ git.branches.length }} 个</span>
        </div>

        <input v-model="branchSearch" type="text" class="search-input" placeholder="搜索分支..." />
        <select class="branch-select" :value="git.currentBranch" :disabled="git.loading" @change="git.checkoutBranch($event.target.value)">
          <option v-for="branch in filteredBranchOptions" :key="branch.name" :value="branch.name" :disabled="branch.occupied">
            {{ branch.occupied ? `${branch.name}（已被 worktree 占用）` : branch.name }}
          </option>
        </select>

        <div class="occupied-list" v-if="git.occupiedBranchOptions.length > 0">
          <p class="muted">被其他 worktree 占用的分支：</p>
          <article class="occupied-item" v-for="branch in git.occupiedBranchOptions" :key="branch.name">
            <strong>{{ branch.name }}</strong>
            <small>{{ branch.path }}</small>
            <div class="occupied-actions">
              <button type="button" :disabled="git.loading" @click="git.switchToWorktree(branch.path)">切换到该 worktree</button>
              <button type="button" :disabled="git.loading" @click="git.openExternalPath(branch.path)">打开目录</button>
            </div>
          </article>
        </div>

        <div class="branch-create">
          <input v-model="newBranchName" type="text" placeholder="输入新分支名" :disabled="git.loading" />
          <button type="button" :disabled="git.loading || !newBranchName.trim()" @click="createBranch">创建并切换</button>
        </div>

        <div class="remote-panel" v-if="git.hasRemote">
          <div class="panel-title compact with-help">
            <h3>远程分支</h3>
            <div class="title-actions">
              <button type="button" class="help-chip" @click="activeTab = 'guide'">?</button>
              <span>{{ git.remoteBranches.length }} 个</span>
            </div>
          </div>

          <input v-model="remoteBranchSearch" type="text" class="search-input" placeholder="搜索远程分支..." />
          <article class="remote-branch-row" v-for="branch in filteredRemoteBranches" :key="branch">
            <span>{{ branch }}</span>
            <button type="button" class="danger-action" :disabled="git.loading" @click="git.deleteRemoteBranch(branch)">删除远程分支</button>
          </article>
        </div>

        <div class="branch-ops" v-if="git.mergeCandidates.length > 0">
          <div class="panel-title compact with-help">
            <h3>合并 / 变基</h3>
            <button type="button" class="help-chip" @click="activeTab = 'guide'">?</button>
          </div>

          <p class="muted" v-if="git.hasBlockingGitOperation">当前仓库存在进行中的 Git 操作，合并和变基已暂时禁用。</p>

          <div class="branch-op-row">
            <select v-model="mergeTarget" :disabled="mergeActionDisabled">
              <option value="">选择合并目标</option>
              <option v-for="branch in mergeOptions" :key="`merge-${branch}`" :value="branch">{{ branch }}</option>
            </select>
            <button type="button" :disabled="mergeActionDisabled || !mergeTarget" @click="mergeBranch">合并到当前分支</button>
          </div>

          <div class="branch-op-row">
            <select v-model="rebaseTarget" :disabled="mergeActionDisabled">
              <option value="">选择变基目标</option>
              <option v-for="branch in mergeOptions" :key="`rebase-${branch}`" :value="branch">{{ branch }}</option>
            </select>
            <button type="button" :disabled="mergeActionDisabled || !rebaseTarget" @click="rebaseBranch">当前分支变基到它</button>
          </div>
        </div>

        <div class="branch-delete" v-if="git.branches.filter((branch) => branch !== git.currentBranch).length > 0">
          <p class="muted">删除分支：</p>
          <input v-model="deleteBranchSearch" type="text" class="search-input" placeholder="搜索要删除的分支..." />
          <div class="delete-row" v-for="branch in filteredDeletableBranches" :key="branch">
            <span>{{ branch }}</span>
            <button type="button" class="danger-action" :disabled="git.loading" @click="git.deleteBranch(branch)">删除</button>
          </div>
        </div>
      </section>

      <section class="actions" v-if="git.hasRepo">
        <span class="sync-target" v-if="git.hasRemote && git.currentBranch">
          推送目标：{{ git.currentRemote }} / {{ git.currentBranch }}
        </span>
        <button type="button" :disabled="git.loading" @click="git.refreshAll">刷新</button>
        <button type="button" :disabled="!git.canSync" @click="git.pull">拉取</button>
        <button type="button" :disabled="!git.canSync" @click="git.push">推送</button>
      </section>

      <section class="command-log">
        <h2>操作日志</h2>
        <p v-if="git.commandLog.length === 0">还没有执行操作。</p>
        <ul>
          <li v-for="entry in git.commandLog" :key="entry.id" :class="{ failed: !entry.ok }">
            <span>{{ entry.time }}</span>
            <div class="log-content">
              <strong>{{ entry.command }}</strong>
              <small>{{ entry.detail }}</small>
            </div>
          </li>
        </ul>
      </section>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div>
          <span class="eyebrow">Workspace</span>
          <h2>{{ git.hasRepo ? '仓库工作区' : activeTab === 'guide' ? 'Git 知识库' : '请选择一个 Git 仓库' }}</h2>
        </div>
        <div class="tabs">
          <button v-if="git.hasRepo" :class="{ active: activeTab === 'changes' }" type="button" @click="activeTab = 'changes'">变更</button>
          <button v-if="git.hasRepo" :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">提交历史</button>
          <button v-if="git.hasRepo" :class="{ active: activeTab === 'remote' }" type="button" @click="activeTab = 'remote'; git.loadRemoteLog(git.selectedRemoteBranch || git.remoteBranches[0])">远程记录</button>
          <button :class="{ active: activeTab === 'guide' }" type="button" @click="activeTab = 'guide'">Git 知识库</button>
        </div>
      </header>

      <p class="error" v-if="git.error">{{ git.error }}</p>
      <p class="success" v-if="git.successMessage">{{ git.successMessage }}</p>

      <GitGuide v-if="activeTab === 'guide'" />

      <RepoHome v-else-if="!git.hasRepo" @open="openRepoFromHome" @init="git.initRepo" @guide="activeTab = 'guide'" />

      <div class="content-grid" v-else-if="activeTab === 'changes'">
        <section class="left-pane">
          <ChangeList />
          <CommitBox />
        </section>
        <DiffViewer />
      </div>
      <RemoteHistoryList v-else-if="activeTab === 'remote'" />
      <HistoryList v-else />
    </section>

    <div class="update-banner" v-if="updatePhase !== 'idle'">
      <template v-if="updatePhase === 'checking'">
        <span class="update-spinner"></span>
        <span>正在检查更新…</span>
      </template>

      <template v-else-if="updatePhase === 'available'">
        <span>发现新版本 <strong>v{{ updateVersion }}</strong></span>
        <button class="update-btn" type="button" @click="startUpdateDownload">下载更新</button>
      </template>

      <template v-else-if="updatePhase === 'downloading'">
        <span>正在下载更新…</span>
        <div class="update-progress-bar">
          <div class="update-progress-fill" :style="{ width: updateProgress + '%' }"></div>
        </div>
        <span class="update-pct">{{ updateProgress }}%</span>
      </template>

      <template v-else-if="updatePhase === 'downloaded'">
        <span>更新已下载</span>
        <button class="update-btn install" type="button" @click="installUpdate">立即安装</button>
      </template>

      <template v-else-if="updatePhase === 'error'">
        <span class="update-error">检查更新失败：{{ updateError }}</span>
      </template>
    </div>
  </main>
</template>

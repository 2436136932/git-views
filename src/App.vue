<script setup>
import { computed, ref, watch } from 'vue'
import { useGitStore } from './stores/gitStore'
import ChangeList from './components/ChangeList.vue'
import CommitBox from './components/CommitBox.vue'
import DiffViewer from './components/DiffViewer.vue'
import HistoryList from './components/HistoryList.vue'

const git = useGitStore()
const activeTab = ref('changes')
const newBranchName = ref('')
const mergeTarget = ref('')
const rebaseTarget = ref('')

const mergeOptions = computed(() => git.mergeCandidates)

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
      </div>

      <button class="primary-action" type="button" :disabled="git.loading" @click="git.selectRepo">打开仓库</button>

      <section class="repo-panel" v-if="git.hasRepo">
        <span class="label">当前仓库</span>
        <strong>{{ git.repoPath }}</strong>
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

      <section class="branch-panel" v-if="git.hasRepo">
        <div class="panel-title compact">
          <h3>分支</h3>
          <span>{{ git.branches.length }} 个</span>
        </div>

        <select class="branch-select" :value="git.currentBranch" :disabled="git.loading" @change="git.checkoutBranch($event.target.value)">
          <option v-for="branch in git.branchOptions" :key="branch.name" :value="branch.name" :disabled="branch.occupied">
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
          <div class="panel-title compact">
            <h3>远程分支</h3>
            <span>{{ git.remoteBranches.length }} 个</span>
          </div>

          <button type="button" class="secondary-action" :disabled="git.loading" @click="git.pushCurrentBranch()">推送当前分支到远程</button>

          <article class="remote-branch-row" v-for="branch in git.remoteBranches" :key="branch">
            <span>{{ branch }}</span>
            <button type="button" class="danger-action" :disabled="git.loading" @click="git.deleteRemoteBranch(branch)">删除远程分支</button>
          </article>
        </div>

        <div class="branch-ops" v-if="git.mergeCandidates.length > 0">
          <div class="panel-title compact">
            <h3>合并 / 变基</h3>
          </div>

          <div class="branch-op-row">
            <select v-model="mergeTarget" :disabled="git.loading">
              <option value="">选择合并目标</option>
              <option v-for="branch in mergeOptions" :key="`merge-${branch}`" :value="branch">{{ branch }}</option>
            </select>
            <button type="button" :disabled="git.loading || !mergeTarget" @click="mergeBranch">合并到当前分支</button>
          </div>

          <div class="branch-op-row">
            <select v-model="rebaseTarget" :disabled="git.loading">
              <option value="">选择变基目标</option>
              <option v-for="branch in mergeOptions" :key="`rebase-${branch}`" :value="branch">{{ branch }}</option>
            </select>
            <button type="button" :disabled="git.loading || !rebaseTarget" @click="rebaseBranch">当前分支变基到它</button>
          </div>
        </div>

        <div class="branch-delete" v-if="git.branches.filter((branch) => branch !== git.currentBranch).length > 0">
          <p class="muted">删除分支：</p>
          <div class="delete-row" v-for="branch in git.branches.filter((name) => name !== git.currentBranch)" :key="branch">
            <span>{{ branch }}</span>
            <button type="button" class="danger-action" :disabled="git.loading" @click="git.deleteBranch(branch)">删除</button>
          </div>
        </div>
      </section>

      <section class="actions" v-if="git.hasRepo">
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
          <h2>{{ git.hasRepo ? '仓库工作区' : '请选择一个 Git 仓库' }}</h2>
        </div>
        <div class="tabs" v-if="git.hasRepo">
          <button :class="{ active: activeTab === 'changes' }" type="button" @click="activeTab = 'changes'">变更</button>
          <button :class="{ active: activeTab === 'history' }" type="button" @click="activeTab = 'history'">提交历史</button>
        </div>
      </header>

      <p class="error" v-if="git.error">{{ git.error }}</p>

      <div class="empty-state" v-if="!git.hasRepo">
        <h3>先打开一个本地 Git 仓库</h3>
        <p>原型会读取仓库状态、分支信息、文件变更、diff、提交历史，并支持暂存、取消暂存、提交、拉取、推送和版本回退。</p>
      </div>

      <div class="content-grid" v-else-if="activeTab === 'changes'">
        <section class="left-pane">
          <ChangeList />
          <CommitBox />
        </section>
        <DiffViewer />
      </div>
      <HistoryList v-else />
    </section>
  </main>
</template>

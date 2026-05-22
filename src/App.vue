<script setup>
import { ref } from 'vue'
import { useGitStore } from './stores/gitStore'
import ChangeList from './components/ChangeList.vue'
import CommitBox from './components/CommitBox.vue'
import DiffViewer from './components/DiffViewer.vue'
import HistoryList from './components/HistoryList.vue'

const git = useGitStore()
const activeTab = ref('changes')
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

      <button class="primary-action" type="button" @click="git.selectRepo">打开仓库</button>

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

      <section class="actions" v-if="git.hasRepo">
        <button type="button" @click="git.refreshAll">刷新</button>
        <button type="button" @click="git.pull">拉取</button>
        <button type="button" @click="git.push">推送</button>
      </section>

      <section class="command-log">
        <h2>操作日志</h2>
        <p v-if="git.commandLog.length === 0">还没有执行操作。</p>
        <ul>
          <li v-for="entry in git.commandLog" :key="entry.id" :class="{ failed: !entry.ok }">
            <span>{{ entry.time }}</span>
            <strong>{{ entry.command }}</strong>
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
        <p>原型会读取仓库状态、文件变更、diff、提交历史，并支持暂存、取消暂存、提交、拉取和推送。</p>
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

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()

const detailLines = computed(() => {
  if (!git.commitDetail?.diff) return []
  return git.commitDetail.diff.split('\n').map((line, index) => ({
    id: `${index}-${line}`,
    text: line || ' ',
    type: line.startsWith('+') && !line.startsWith('+++') ? 'added' : line.startsWith('-') && !line.startsWith('---') ? 'removed' : 'normal'
  }))
})

async function changeRemoteBranch(branch) {
  await git.loadRemoteLog(branch)
}

onMounted(() => {
  if (!git.selectedRemoteBranch && git.remoteBranches.length > 0) {
    git.loadRemoteLog(git.remoteBranches[0])
  }
})

watch(
  () => git.remoteBranches,
  (branches) => {
    if (branches.length > 0 && !git.selectedRemoteBranch) {
      git.loadRemoteLog(branches[0])
    }
  }
)
</script>

<template>
  <section class="history-layout">
    <section class="history-panel">
      <div class="panel-title">
        <h3>远程记录</h3>
        <span>{{ git.remoteLog.length }} 条</span>
      </div>

      <select class="branch-select remote-log-select" :value="git.selectedRemoteBranch" :disabled="git.loading || git.remoteBranches.length === 0" @change="changeRemoteBranch($event.target.value)">
        <option value="" disabled>选择远程分支</option>
        <option v-for="branch in git.remoteBranches" :key="branch" :value="branch">{{ branch }}</option>
      </select>

      <p class="muted" v-if="git.remoteBranches.length === 0">当前仓库没有可查看的远程分支。</p>
      <p class="muted" v-else-if="git.remoteLog.length === 0">该远程分支暂无提交记录，或尚未加载。</p>

      <article
        class="commit-row"
        v-for="commit in git.remoteLog"
        :key="commit.hash"
        :class="{ selected: git.selectedRemoteCommit?.hash === commit.hash }"
        @click="git.selectRemoteCommit(commit)"
      >
        <span class="hash">{{ commit.hash.slice(0, 7) }}</span>
        <div>
          <strong>{{ commit.message }}</strong>
          <p>{{ commit.author_name }} · {{ commit.date }}</p>
        </div>
      </article>
    </section>

    <section class="history-detail-panel">
      <div class="panel-title">
        <h3>提交详情</h3>
      </div>

      <div class="history-empty" v-if="!git.selectedRemoteCommit">
        选择左侧远程提交查看详情。
      </div>

      <template v-else>
        <div class="history-meta">
          <strong>{{ git.selectedRemoteCommit.message }}</strong>
          <p>提交哈希：{{ git.selectedRemoteCommit.hash }}</p>
          <p>作者：{{ git.selectedRemoteCommit.author_name }}</p>
          <p>日期：{{ git.selectedRemoteCommit.date }}</p>
        </div>

        <pre class="history-summary" v-if="git.commitDetail?.summary"><code>{{ git.commitDetail.summary }}</code></pre>

        <pre class="diff-code history-diff" v-if="git.commitDetail?.diff"><code><span
          v-for="line in detailLines"
          :key="line.id"
          :class="line.type"
        >{{ line.text }}
</span></code></pre>
      </template>
    </section>
  </section>
</template>

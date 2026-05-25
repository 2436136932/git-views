<script setup>
import { computed, ref } from 'vue'
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()
const commitSearch = ref("")

const filteredLog = computed(() => {
  const q = commitSearch.value.toLowerCase().trim()
  if (!q) return git.log
  return git.log.filter(c =>
    c.message.toLowerCase().includes(q) ||
    (c.author_name || "").toLowerCase().includes(q) ||
    c.hash.toLowerCase().includes(q)
  )
})

const detailLines = computed(() => {
  if (!git.commitDetail?.diff) return []
  return git.commitDetail.diff.split('\n').map((line, index) => ({
    id: `${index}-${line}`,
    text: line || ' ',
    type: line.startsWith('+') && !line.startsWith('+++') ? 'added' : line.startsWith('-') && !line.startsWith('---') ? 'removed' : 'normal'
  }))
})
</script>

<template>
  <section class="history-layout">
    <section class="history-panel">
      <div class="panel-title">
        <h3>提交历史</h3>
        <span>最近 {{ filteredLog.length }} 条{{ commitSearch ? " / " + git.log.length + " 总计" : "" }}</span>
      </div>

      <input v-model="commitSearch" type="text" class="search-input" placeholder="搜索提交信息、作者、哈希..." style="margin-bottom: 10px;" />
      <div class="history-empty" v-if="git.log.length === 0">
        当前仓库还没有提交记录。先暂存文件并创建第一次提交。
      </div>
      <div class="history-empty" v-else-if="filteredLog.length === 0">
        没有匹配的提交记录。
      </div>

      <article
        v-for="commit in filteredLog"
        v-else
        class="commit-row"
        :key="commit.hash"
        :class="{ selected: git.selectedCommit?.hash === commit.hash }"
        @click="git.selectCommit(commit)"
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
        <button
          v-if="git.selectedCommit"
          type="button"
          class="danger-action"
          :disabled="git.loading"
          @click="git.revertCommit(git.selectedCommit)"
        >
          回退到此版本
        </button>
      </div>

      <button
        v-if="git.selectedCommit"
        type="button"
        class="danger-action hard-reset"
        :disabled="git.loading"
        @click="git.hardResetToCommit(git.selectedCommit)"
      >
        硬回退到此版本
      </button>

      <div class="history-empty" v-if="!git.selectedCommit">
        选择左侧提交查看详情。
      </div>

      <template v-else>
        <div class="history-meta">
          <strong>{{ git.selectedCommit.message }}</strong>
          <p>提交哈希：{{ git.selectedCommit.hash }}</p>
          <p>作者：{{ git.selectedCommit.author_name }}</p>
          <p>日期：{{ git.selectedCommit.date }}</p>
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

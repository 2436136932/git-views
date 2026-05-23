<script setup>
import { computed } from 'vue'
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
</script>

<template>
  <section class="history-layout">
    <section class="history-panel">
      <div class="panel-title">
        <h3>提交历史</h3>
        <span>最近 {{ git.log.length }} 条</span>
      </div>

      <article
        class="commit-row"
        v-for="commit in git.log"
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

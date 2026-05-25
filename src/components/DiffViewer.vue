<script setup>
import { computed } from 'vue'
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()

const diffLines = computed(() => {
  if (!git.diff) return []
  return git.diff.split('\n').map((line, index) => ({
    id: `${index}-${line}`,
    text: line || ' ',
    type: line.startsWith('+') && !line.startsWith('+++') ? 'added' : line.startsWith('-') && !line.startsWith('---') ? 'removed' : 'normal'
  }))
})
</script>

<template>
  <section class="diff-panel">
    <div class="panel-title">
      <h3>Diff</h3>
      <span v-if="git.selectedFile">{{ git.selectedDiffStaged ? '已暂存' : '未暂存' }}</span>
    </div>

    <div class="diff-empty" v-if="!git.selectedFile">
      选择左侧文件查看 diff。
    </div>

    <div class="diff-header" v-else>
      <strong>{{ git.selectedFile.path }}</strong>
    </div>

    <pre class="diff-code" v-if="git.selectedFile"><code><span
      v-for="line in diffLines"
      :key="line.id"
      :class="line.type"
    >{{ line.text }}
</span></code></pre>
  </section>
</template>

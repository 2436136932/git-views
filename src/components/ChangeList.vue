<script setup>
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()

function statusText(file) {
  const index = file.index.trim() || '-'
  const working = file.workingDir.trim() || '-'
  return `${index}/${working}`
}
</script>

<template>
  <section class="changes-panel">
    <div class="panel-title">
      <h3>文件变更</h3>
      <span>{{ git.status?.files.length || 0 }} 个文件</span>
    </div>

    <div class="bulk-actions">
      <button type="button" :disabled="git.unstagedFiles.length === 0 || git.loading" @click="git.stageAll">
        全部暂存
      </button>
      <button type="button" :disabled="git.stagedFiles.length === 0 || git.loading" @click="git.unstageAll">
        全部取消暂存
      </button>
    </div>

    <div class="change-group">
      <h4>已暂存</h4>
      <p class="muted" v-if="git.stagedFiles.length === 0">暂时没有已暂存文件。</p>
      <article
        v-for="file in git.stagedFiles"
        :key="`staged-${file.path}`"
        class="file-row"
        :class="{ selected: git.selectedFile?.path === file.path && git.selectedDiffStaged }"
        @click="git.showDiff(file, true)"
      >
        <span class="status-code">{{ statusText(file) }}</span>
        <span class="file-path">{{ file.path }}</span>
        <button type="button" @click.stop="git.unstage(file)">取消暂存</button>
      </article>
    </div>

    <div class="change-group">
      <h4>未暂存</h4>
      <p class="muted" v-if="git.unstagedFiles.length === 0">暂时没有未暂存文件。</p>
      <article
        v-for="file in git.unstagedFiles"
        :key="`unstaged-${file.path}`"
        class="file-row"
        :class="{ selected: git.selectedFile?.path === file.path && !git.selectedDiffStaged }"
        @click="git.showDiff(file, false)"
      >
        <span class="status-code">{{ statusText(file) }}</span>
        <span class="file-path">{{ file.path }}</span>
        <button type="button" @click.stop="git.stage(file)">暂存</button>
      </article>
    </div>
  </section>
</template>

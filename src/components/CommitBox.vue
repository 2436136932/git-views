<script setup>
import { computed, ref } from 'vue'
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()
const message = ref('')

const commitHint = computed(() => {
  if (git.loading) return '正在执行 Git 操作，请稍候。'
  if (!git.hasRemote) return '当前仓库未配置远程仓库，拉取和推送功能会被禁用。'
  if (!git.canCommit) return '先暂存至少一个文件，再执行提交。'
  return '只会提交“已暂存”区域中的文件变更。'
})

async function submit() {
  const ok = await git.commit(message.value)
  if (ok) message.value = ''
}
</script>

<template>
  <section class="commit-box">
    <h3>提交</h3>
    <textarea v-model="message" rows="4" placeholder="输入提交信息，例如：修复远程分支删除逻辑" :disabled="git.loading"></textarea>
    <button type="button" :disabled="!git.canCommit" @click="submit">
      提交已暂存变更
    </button>
    <p class="muted">{{ commitHint }}</p>
  </section>
</template>

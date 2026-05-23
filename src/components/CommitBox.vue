<script setup>
import { ref } from 'vue'
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()
const message = ref('')

async function submit() {
  const ok = await git.commit(message.value)
  if (ok) message.value = ''
}
</script>

<template>
  <section class="commit-box">
    <h3>提交</h3>
    <textarea v-model="message" rows="4" placeholder="输入提交信息" :disabled="git.loading"></textarea>
    <button type="button" :disabled="!git.canCommit" @click="submit">
      提交已暂存变更
    </button>
    <p class="muted" v-if="!git.hasRemote">当前仓库未配置远程，拉取和推送将被禁用。</p>
  </section>
</template>

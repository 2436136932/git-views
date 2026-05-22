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
    <textarea v-model="message" rows="4" placeholder="输入提交信息"></textarea>
    <button type="button" :disabled="git.stagedFiles.length === 0 || git.loading" @click="submit">
      提交已暂存变更
    </button>
  </section>
</template>

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

const templates = [
  { prefix: 'feat:', label: '新功能', desc: '添加新特性' },
  { prefix: 'fix:', label: '修复', desc: '修复 Bug' },
  { prefix: 'refactor:', label: '重构', desc: '代码重构' },
  { prefix: 'docs:', label: '文档', desc: '文档更新' },
  { prefix: 'style:', label: '样式', desc: '格式调整' },
  { prefix: 'test:', label: '测试', desc: '测试相关' },
  { prefix: 'chore:', label: '杂项', desc: '构建/工具' }
]

function insertTemplate(prefix) {
  if (message.value.startsWith(prefix)) {
    message.value = message.value.slice(prefix.length)
  } else {
    message.value = prefix + ' ' + message.value
  }
}

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
    <div class="template-chips">
    <button
      v-for="tpl in templates"
      :key="tpl.prefix"
      type="button"
      class="template-chip"
      :class="{ active: message.startsWith(tpl.prefix) }"
      @click="insertTemplate(tpl.prefix)"
      :title="tpl.desc"
    >{{ tpl.label }}</button>
  </div>
  <p class="muted">{{ commitHint }}</p>
  </section>
</template>

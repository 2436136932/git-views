<script setup>
import { computed } from 'vue'
import { useRecentStore } from '../stores/recentStore'

const recent = useRecentStore()

const emit = defineEmits(['open', 'init', 'guide'])

const hasRecent = computed(() => recent.repos.length > 0)

function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return mins + ' 分钟前'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + ' 小时前'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + ' 天前'
  return new Date(ts).toLocaleDateString()
}
</script>

<template>
  <div class="repo-home">
    <div class="home-hero">
      <h2>Git 操作台</h2>
      <p>选择一个仓库开始工作</p>
      <div class="home-actions">
        <button type="button" class="primary-action" @click="('open')">打开仓库</button>
        <button type="button" class="secondary-action" @click="('init')">新建仓库</button>
        <button type="button" class="ghost-action" @click="('guide')">使用引导</button>
      </div>
    </div>

    <section class="recent-section" v-if="hasRecent">
      <h3>最近打开</h3>
      <div class="recent-grid">
        <article
          v-for="repo in recent.repos"
          :key="repo.path"
          class="recent-card"
          @click="('open', repo.path)"
        >
          <div class="card-head">
            <strong class="card-name">{{ repo.name }}</strong>
            <button class="card-remove" type="button" @click.stop="recent.removeRecent(repo.path)" title="移除记录">x</button>
          </div>
          <p class="card-path">{{ repo.path }}</p>
          <div class="card-meta">
            <span v-if="repo.branch">{{ repo.branch }}</span>
            <span class="card-time">{{ timeAgo(repo.openedAt) }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.repo-home {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 40px 24px;
  max-width: 640px;
  margin: 0 auto;
}

.home-hero {
  text-align: center;
}

.home-hero h2 {
  margin: 0 0 8px;
  font-size: 24px;
}

.home-hero p {
  color: var(--text-muted, #8c8a82);
  margin: 0 0 20px;
}

.home-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.ghost-action {
  background: none;
  border: 1px dashed var(--gray-300, #ccc);
  color: var(--text-muted, #8c8a82);
  padding: 8px 18px;
  border-radius: var(--radius, 10px);
  cursor: pointer;
  font-size: 14px;
}

.ghost-action:hover {
  border-color: var(--accent, #d9775e);
  color: var(--accent, #d9775e);
}

.recent-section h3 {
  margin: 0 0 14px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #8c8a82);
}

.recent-grid {
  display: grid;
  gap: 12px;
}

.recent-card {
  padding: 16px 18px;
  background: var(--card-bg, #fffdf7);
  border-radius: var(--radius, 10px);
  border: 1px solid var(--card-border, #f0e8d8);
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.recent-card:hover {
  border-color: var(--accent, #d9775e);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-name {
  font-size: 16px;
  color: var(--text, #4a4138);
}

.card-remove {
  background: none;
  border: 1px solid var(--card-border, #f0e8d8);
  color: var(--text-muted, #8c8a82);
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-remove:hover {
  border-color: var(--danger, #d86081);
  color: var(--danger, #d86081);
}

.card-path {
  margin: 6px 0 8px;
  font-size: 12px;
  color: var(--text-muted, #8c8a82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--text-muted, #8c8a82);
}

.card-time {
  margin-left: auto;
}
</style>

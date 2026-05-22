<script setup>
import { useGitStore } from '../stores/gitStore'

const git = useGitStore()
</script>

<template>
  <section class="history-panel">
    <div class="panel-title">
      <h3>提交历史</h3>
      <span>最近 {{ git.log.length }} 条</span>
    </div>

    <article class="commit-row" v-for="commit in git.log" :key="commit.hash">
      <span class="hash">{{ commit.hash.slice(0, 7) }}</span>
      <div>
        <strong>{{ commit.message }}</strong>
        <p>{{ commit.author_name }} · {{ commit.date }}</p>
      </div>
    </article>
  </section>
</template>

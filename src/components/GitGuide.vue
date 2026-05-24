<script setup>
const sections = [
  {
    title: '基础操作',
    items: [
      ['打开仓库', '选择一个本地 Git 仓库作为当前工作区，后续所有操作都在这里执行。'],
      ['刷新', '重新读取仓库状态、分支、远程和进行中状态。'],
      ['拉取', '对应 git pull，把远程最新提交拉到本地并尝试合并。'],
      ['推送', '对应 git push，把当前本地分支提交到远程仓库。']
    ]
  },
  {
    title: '文件变更',
    items: [
      ['暂存', '对应 git add，把文件加入下一次提交。'],
      ['全部暂存', '对应 git add .，把当前修改一次性加入暂存区。'],
      ['取消暂存', '对应 git restore --staged <file>，把文件移回工作区。'],
      ['全部取消暂存', '对应 git restore --staged .，撤销所有暂存。'],
      ['提交', '对应 git commit，把暂存内容保存为一个新提交。']
    ]
  },
  {
    title: '分支与远程',
    items: [
      ['切换分支', '对应 git checkout <branch>，切换到目标分支。'],
      ['创建并切换', '对应 git checkout -b <branch>，新建分支并立即切换。'],
      ['删除分支', '对应 git branch -d / -D，删除本地分支。'],
      ['推送当前分支到远程', '对应 git push -u origin HEAD，把当前分支推送到远程并建立跟踪。'],
      ['删除远程分支', '对应 git push origin --delete <branch>，从远程移除分支。']
    ]
  },
  {
    title: '合并与变基',
    items: [
      ['合并到当前分支', '对应 git merge <branch>，把目标分支合并到当前分支。'],
      ['当前分支变基到它', '对应 git rebase <branch>，把当前分支的提交接到目标分支后面。'],
      ['继续 rebase', '对应 git rebase --continue，解决冲突后继续执行。'],
      ['中止 rebase', '对应 git rebase --abort，放弃本次变基并恢复。'],
      ['中止 merge', '对应 git merge --abort，放弃本次合并并恢复。']
    ]
  },
  {
    title: '历史与版本',
    items: [
      ['提交历史', '显示当前仓库的本地提交记录，点击可看详情。'],
      ['远程记录', '显示远程分支上的提交记录。'],
      ['回退到此版本', '对应 git revert <commit>，生成一个反向提交。'],
      ['硬回退到此版本', '对应 git reset --hard <commit>，直接回退指针并丢弃修改。']
    ]
  }
]
</script>

<template>
  <section class="guide-layout">
    <article class="guide-card" v-for="section in sections" :key="section.title">
      <div class="panel-title">
        <h3>{{ section.title }}</h3>
      </div>
      <div class="guide-list">
        <div class="guide-item" v-for="item in section.items" :key="item[0]">
          <strong>{{ item[0] }}</strong>
          <p>{{ item[1] }}</p>
        </div>
      </div>
    </article>
  </section>
</template>

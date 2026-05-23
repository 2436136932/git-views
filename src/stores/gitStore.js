import { defineStore } from 'pinia'

function ensureDesktopApi() {
  if (!window.desktopApi) {
    throw new Error('Desktop API 不可用。请通过 Electron 启动应用。')
  }
  return window.desktopApi
}

function normalizeGitMessage(message) {
  if (!message) return 'Git 操作失败。'
  if (message.includes('is already used by worktree')) {
    return '该分支已被另一个 worktree 占用，当前仓库不能直接切换到它。'
  }
  return message
}

export const useGitStore = defineStore('git', {
  state: () => ({
    repoPath: '',
    status: null,
    branches: [],
    remoteBranches: [],
    currentBranch: '',
    currentRemote: 'origin',
    worktrees: [],
    hasRemote: false,
    log: [],
    selectedFile: null,
    selectedDiffStaged: false,
    diff: '',
    selectedCommit: null,
    commitDetail: null,
    loading: false,
    error: '',
    commandLog: []
  }),

  getters: {
    stagedFiles(state) {
      return state.status?.files.filter((file) => file.staged) || []
    },
    unstagedFiles(state) {
      return state.status?.files.filter((file) => file.unstaged || (!file.staged && !file.unstaged)) || []
    },
    hasRepo(state) {
      return Boolean(state.repoPath)
    },
    canCommit(state) {
      return !state.loading && (state.status?.files.some((file) => file.staged) || false)
    },
    canSync(state) {
      return !state.loading && state.hasRemote
    },
    mergeCandidates(state) {
      return state.branches.filter((branch) => branch !== state.currentBranch)
    },
    occupiedBranchMap(state) {
      const currentPath = state.repoPath.replace(/\\/g, '/').toLowerCase()
      return Object.fromEntries(
        state.worktrees
          .filter((worktree) => worktree.branch && worktree.path.replace(/\\/g, '/').toLowerCase() !== currentPath)
          .map((worktree) => [worktree.branch, worktree.path])
      )
    },
    branchOptions(state) {
      const currentPath = state.repoPath.replace(/\\/g, '/').toLowerCase()
      return state.branches.map((branch) => {
        const occupied = state.worktrees.find((worktree) => worktree.branch === branch && worktree.path.replace(/\\/g, '/').toLowerCase() !== currentPath)
        return {
          name: branch,
          occupied: Boolean(occupied),
          occupiedPath: occupied?.path || ''
        }
      })
    },
    occupiedBranchOptions(state) {
      const currentPath = state.repoPath.replace(/\\/g, '/').toLowerCase()
      return state.worktrees
        .filter((worktree) => worktree.branch && worktree.path.replace(/\\/g, '/').toLowerCase() !== currentPath)
        .map((worktree) => ({
          name: worktree.branch,
          path: worktree.path
        }))
    }
  },

  actions: {
    async selectRepo() {
      this.loading = true
      this.error = ''

      try {
        const api = ensureDesktopApi()
        const path = await api.selectRepo()
        if (!path) return
        await this.openRepo(path)
      } catch (error) {
        this.error = error.message
        this.addCommandLog('打开仓库', error.message, false)
      } finally {
        this.loading = false
      }
    },

    async openRepo(path) {
      const api = ensureDesktopApi()
      const repoCheck = await api.git.isRepo(path)
      if (!repoCheck.ok || !repoCheck.data) {
        this.error = '选择的目录不是 Git 仓库。'
        return false
      }

      this.repoPath = path
      this.selectedFile = null
      this.diff = ''
      this.selectedCommit = null
      this.commitDetail = null
      this.addCommandLog('打开仓库', path, true)
      await this.refreshAll()
      return true
    },

    async openExternalPath(targetPath) {
      const result = await ensureDesktopApi().openPath(targetPath)
      const detail = result?.ok ? targetPath : normalizeGitMessage(result?.message)
      this.addCommandLog('打开目录', detail, Boolean(result?.ok))
      if (!result?.ok) this.error = detail
      return Boolean(result?.ok)
    },

    async switchToWorktree(targetPath) {
      this.loading = true
      this.error = ''
      try {
        return await this.openRepo(targetPath)
      } catch (error) {
        this.error = error.message
        this.addCommandLog('切换到 worktree', error.message, false)
        return false
      } finally {
        this.loading = false
      }
    },

    async refreshAll() {
      await Promise.all([
        this.refreshStatus(),
        this.refreshLog(),
        this.refreshBranches(),
        this.refreshRemoteBranches(),
        this.refreshRemotes(),
        this.refreshWorktrees()
      ])
    },

    async refreshStatus() {
      if (!this.repoPath) return
      await this.callGit('git status', async (api) => {
        const result = await api.git.status(this.repoPath)
        if (result.ok) this.status = result.data
        return result
      })
    },

    async refreshLog() {
      if (!this.repoPath) return
      await this.callGit('git log', async (api) => {
        const result = await api.git.log(this.repoPath)
        if (result.ok) this.log = result.data.all || []
        return result
      })
    },

    async refreshBranches() {
      if (!this.repoPath) return
      await this.callGit('git branch', async (api) => {
        const result = await api.git.branches(this.repoPath)
        if (result.ok) {
          this.branches = result.data.all || []
          this.currentBranch = result.data.current || ''
        }
        return result
      })
    },

    async refreshRemoteBranches() {
      if (!this.repoPath) return
      await this.callGit('git branch -r', async (api) => {
        const result = await api.git.remoteBranches(this.repoPath)
        if (result.ok) this.remoteBranches = result.data || []
        return result
      })
    },

    async refreshRemotes() {
      if (!this.repoPath) return
      await this.callGit('git remote', async (api) => {
        const result = await api.git.remotes(this.repoPath)
        if (result.ok) {
          this.hasRemote = (result.data || []).length > 0
          this.currentRemote = result.data?.[0]?.name || 'origin'
        }
        return result
      })
    },

    async refreshWorktrees() {
      if (!this.repoPath) return
      await this.callGit('git worktree list', async (api) => {
        const result = await api.git.worktrees(this.repoPath)
        if (result.ok) this.worktrees = result.data || []
        return result
      })
    },

    async checkoutBranch(branchName) {
      if (!branchName || branchName === this.currentBranch) return false

      const occupiedPath = this.occupiedBranchMap[branchName]
      if (occupiedPath) {
        this.error = `分支 ${branchName} 已被其他 worktree 占用：${occupiedPath}`
        this.addCommandLog(`git checkout ${branchName}`, this.error, false)
        return false
      }

      const result = await this.callGit(`git checkout ${branchName}`, (api) => api.git.checkoutBranch(this.repoPath, branchName))
      if (result?.ok) {
        this.selectedFile = null
        this.diff = ''
        await this.refreshAll()
      }
      return result?.ok
    },

    async createBranch(branchName) {
      const normalized = branchName.trim()
      if (!normalized) {
        this.error = '分支名不能为空。'
        return false
      }

      const result = await this.callGit(`git checkout -b ${normalized}`, (api) => api.git.createBranch(this.repoPath, normalized))
      if (result?.ok) {
        this.selectedFile = null
        this.diff = ''
        await this.refreshAll()
      }
      return result?.ok
    },

    async deleteBranch(branchName) {
      const normalized = branchName.trim()
      if (!normalized) return false

      if (normalized === this.currentBranch) {
        this.error = '不能删除当前检出的分支。'
        return false
      }

      const occupiedPath = this.occupiedBranchMap[normalized]
      if (occupiedPath) {
        this.error = `分支 ${normalized} 正在被 worktree 占用：${occupiedPath}`
        return false
      }

      const confirmed = window.confirm(`确定要删除分支 ${normalized} 吗？`)
      if (!confirmed) {
        this.error = '已取消删除分支。'
        this.addCommandLog(`git branch -d ${normalized}`, this.error, false)
        return false
      }

      const api = ensureDesktopApi()
      let result = await api.git.deleteBranch(this.repoPath, normalized, false)
      let usedForce = false
      if (!result.ok && /not fully merged|is not fully merged/i.test(result.message || '')) {
        const forceConfirm = window.confirm(`分支 ${normalized} 尚未完全合并。确定要强制删除吗？`)
        if (!forceConfirm) {
          this.error = '已取消强制删除分支。'
          this.addCommandLog(`git branch -D ${normalized}`, this.error, false)
          return false
        }
        result = await api.git.deleteBranch(this.repoPath, normalized, true)
        usedForce = true
      }

      const detail = result.ok ? '成功' : normalizeGitMessage(result.message)
      this.addCommandLog(`git branch ${usedForce ? '-D' : '-d'} ${normalized}`, detail, result.ok)
      if (!result.ok) {
        this.error = detail
        return false
      }

      await this.refreshAll()
      return true
    },

    async pushCurrentBranch() {
      if (!this.hasRemote) {
        this.error = '当前仓库没有配置远程仓库，无法推送当前分支。'
        return false
      }
      const result = await this.callGit(`git push -u ${this.currentRemote} HEAD`, (api) => api.git.pushCurrentBranch(this.repoPath, this.currentRemote))
      await this.refreshAll()
      return result?.ok
    },

    async deleteRemoteBranch(remoteBranch) {
      const [remoteName, ...branchParts] = remoteBranch.split('/')
      const branchName = branchParts.join('/')
      if (!remoteName || !branchName) return false

      const confirmed = window.confirm(`确定要删除远程分支 ${remoteBranch} 吗？`)
      if (!confirmed) return false

      const result = await this.callGit(`git push ${remoteName} --delete ${branchName}`, (api) => api.git.deleteRemoteBranch(this.repoPath, remoteName, branchName))
      await this.refreshAll()
      return result?.ok
    },

    async mergeBranch(branchName) {
      if (!branchName || branchName === this.currentBranch) return false
      const confirmed = window.confirm(`确定要将 ${branchName} 合并到当前分支 ${this.currentBranch} 吗？`)
      if (!confirmed) return false

      const result = await this.callGit(`git merge ${branchName}`, (api) => api.git.mergeBranch(this.repoPath, branchName))
      await this.refreshAll()
      return result?.ok
    },

    async rebaseBranch(branchName) {
      if (!branchName || branchName === this.currentBranch) return false
      const confirmed = window.confirm(`确定要将当前分支 ${this.currentBranch} 变基到 ${branchName} 上吗？`)
      if (!confirmed) return false

      const result = await this.callGit(`git rebase ${branchName}`, (api) => api.git.rebaseBranch(this.repoPath, branchName))
      await this.refreshAll()
      return result?.ok
    },

    async showDiff(file, staged = false) {
      this.selectedFile = file
      this.selectedDiffStaged = staged
      await this.callGit(staged ? `git diff --cached ${file.path}` : `git diff ${file.path}`, async (api) => {
        const result = await api.git.diff(this.repoPath, file.path, staged)
        if (result.ok) this.diff = result.data || '这个文件当前没有可显示的 diff。'
        return result
      })
    },

    async stage(file) {
      await this.callGit(`git add ${file.path}`, (api) => api.git.stage(this.repoPath, file.path))
      await this.afterMutation(file)
    },

    async stageAll() {
      const result = await this.callGit('git add .', (api) => api.git.stageAll(this.repoPath))
      await this.afterBulkMutation(result?.ok)
    },

    async unstage(file) {
      await this.callGit(`git restore --staged ${file.path}`, (api) => api.git.unstage(this.repoPath, file.path))
      await this.afterMutation(file)
    },

    async unstageAll() {
      const result = await this.callGit('git restore --staged .', (api) => api.git.unstageAll(this.repoPath))
      await this.afterBulkMutation(result?.ok)
    },

    async commit(message) {
      if (!message.trim()) {
        this.error = '提交信息不能为空。'
        return false
      }

      if (!this.canCommit) {
        this.error = '没有可提交的已暂存变更。'
        return false
      }

      const result = await this.callGit('git commit', (api) => api.git.commit(this.repoPath, message.trim()))
      await this.refreshAll()
      return result?.ok
    },

    async pull() {
      if (!this.hasRemote) {
        this.error = '当前仓库没有配置远程仓库，无法拉取。'
        return false
      }
      await this.callGit('git pull', (api) => api.git.pull(this.repoPath))
      await this.refreshAll()
      return true
    },

    async push() {
      if (!this.hasRemote) {
        this.error = '当前仓库没有配置远程仓库，无法推送。'
        return false
      }
      await this.callGit('git push', (api) => api.git.push(this.repoPath))
      await this.refreshAll()
      return true
    },

    async selectCommit(commit) {
      this.selectedCommit = commit
      await this.callGit(`git show ${commit.hash}`, async (api) => {
        const result = await api.git.showCommit(this.repoPath, commit.hash)
        if (result.ok) this.commitDetail = result.data
        return result
      })
    },

    async revertCommit(commit) {
      const confirmed = window.confirm(`确定要回退提交 ${commit.hash.slice(0, 7)} 吗？\n这会创建一条新的反向提交，不会删除历史。`)
      if (!confirmed) return false

      const result = await this.callGit(`git revert ${commit.hash}`, (api) => api.git.revertCommit(this.repoPath, commit.hash))
      if (result?.ok) {
        await this.refreshAll()
        await this.selectCommit(commit)
      }
      return result?.ok
    },

    async hardResetToCommit(commit) {
      const confirmed = window.confirm(`确定要硬回退到 ${commit.hash.slice(0, 7)} 吗？\n这会直接丢弃当前工作区修改，并移动当前分支指针。`)
      if (!confirmed) return false

      const forceConfirm = window.confirm('再次确认：执行 git reset --hard 后，未提交修改将被永久丢弃。是否继续？')
      if (!forceConfirm) return false

      const result = await this.callGit(`git reset --hard ${commit.hash}`, (api) => api.git.hardResetToCommit(this.repoPath, commit.hash))
      if (result?.ok) {
        await this.refreshAll()
        await this.selectCommit(commit)
      }
      return result?.ok
    },

    async afterMutation(file) {
      await this.refreshStatus()
      if (file) await this.showDiff(file, this.selectedDiffStaged)
    },

    async afterBulkMutation(ok) {
      if (ok) {
        this.selectedFile = null
        this.diff = ''
      }
      await this.refreshStatus()
    },

    async callGit(label, operation) {
      this.loading = true
      this.error = ''

      try {
        const result = await operation(ensureDesktopApi())
        const detail = result.ok ? '成功' : normalizeGitMessage(result.message)
        this.addCommandLog(label, detail, result.ok)
        if (!result.ok) this.error = detail
        return result.ok ? result : { ...result, message: detail }
      } catch (error) {
        const detail = normalizeGitMessage(error.message)
        this.error = detail
        this.addCommandLog(label, detail, false)
        return { ok: false, message: detail }
      } finally {
        this.loading = false
      }
    },

    addCommandLog(command, detail, ok) {
      this.commandLog.unshift({
        id: crypto.randomUUID(),
        command,
        detail,
        ok,
        time: new Date().toLocaleTimeString()
      })
      this.commandLog = this.commandLog.slice(0, 40)
    }
  }
})

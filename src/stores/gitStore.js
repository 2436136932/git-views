import { defineStore } from 'pinia'
import { useRecentStore } from './recentStore.js'

function ensureDesktopApi() {
  if (!window.desktopApi) {
    throw new Error('Desktop API 不可用。请通过 Electron 启动应用。')
  }
  return window.desktopApi
}

function normalizeGitMessage(message) {
  if (!message) return 'Git 操作失败。'
  if (message.includes('is already used by worktree')) {
    return '该分支已被其他 worktree 占用，当前仓库不能直接切换到它。'
  }
  return message
}

export const useGitStore = defineStore('git', {
  state: () => ({
    repoPath: '',
    status: null,
    gitState: null,
    branches: [],
    remoteBranches: [],
    remoteLog: [],
    selectedRemoteBranch: '',
    selectedRemoteCommit: null,
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
    commandLog: [],
    githubInfo: null,
    githubLoading: false,
    githubError: '',
    successMessage: ''
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
    gitStateSummary(state) {
      const parts = []
      if (state.gitState?.mergeInProgress) parts.push('合并中')
      if (state.gitState?.rebaseInProgress) parts.push('变基中')
      if (state.gitState?.cherryPickInProgress) parts.push('cherry-pick 中')
      if ((state.gitState?.conflicts || []).length > 0) parts.push(`冲突 ${state.gitState.conflicts.length} 个`) 
      return parts.length > 0 ? parts.join(' · ') : '无进行中的 Git 操作'
    },
    gitStateType(state) {
      if (state.gitState?.mergeInProgress) return 'merge'
      if (state.gitState?.rebaseInProgress) return 'rebase'
      if (state.gitState?.cherryPickInProgress) return 'cherry-pick'
      if ((state.gitState?.conflicts || []).length > 0) return 'conflicts'
      return 'idle'
    },
    gitStateDetail(state) {
      const parts = []
      if (state.gitState?.mergeInProgress) parts.push('当前正在执行 merge。')
      if (state.gitState?.rebaseInProgress) parts.push('当前正在执行 rebase。')
      if (state.gitState?.cherryPickInProgress) parts.push('当前正在执行 cherry-pick。')
      if ((state.gitState?.conflicts || []).length > 0) parts.push(`有 ${state.gitState.conflicts.length} 个冲突文件需要处理。`)
      return parts.join(' ')
    },
    gitStateNextStep(state) {
      if (state.gitState?.conflicts?.length > 0) {
        return '先打开冲突文件，手动解决冲突并保存，然后继续当前操作。'
      }
      if (state.gitState?.rebaseInProgress) {
        return '如果已解决冲突，点击“继续 rebase”；如果要放弃本次变基，点击“中止 rebase”。'
      }
      if (state.gitState?.mergeInProgress) {
        return '如果已解决冲突，继续提交合并结果；如果要放弃本次合并，点击“中止 merge”。'
      }
      if (state.gitState?.cherryPickInProgress) {
        return '如果已解决冲突，点击“继续 cherry-pick”；如果要放弃本次操作，点击“中止 cherry-pick”。'
      }
      return '当前没有阻塞性 Git 操作，可以继续正常提交、拉取、推送或切换分支。'
    },
    hasGitStateIssue(state) {
      return Boolean(
        state.gitState?.mergeInProgress ||
        state.gitState?.rebaseInProgress ||
        state.gitState?.cherryPickInProgress ||
        (state.gitState?.conflicts || []).length > 0
      )
    },
    hasBlockingGitOperation(state) {
      return Boolean(state.gitState?.mergeInProgress || state.gitState?.rebaseInProgress || state.gitState?.cherryPickInProgress)
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
    async initRepo() {
      const wasLoading = this.loading
      if (!wasLoading) this.loading = true
      this.error = ''

      try {
        const api = ensureDesktopApi()
        const path = await api.selectRepo()
        if (!path) return false

        const initResult = await api.git.init(path)
        if (!initResult.ok) {
          this.error = initResult.message || '初始化 Git 仓库失败'
          this.addCommandLog('git init', initResult.message || '失败', false)
          return false
        }

        this.addCommandLog('git init', path, true)
        await this.openRepo(path)
        this.successMessage = '仓库初始化成功'
        this.clearSuccessAfter()
        return true
      } catch (error) {
        this.error = error.message
        this.addCommandLog('git init', error.message, false)
        return false
      } finally {
        if (!wasLoading) this.loading = false
      }
    },

    async addRemote(name, url) {
      if (!name.trim() || !url.trim()) {
        this.error = '远程仓库名称和 URL 不能为空。'
        return false
      }

      const trimmedName = name.trim()
      const trimmedUrl = url.trim()

      // 先尝试添加 — 如果 remote 已存在则自动改为更新 URL
      const result = await this.callGit('git remote add', (api) => api.git.addRemote(this.repoPath, trimmedName, trimmedUrl))

      if (!result?.ok && result?.message?.includes('already exists')) {
        const updateResult = await this.callGit('git remote set-url', (api) => api.git.setRemoteUrl(this.repoPath, trimmedName, trimmedUrl))
        if (updateResult?.ok) {
          this.successMessage = '远程仓库 URL 已更新'
          this.clearSuccessAfter()
          await this.refreshAll()
        }
        return updateResult?.ok
      }

      if (result?.ok) {
        this.successMessage = '远程仓库已连接'
        this.clearSuccessAfter()
        await this.refreshAll()
      }
      return result?.ok
    },

    async selectRepo() {
      const wasLoading = this.loading
      if (!wasLoading) this.loading = true
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
        if (!wasLoading) this.loading = false
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
      this.gitState = null
      this.githubInfo = null
      this.githubError = ''
      this.selectedFile = null
      this.diff = ''
      this.selectedCommit = null
      this.selectedRemoteCommit = null
      this.commitDetail = null
      this.addCommandLog('打开仓库', path, true)
      await this.refreshAll()
      this.recordRecent(path)
      return true
    },

    async continueRebase() {
      const result = await this.callGit('git rebase --continue', (api) => api.git.continueRebase(this.repoPath))
      if (result?.ok) await this.refreshAll()
      return result?.ok
    },

    async abortRebase() {
      const confirmed = window.confirm("确定要中止 rebase 吗？当前变基进度会丢失，分支会恢复到变基前的状态。")
      if (!confirmed) return false
      const result = await this.callGit('git rebase --abort', (api) => api.git.abortRebase(this.repoPath))
      if (result?.ok) await this.refreshAll()
      return result?.ok
    },

    async abortMerge() {
      const confirmed = window.confirm("确定要中止 merge 吗？合并进度会丢失，分支会恢复到合并前的状态。")
      if (!confirmed) return false
      const result = await this.callGit('git merge --abort', (api) => api.git.abortMerge(this.repoPath))
      if (result?.ok) await this.refreshAll()
      return result?.ok
    },

    async continueCherryPick() {
      const result = await this.callGit('git cherry-pick --continue', (api) => api.git.continueCherryPick(this.repoPath))
      if (result?.ok) await this.refreshAll()
      return result?.ok
    },

    async abortCherryPick() {
      const confirmed = window.confirm("确定要中止 cherry-pick 吗？当前 cherry-pick 进度会丢失。")
      if (!confirmed) return false
      const result = await this.callGit('git cherry-pick --abort', (api) => api.git.abortCherryPick(this.repoPath))
      if (result?.ok) await this.refreshAll()
      return result?.ok
    },

    closeRepo() {
      this.repoPath = ''
      this.status = null
      this.gitState = null
      this.branches = []
      this.remoteBranches = []
      this.remoteLog = []
      this.selectedRemoteBranch = ''
      this.selectedRemoteCommit = null
      this.currentBranch = ''
      this.hasRemote = false
      this.log = []
      this.selectedFile = null
      this.diff = ''
      this.selectedCommit = null
      this.commitDetail = null
      this.githubInfo = null
      this.githubError = ''
      this.error = ''
      this.successMessage = ''
      this.commandLog = []
    },

    closeRepo() {
      this.repoPath = ''
      this.status = null
      this.gitState = null
      this.branches = []
      this.remoteBranches = []
      this.remoteLog = []
      this.selectedRemoteBranch = ''
      this.selectedRemoteCommit = null
      this.currentBranch = ''
      this.hasRemote = false
      this.log = []
      this.selectedFile = null
      this.diff = ''
      this.selectedCommit = null
      this.commitDetail = null
      this.githubInfo = null
      this.githubError = ''
      this.error = ''
      this.successMessage = ''
      this.commandLog = []
    },

    recordRecent(path) {
      try {
        useRecentStore().addRecent(path, this.currentBranch)
      } catch(e) {}
    },

    async openExternalPath(targetPath) {
      const result = await ensureDesktopApi().openPath(targetPath)
      const detail = result?.ok ? targetPath : normalizeGitMessage(result?.message)
      this.addCommandLog('打开目录', detail, Boolean(result?.ok))
      if (!result?.ok) this.error = detail
      return Boolean(result?.ok)
    },

    async switchToWorktree(targetPath) {
      const wasLoading = this.loading
      if (!wasLoading) this.loading = true
      this.error = ''
      try {
        return await this.openRepo(targetPath)
      } catch (error) {
        this.error = error.message
        this.addCommandLog('切换到 worktree', error.message, false)
        return false
      } finally {
        if (!wasLoading) this.loading = false
      }
    },

    async refreshAll() {
      const wasLoading = this.loading
      if (!wasLoading) this.loading = true
      try {
        await Promise.all([
          this.refreshStatus(),
          this.refreshState(),
          this.refreshLog(),
          this.refreshBranches(),
          this.refreshRemoteBranches(),
          this.refreshRemotes(),
          this.refreshWorktrees(),
          this.refreshGitHubInfo()
        ])
      } finally {
        // 后处理：空仓库时 git branch 不返回分支，用 status 补充
        if (!this.currentBranch && this.status?.current) {
          this.currentBranch = this.status.current
          if (!this.branches.includes(this.currentBranch)) {
            this.branches = [this.currentBranch, ...this.branches]
          }
        }
        if (!wasLoading) this.loading = false
      }
    },

    async refreshStatus() {
      if (!this.repoPath) return
      await this.callGit('git status', async (api) => {
        const result = await api.git.status(this.repoPath)
        if (result.ok) this.status = result.data
        return result
      })
    },

    async refreshState() {
      if (!this.repoPath) return
      await this.callGit('git state', async (api) => {
        const result = await api.git.state(this.repoPath)
        if (result.ok) this.gitState = result.data
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
      // 刚 init 的空仓库没有提交记录，这不是错误
      if (this.error?.includes('does not have any commits yet')) {
        this.error = ''
        this.log = []
      }
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
        if (result.ok) {
          this.remoteBranches = result.data || []
          if (!this.remoteBranches.includes(this.selectedRemoteBranch)) {
            this.selectedRemoteBranch = this.remoteBranches[0] || ''
            this.remoteLog = []
            this.selectedRemoteCommit = null
          }
        }
        return result
      })
    },

    async loadRemoteLog(remoteBranch = this.selectedRemoteBranch) {
      if (!this.repoPath || !remoteBranch) {
        this.remoteLog = []
        this.selectedRemoteBranch = remoteBranch || ''
        this.selectedRemoteCommit = null
        return false
      }

      this.selectedRemoteBranch = remoteBranch
      const result = await this.callGit(`git log ${remoteBranch}`, async (api) => {
        const response = await api.git.remoteLog(this.repoPath, remoteBranch)
        if (response.ok) {
          this.remoteLog = response.data?.all || []
          if (!this.remoteLog.some((commit) => commit.hash === this.selectedRemoteCommit?.hash)) {
            this.selectedRemoteCommit = null
          }
        }
        return response
      })

      return result?.ok
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

    async refreshGitHubInfo() {
      if (!this.repoPath) return
      this.githubLoading = true
      this.githubError = ''
      try {
        const api = ensureDesktopApi()
        const remotes = await api.git.remotes(this.repoPath)
        if (remotes.ok && remotes.data?.length > 0) {
          const remoteUrl = remotes.data[0].refs?.fetch || ''
          const result = await api.github.info(remoteUrl)
          if (result.ok) {
            this.githubInfo = result.data
          } else {
            this.githubInfo = null
            this.githubError = result.message
          }
        } else {
          this.githubInfo = null
        }
      } catch (error) {
        this.githubInfo = null
        this.githubError = error.message || '获取 GitHub 信息失败'
      } finally {
        this.githubLoading = false
      }
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

      if (this.branches.includes(normalized)) {
        this.error = `分支 ${normalized} 已存在。`
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

      const confirmed = window.confirm(`确定要删除本地分支 ${normalized} 吗？此操作不可撤销。`)
      if (!confirmed) {
        this.error = '已取消删除分支。本地分支已保留。'
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
      if (result?.ok) {
        const summary = this.formatPushSummary(result.data)
        this.successMessage = `推送${summary}`
        this.clearSuccessAfter()
      }
      await this.refreshAll()
      return result?.ok
    },

    async deleteRemoteBranch(remoteBranch) {
      const [remoteName, ...branchParts] = remoteBranch.split('/')
      const branchName = branchParts.join('/')
      if (!remoteName || !branchName) return false

      const confirmed = window.confirm(`确定要删除远程分支 ${remoteBranch} 吗？此操作不可撤销且会影响其他协作者。`)
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
      const savedError = this.error
      await this.refreshAll()
      if (savedError) this.error = savedError
      return result?.ok
    },

    async rebaseBranch(branchName) {
      if (!branchName || branchName === this.currentBranch) return false
      const confirmed = window.confirm(`确定要将当前分支 ${this.currentBranch} 变基到 ${branchName} 上吗？`)
      if (!confirmed) return false

      const result = await this.callGit(`git rebase ${branchName}`, (api) => api.git.rebaseBranch(this.repoPath, branchName))
      const savedError = this.error
      await this.refreshAll()
      if (savedError) this.error = savedError
      return result?.ok
    },

    async showDiff(file, staged = false) {
      this.selectedFile = file
      this.selectedDiffStaged = staged
      await this.callGit(staged ? `git diff --cached ${file.path}` : `git diff ${file.path}`, async (api) => {
        const result = await api.git.diff(this.repoPath, file.path, staged)
        if (result.ok) {
          // Binary file detection
          if (result.data && /^Binary files/i.test(result.data)) {
            this.diff = '这是二进制文件，无法显示文本 diff。\n文件: ' + file.path + '\n请使用外部工具查看或编辑此文件。'
            return result
          }
          // 未跟踪的新文件没有 diff，改为读取文件内容作为预览
          if (!result.data && file.index === '?') {
            try {
              const raw = await api.git.readFile(this.repoPath, file.path)
              if (raw.ok) {
                this.diff = '📄 未跟踪文件 — 内容预览：\n\n' + raw.data
              } else {
                this.diff = '无法读取文件内容（可能为二进制文件）'
              }
            } catch {
              this.diff = '无法读取文件内容'
            }
          } else {
            this.diff = result.data || '这个文件当前没有可显示的 diff。'
          }
        }
        return result
      })
    },

    async showConflictFile(filePath) {
      this.selectedFile = { path: filePath, index: 'U', workingDir: 'U' }
      this.selectedDiffStaged = false
      await this.showDiff(this.selectedFile, false)
    },

    async stage(file) {
      await this.callGit(`git add ${file.path}`, (api) => api.git.stage(this.repoPath, file.path))
      await this.afterMutation(file, true)
    },

    async stageAll() {
      const result = await this.callGit('git add .', (api) => api.git.stageAll(this.repoPath))
      await this.afterBulkMutation(result?.ok)
    },

    async unstage(file) {
      await this.callGit(`git restore --staged ${file.path}`, (api) => api.git.unstage(this.repoPath, file.path))
      await this.afterMutation(file, false)
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
      const result = await this.callGit('git pull', (api) => api.git.pull(this.repoPath))
      const savedError = this.error
      if (result?.ok) {
        const summary = this.formatPullSummary(result.data)
        this.successMessage = `拉取${summary}`
        this.clearSuccessAfter()
      }
      await this.refreshAll()
      if (savedError) this.error = savedError
      return result?.ok ?? false
    },

    async push() {
      if (!this.hasRemote) {
        this.error = '当前仓库没有配置远程仓库，无法推送。'
        return false
      }
      const result = await this.callGit('git push', (api) => api.git.pushCurrentBranch(this.repoPath, this.currentRemote))
      const savedError = this.error
      if (result?.ok) {
        const summary = formatPushSummary(result.data)
        this.successMessage = `推送${summary}`
        this.clearSuccessAfter()
      }
      await this.refreshAll()
      if (savedError) this.error = savedError
      return result?.ok ?? false
    },

    async selectCommit(commit) {
      this.selectedCommit = commit
      await this.callGit(`git show ${commit.hash}`, async (api) => {
        const result = await api.git.showCommit(this.repoPath, commit.hash)
        if (result.ok) this.commitDetail = result.data
        return result
      })
    },

    async selectRemoteCommit(commit) {
      this.selectedRemoteCommit = commit
      this.selectedCommit = commit
      await this.callGit(`git show ${commit.hash}`, async (api) => {
        const result = await api.git.showCommit(this.repoPath, commit.hash)
        if (result.ok) this.commitDetail = result.data
        return result
      })
    },

    async revertCommit(commit) {
      const confirmed = window.confirm(`确定要回退提交 ${commit.hash.slice(0, 7)} 吗？\n这会创建一个新的反向提交，不会删除历史。`)
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

    async afterMutation(file, stagedForDiff) {
      await this.refreshStatus()
      if (file) await this.showDiff(file, stagedForDiff ?? this.selectedDiffStaged)
    },

    async afterBulkMutation(ok) {
      if (ok) {
        this.selectedFile = null
        this.diff = ''
      }
      await this.refreshStatus()
    },

    formatPullSummary(data) {
      if (!data?.summary) return '完成'
      const s = data.summary
      if (s.changes === 0) return '完成：已是最新'
      const parts = [`${s.changes} 个文件变更`]
      if (s.insertions > 0) parts.push(`+${s.insertions}`)
      if (s.deletions > 0) parts.push(`-${s.deletions}`)
      return '成功：' + parts.join('，')
    },

    formatPushSummary(data) {
      if (!data?.pushed || data.pushed.length === 0) return '完成：已是最新'
      const pushed = data.pushed.filter(p => !p.alreadyUpdated)
      if (pushed.length === 0) return '完成：已是最新'
      const refs = pushed.map(p => p.branch || p.local).filter(Boolean)
      return `成功：已推送 ${refs.join(', ')} 到 ${this.currentRemote}`
    },

    async callGit(label, operation) {
      const wasLoading = this.loading
      if (!wasLoading) this.loading = true
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
        if (!wasLoading) this.loading = false
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
    },

    clearSuccessAfter(delay = 3000) {
      setTimeout(() => {
        this.successMessage = ''
      }, delay)
    }
  }
})

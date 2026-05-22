import { defineStore } from 'pinia'

function ensureDesktopApi() {
  if (!window.desktopApi) {
    throw new Error('Desktop API 不可用。请通过 Electron 启动应用。')
  }
  return window.desktopApi
}

export const useGitStore = defineStore('git', {
  state: () => ({
    repoPath: '',
    status: null,
    log: [],
    selectedFile: null,
    selectedDiffStaged: false,
    diff: '',
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
    }
  },

  actions: {
    async selectRepo() {
      const api = ensureDesktopApi()
      const path = await api.selectRepo()
      if (!path) return

      const repoCheck = await api.git.isRepo(path)
      if (!repoCheck.ok || !repoCheck.data) {
        this.error = '选择的目录不是 Git 仓库。'
        return
      }

      this.repoPath = path
      this.selectedFile = null
      this.diff = ''
      this.addCommandLog('打开仓库', path, true)
      await this.refreshAll()
    },

    async refreshAll() {
      await Promise.all([this.refreshStatus(), this.refreshLog()])
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

    async unstage(file) {
      await this.callGit(`git restore --staged ${file.path}`, (api) => api.git.unstage(this.repoPath, file.path))
      await this.afterMutation(file)
    },

    async commit(message) {
      if (!message.trim()) {
        this.error = '提交信息不能为空。'
        return false
      }

      const result = await this.callGit('git commit', (api) => api.git.commit(this.repoPath, message.trim()))
      await this.refreshAll()
      return result?.ok
    },

    async pull() {
      await this.callGit('git pull', (api) => api.git.pull(this.repoPath))
      await this.refreshAll()
    },

    async push() {
      await this.callGit('git push', (api) => api.git.push(this.repoPath))
      await this.refreshAll()
    },

    async afterMutation(file) {
      await this.refreshStatus()
      if (file) await this.showDiff(file, this.selectedDiffStaged)
    },

    async callGit(label, operation) {
      this.loading = true
      this.error = ''

      try {
        const result = await operation(ensureDesktopApi())
        this.addCommandLog(label, result.ok ? '成功' : result.message, result.ok)
        if (!result.ok) this.error = result.message
        return result
      } catch (error) {
        this.error = error.message
        this.addCommandLog(label, error.message, false)
        return { ok: false, message: error.message }
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

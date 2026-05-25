import { defineStore } from 'pinia'

const STORAGE_KEY = 'git-views-recent'
const MAX_RECENT = 10

function loadRecent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecent(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // silent
  }
}

export const useRecentStore = defineStore('recent', {
  state: () => ({
    repos: loadRecent()
  }),

  actions: {
    addRecent(path, branch = '') {
      const now = Date.now()
      this.repos = this.repos.filter((r) => r.path !== path)
      const name = path.split(/[\\/]/).pop() || path
      this.repos.unshift({ path, name, branch, openedAt: now })
      if (this.repos.length > MAX_RECENT) {
        this.repos = this.repos.slice(0, MAX_RECENT)
      }
      saveRecent(this.repos)
    },

    removeRecent(path) {
      this.repos = this.repos.filter((r) => r.path !== path)
      saveRecent(this.repos)
    },

    updateBranch(path, branch) {
      const entry = this.repos.find((r) => r.path === path)
      if (entry) {
        entry.branch = branch
        entry.openedAt = Date.now()
        saveRecent(this.repos)
      }
    },

    clearAll() {
      this.repos = []
      saveRecent(this.repos)
    }
  }
})
